"""Export the synthetic training corpus to JSONL for inspection.

This is a *data-generation* utility (pure numpy via the simulator) — NOT model
training. It writes the exact same 3,000-student dataset the Colab notebook
regenerates from `seed=42`, so you can open and eyeball the data the DKT trains
on. Run:

    python -m app.ml.export_dataset
"""
from __future__ import annotations

import json
from pathlib import Path

from app.ml.simulator import simulate_dataset

_DATA_DIR = Path(__file__).parent / "data"
_FULL = _DATA_DIR / "training_data.jsonl"
_SAMPLE = _DATA_DIR / "training_data_sample.jsonl"


def _student_to_json(index: int, sequence) -> dict:
    return {
        "student": index,
        "interactions": [
            {"skill": it.skill, "correct": it.correct,
             "focus": it.focus, "tracked": it.tracked}
            for it in sequence
        ],
    }


def export(n_students: int = 3000, seed: int = 42) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    dataset = simulate_dataset(n_students, seed=seed)

    with _FULL.open("w", encoding="utf-8") as f:
        for i, seq in enumerate(dataset):
            f.write(json.dumps(_student_to_json(i, seq)) + "\n")

    with _SAMPLE.open("w", encoding="utf-8") as f:
        for i, seq in enumerate(dataset[:5]):
            f.write(json.dumps(_student_to_json(i, seq)) + "\n")

    total = sum(len(s) for s in dataset)
    print(f"Wrote {len(dataset)} students, {total} interactions")
    print(f"  full   -> {_FULL}")
    print(f"  sample -> {_SAMPLE} (first 5 students)")


if __name__ == "__main__":
    export()
