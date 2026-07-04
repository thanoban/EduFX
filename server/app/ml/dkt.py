r"""Deep Knowledge Tracing (DKT) — the deep-learning model.

WHAT DKT IS  (Piech et al., NeurIPS 2015)
-----------------------------------------
Where BKT models each skill with its own tiny HMM, DKT uses a **single LSTM**
over the student's *entire* interaction sequence. At each step it reads what the
student just did and outputs a prediction of how likely they are to get the next
question right — **for every skill at once**.

Because one shared network sees all skills, it can learn *cross-skill*
structure that BKT cannot: e.g. that a student who just mastered G1 thermal
stability is now more likely to succeed on G2 thermal stability (they share the
"polarizing power / charge density" idea). That is the whole reason to reach for
a deep model here.

INPUT / OUTPUT
--------------
At timestep t the network reads a vector describing the interaction that just
happened::

    [ one-hot(skill) if correct | one-hot(skill) if wrong | focus ]
      \_____ NUM_SKILLS ____/     \_____ NUM_SKILLS ____/    \_1_/

plus two behaviour slots (``focus`` and a ``tracked`` flag), so the input
dimension is ``2 * NUM_SKILLS + 2``. Those trailing slots are the
**behaviour-aware** part — the LSTM learns natively how distraction changes what
an answer tells us about mastery, while ``tracked=0`` (webcam skipped, focus
recorded as 1.0) marks "focus unknown, full credit" so opting out is never a
penalty. The output is ``NUM_SKILLS`` sigmoids: the predicted P(correct) for
each skill on the *next* attempt.

TWO HALVES OF THIS FILE
-----------------------
1. ``DKTInference`` — **pure numpy**. Loads exported weights (.npz) and runs the
   LSTM forward pass by hand. This is what the FastAPI server uses, so the
   deployed image needs only numpy — never torch.
2. A torch section (import-guarded) with the ``DKT`` module, ``train_dkt`` and
   ``export_numpy``. Used only when TRAINING (in Colab). Importing this file on a
   torch-free server is fine; the torch bits are just never called.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.ml import NUM_SKILLS
from app.ml.simulator import Interaction

INPUT_DIM = 2 * NUM_SKILLS + 2  # 2K one-hot(skill*correct) + focus + tracked
HIDDEN_DIM = 64

_ARTIFACT_NPZ = Path(__file__).parent / "artifacts" / "dkt.npz"
_ARTIFACT_PT = Path(__file__).parent / "artifacts" / "dkt.pt"


# ---------------------------------------------------------------------------
# Shared input encoding (pure numpy — used by both training and inference)
# ---------------------------------------------------------------------------
def encode_step(skill: int, correct: int, focus: float, tracked: int = 1) -> np.ndarray:
    """Encode one interaction into the 2K+2 input vector (see module docstring).

    Layout: [one-hot(skill) if correct | one-hot(skill) if wrong | focus | tracked].
    ``tracked=0`` (student skipped the webcam) pairs with ``focus=1.0`` so an
    opted-out session reads as full-credit / "focus unknown", never a penalty.
    """
    vec = np.zeros(INPUT_DIM, dtype=np.float32)
    if correct:
        vec[skill] = 1.0
    else:
        vec[NUM_SKILLS + skill] = 1.0
    vec[2 * NUM_SKILLS] = float(np.clip(focus, 0.0, 1.0))
    vec[2 * NUM_SKILLS + 1] = float(tracked)
    return vec


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


# ---------------------------------------------------------------------------
# 1) Pure-numpy inference — what the server runs (no torch dependency)
# ---------------------------------------------------------------------------
class DKTInference:
    """Runs a trained DKT forward pass in numpy from exported weights.

    Mirrors a single-layer PyTorch ``nn.LSTM`` (batch_first) followed by a
    linear head. PyTorch packs the four gates in the order (input, forget,
    cell, output); we unpack and apply the standard LSTM cell equations.
    """

    def __init__(self, weights: dict[str, np.ndarray]) -> None:
        self.W_ih = weights["W_ih"]        # (4H, input)
        self.W_hh = weights["W_hh"]        # (4H, H)
        self.b_ih = weights["b_ih"]        # (4H,)
        self.b_hh = weights["b_hh"]        # (4H,)
        self.W_out = weights["W_out"]      # (K, H)
        self.b_out = weights["b_out"]      # (K,)
        self.hidden = self.W_hh.shape[1]

    def _lstm_final_hidden(self, history: list[Interaction]) -> np.ndarray:
        h = np.zeros(self.hidden, dtype=np.float32)
        c = np.zeros(self.hidden, dtype=np.float32)
        H = self.hidden
        for it in history:
            x = encode_step(it.skill, it.correct, it.focus, getattr(it, "tracked", 1))
            gates = self.W_ih @ x + self.b_ih + self.W_hh @ h + self.b_hh
            i = _sigmoid(gates[0:H])
            f = _sigmoid(gates[H:2 * H])
            g = np.tanh(gates[2 * H:3 * H])
            o = _sigmoid(gates[3 * H:4 * H])
            c = f * c + i * g
            h = o * np.tanh(c)
        return h

    def predict_p_correct(self, history: list[Interaction]) -> dict[int, float]:
        """P(next answer correct) per skill given the full history."""
        h = self._lstm_final_hidden(history)         # final hidden state
        logits = self.W_out @ h + self.b_out         # (K,)
        p = _sigmoid(logits)
        return {skill: float(p[skill]) for skill in range(NUM_SKILLS)}

    def predict_mastery(self, history: list[Interaction]) -> dict[int, float]:
        """DKT has no explicit mastery state; we use P(correct) as the proxy.

        Provided so the recommender can treat BKT and DKT interchangeably.
        """
        return self.predict_p_correct(history)

    # ---- persistence ----------------------------------------------------
    @classmethod
    def load(cls, path: Path = _ARTIFACT_NPZ) -> "DKTInference":
        data = np.load(Path(path))
        return cls({k: data[k] for k in data.files})

    @classmethod
    def is_available(cls, path: Path = _ARTIFACT_NPZ) -> bool:
        return Path(path).exists()


# ---------------------------------------------------------------------------
# 2) Torch training section — used only in Colab (import-guarded)
# ---------------------------------------------------------------------------
def _require_torch():
    try:
        import torch  # noqa: F401
    except ImportError as exc:  # pragma: no cover - only hit without torch
        raise RuntimeError(
            "Training DKT needs PyTorch. Install training deps first:\n"
            "  pip install -r requirements-ml.txt\n"
            "The deployed server does NOT need torch — it uses DKTInference (numpy)."
        ) from exc
    return torch


def build_model():
    """Construct the torch DKT module (call only where torch is installed)."""
    torch = _require_torch()
    import torch.nn as nn

    class DKT(nn.Module):
        def __init__(self, input_dim=INPUT_DIM, hidden_dim=HIDDEN_DIM, num_skills=NUM_SKILLS):
            super().__init__()
            self.lstm = nn.LSTM(input_dim, hidden_dim, batch_first=True)
            self.head = nn.Linear(hidden_dim, num_skills)

        def forward(self, x):
            # x: (batch, seq, input_dim) -> out: (batch, seq, num_skills) logits
            out, _ = self.lstm(x)
            return self.head(out)

    return DKT()


def _build_tensors(dataset: list[list[Interaction]]):
    """Turn Interaction sequences into padded (inputs, target_skill, target_y, mask).

    At timestep t the input describes interaction t; the supervised target is
    interaction t+1's (skill, correct). So a length-L sequence yields L-1
    supervised steps.
    """
    torch = _require_torch()
    seqs_x, seqs_skill, seqs_y = [], [], []
    for seq in dataset:
        if len(seq) < 2:
            continue
        xs = np.stack([encode_step(it.skill, it.correct, it.focus, getattr(it, "tracked", 1)) for it in seq[:-1]])
        nxt_skill = np.array([it.skill for it in seq[1:]], dtype=np.int64)
        nxt_y = np.array([it.correct for it in seq[1:]], dtype=np.float32)
        seqs_x.append(xs)
        seqs_skill.append(nxt_skill)
        seqs_y.append(nxt_y)

    max_len = max(len(x) for x in seqs_x)
    B = len(seqs_x)
    X = np.zeros((B, max_len, INPUT_DIM), dtype=np.float32)
    SK = np.zeros((B, max_len), dtype=np.int64)
    Y = np.zeros((B, max_len), dtype=np.float32)
    M = np.zeros((B, max_len), dtype=np.float32)
    for i, (x, sk, y) in enumerate(zip(seqs_x, seqs_skill, seqs_y)):
        L = len(x)
        X[i, :L] = x
        SK[i, :L] = sk
        Y[i, :L] = y
        M[i, :L] = 1.0
    return (
        torch.from_numpy(X),
        torch.from_numpy(SK),
        torch.from_numpy(Y),
        torch.from_numpy(M),
    )


def train_dkt(
    dataset: list[list[Interaction]],
    epochs: int = 20,
    batch_size: int = 32,
    lr: float = 1e-2,
    seed: int = 0,
    verbose: bool = True,
):
    """Train the DKT LSTM. Run this in Colab, not on the server.

    Returns the trained torch model. Loss is masked binary cross-entropy on the
    predicted probability for the *next* attempted skill at each timestep.
    """
    torch = _require_torch()
    import torch.nn as nn

    torch.manual_seed(seed)
    model = build_model()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    bce = nn.BCEWithLogitsLoss(reduction="none")

    X, SK, Y, M = _build_tensors(dataset)
    n = X.shape[0]

    for epoch in range(epochs):
        perm = torch.randperm(n)
        total = 0.0
        for start in range(0, n, batch_size):
            idx = perm[start:start + batch_size]
            xb, skb, yb, mb = X[idx], SK[idx], Y[idx], M[idx]
            logits = model(xb)                                   # (b, seq, K)
            # gather the logit for the skill actually attempted next
            pred = logits.gather(2, skb.unsqueeze(-1)).squeeze(-1)  # (b, seq)
            loss = bce(pred, yb) * mb                             # mask padding
            loss = loss.sum() / mb.sum()
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += float(loss) * len(idx)
        if verbose:
            print(f"epoch {epoch + 1:2d}/{epochs}  loss={total / n:.4f}")
    return model


def export_numpy(model, path: Path = _ARTIFACT_NPZ) -> None:
    """Export a trained torch DKT to a .npz that DKTInference can load."""
    _require_torch()
    sd = model.state_dict()
    weights = {
        "W_ih": sd["lstm.weight_ih_l0"].cpu().numpy(),
        "W_hh": sd["lstm.weight_hh_l0"].cpu().numpy(),
        "b_ih": sd["lstm.bias_ih_l0"].cpu().numpy(),
        "b_hh": sd["lstm.bias_hh_l0"].cpu().numpy(),
        "W_out": sd["head.weight"].cpu().numpy(),
        "b_out": sd["head.bias"].cpu().numpy(),
    }
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    np.savez(Path(path), **weights)


def save_torch(model, path: Path = _ARTIFACT_PT) -> None:
    """Save the raw torch checkpoint too (optional, for resuming training)."""
    torch = _require_torch()
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), Path(path))


def write_metadata(path: Path | None = None, **extra) -> None:
    """Record the architecture so inference and training never drift apart."""
    meta = {
        "num_skills": NUM_SKILLS,
        "input_dim": INPUT_DIM,
        "hidden_dim": HIDDEN_DIM,
        "encoding": "onehot(skill*correct) 2K + focus + tracked",
        **extra,
    }
    target = path or (Path(__file__).parent / "artifacts" / "dkt_meta.json")
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    Path(target).write_text(json.dumps(meta, indent=2), encoding="utf-8")
