# Curriculum contract v1 — Math Quest

Source: `public/mindforge/arcade/math/content/v1/topics.json`  
Machine-readable schema: `public/mindforge/arcade/math/content/v1/contract.schema.json`  
Semantic validator: `scripts/mindforge/math-content-validate.mjs`  
Tests: `tests/mindforge/math-content.test.mjs`

## What is included

Three original bilingual early-math topics, each with **three guided lessons** (Explain → Try → Reflect) and **six sample practice questions**:

1. `count-to-10`: a ten-frame displays one quantity 0–10; the answer is exactly that count.
2. `compare-to-10`: two groups display 0–10 items; choose **left**, **right** or **equal** based on which group contains more.
3. `bonds-to-10`: a ten-frame shows the first part; the missing part must equal `10 - visible`.

Every puzzle has a `topicId`, `schemaVersion`, stable `id`, `seed` (for examples), `difficulty`, localized `prompt`, `manipulative`, `answerSpec`, two `hintSteps`, and an `explanation`. Lesson steps use the same visual and answer structure and add `mode` of `explain|try|reflect`.

## UI contract

Render text with DOM textContent, not untrusted innerHTML. Draw the model from `manipulative` data using original SVG; **counts** and answer are data, not executable code. Do not infer the answer from translated strings. Manipulatives must be touch/keyboard accessible and preserve visible geometry/hitbox alignment.

For localized copy, both `en` and `vi` must be present; do not auto-generate translations on a child's device. `target=10` is fixed for V1. Introduce another content schema version for larger ranges rather than changing the meaning of V1.

## State / migration contract (for upcoming implementation)

Do **not** overwrite `mf-math-quest-v1` (existing saved game) or `mf-library-theme` (user appearance preference). Future Learn/Practice progress should live separately under e.g. `mf-math-learning-v1`, with a `schemaVersion` and bounded history. Any migration needs tests for valid, corrupted and outdated storage. No PII or remote analytics.

## Local verification

```bash
node scripts/mindforge/math-content-validate.mjs
node --test tests/mindforge/math-content.test.mjs
```

Both commands use Node 22 built-ins and require no dependency installation. The semantic validator checks arithmetic accuracy (e.g., a wrong number-bond complement is rejected), translations, duplicate IDs, invalid counts, lesson order and missing puzzle hints. JSON Schema is a public machine-readable description; the semantic validator is additionally mandatory because schema alone cannot verify mathematical correctness.

## Curriculum limits

Ages 5–7 are informal guidance, not certification. This content is original, not copied from OctoKids. The illustrated Math Quest **Learn/Practice screens are not shipped by this task**; subsequent issues #123–#125 implement them. Existing game remains unchanged.
