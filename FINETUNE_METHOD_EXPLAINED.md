# EduFX Fine-Tune Guide - Method Explained

This file explains the fine-tuning method in the form you can use in your viva.

It is based on the path that actually worked:

- Colab Enterprise
- NVIDIA L4
- `Qwen/Qwen2.5-7B-Instruct`
- QLoRA
- standard Hugging Face stack

---

## 0. Result reference

The final training numbers are documented separately in:

- [RESULT_FINETUNE.md](D:/PROJECTS/2ndYearProject/EduFX_MVC/RESULT_FINETUNE.md)

This file focuses on explaining the method and reasoning.

---

## 1. What fine-tuning means in this project

The base model already knows a lot of chemistry from pretraining.

We are not trying to teach it all chemistry from scratch.

We are teaching it:

- the EduFX question format
- the EduFX JSON output structure
- the EduFX style of multiple-choice question generation

That is why fine-tuning is useful even with a relatively small task-specific dataset.

---

## 2. Why we did not full-fine-tune the model

Full fine-tuning would try to update all model weights.

That is expensive in:

- GPU memory
- training time
- compute cost

For a notebook-based student project, that is unnecessary.

Instead, we used QLoRA, which is much lighter.

---

## 3. What QLoRA is

QLoRA combines two ideas:

1. quantization
2. LoRA adapters

### Quantization

The base model weights are loaded in 4-bit form.

Why:

- much lower memory usage
- larger models can fit on a single GPU
- the base model stays frozen

### LoRA

Instead of training every parameter, we add small trainable adapter layers.

Why:

- only a small fraction of parameters are updated
- training is much cheaper
- it is enough for a narrow task like format-specific quiz generation

So QLoRA means:

- frozen quantized base model
- small trainable adapters on top

---

## 4. Why Qwen2.5-7B-Instruct was chosen

We chose `Qwen/Qwen2.5-7B-Instruct` for the final working path because it gave a good balance:

- strong enough to be worth fine-tuning
- still practical on a single L4 with 4-bit loading
- good instruction-following behavior
- compatible with the Hugging Face workflow we wanted to understand

This was a better final learning choice than staying trapped in runtime debugging on the earlier path.

---

## 5. Why Colab Enterprise + L4 was chosen

We originally experimented on free Colab, but that route became unstable because of:

- usage limits
- bf16/fp16 scaler issues
- dtype mismatches
- package-version friction

So the final engineering decision was to move to:

- Google Cloud Colab Enterprise
- L4 GPU using GCP credits

That gave us:

- a stronger GPU
- a cleaner environment
- a more stable notebook path
- enough control to keep the training self-run

---

## 6. Why we used the standard Hugging Face stack

Final stack:

- `transformers`
- `peft`
- `trl`
- `bitsandbytes`
- `accelerate`
- `datasets`

Why this was a good final choice:

- it is widely used and easy to justify academically
- it exposes the actual training loop
- it avoids special library behavior that confused the earlier experiments
- it is easier to explain step by step

In other words, this was not a shortcut. It was the more teachable engineering path.

---

## 7. What happens in the notebook

The notebook pipeline is:

1. verify the GPU
2. install the training libraries
3. load the tokenizer and 4-bit base model
4. attach LoRA adapters
5. format each JSONL record with the model's chat template
6. run supervised fine-tuning
7. save the adapter

That is the whole training story in a clean sequence.

---

## 8. Why the chat template matters

The dataset stores clean `instruction` and `output` fields.

But the model does not train directly on that raw pair.

The tokenizer wraps each example into the model's expected conversation format.

Why that matters:

- the model sees data in the structure it expects
- train and inference become more consistent
- the same dataset contract can be reused across model families

So the JSONL stays model-agnostic, while the notebook applies the model-specific wrapper.

---

## 9. What the loss means

During training, the trainer reports loss values.

Loss is a measure of how wrong the model is when predicting the correct next token in the target output.

In simple terms:

- high loss = the model is more surprised by the correct output
- lower loss = the model is learning the desired pattern

From the successful run:

| Epoch | Training Loss | Validation Loss |
|---|---:|---:|
| 1 | 1.611690 | 1.214605 |
| 2 | 1.297928 | 1.132317 |
| 3 | 1.188604 | 1.047082 |

This is a healthy sign because validation loss kept decreasing.

---

## 10. What the successful run proves

The successful run proves that:

- the dataset format is valid
- the notebook setup is valid
- the model loads correctly
- LoRA adapters train correctly
- the trainer completes without crashing
- the adapter can be saved

This is already meaningful engineering progress.

---

## 11. What the successful run does not prove

Because the dataset is tiny, the run does not yet prove:

- strong generalization
- production readiness
- reliable performance across many chemistry subtopics

Current dataset size:

- 5 training records
- 1 validation record

So the honest conclusion is:

the pipeline is successful, but the dataset still needs expansion.

That honesty is good viva material, not a weakness.

---

## 12. Why Task B was not fine-tuned

Task B is explanation generation for wrong answers.

That task depends on:

- the student's chosen wrong option
- the correct option
- the current question text
- retrieved study content from RAG

So it is better served by a live model call plus retrieval than by a narrow static fine-tune.

This is why EduFX uses:

- fine-tuning for quiz generation style
- live Gemini + RAG for explanations

---

## 13. What to say if asked "Why not just use RAG only?"

Good answer:

"RAG gives the model facts at runtime, but it does not guarantee the exact EduFX output structure. Fine-tuning teaches the format and style. RAG then supplies the topic-specific study content. They solve different problems."

---

## 14. What to say if asked "Why not just use Vertex managed tuning?"

Good answer:

"Managed tuning is useful, but for this phase I wanted to understand the training mechanics directly. So I used a self-run QLoRA pipeline first. That gave better learning value and clearer control over the experiment."

---

## 15. What to say if asked "Why did you change approach mid-way?"

Good answer:

"The original route exposed repeated runtime issues around mixed precision and library compatibility. Instead of forcing a brittle setup, I moved to a more stable Colab Enterprise L4 environment and a standard Hugging Face stack. That was a deliberate engineering decision to improve reliability while preserving the learning goal."

---

## 16. One-paragraph viva summary

"For EduFX, I fine-tuned Task A quiz generation using QLoRA on Qwen2.5-7B-Instruct in Colab Enterprise with an NVIDIA L4 GPU. I used a 4-bit frozen base model and trained small LoRA adapters with the standard Hugging Face fine-tuning stack. The run completed successfully, validation loss decreased across epochs, and the adapter was saved correctly. I treated this as a pipeline proof because the current dataset is only 5 training examples and 1 validation example, so the next step is expanding the dataset before claiming production-quality performance."
