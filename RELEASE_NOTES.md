# Production release — 2026-10-15
Vu approved production promotion in Telegram topic 32, message 16337.

- Exact approved renderer: preview commit 56144d6.
- Release restores original production quote API and form submission, using the
  shared composited floor image for the quote attachment. Removes preview banner.
- Quote tests intercept requests; no real customer emails or leads are generated.
- Production Vercel project: epoxy-visualizer-app-v5.
- Original rollback deployment: dpl_EYiFoC4dRbx9uhpiEU2rHPgjp3d3.
- Preview project/branch remains separate with quote delivery disabled.
- PREVIEW_NOTES.md records prior preview work; its preview-only restrictions are
  historical and do not describe this production release branch.
