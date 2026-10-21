# Math Learning V1 — Practice and Review release notes

**Implementation tasks:** #125, #126. **Integration and release gate:** #127.

## Learner flows

- [Learn](https://buianhtai.github.io/mindforge/arcade/math/learn/): original guided counting, comparison and number-bond lessons.
- [Practice](https://buianhtai.github.io/mindforge/arcade/math/practice/): choose one of the same three concepts, set a difficulty, solve 7 visually randomized problems, see short strategy hints, try twice, and optionally auto-advance after success. The questions come from the validated `learning/engine.mjs`; each is re-created from stored seed and index, not regenerated from current time on rerender.
- [Review](https://buianhtai.github.io/mindforge/arcade/math/review/): choose fresh visual examples for previously missed concepts, track actual attempts, and reduce the review backlog after a correct answer. No invented IQ/clinical improvement scores.
- [Math Quest](https://buianhtai.github.io/mindforge/arcade/math/): provides a one-tap entry to Learn, Practice, and Review alongside the original Quick Sums, Missing Number and Mini Market.

## Player-state guarantees

- New `mf-math-learning-v1` storage is **separate** from existing `mf-math-quest-v1` and `mf-math-learn-v1`; the previous game and lesson progress are not overwritten.
- When `mindforge-data-v1.activeId` is present, the Practice/Review key is scoped to the corresponding player ID; otherwise it is guest-scoped.
- Records carry `schemaVersion: 1`, validated seed, topic, difficulty, answer, hint/retry information and timestamp. A maximum of 200 attempts and 60 unresolved miss records are retained.
- Players can export their Math Learning data in JSON or explicitly clear only the Practice/Review history. No third-party analytics, accounts or backend are involved.
- Reducing mistakes requires subsequent demonstrated correct answers from a fresh practice/review task of the same concept, removing one missed instance per success.

## Acceptance QA

- `node --test tests/mindforge/math-learning-flow.test.mjs`: 4,500 seed-driven instances, mathematical validation, options and replay invariants, bounded/corrupt storage, per-profile separation, mistake queue lifecycle, and route contracts.
- Existing `Math Learning checks` also validates content/schema and original Math Quest regression.
- Browser E2E, physical iOS Safari and Android, offline PWA and public Pages route must be independently verified before marking #127 fully complete. Do not infer deployment from the merge.
- Playwright route checks should cover 320/390/768/1280px and EN/VI with light/dark; tap/keyboard and reduced-motion, correct/wrong/reveal, auto-next and saved reload.
- No timed exams, voice synthesis, certificates or claims of intelligence measurement are included.

## Release/rollback

Changes are additive. The new subroutes import two new `learning/*.mjs` files and one CSS file; Math Quest gained navigation links; the PWA cache version is invalidated. A revert can remove these new routes without touching existing legacy player scores.

See [MATH_LEARNING_V1_PLAN.md](../../MATH_LEARNING_V1_PLAN.md) for complete phases.
