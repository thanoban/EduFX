# EduFX Fine-Tune Results

This file contains the actual measured results from the successful EduFX fine-tune run.

Use this file in the viva when you need to show:

- what environment was used
- what dataset was used
- what model was trained
- what the final losses and metrics were
- what conclusions can and cannot be claimed

---

## 1. Final successful run

Status:

- fine-tuning completed successfully
- adapter was saved and zipped
- no training crash in the final working path

Final working setup:

- platform: Google Cloud Colab Enterprise
- region: `us-central1`
- runtime template: `g2-standard-4`
- GPU: `NVIDIA L4 x1`
- Python: `3.12`
- base model: `Qwen/Qwen2.5-7B-Instruct`
- method: QLoRA
- training stack:
  - `transformers`
  - `peft`
  - `trl`
  - `bitsandbytes`
  - `accelerate`
  - `datasets`

---

## 2. Dataset used in the successful run

Files used:

- [train.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/train.jsonl)
- [val.jsonl](D:/PROJECTS/2ndYearProject/EduFX_MVC/data/finetune/val.jsonl)

Verified dataset counts:

- training records: `5`
- validation records: `1`

Verified output structure per record:

- exactly `15` questions
- exactly `5 easy`
- exactly `5 medium`
- exactly `5 hard`

Current topic scope in the dataset:

- `mixed_inorganic`

Important conclusion:

This dataset is large enough for a pipeline proof, but too small for a strong production-quality claim.

---

## 3. Training configuration summary

Main training settings used in the final successful run:

- epochs: `3`
- per-device train batch size: `1`
- per-device eval batch size: `1`
- gradient accumulation steps: `4`
- learning rate: `2e-4`
- warmup steps: `5`
- max length: `3072`
- packing: `False`
- gradient checkpointing: `True`
- optimizer: `paged_adamw_8bit`
- fp16: `False`
- bf16: `False`
- seed: `42`

---

## 4. Measured training results

Overall summary:

- total runtime: `263 seconds`
- final reported training loss: `1.3884`

Per-epoch values:

| Epoch | Training Loss | Validation Loss | Entropy | Num Tokens | Mean Token Accuracy |
|---|---:|---:|---:|---:|---:|
| 1 | 1.611690 | 1.214605 | 0.760366 | 11753.000000 | 0.742706 |
| 2 | 1.297928 | 1.132317 | 0.830571 | 23506.000000 | 0.751989 |
| 3 | 1.188604 | 1.047082 | 0.954509 | 35259.000000 | 0.759947 |

---

## 5. Interpretation of the results

What the numbers show:

- training completed successfully
- validation loss decreased each epoch
- the model learned the target format better over time
- the notebook path and training pipeline are valid

Why the decreasing validation loss matters:

- it suggests the model was learning the task rather than immediately failing
- it gives evidence that the adapter training was functioning correctly

What the numbers do not prove yet:

- strong generalization
- stable performance across a large syllabus
- production readiness

Reason:

- the validation set contains only `1` record
- the total dataset is only `6` records

---

## 6. What was achieved technically

This run successfully demonstrated:

1. correct dataset formatting
2. successful base-model loading
3. successful 4-bit QLoRA setup
4. successful LoRA adapter training
5. successful evaluation during training
6. successful adapter saving
7. successful adapter zip export

---

## 7. Viva-ready conclusion

Good short explanation:

"The final fine-tune completed successfully on Colab Enterprise using an NVIDIA L4 GPU and Qwen2.5-7B-Instruct with QLoRA. The run finished in 263 seconds, training loss and validation loss both improved across the three epochs, and the adapter was saved successfully. Because the dataset was only 5 training records and 1 validation record, I treat this as a successful pipeline proof rather than a final production-quality model."

---

## 8. Related documents

For method and setup:

- [FINETUNE_COLAB_GUIDE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/FINETUNE_COLAB_GUIDE.md)
- [FINETUNE_METHOD_EXPLAINED.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/FINETUNE_METHOD_EXPLAINED.md)
- [FINETUNE_DATASET_FORMAT.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/FINETUNE_DATASET_FORMAT.md)
- [FINETUNE_AND_RAG_DATA_PLAN.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/FINETUNE_AND_RAG_DATA_PLAN.md)
- [FINETUNE_VERTEX_PLAN.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/FINETUNE_VERTEX_PLAN.md)
