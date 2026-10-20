# MindForge Math Learning — task automation runbook

**Epic:** [#119](https://github.com/buianhtai/buianhtai.github.io/issues/119) · **Tracker:** [#82](https://github.com/buianhtai/buianhtai.github.io/issues/82)

## What is automated now

Workflow: `.github/workflows/mindforge-math-task-coordinator.yml`

- Reconciles only GitHub Math V1 issues **#120–#127** using their existing `## Blocked by` sections.
- Runs on issue dependency/label edits and merged PR events, every **6 hours**, or via **Actions → MindForge Math task coordination → Run workflow**.
- Categorizes each task: ready, blocked, in progress, implementation merged (QA pending), or done (closed).
- Adds/removes labels `math:ready` and `math:blocked` idempotently and preserves `math:building`, `math:qa`, `math:review` states.
- Seeds implementation-merged labels on **#122** and **#123** only after checking the actual merged states of PRs **#130**, **#131** and **#132**. It **does not close** either QA-incomplete issue.
- Writes a Markdown run summary and comments on the epic only if labels changed, avoiding notification spam.
- Fails closed for missing/malformed dependency sections or unknown blockers.
- Uses only the repository's built-in `GITHUB_TOKEN` and GitHub API. No Claude/LLM credentials, shell installer, external services or new npm package.

**Expected first-run state (provided the currently merged PRs remain merged):** #120 Ready, #121 Done, #122/#123 implementation merged, #124/#125 Ready, #126/#127 Blocked.

## Safe operating modes

To preview without any GitHub issue changes, use **Run workflow → dry_run: true**. To reconcile labels immediately use **Run workflow → dry_run: false**.

CI runs `node --test tests/mindforge/math-task-coordinator.test.mjs` before any reconciliation. The same tests are added to the existing Math Learning PR-check workflow.

Labels are *coordination signals*, not automatic declarations of QA success. To show an implementation is merged but its physical-device checks remain, use `math:implementation-merged`. An issue closes only after its acceptance criteria are independently verified.

To pause scheduled automation, disable the **MindForge Math task coordination** workflow in the repository Actions settings. To stop automatic issue mutations without disabling the workflow, run only dry-run manually after disabling the schedule/events in a reviewed PR.

## What is NOT automated

This workflow does **not** create product code or PRs, install super-board, start Claude/Codex agents, bypass branch protection, or merge a PR. GitHub Issues are **not yet a super-board GitHub Project v2 board**. The repository has an existing Beads/gstack workflow; onboarding another runner must be checked for conflicting hooks and worktree conventions.

### Turning on supervised autonomous implementation

[super-board](https://github.com/EricTechPro/super-board) requires a supported Claude Code/Codex environment, authenticated `gh` with project scopes, a GitHub Project v2 status board, `jq` and Python. From a trusted development environment:

1. Review/pin the super-board release and all installer scripts/hooks; install it **only after that review**. Never blindly pipe a remote shell script to bash.
2. Run its official `/super-board onboard` (host-specific syntax) to configure the board, permissions and project fields. Keep `human_approves_merge: true` and protect `main`.
3. Set nonempty verification commands (run from repo root with Node 22):

   ```bash
   node scripts/mindforge/math-content-validate.mjs
   node scripts/mindforge/verify-existing-math.mjs
   node --test tests/mindforge/math-content.test.mjs tests/mindforge/math-generator.test.mjs tests/mindforge/math-visual-contract.test.mjs tests/mindforge/math-task-coordinator.test.mjs
   ```

4. Create/reuse a GitHub Project v2 with **Backlog → Ready → Building → QA → Review → Blocked → Done**, add the existing GitHub issue cards, and check dependencies match the issue bodies.
5. Assign **#124 Guided Learn** and **#125 Topic Practice** as the first eligible implementation cards. Keep #126 and #127 Blocked. Prefer one small task + independent QA before increasing agent concurrency.
6. Run `/super-board lint` and dry-run/read-only status before dispatch. Run the agent **from your trusted host**; do not assume that a GitHub Action by itself hosts a coding agent.
7. Review every PR with deterministic math QA, responsive Playwright tests, score/localStorage regression tests, VI/EN and reduced-motion accessibility evidence. Only a human with repo permissions should authorize merging while the quality gates are being established.

**No coding agent has been installed or configured by this workflow.** If you want one, onboarding credentials/host/project access and approval remain separate.

## Verification coverage

Tests at `tests/mindforge/math-task-coordinator.test.mjs` ensure a merged implementation unblocks subsequent engineering **without misreporting an incomplete QA issue as closed**, untrusted issue text is not executed, invalid dependencies block rather than launch work, manual in-progress signals are preserved, and label updates are idempotent.

The game UI itself still needs real device verification. Completing an issue or merging code alone does not demonstrate GitHub Pages release readiness.
