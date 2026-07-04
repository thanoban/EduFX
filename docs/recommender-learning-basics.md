# EduFX Recommender Learning Guide - From Basics

This guide teaches the EduFX recommender training process from the beginning.
It is meant to be studied together with [recommender-colab-training.md](recommender-colab-training.md),
which contains the runnable Google Colab cells.

If the Colab notebook is the "how to run it" document, this file is the
"how to understand it" document.

---

## What We Are Building

EduFX needs a recommender that can answer:

- What does this student probably know?
- Which subtopic is weak?
- Which subtopic is ready to learn next?
- Which subtopic should be revised again later?

This is different from a text-generation model. We are not training an LLM to
write answers. We are training a **student modeling system**.

The training pipeline uses two models:

- `BKT` = Bayesian Knowledge Tracing
- `DKT` = Deep Knowledge Tracing

Both models look at a student's learning history and try to estimate how strong
the student is on each skill.

After that, another layer of logic can use those predictions to recommend the
next topic.

---

## The Big Picture

The full process is:

1. Build or collect student interaction data.
2. Represent each student's learning history as a sequence.
3. Train BKT as a classic, interpretable baseline.
4. Train DKT as a neural-network sequence model.
5. Compare how well both models predict future answers.
6. Export the trained artifacts so the backend can use them.

In EduFX right now, the notebook creates **synthetic student data** with a
simulator because there is not yet enough real student history for deep
training.

---

## Learning Order

Study the system in this order:

1. Simulator
2. BKT
3. DKT input encoding
4. DKT training loop
5. Evaluation
6. Export and backend integration

That same order is used below.

---

## Part 1 - Understand the Simulator First

### Why do we need a simulator?

Machine learning needs data.

For this recommender, the ideal data would be many real student sequences like:

- skill attempted
- correct or wrong
- focus level
- whether webcam tracking was enabled

But EduFX does not yet have enough real sequences to properly train a deep
model. So the notebook creates a **simulated dataset**.

This means we write rules for how a realistic student behaves, then generate
many fake students from those rules.

---

### What is one student history?

A student history is an ordered sequence of interactions such as:

1. Student attempts `G1 Reactions`, gets it right, focus `0.82`
2. Student attempts `G1 Thermal Stability`, gets it wrong, focus `0.41`
3. Student attempts `G2 Reactions`, gets it wrong, focus `0.33`

Order matters.

The same three answers in a different order can mean a different learning path.
That is why this is a **sequence learning** problem.

---

### What is hidden ability?

Inside the simulator, each student has a hidden ability value for each skill.
This is usually stored in a variable like `theta`.

You can think of `theta` as:

- a low number = weak understanding
- a high number = strong understanding

We do not directly show `theta` to the final model. It is only used inside the
simulator to create realistic correct/wrong answers.

So the simulator "knows" the truth, and the models later try to recover that
truth from visible behaviour.

---

### Why do we use a sigmoid?

A sigmoid function converts any real number into a value between `0` and `1`.

That is useful because probabilities must stay between `0` and `1`.

Basic intuition:

- very negative input -> close to `0`
- near zero -> around `0.5`
- very positive input -> close to `1`

In the simulator, sigmoid helps turn hidden ability into:

- probability of mastering a skill
- probability of answering correctly

---

### How does the simulator decide whether an answer is correct?

The simulator uses a function like `p_correct(...)`.

That function considers:

- the student's current ability on that skill
- any prerequisite boost from related skills
- the student's focus
- a "guess" chance
- a "slip" chance

This makes the synthetic data more realistic.

Example:

- A weak student may still get a question right by guessing.
- A strong student may still get a question wrong by slipping.
- A distracted student should usually do worse than a focused student.

---

### What are slip and guess?

These are classic educational modeling ideas.

`guess` means:

- the student did not really know it
- but still answered correctly by luck

`slip` means:

- the student actually knew it
- but still answered wrongly due to a mistake

These ideas are important because correct and wrong answers are not perfect
signals.

---

### How does learning happen in the simulator?

After a student attempts a skill, the simulator updates their hidden ability.

If focus is high:

- learning should increase more

If focus is low:

- learning should increase less

This is important because EduFX wants behaviour-aware recommendations. A correct
answer while distracted should not count the same as a correct answer while
fully focused.

---

### Why do prerequisites matter?

Some skills are related.

For example:

- doing well in one Group 1 concept can help with a similar Group 2 concept

The simulator includes this using a prerequisite map.

That means the model can later learn that success in one topic can improve the
chance of success in another topic.

This matters especially for DKT, because DKT is designed to learn
cross-topic transfer.

---

### What is `tracked`?

EduFX focus tracking is optional.

So each interaction includes:

- `focus`: a number between `0` and `1`
- `tracked`: `1` if focus was measured, `0` if it was skipped

If tracking is skipped, the current design uses:

- `focus = 1.0`
- `tracked = 0`

This means:

- students are not punished for skipping tracking
- the model can still tell the difference between "fully focused" and "not measured"

---

### What does the simulator finally produce?

It produces many student histories.

For example:

- 3,000 students
- around 150,000 total interactions

Then the notebook splits that into:

- training data
- validation data

Training data teaches the model. Validation data checks whether the model
actually learned something useful.

---

## Part 2 - Understand BKT

### What is BKT?

`BKT` stands for **Bayesian Knowledge Tracing**.

It is a classic educational model. For each skill, it assumes the student is in
one of two hidden states:

- not learned
- learned

We never observe that state directly. We only observe:

- correct answers
- wrong answers

So BKT tries to estimate the probability that the student has learned the skill.

---

### Why is BKT useful?

BKT is useful because it is small, fast, and interpretable.

You can explain each parameter in plain words.

That makes it:

- a good baseline
- easy to defend in a viva
- easy to debug
- a safe fallback if the deep model is missing or worse

---

### What are the 4 BKT parameters?

For each skill, BKT learns four values:

`L0`
: probability the student already knew the skill before practice

`T`
: probability the student learns the skill after an attempt

`S`
: slip probability, meaning they knew it but still answered wrong

`G`
: guess probability, meaning they did not know it but still answered right

These are powerful because every one of them has a meaning you can explain.

---

### What does "hidden state" mean?

The model assumes the student has a real internal state:

- knows the skill
- does not know the skill

But we cannot directly see that.

We only see answers, which are noisy.

So BKT uses probability to reason about the hidden state.

---

### Why is BKT trained per skill?

BKT usually builds one small model per skill.

That means:

- one model for Group 1 Reactions
- one model for Group 1 Thermal Stability
- one model for Group 2 Reactions
- and so on

This is both a strength and a weakness.

Strength:

- simple and interpretable

Weakness:

- it does not naturally learn relationships across skills

That weakness is one reason we also train DKT.

---

### How does BKT train?

BKT does not train with backpropagation like a neural network.

It uses a statistical process called **Expectation-Maximization (EM)**.

Simple intuition:

1. Start with guessed parameter values.
2. Estimate the hidden learned/not-learned states using those values.
3. Update the parameters based on those estimates.
4. Repeat many times.

This cycle gradually improves the parameters.

---

### What is forward-backward in BKT?

The forward-backward algorithm is a probability procedure used inside Hidden
Markov Models.

Its job is to estimate:

- how likely the student was in each hidden state at each time step

It uses:

- past observations
- future observations

That gives a better estimate than looking only one step at a time.

---

### How does BKT use focus?

In EduFX, BKT is behaviour-aware.

Low focus should make an answer less trustworthy.

So instead of treating a distracted correct answer as strong evidence, BKT
adjusts slip and guess toward `0.5`.

That means:

- a distracted answer changes mastery less
- a focused answer changes mastery more

This is a smart way to use behaviour without redesigning the whole BKT model.

---

### What does BKT output?

BKT can output:

- probability the student has mastered a skill
- probability the student would answer correctly on a skill

That output can then be used later by the recommendation policy.

---

## Part 3 - Understand DKT Input Encoding

### What is DKT?

`DKT` stands for **Deep Knowledge Tracing**.

Instead of building one small model per skill, it builds one neural network that
reads the entire student sequence.

That allows it to learn patterns like:

- mastering one topic helps with another topic
- students with certain learning paths behave similarly
- focus and skill history together affect future success

---

### Why do we need input encoding?

A neural network cannot directly understand:

- "skill 3, correct, focus 0.81"

It needs numbers arranged in vectors.

So we encode each interaction into a numeric format.

This conversion step is called **input encoding**.

---

### What is one-hot encoding?

If there are 10 skills, one-hot encoding represents a skill using a vector of
length 10 where:

- one position is `1`
- all other positions are `0`

Example:

- skill `2` becomes `[0, 0, 1, 0, 0, 0, 0, 0, 0, 0]`

That tells the network exactly which skill happened.

---

### Why do we use `2K + 2` dimensions?

If there are `K = 10` skills, the notebook uses:

- first 10 positions for "correct on skill"
- next 10 positions for "wrong on skill"
- 1 position for `focus`
- 1 position for `tracked`

So total size is:

- `2 * 10 + 2 = 22`

This is written as `2K + 2`.

---

### Why split correct and wrong into separate halves?

Because the model should know both:

- which skill was attempted
- whether the result was correct or wrong

If skill `4` is answered correctly, that should be different from skill `4`
answered wrongly.

So the encoding uses:

- one half for correct events
- one half for wrong events

This is a common DKT encoding idea.

---

### Why are `focus` and `tracked` appended?

These two values add behavioural context.

`focus` tells the model:

- how attentive the student was during that interaction

`tracked` tells the model:

- whether focus was actually measured

This helps the model interpret answers more fairly.

A correct answer with low focus might be weaker evidence than a correct answer
with high focus.

---

### What does one encoded step mean?

One encoded vector means:

- which skill happened
- whether it was correct or wrong
- how focused the student was
- whether tracking was on

That one vector is one time step in the student's sequence.

Then the full student history becomes a sequence of those vectors.

---

## Part 4 - Understand the DKT Training Loop

### Why use an LSTM?

An `LSTM` is a type of recurrent neural network designed for sequences.

It is useful here because learning history matters over time.

The model should remember:

- what the student did earlier
- which topics improved
- which mistakes repeated
- how focus changed over time

LSTMs are built to keep and update a memory state while reading a sequence.

---

### What does the DKT model predict?

At each step, the DKT model predicts:

- probability of answering correctly for each skill

During training, we mainly score it on the skill the student actually attempts
next.

So the model learns to answer:

"Given everything so far, how likely is the next answer on this skill to be correct?"

---

### What is a batch?

Instead of training on one student at a time, we usually train on a small group
of students together.

That group is called a **batch**.

Batching is useful because:

- it is faster
- it uses matrix operations efficiently
- it makes training more stable

---

### Why do we pad sequences?

Not all students have histories of the same length.

Examples:

- one student may have 31 interactions
- another may have 67 interactions

But neural networks in batches usually need rectangular arrays.

So we pad shorter sequences with zeros.

Then we use a **mask** so the model does not treat padding as real data.

---

### What is the training target?

The training task is **next-step prediction**.

At time step `t`, the model uses the history up to that point to predict the
outcome at time step `t + 1`.

That teaches the model how learning evolves.

This is better than just fitting current labels, because recommendation is
really about predicting future success.

---

### What is loss?

Loss is a number that measures how wrong the model is.

In this notebook, the training loop uses binary cross-entropy loss for
correct/wrong prediction.

Basic intuition:

- lower loss = model predictions are better
- higher loss = model predictions are worse

During training, you want loss to decrease across epochs.

---

### What is an epoch?

One epoch means:

- the model has seen the whole training dataset once

If you train for 20 epochs, the model goes through the dataset 20 times.

Each epoch should usually improve the weights a bit more.

---

### What is backpropagation?

Backpropagation is how the neural network learns from mistakes.

Simple idea:

1. The model makes predictions.
2. Loss measures the error.
3. Backpropagation calculates how each weight contributed to that error.
4. The optimizer updates the weights to reduce future error.

This is the core learning mechanism in deep learning.

---

### What is the optimizer?

The optimizer decides how to change the model weights.

In this notebook, the optimizer is `Adam`.

You can think of Adam as a smart rule for:

- how big each update should be
- how fast learning should happen

It is one of the most common choices in modern deep learning.

---

### What is `gather(...)` doing?

The model outputs predictions for **all skills** at each time step.

But the next real interaction only belongs to one actual skill.

So `gather(...)` selects the prediction for the skill that was really attempted.

That is the one we compare against the real answer.

---

### What does a good training run look like?

A healthy training run usually shows:

- loss gradually going down
- no crashes or shape mismatches
- evaluation score above the baseline

That tells you the model learned useful sequence patterns.

---

## Part 5 - Understand Evaluation

### Why do we need evaluation?

Training performance alone is not enough.

A model can memorize training data and still fail on new students.

So we keep separate validation data that the model never trained on.

Then we test whether the model still predicts well there.

That is the real check of generalization.

---

### What is the baseline?

A baseline is a simple reference point.

Examples:

- always predict the average correctness rate
- use BKT as the classic baseline

This helps answer:

"Is the deep model actually better, or just more complicated?"

---

### What is ROC-AUC?

`ROC-AUC` is a common evaluation metric for binary classification.

Here, the binary classes are:

- correct
- wrong

Very simple interpretation:

- `0.5` = random guessing
- above `0.5` = the model learned useful ranking
- closer to `1.0` = much better ranking

ROC-AUC does not ask for one hard yes/no prediction. It asks whether the model
gives higher confidence to truly correct cases than to wrong ones.

---

### Why compare BKT and DKT?

Because model choice should be evidence-based.

If DKT performs better:

- use it as the main model

If BKT is similar or better:

- keep BKT or use it as fallback

This comparison is important academically too, because it shows you did not
blindly choose the deep model.

---

### What is a good outcome?

A good outcome is usually:

- both models beat the trivial baseline
- DKT slightly or clearly beats BKT

If BKT stays close to DKT, that is still a valid finding. On a small skill set,
simple models can stay strong.

---

## Part 6 - Understand Export and Backend Integration

### Why export model files?

After training, the models exist only in memory inside Colab.

To use them in the real EduFX backend, we must save them to files.

That saved form is called an **artifact**.

---

### What files are exported?

The notebook exports:

- `bkt.json`
- `dkt.npz`
- `dkt.pt`
- `dkt_meta.json`

Each file has a different role.

---

### What is `bkt.json`?

`bkt.json` stores the trained BKT parameters for each skill:

- `L0`
- `T`
- `S`
- `G`

It is human-readable and easy for the backend to load.

---

### What is `dkt.pt`?

`dkt.pt` is the native PyTorch checkpoint.

It is useful for:

- resuming training
- inspecting the original torch model
- debugging inside a PyTorch environment

It is not the main serving format for the EduFX backend.

---

### What is `dkt.npz`?

`dkt.npz` stores the DKT weights in NumPy format.

This is important because the EduFX backend is designed to run inference
without depending on PyTorch at serving time.

That gives a lighter production setup.

So:

- `dkt.pt` is training-friendly
- `dkt.npz` is serving-friendly

---

### What is `dkt_meta.json`?

This file stores metadata such as:

- number of skills
- input dimension
- hidden dimension
- encoding format

It is useful for documentation and for checking that the saved weights match the
expected architecture.

---

### Why do we check NumPy parity?

The DKT model is trained in PyTorch, but served in NumPy.

That creates a risk:

- what if the NumPy implementation behaves differently from the PyTorch one?

So the notebook performs a parity check.

It runs the same sample through:

- PyTorch model
- NumPy forward pass

Then it confirms the outputs are almost identical.

If they match, we can trust the backend inference path.

---

### How does this connect to the backend?

After training, the downloaded files go into:

`server/app/ml/artifacts/`

Then the backend can:

- load `bkt.json`
- load `dkt.npz`
- compute predicted correctness or mastery
- pass those predictions into the recommendation logic

The recommendation logic then decides:

- what to introduce next
- what to revise
- what is overdue

So the model is the prediction engine, and the policy is the decision engine.

---

## Final Mental Model

If you remember only one summary, remember this:

### Simulator

Creates many realistic student histories.

### BKT

A simple probabilistic model that estimates whether each skill is learned.

### DKT input encoding

Turns each interaction into numbers the neural network can read.

### DKT training loop

Shows sequences to the LSTM, measures mistakes, and updates weights.

### Evaluation

Checks whether the trained models predict future answers better than a baseline.

### Export and integration

Saves the trained models into files the EduFX backend can load and use.

---

## Recommended Study Routine

Use this routine if you want to really learn the notebook:

1. Read the simulator section in this file.
2. Open [recommender-colab-training.md](recommender-colab-training.md).
3. Study Cell 3 and match each block to the simulator explanation here.
4. Then study the BKT section here and compare it with the BKT cells.
5. Then move to DKT encoding and training loop.
6. Finally study evaluation and export.

Do not rush to run all cells before understanding what each part is doing.
Understanding the data flow is much more important than memorizing syntax.

---

## Next Best Step

After reading this guide, the best next step is:

1. open the Colab notebook guide
2. focus only on the simulator cell first
3. trace each variable slowly
4. then move to BKT

If you want an even deeper walkthrough, the next teaching document can be:

- "Simulator line-by-line"
- "BKT line-by-line"
- "DKT line-by-line"

That would be the best follow-up for true beginner learning.
