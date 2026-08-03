# TASK-021 - Hackathon UI Quality Baseline

## Disposition

`ready-for-owner-review`

The accepted W·HERE Demo has no source-backed P0 visual or interaction defect in the audited first-viewport routes. One mobile typography issue is worth a bounded competition-polish task; one layout animation warning is a small technical cleanup. No product source was modified.

## Scope And Evidence

Audited:

- `#/` at `1440 x 1000` and `390 x 844`
- `#/recipient` at `390 x 844`
- direct `#/recipient/echo-map`, which correctly rendered the identity-confirmation gate
- home, recipient and Echo Map source and responsive CSS

Evidence commands:

```powershell
npx impeccable detect --json src/
npx impeccable detect --json "http://127.0.0.1:5174/#/"
npx impeccable detect --json "http://127.0.0.1:5174/#/recipient"
npx impeccable detect --json "http://127.0.0.1:5174/#/recipient/echo-map"
npx playwright screenshot --channel msedge --viewport-size="1440,1000" "http://127.0.0.1:5174/#/" <temp-output>
npx playwright screenshot --channel msedge --viewport-size="390,844" "http://127.0.0.1:5174/#/" <temp-output>
npx playwright screenshot --channel msedge --viewport-size="390,844" "http://127.0.0.1:5174/#/recipient" <temp-output>
```

The source detector returned six findings: three `side-tab`, two `codex-grid-background`, and one `layout-transition`. URL scans additionally reported hero eyebrow, dark glow, repeating stripes and low contrast candidates.

## Findings

### P0

None retained.

The first Edge `--headless --window-size=390,844` screenshots appeared horizontally cropped, but that path did not reliably establish a 390 CSS-pixel viewport. Playwright using the installed Edge channel and explicit viewport produced complete 390px layouts with no text or card clipping. The initial crop was rejected as invalid evidence.

### P1 - Mobile Recipient Headline Has A Weak Final Orphan

Route: `#/recipient` at `390 x 844`.

Evidence:

- `src/styles/global.css:545` sets all mobile `h1` to `46px`.
- `src/features/recipient/RecipientExperience.tsx:185` renders “你想说话的时候，记忆仍在这里。”.
- At 390px the heading wraps into three lines with `里。` alone on the last line.

Impact: the text remains readable and does not overlap, but this is the dominant first-viewport message shown to judges. The short orphan makes the composition feel unrefined and pushes the supporting copy and primary entry card downward.

Recommended treatment: add a recipient-specific mobile heading size/measure rather than shrinking all global headings. Preserve the sentence and product meaning.

### P2 - Choice Rows Animate Padding

Routes: identity confirmation and other pages that load global CSS.

Evidence:

- `src/styles/global.css:384` includes `transition: padding .2s ease`.
- `src/styles/global.css:385` changes horizontal padding on hover.
- Impeccable reports `layout-transition` in source and all audited URLs.

Impact: low for the Demo, but padding animation causes layout work and shifts text rather than expressing state with paint/transform properties. Remove the padding transition and keep a stable hit area; background/color is sufficient.

### P2 - Repeated Side Accent Is A Visual Preference, Not A Defect

Evidence:

- `src/features/journey/journey.css:198` uses a coral left edge for an error state.
- `src/features/hardware/hardwareSimulator.css:142` uses a green left edge for simulator notice state.
- `src/styles/global.css:407` uses a coral quote rule.

Impeccable classifies these as `side-tab`, but the instances encode error, notice and quotation semantics rather than repeated decorative card chrome. Do not change them solely to satisfy the detector. A later visual-system task may replace them if it establishes a clearer state treatment.

## Rejected Detector Findings

- **Echo Map grid and stripes**: `src/features/journey/journey.css:45-75` belong to the actual map/weather surface. The detector explicitly permits grids on map and measurement surfaces.
- **Home coordinate grid**: `src/styles/global.css:288-327` visualizes two temporal coordinates and a route; it is not an unrelated SaaS background.
- **Dark glow**: `src/features/journey/journey.css:87-97` applies a restrained route-line glow inside the map. Retain unless screenshot review shows it overpowering content.
- **Low contrast**: the URL detector reported dark-surface text against the page's light background instead of its gradient parent. Desktop and mobile screenshots show the text on the dark coordinate surface; the reported ratios are not reliable evidence.
- **Eyebrow pattern**: the eyebrow communicates brand, identity gate and `pull_only` context. Repetition may be reviewed later, but removing it would currently discard useful state information.

## Proposed Follow-up Task

### TASK-022 - Mobile Judge First-Viewport Polish

Objective: refine the mobile recipient first viewport and remove the one confirmed layout animation without changing behavior, copy, routes or product scope.

Proposed allowed files:

- `src/styles/global.css`
- existing focused UI test only if a stable class/structure assertion is needed
- TASK-022 claim and report

Acceptance criteria:

- At `390 x 844`, the recipient entry heading has no one- or two-character orphan line and remains visually subordinate to no other element.
- Recipient lead, identity card and primary CTA remain fully visible without horizontal overflow.
- Home `390 x 844` and desktop `1440 x 1000` composition do not regress.
- `.choice` keeps a stable hit area and no longer animates padding, width, height or margin.
- No behavior, copy, source label, relationship scope, `pull_only`, offline behavior or hardware fallback changes.
- `npm run verify`, `git diff --check`, desktop screenshot and mobile screenshot pass.

Smoke path:

```text
#/ at 390 x 844 and 1440 x 1000
→ #/recipient at 390 x 844
→ 主动进入
→ identity confirmation choice rows hover/focus at desktop width
```

Budget: one worker, maximum two attempts, 45 minutes, no dependency changes.

## Limitations

- This run did not automate the stateful Echo Map journey through postcard completion. Direct deep-link behavior was checked and correctly required identity confirmation; deeper state evidence remains covered by existing tests and prior smoke reports.
- Detector results are heuristics. Findings were retained only when source and screenshot evidence agreed.
- The shared worktree was already dirty, so TASK-021 intentionally made no product source changes.

## Verification

```text
npm run verify
  19 test files passed
  199 tests passed
  TypeScript check passed
  Vite production build passed

git diff --check
  passed; existing Windows LF/CRLF conversion warnings only
```

The current README and coordination summaries still cite 198 tests while this shared worktree verifies 199. TASK-021 did not own canonical status or README test-count changes, so this drift is recorded for coordinator reconciliation rather than silently edited here.

## Scope Confirmation

- Product source changes: none.
- Dependency changes: none.
- Canonical status/decision/risk/queue changes: none.
- Follow-up implementation started: no.
