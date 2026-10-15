# V5 mobile flake realism — isolated preview

## Baseline and boundaries
- Exact live source: `ziusho83-ctrl/epoxy-visualizer-app-v5`, commit `a62d2f2dfd0ec6c0d5e1d2697870d9064e8a8602`.
- Original production deployment: `dpl_EYiFoC4dRbx9uhpiEU2rHPgjp3d3` (April 19, 2026).
- Original production URL/project must not be deployed to or aliased by this checkout.
- Isolated project: `epoxy-v5-mobile-preview`; Git auto-deployment disconnected.
- Use `vercel deploy --target=preview --yes` (the first-ever deployment of a new project can otherwise default to its own production target).
- Preview lead submission is disabled in both the UI handler and API. No production quote webhook is copied.
- Segmentation uses the existing service credential, scoped to the isolated project's preview environment. No credentials belong in git or notes.

## What changed
- Removed the viewport-dependent 70,000/290,000 SVG flake elements and separate export pattern.
- One deterministic, unique full-floor chip field with irregular angular cells; no repeating bitmap.
- Perspective-scaled chips with identical full coverage on phones and desktops.
- Low-frequency monochrome room lighting, restrained satin/gloss reflection; no source floor-color tinting.
- Shared composited canvas for the displayed floor, exported floor, comparison, and quote card.
- Photo always drawn before the clipped material; source pixels outside the mask stay intact.
- Fine/Standard/Bold apparent chip sizes, satin/gloss selector; no physical-size claim.
- Canonical image bounded to 1800px longest edge, not device viewport size.
- Share files use their actual MIME type; cancelled sharing does not trigger a fallback download.
- Fixed existing narrow-screen horizontal overflow.

## Verification
`npm run build`, `npm run lint`, `npm test` with Vite running at localhost:5178.
Install browsers with `npx playwright install chromium webkit`.
Optional `CHROMIUM_PATH` points at an existing Chromium executable.
`PREVIEW_URL` runs the browser suite against the deployed preview instead of localhost.

Twelve checks across mobile Chromium and mobile WebKit cover export pixel equality,
unchanged outside-mask photo pixels (including a concave boundary), viewport invariance,
opaque output, size/finish/palette/None controls, mask reset, portrait size bounds,
sharing cancellation, and long-portrait non-repetition at the former tile spacing. Browser suite stubs only the segmentation response;
a separate real-image request confirmed the deployed segmentation endpoint returns 200.
Real-device iPhone Photos/share-sheet behavior and physical sample accuracy still need human review.

## Scope / next improvements
The material is procedural, not a calibrated manufacturer photograph. Existing blend
palettes were preserved. Next useful refinement: calibrate color weights, actual chip
size and gloss against photographed installer samples. Floor-plane perspective is a
heuristic inferred from the mask; it is not a recovered 3D room or ray-traced reflection.
This branch is intentionally NOT a production-ready merge while quote sending is disabled.

## Repetition fix (October 15 follow-up)
Vu identified visible repeated clusters in a long-hallway photo. Replaced the
1024px repeating tile with absolute-coordinate hashed, fully jittered Voronoi
chip cells, rasterized once for the entire bounded floor. No texture wrapping
or modulo lookup. Four subpixel samples suppress tiny-chip aliasing. Only
nearby site rows plus one full-frame material are cached.
The regression test fails against the old deployed renderer (correlation
0.90–0.96 at the repeating tile period), and passes against the new material.
Density, preview/export parity, and production isolation are unchanged.

## Base-coat visibility fix (October 15 follow-up)
Vu approved the new textures but found that the base selector had no effect
with flakes enabled. The opaque chip field completely covered the base fill,
and its cache did not include the selected base.
- Preserve chip locations and blend colors; expose the base in a deterministic
  18% subset of small chip-scale cells. This is a dense broadcast approximation,
  not a literal 100%-flake broadcast. UI wording now says dense flake finish.
- Include base in the material-cache key. No-flake mode stays fully solid.
- Grey/Tan/Charcoal regression checks visible warm/dark shifts, unchanged
  majority flake pixels, deterministic roundtrip to Grey, and exported pixels.
- The test fails old deployed renderer (zero changed pixels); new tests pass.
