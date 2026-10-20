# MindForge Math Learning — safe verification / super-board readiness

**Task:** [#120](https://github.com/buianhtai/buianhtai.github.io/issues/120).  
**State:** CI checks added to this PR; super-board installation, GitHub Project v2 setup, host authentication, branch protection and unattended merge are **not activated**.

## Fast verification (no npm install)

```bash
node --check scripts/mindforge/math-content-validate.mjs
node --check scripts/mindforge/verify-existing-math.mjs
node --test tests/mindforge/math-content.test.mjs
node scripts/mindforge/math-content-validate.mjs
node scripts/mindforge/verify-existing-math.mjs
```

Run from repo root with Node 22. These `verify_commands` are useful candidates for super-board after onboarding. GitHub Actions also runs them in `.github/workflows/mindforge-math-learning.yml` for relevant PR paths. **A CI job existing does not imply branch protection or required status checks are enabled.**

### Test evidence and scope

- Curriculum: 3 original VI/EN topics, 9 guided lessons, 18 practice fixtures.
- Math validator checks semantic correctness of counts, compare left/right/equal, and complements to 10 in addition to schema shape and bilingual text.
- Negative fixtures simulate invalid sums, missing translations, incorrect comparison, duplicate IDs, over-10 counters, and untrusted HTML.
- Game regression smoke verifies existing inline Math Quest script is syntactically valid, the three existing modes remain represented, and route files exist.
- Browser tests **not** covered by this lightweight CI: automated touchscreen flow, actual rendering at 320/390/768/1280px, real iOS/Android, contrast/screen readers, PWA cache and public GitHub Pages publication. Those are required for Learn UI tasks #123–#127.

## Super-board security / onboarding review

Reference: [EricTechPro/super-board](https://github.com/EricTechPro/super-board). Its documented workflow drives GitHub Project v2 through Backlog, Ready, Building, QA, Review, Blocked, Done. Cards with `## Blocked by` relations are scheduled by dependencies.

1. On the development machine, inspect the **pinned version** and installer/hook sources (especially guarded file deletes, env access, worktrees, protected push and merge gate). Do **not** pipe a remote installer into a shell without reviewing it.
2. Ensure `gh` is authenticated with project scopes, a supported Claude Code/Codex host, `jq`, Python, node and git are available; verify official requirements at onboarding time.
3. Create or select the intended GitHub Project. Do not assume regular GitHub Issues automatically become Project cards.
4. Configure nonempty `verify_commands`, protected main branch, required job checks and explicit `human_approves_merge: true`. If config generation differs in the pinned version, consult its schema rather than guessing.
5. Use a non-production dry-run / low-impact issue; inspect branch, PR and independent QA before enabling any card in Ready.
6. Require a human to review each meaningful PR. Report and retain failure evidence; never infer a successful deploy from a merged commit.
7. Keep board automation **off** until the user explicitly approves the installation and its intended permissions.

## Review evidence template

- Issue and blocked-by IDs; feature scope and out-of-scope.
- PR head SHA plus exact base tested and commands/exit codes.
- Negative/positive test evidence and any reproducible failed seed.
- Browser phone/desktop screenshots, VI/EN, light/dark, accessibility/reduced motion, JS console.
- Saved-state migration and data-loss checks.
- GitHub Pages route and PWA offline checks; physical iOS/Android QA or explicit pending status.
- Rollback: revert the focused PR, restore previous versioned assets and maintain existing `mf-math-quest-v1` progress; never silently delete it.

## Next

After curriculum contracts are approved, #122 expands seeded generators and Playwright. #123 creates reusable touch/keyboard-operable SVG math components. #120's CI is a starting gate; it is **not** proof that super-board is installed or safe to run unattended.
