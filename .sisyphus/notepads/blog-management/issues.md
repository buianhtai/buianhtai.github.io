# Issues

## 2026-03-24 Task: Flywheel Ecosystem Post Expansion
- `npm run build` initially failed due to unrelated MDX HTML comments in `the-agentic-coding-flywheel-why-85-planning-beats-100-coding.mdx` (`Unexpected character '!' before name`).
- Resolved by converting HTML comments to JSX/MDX-safe comments (`{/* ... */}`), then rebuild succeeded.

## 2026-03-24 Task: Flywheel Methodology Post
- `lsp_diagnostics` cannot validate `.mdx` in this workspace because no MDX LSP server is configured; build output is the effective correctness gate for this file type.
