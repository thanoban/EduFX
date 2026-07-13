# EduFX Docs

This folder is now organized by purpose instead of keeping every `.md` file in
one flat list.

## Start Here

- [Full adaptive-system guide](getting-started/adaptive-system-learning-guide.md)
  Beginner-friendly guide to the whole adaptive system: recommender, agent,
  fine-tune, RAG, metrics, and backend integration.
- [Architecture reference](architecture/architecture-reference.md)
  System architecture notes, key backend patterns, and module boundaries.
- [Feature guides index](features/index.md)
  Feature-by-feature breakdown of authentication, diagnostic, scheduler,
  content, quiz, results, tracking, progress, settings, and admin flows.
- [Agent learning guide](getting-started/agent-learning-guide.md)
  Agent-only walkthrough: scheduling flow, files, data path, and integration.
- [Behavioural tracking guide](getting-started/behaviouraltracking.md)
  End-to-end webcam tracking guide: live inference, focus scoring, backend
  aggregation, and accuracy improvements.
- [Session handoff](getting-started/session-handoff.md)
  Current project state, architecture, env vars, and key files.

## Architecture

- [Architecture reference](architecture/architecture-reference.md)
  Repo structure, MVC layering, contracts, and local run notes.

## Plans

- [Recommender implementation plan](plans/recommender-implementation-plan.md)
  Full knowledge-tracing plan for BKT, DKT, training, inference, and backend
  rollout.

## ML Recommender

- [Recommender learning basics](ml-recommender/recommender-learning-basics.md)
  Slow explanation from simulator to backend integration.
- [Recommender Colab training](ml-recommender/recommender-colab-training.md)
  Runnable Colab notebook guide for BKT and DKT training.

## Fine-Tuning

- [Fine-tune results](finetuning/finetune-results.md)
  Measured training metrics and saved adapter artifacts.
- [Fine-tune method](finetuning/finetune-method.md)
  QLoRA method in plain language and viva reasoning.
- [Fine-tune Colab guide](finetuning/finetune-colab-guide.md)
  Full Colab notebook path that actually worked.
- [Dataset format](finetuning/finetune-dataset-format.md)
  JSONL contract and validation expectations.
- [Fine-tune + RAG plan](finetuning/finetune-rag-data-plan.md)
  Why both fine-tune and RAG are needed.
- [Vertex tuning plan](finetuning/finetune-vertex-plan.md)
  Managed-tuning future path.
- [AWS hosting guide](finetuning/finetune-aws-hosting-guide.md)
  Hosting the fine-tuned model on AWS EC2.
- [Azure hosting guide](finetuning/finetune-azure-hosting-guide.md)
  Hosting the fine-tuned model on Azure GPU VM.

## Deployment

- [Deployment plan](deployment/deployment-plan.md)
  GCP deploy via GitHub Actions, secrets, Cloud Run, and model serving.

## Data

- [Data format guide](data/data-format-guide.md)
  How to write RAG notes and fine-tune JSONL data.

## QA

- [QA documentation index](qa/index.md)
  Test planning, test cases, bug reports, QA summary reports, and API
  validation guidance.
- [QA project structure](qa/qa-project-structure.md)
  Recommended mini-project layout for professional QA portfolios.
- [Test plan](qa/test-plan.md)
- [Test cases](qa/test-cases.md)
- [Bug report samples](qa/bug-report-samples.md)
- [QA summary report](qa/qa-summary-report.md)
- [API testing checklist](qa/api-testing-checklist.md)
- [API testing guide (manual, endpoint-by-endpoint)](qa/api-testing-guide.md)
- [Automated API testing guide](qa/automated-api-testing-guide.md)
- [Postman collection](qa/api-testing/edufx-api.postman_collection.json)
- [Exploratory charter](qa/manual-testing/exploratory-charter.md)

## Product and UI

- [UI details](product/ui-details.md)
  UI component map and page-by-page layout.

## Feature Guides

- [Feature guides index](features/index.md)
  Start here for focused documentation per EduFX feature.
- [Authentication and session management](features/authentication-and-session-management.md)
- [Diagnostic and level assignment](features/diagnostic-and-level-assignment.md)
- [Dashboard and adaptive scheduler](features/dashboard-and-adaptive-scheduler.md)
- [Study content and level-aware notes](features/study-content-and-level-aware-notes.md)
- [Quiz and session flow](features/quiz-and-session-flow.md)
- [Results and AI explanations](features/results-and-ai-explanations.md)
- [Behavioural tracking](getting-started/behaviouraltracking.md)
- [Progress tracking](features/progress-tracking.md)
- [Settings and availability](features/settings-and-availability.md)
- [Admin analytics and student management](features/admin-analytics-and-student-management.md)

## Recommended Reading Order

1. [getting-started/adaptive-system-learning-guide.md](getting-started/adaptive-system-learning-guide.md)
2. [architecture/architecture-reference.md](architecture/architecture-reference.md)
3. [features/index.md](features/index.md)
4. [getting-started/behaviouraltracking.md](getting-started/behaviouraltracking.md)
5. [getting-started/agent-learning-guide.md](getting-started/agent-learning-guide.md)
6. [ml-recommender/recommender-learning-basics.md](ml-recommender/recommender-learning-basics.md)
7. [plans/recommender-implementation-plan.md](plans/recommender-implementation-plan.md)
8. [finetuning/finetune-method.md](finetuning/finetune-method.md)
9. [finetuning/finetune-results.md](finetuning/finetune-results.md)
10. [deployment/deployment-plan.md](deployment/deployment-plan.md)
11. [qa/index.md](qa/index.md)
