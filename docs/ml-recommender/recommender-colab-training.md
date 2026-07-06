# EduFX Recommender — Full Model Training in Google Colab

This is a **self-contained training notebook in markdown form** for the *complete*
EduFX recommender. Paste each cell into a fresh Google Colab notebook, top to
bottom, and run. You will train **both** knowledge-tracing models — the classic
**BKT** baseline and the deep **DKT** model — compare them head-to-head, and
download the artifacts the backend loads.

Nothing needs to be uploaded from the repo — every cell is complete on its own.
The model architectures match `server/app/ml/bkt.py` and `server/app/ml/dkt.py`
exactly, so the artifacts you export load and run in the FastAPI backend
unchanged.

---

## What you're training and why

EduFX's backend currently recommends the next subtopic with a hand-tuned rule
(`days_since_studied × level_multiplier`). It works, but it can't *learn* from
data, can't tell that mastering **G1 thermal stability** makes **G2 thermal
stability** easier, and treats a quiz passed while distracted the same as one
passed while focused.

**Knowledge Tracing (KT)** is the standard ML framing for "what should this
student study next": from a student's history of `(subtopic, correct/incorrect,
focus)` interactions, estimate the probability they've mastered each subtopic,
then recommend from those estimates. You'll build two KT models:

| Model | What it is | Strength |
|---|---|---|
| **BKT** | One 2-state Hidden Markov Model per subtopic, 4 interpretable params, fit with Expectation-Maximization (pure numpy) | Fully explainable baseline |
| **DKT** | One shared LSTM across all subtopics (PyTorch) | Learns cross-topic transfer BKT can't |

Building the classic baseline *and* the deep model, then measuring which wins, is
the strongest possible story — you demonstrate you understand the fundamentals
and the deep model, with numbers to back it.

**Why Colab / no GPU needed:** you're doing this hands-on to learn. Both models
are tiny — BKT is instant, DKT is ~23k parameters and trains on Colab's CPU in
about a minute.

---

## Notebook name and runtime

Recommended notebook name (File → Rename in Colab):

`EduFX_Recommender_Guide_BKT_DKT`

Runtime: **CPU only** is enough (Runtime → Change runtime type → CPU). A GPU is
not required — DKT trains in under a minute either way.

---

## Cell 1 — Install

**What & why.** Three libraries only. `torch` builds and trains the LSTM (DKT).
`numpy` handles arrays, all of BKT, and the CPU inference the server uses.
`scikit-learn` gives us `roc_auc_score` for the comparison. `torch` is a
**training-only** dependency — the EduFX backend never imports it (BKT is numpy;
DKT is served from exported numpy weights).

```python
!pip -q install torch numpy scikit-learn
print("installed")
```

---

## Cell 2 — Config & the skill map

**What & why.** Our "skills" are the 10 S-block subtopics. The **prerequisite
graph** encodes which subtopics build on which — e.g. skill 7 (G2 thermal
stability) depends on skill 6 (G2 reactions) and is *primed* by skill 2 (G1
thermal stability, which teaches the same "polarizing power" idea). This
cross-topic structure is what the deep model (DKT) learns to exploit and what BKT
and the old flat heuristic are blind to.

```python
import numpy as np

NUM_SKILLS = 10
SKILL_LABELS = {
    0: "G1 · Group trends", 1: "G1 · Reactions",     2: "G1 · Thermal stability",
    3: "G1 · Solubility",   4: "G1 · Flame tests",
    5: "G2 · Group trends", 6: "G2 · Reactions",     7: "G2 · Thermal stability",
    8: "G2 · Solubility",   9: "G2 · Flame tests",
}

# skill -> list of (prerequisite_skill, strength 0..1)
# strength >= 0.6 = hard prerequisite (gates recommendation);
# weaker links = cross-group "priming" (a learning boost, not a blocker).
PREREQUISITES = {
    0: [],                    1: [(0, 1.0)],           2: [(1, 1.0)],
    3: [(1, 1.0)],            4: [(1, 1.0)],
    5: [(0, 0.4)],            6: [(5, 1.0), (1, 0.4)], 7: [(6, 1.0), (2, 0.4)],
    8: [(6, 1.0), (3, 0.4)],  9: [(6, 1.0), (4, 0.4)],
}
print("skills:", NUM_SKILLS)
```

---

## Cell 3 — The student simulator (synthetic training data)

**What & why.** Deep KT needs *thousands* of student histories; EduFX doesn't
have that many real students yet. So we hand-write a small **generative model of
learning** and sample virtual students — a standard, legitimate way to prototype
(and a great way to understand what the models must recover).

Three ingredients: (1) each student has a hidden per-skill **ability** (`theta`)
that starts low and grows with practice; (2) **answering** follows a logistic
item-response curve with slip/guess so it behaves like a real 4-option MCQ; (3)
**focus** varies per attempt — low focus hurts the answer and slows learning.
Mastered prerequisites boost effective ability, which is the cross-topic transfer
DKT should discover. We generate **3,000 students (~150k interactions)**.

```python
from dataclasses import dataclass

_DISCRIMINATION = 1.7    # steepness of the correctness curve
_SLIP  = 0.10            # P(wrong | fully mastered)
_GUESS = 0.25            # P(right | no idea) — 4-option MCQ
_LEARN_RATE   = 0.85     # ability gained per focused practice
_PREREQ_BOOST = 0.9      # lift from mastered prerequisites
_START_THETA  = -1.8     # ability floor before practice
_THETA_CEILING = 3.5     # mastery asymptote

def _sigmoid(x): return 1.0 / (1.0 + np.exp(-x))

@dataclass(frozen=True)
class Interaction:
    skill: int
    correct: int
    focus: float     # recorded focus (1.0 if not tracked — see Cell 6)
    tracked: int     # 1 = webcam focus measured, 0 = student skipped tracking

class _SimStudent:
    def __init__(self, rng):
        aptitude = rng.normal(0.0, 0.7)
        self.theta = np.full(NUM_SKILLS, _START_THETA) + aptitude + rng.normal(0, 0.4, NUM_SKILLS)
        self.focus_mean   = float(rng.uniform(0.35, 0.95))
        self.focus_spread = float(rng.uniform(4.0, 10.0))
        self.uses_tracking = rng.random() < 0.7   # ~70% of students keep tracking on
        self._rng = rng

    def sample_focus(self):
        a = self.focus_mean * self.focus_spread
        b = (1 - self.focus_mean) * self.focus_spread
        return float(np.clip(self._rng.beta(a, b), 0.02, 1.0))

    def effective_theta(self, s):
        t = self.theta[s]
        for p, strength in PREREQUISITES.get(s, []):
            t += _PREREQ_BOOST * strength * _sigmoid(self.theta[p])
        return t

    def p_correct(self, s, focus):
        z = _DISCRIMINATION * (self.effective_theta(s) - 0.0)
        base = _GUESS + (1 - _GUESS - _SLIP) * _sigmoid(z)
        distraction = 1.0 - focus
        return float((1 - 0.5 * distraction) * base + 0.5 * distraction * _GUESS)

    def study(self, s, focus):
        headroom = _THETA_CEILING - self.theta[s]
        self.theta[s] += _LEARN_RATE * focus * _sigmoid(headroom)

def _choose_next_skill(st, rng):
    if rng.random() < 0.2:
        return int(rng.integers(NUM_SKILLS))               # exploration
    unlocked = [s for s in range(NUM_SKILLS)
                if all(_sigmoid(st.theta[p]) >= 0.5
                       for p, strg in PREREQUISITES.get(s, []) if strg >= 0.6)]
    if not unlocked:
        unlocked = [0]
    return min(unlocked, key=lambda s: st.theta[s])        # weakest unlocked

def simulate_student(rng, min_len=30, max_len=80):
    st = _SimStudent(rng)
    L = int(rng.integers(min_len, max_len + 1))
    hist = []
    for _ in range(L):
        s = _choose_next_skill(st, rng)
        true_focus = st.sample_focus()          # physically always exists
        correct = int(rng.random() < st.p_correct(s, true_focus))
        st.study(s, true_focus)                 # learning uses the REAL focus
        if st.uses_tracking:
            rec_focus, tracked = round(true_focus, 3), 1
        else:
            rec_focus, tracked = 1.0, 0          # not measured -> neutral / full credit
        hist.append(Interaction(s, correct, rec_focus, tracked))
    return hist

def simulate_dataset(n_students=3000, seed=42, min_len=30, max_len=80):
    rng = np.random.default_rng(seed)
    return [simulate_student(rng, min_len, max_len) for _ in range(n_students)]

data = simulate_dataset(3000, seed=42)
train_data, val_data = data[:2400], data[2400:]   # 80/20 split
_all = [(i.focus, i.correct) for s in data for i in s if i.tracked]
_f = np.array([a for a, _ in _all]); _c = np.array([b for _, b in _all])
print(f"students={len(data)}  interactions={sum(len(s) for s in data)}")
print(f"focus (tracked only): hi={_c[_f>=0.7].mean():.3f} lo={_c[_f<0.4].mean():.3f}")
```

Expected: ~3000 students, ~165k interactions, focus hi≈0.59 vs lo≈0.42 (focus
helps — a signal the models must recover).

---

# PART A — BKT (the classic, interpretable baseline)

## Cell 4 — BKT: model, EM fitting, behaviour-aware inference

**What & why.** For *each skill*, BKT is a 2-state Hidden Markov Model: the hidden
state is "learned" or "not learned", and four parameters describe it —
`L0` (prior known), `T` (learn rate), `S` (slip: wrong despite knowing),
`G` (guess: right despite not knowing). We fit them with **Expectation-
Maximization** (the Baum-Welch forward-backward algorithm). Every number is
interpretable — that's BKT's whole appeal.

**Behaviour-aware:** focus is folded in at *inference*. When updating the mastery
belief after an answer, low focus inflates the effective slip/guess toward 0.5,
so a distracted answer barely moves the belief. A skipped-tracking session
(`focus=1.0`) simply gets no discount — never penalized.

```python
from dataclasses import dataclass as _dc

_MIN_P, _MAX_P = 0.01, 0.99
_MAX_SLIP, _MAX_GUESS = 0.30, 0.40

@_dc
class BKTParams:
    p_L0: float; p_T: float; p_S: float; p_G: float

def _emission(obs, slip, guess):
    if obs == 1:  # correct
        return guess, 1.0 - slip          # P(obs | not-learned), P(obs | learned)
    return 1.0 - guess, slip              # wrong

def _forward_backward(obs, prm):
    T = len(obs)
    pi = np.array([1.0 - prm.p_L0, prm.p_L0])
    A  = np.array([[1.0 - prm.p_T, prm.p_T], [0.0, 1.0]])   # "known" is absorbing
    alpha = np.zeros((T, 2)); scale = np.zeros(T)
    b0, b1 = _emission(int(obs[0]), prm.p_S, prm.p_G)
    alpha[0] = pi * np.array([b0, b1]); scale[0] = alpha[0].sum() or 1e-12; alpha[0] /= scale[0]
    for t in range(1, T):
        b0, b1 = _emission(int(obs[t]), prm.p_S, prm.p_G)
        alpha[t] = (alpha[t-1] @ A) * np.array([b0, b1])
        scale[t] = alpha[t].sum() or 1e-12; alpha[t] /= scale[t]
    beta = np.zeros((T, 2)); beta[-1] = 1.0
    for t in range(T-2, -1, -1):
        b0, b1 = _emission(int(obs[t+1]), prm.p_S, prm.p_G)
        beta[t] = (A @ (np.array([b0, b1]) * beta[t+1])) / scale[t+1]
    gamma = alpha * beta; gamma /= gamma.sum(axis=1, keepdims=True) + 1e-12
    xi = np.zeros(T-1)
    for t in range(T-1):
        b0, b1 = _emission(int(obs[t+1]), prm.p_S, prm.p_G)
        xi[t] = alpha[t, 0] * prm.p_T * b1 * beta[t+1, 1] / (scale[t+1] + 1e-12)
    return gamma, xi

def _fit_skill(sequences, iters=60):
    prm = BKTParams(0.2, 0.15, 0.1, 0.25)
    for _ in range(iters):
        l0n=l0d=tn=td=sn=sd=gn=gd=0.0
        for obs in sequences:
            if len(obs) == 0: continue
            gamma, xi = _forward_backward(obs, prm)
            l0n += gamma[0, 1]; l0d += 1.0
            if len(obs) > 1:
                tn += xi.sum(); td += gamma[:-1, 0].sum()
            wrong = (obs == 0).astype(float); right = (obs == 1).astype(float)
            sn += (gamma[:, 1] * wrong).sum(); sd += gamma[:, 1].sum()
            gn += (gamma[:, 0] * right).sum(); gd += gamma[:, 0].sum()
        prm = BKTParams(
            float(np.clip(l0n/(l0d+1e-12), _MIN_P, _MAX_P)),
            float(np.clip(tn/(td+1e-12),  _MIN_P, _MAX_P)),
            float(np.clip(sn/(sd+1e-12),  _MIN_P, _MAX_SLIP)),
            float(np.clip(gn/(gd+1e-12),  _MIN_P, _MAX_GUESS)))
    return prm

def _focus_adjust(prm, focus):
    d = 1.0 - float(np.clip(focus, 0.0, 1.0))     # distraction
    return prm.p_S + d*(0.5 - prm.p_S), prm.p_G + d*(0.5 - prm.p_G)

class BKTModel:
    def __init__(self, params=None): self.params = params or {}

    @classmethod
    def fit(cls, dataset):
        per_skill = {s: [] for s in range(NUM_SKILLS)}
        for seq in dataset:
            buckets = {s: [] for s in range(NUM_SKILLS)}
            for it in seq: buckets[it.skill].append(it.correct)
            for s, obs in buckets.items():
                if obs: per_skill[s].append(np.array(obs, dtype=np.int64))
        m = cls()
        for s in range(NUM_SKILLS): m.params[s] = _fit_skill(per_skill[s])
        return m

    def belief_after(self, obs, focus, skill):
        """Online forward filter -> P(learned) after this skill's sub-history."""
        p = self.params[skill]; belief = p.p_L0
        for o, f in zip(obs, focus):
            slip, guess = _focus_adjust(p, f)
            lk, lu = (1.0-slip, guess) if o == 1 else (slip, 1.0-guess)
            post = belief*lk / (belief*lk + (1.0-belief)*lu + 1e-12)
            belief = post + (1.0-post)*p.p_T
        return float(belief)

    def predict_mastery(self, history):
        obs = {s: [] for s in range(NUM_SKILLS)}; foc = {s: [] for s in range(NUM_SKILLS)}
        for it in history:
            obs[it.skill].append(it.correct); foc[it.skill].append(it.focus)
        return {s: (self.belief_after(obs[s], foc[s], s) if obs[s] else self.params[s].p_L0)
                for s in range(NUM_SKILLS)}

    def predict_p_correct(self, history):
        m = self.predict_mastery(history)
        return {s: m[s]*(1.0-self.params[s].p_S) + (1.0-m[s])*self.params[s].p_G
                for s in range(NUM_SKILLS)}
```

---

## Cell 5 — Fit BKT and read the parameters

**What & why.** BKT fits in a second (pure numpy, no GPU). Print the learned
parameters — you can defend each one in a viva ("this skill's guess ≈ 0.27, close
to the 0.25 you'd expect from a 4-option MCQ").

```python
bkt = BKTModel.fit(train_data)
print("Fitted BKT parameters per skill:")
for s in range(NUM_SKILLS):
    p = bkt.params[s]
    print(f"  {s} {SKILL_LABELS[s]:<22} L0={p.p_L0:.3f} T={p.p_T:.3f} S={p.p_S:.3f} G={p.p_G:.3f}")

# behaviour-aware sanity check
drill_focused    = [Interaction(4, 1, 0.95, 1) for _ in range(7)]
drill_distracted = [Interaction(4, 1, 0.15, 1) for _ in range(7)]
drill_untracked  = [Interaction(4, 1, 1.00, 0) for _ in range(7)]
print("\nmastery[4]  focused =%.3f  distracted =%.3f  untracked =%.3f (=focused, no penalty)"
      % (bkt.predict_mastery(drill_focused)[4],
         bkt.predict_mastery(drill_distracted)[4],
         bkt.predict_mastery(drill_untracked)[4]))
```

Expected: `L0` low (students start not-knowing), `G ≈ 0.27` (near the 0.25 guess
floor), and focused ≈ distracted-is-lower ≈ untracked-matches-focused.

---

# PART B — DKT (the deep model)

## Cell 6 — Input encoding: behaviour-aware, tracking optional

**What & why.** DKT reads one vector per interaction. The first `2K` slots are the
classic DKT encoding: a one-hot of the skill in the *first* half if correct, the
*second* half if wrong. Then two behaviour slots: `focus` (0–1) and `tracked`
(1 measured, 0 skipped). A skipped session is `focus=1.0, tracked=0` — full
credit, never penalized — and the separate `tracked` bit lets the network tell
"fully focused" apart from "not measured".

```python
INPUT_DIM = 2 * NUM_SKILLS + 2   # 2K one-hot(skill*correct) + focus + tracked

def encode_step(skill, correct, focus, tracked):
    v = np.zeros(INPUT_DIM, dtype=np.float32)
    if correct: v[skill] = 1.0
    else:       v[NUM_SKILLS + skill] = 1.0
    v[2 * NUM_SKILLS]     = float(np.clip(focus, 0.0, 1.0))
    v[2 * NUM_SKILLS + 1] = float(tracked)
    return v

print("input dim:", INPUT_DIM)
```

---

## Cell 7 — The DKT model (PyTorch LSTM)

**What & why.** One shared LSTM reads the sequence; at each step its hidden state
feeds a linear head that outputs one logit per skill → sigmoid →
`P(next answer on that skill is correct)`. Because one network sees all skills, it
learns cross-topic transfer BKT structurally cannot.

```python
import torch
import torch.nn as nn

HIDDEN_DIM = 64

class DKT(nn.Module):
    def __init__(self, input_dim=INPUT_DIM, hidden=HIDDEN_DIM, num_skills=NUM_SKILLS):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden, batch_first=True)
        self.head = nn.Linear(hidden, num_skills)
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out)             # (batch, seq, num_skills) logits

print(DKT())
```

---

## Cell 8 — Train DKT (masked next-step prediction)

**What & why.** Objective: **predict the next answer**. At step *t* the model's
prediction for the skill attempted at *t+1* is scored against the actual result
with binary cross-entropy; we supervise only the attempted skill (gather) and
**mask** padding. Adam optimizes; loss should fall steadily.

```python
def build_tensors(dataset):
    xs, sks, ys = [], [], []
    for seq in dataset:
        if len(seq) < 2: continue
        x  = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        sk = np.array([i.skill   for i in seq[1:]], dtype=np.int64)
        y  = np.array([i.correct for i in seq[1:]], dtype=np.float32)
        xs.append(x); sks.append(sk); ys.append(y)
    maxlen = max(len(x) for x in xs); B = len(xs)
    X  = np.zeros((B, maxlen, INPUT_DIM), np.float32); SK = np.zeros((B, maxlen), np.int64)
    Y  = np.zeros((B, maxlen), np.float32);            M  = np.zeros((B, maxlen), np.float32)
    for i, (x, sk, y) in enumerate(zip(xs, sks, ys)):
        L = len(x); X[i, :L] = x; SK[i, :L] = sk; Y[i, :L] = y; M[i, :L] = 1.0
    return (torch.from_numpy(X), torch.from_numpy(SK), torch.from_numpy(Y), torch.from_numpy(M))

def train_dkt(dataset, epochs=20, batch=32, lr=1e-2, seed=0):
    torch.manual_seed(seed)
    model = DKT(); opt = torch.optim.Adam(model.parameters(), lr=lr)
    bce = nn.BCEWithLogitsLoss(reduction="none")
    X, SK, Y, M = build_tensors(dataset); n = X.shape[0]
    for ep in range(epochs):
        perm = torch.randperm(n); tot = 0.0
        for s in range(0, n, batch):
            idx = perm[s:s+batch]; xb, skb, yb, mb = X[idx], SK[idx], Y[idx], M[idx]
            pred = model(xb).gather(2, skb.unsqueeze(-1)).squeeze(-1)
            loss = (bce(pred, yb) * mb).sum() / mb.sum()
            opt.zero_grad(); loss.backward(); opt.step()
            tot += float(loss) * len(idx)
        print(f"epoch {ep+1:2d}/{epochs}  loss={tot/n:.4f}")
    return model

dkt = train_dkt(train_data)
```

---

# PART C — Compare, then export

## Cell 9 — Evaluate BKT vs DKT vs a baseline (held-out ROC-AUC)

**What & why.** The fair, honest test: on students neither model trained on, how
well does each one's predicted `P(correct)` rank actual correct-vs-wrong answers?
Same protocol for both — at every step predict the next attempt using only the
history so far. **ROC-AUC**: 0.5 = coin flip, 1.0 = perfect. We also include the
trivial "always predict the base rate" majority baseline as a floor. This table
is your viva evidence.

```python
from sklearn.metrics import roc_auc_score

@torch.no_grad()
def dkt_auc(model, dataset):
    yt, yp = [], []
    for seq in dataset:
        if len(seq) < 2: continue
        x = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in seq[:-1]])
        probs = torch.sigmoid(model(torch.from_numpy(x).unsqueeze(0))[0]).numpy()
        for t, nxt in enumerate(seq[1:]):
            yt.append(nxt.correct); yp.append(probs[t, nxt.skill])
    return roc_auc_score(yt, yp), yt

def bkt_auc(model, dataset):
    yt, yp = [], []
    for seq in dataset:
        # online: maintain per-skill belief; predict next BEFORE seeing its answer
        obs = {s: [] for s in range(NUM_SKILLS)}; foc = {s: [] for s in range(NUM_SKILLS)}
        for i, it in enumerate(seq):
            if i > 0:  # predict this step from history so far
                s = it.skill; p = model.params[s]
                belief = model.belief_after(obs[s], foc[s], s) if obs[s] else p.p_L0
                yp.append(belief*(1.0-p.p_S) + (1.0-belief)*p.p_G); yt.append(it.correct)
            obs[it.skill].append(it.correct); foc[it.skill].append(it.focus)
    return roc_auc_score(yt, yp)

dkt_score, yt = dkt_auc(dkt, val_data)
bkt_score = bkt_auc(bkt, val_data)
base_rate = float(np.mean(yt))                       # majority/base-rate floor
print(f"{'Model':<28}{'held-out ROC-AUC'}")
print(f"{'-'*44}")
print(f"{'Base rate (always '+str(round(base_rate,2))+')':<28}0.500")
print(f"{'BKT (classic, interpretable)':<28}{bkt_score:.4f}")
print(f"{'DKT (deep LSTM)':<28}{dkt_score:.4f}")
```

Expect both models comfortably above 0.5, with DKT typically edging out BKT
because it exploits cross-topic transfer. (If they're close, that's a fine
finding too — on a small syllabus BKT is a strong baseline.)

---

## Cell 10 — Export everything, verify numpy parity, download

**What & why.** The EduFX server runs on CPU with **no torch**. BKT is already
pure numpy → save its params as `bkt.json`. For DKT we export the weights to
`dkt.npz` and prove a hand-written numpy LSTM forward pass reproduces PyTorch's
output (the `assert`) — this guards the gate-ordering when the server runs the
model without torch. Then download all four files.

```python
import json

# --- BKT -> bkt.json ---
bkt_payload = {str(s): {"p_L0": p.p_L0, "p_T": p.p_T, "p_S": p.p_S, "p_G": p.p_G}
               for s, p in bkt.params.items()}
json.dump(bkt_payload, open("bkt.json", "w"), indent=2)

# --- DKT -> dkt.npz (+ parity check) ---
def _np_forward(w, seq):
    H = w["W_hh"].shape[1]; h = np.zeros(H, np.float32); c = np.zeros(H, np.float32)
    for i in seq:
        x = encode_step(i.skill, i.correct, i.focus, i.tracked)
        g = w["W_ih"] @ x + w["b_ih"] + w["W_hh"] @ h + w["b_hh"]
        ii = _sigmoid(g[:H]); f = _sigmoid(g[H:2*H]); gg = np.tanh(g[2*H:3*H]); o = _sigmoid(g[3*H:4*H])
        c = f*c + ii*gg; h = o*np.tanh(c)
    return _sigmoid(w["W_out"] @ h + w["b_out"])

sd = dkt.state_dict()
weights = dict(
    W_ih=sd["lstm.weight_ih_l0"].cpu().numpy(), W_hh=sd["lstm.weight_hh_l0"].cpu().numpy(),
    b_ih=sd["lstm.bias_ih_l0"].cpu().numpy(),   b_hh=sd["lstm.bias_hh_l0"].cpu().numpy(),
    W_out=sd["head.weight"].cpu().numpy(),      b_out=sd["head.bias"].cpu().numpy())

sample = val_data[0]
with torch.no_grad():
    xs = np.stack([encode_step(i.skill, i.correct, i.focus, i.tracked) for i in sample])
    torch_last = torch.sigmoid(dkt(torch.from_numpy(xs).unsqueeze(0))[0, -1]).numpy()
assert np.allclose(torch_last, _np_forward(weights, sample), atol=1e-5), "numpy/torch mismatch"
print("DKT parity OK — max diff:", float(np.abs(torch_last - _np_forward(weights, sample)).max()))

np.savez("dkt.npz", **weights)
torch.save(sd, "dkt.pt")
json.dump({"num_skills": NUM_SKILLS, "input_dim": INPUT_DIM, "hidden_dim": HIDDEN_DIM,
           "encoding": "onehot(skill*correct) 2K + focus + tracked"},
          open("dkt_meta.json", "w"), indent=2)

from google.colab import files
for fn in ("bkt.json", "dkt.npz", "dkt.pt", "dkt_meta.json"):
    files.download(fn)
print("done — send these FOUR files back")
```

---

## Cell 11 — Re-download (if you closed the download prompt or lost the files)

**What & why.** Colab's runtime and its files stay alive as long as the tab/
session is connected, even if a browser download got missed or dismissed. Run
this on its own — no retraining — to re-trigger the download of files already
sitting in the Colab file system from Cell 10.

```python
from google.colab import files
import os

for fn in ("bkt.json", "dkt.npz", "dkt.pt", "dkt_meta.json"):
    if os.path.exists(fn):
        files.download(fn)
        print(f"downloaded: {fn}")
    else:
        print(f"missing: {fn} — the runtime was likely disconnected; re-run Cells 1-10")
```

If everything shows `missing`, the Colab runtime was recycled (common after long
idle periods) and the in-memory model is gone — re-run Cells 1–10 to retrain
(still under 2 minutes total) before downloading again.

---

## Hand-off

Send back the four files: **`bkt.json`, `dkt.npz`, `dkt.pt`, `dkt_meta.json`**.
They go into `server/app/ml/artifacts/`; the backend loads `bkt.json` and
`dkt.npz` (both numpy, CPU) — no torch, no GPU, no separate hosting.

---

## FAQ / viva talking points

**Do I need a GPU?** No. BKT is instant numpy; DKT is ~23,000 parameters and
trains on Colab CPU in ~1 minute. Contrast the fine-tuned Qwen quiz model
(7 *billion* params, needs a GPU host) — the recommender is ~300,000× smaller and
runs inside the normal FastAPI backend.

**BKT vs DKT — why both?** BKT is the interpretable baseline: one tiny HMM per
skill, four explainable parameters, fit with EM. DKT is the deep upgrade: one LSTM
across all skills, so it captures cross-topic transfer BKT can't. Training both
and measuring which wins (Cell 9) is a far stronger result than either alone.

**Why synthetic data?** Deep KT needs thousands of sequences; EduFX doesn't have
that many real students yet. The simulator is a standard bootstrap — and once real
logs accumulate, the same pipeline runs on them unchanged.

**What does the recommender do with the models?** They output `P(correct)` per
subtopic. A spaced-repetition policy then schedules *all* subtopics — weak ones
most often, new ones introduced then revisited, strong ones refreshed
occasionally — preferring subtopics whose predicted success sits in the
"Goldilocks zone" (challenging but not frustrating).
