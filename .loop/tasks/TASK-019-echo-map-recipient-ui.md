# TASK-019 - Echo Map Recipient UI

## Objective

Implement the complete recipient-facing Echo Map flow against
`EchoMapJourneyData`: map/intensity, proposal, action, memory, response, postcard,
and lit-node completion, including every exit and retry state.

## Allowed Files

- `src/features/journey/ui/**`
- `src/features/journey/journey.css`
- `src/app/pages/RecipientPage.tsx`
- `.loop/claims/TASK-019--<session-id>.md`
- `.loop/reports/TASK-019-echo-map-recipient-ui.md`

Do not modify journey domain/services, `OfflineDemoService`, app shell/router,
capture, Agent, artifact, hardware, shared global styles, or package files.

## Requirements

- Echo Map is the first screen after existing recipient identity entry or the
  explicit `/recipient/echo-map` route seam.
- Stable map surface with one node and neutral Traveling Messenger representation.
- Accessible segmented quiet/glimmer/deep control; quiet default and no autoplay.
- Proposal displays rationale, Context ID, trigger, intensity, Loop authorship,
  neutral fallback, and inspect/accept/skip/reject/hide/back controls.
- Explicit simulated action completion with stop.
- Original and AI composition remain separate with provenance and labels.
- Recipient text or explicit omission precedes postcard creation.
- Postcard review precedes node lighting; retries preserve prior input/artifact.
- Lit, hidden, rejected, skipped, stopped, close, restart-required, loading, and
  typed error states are visibly coherent and cannot claim false completion.
- UI states the in-memory Demo lifetime directly for permanent hide.
- Keyboard, focus, alerts/status, reduced motion, mobile, and desktop behavior
  follow TASK-016 UI specification.
- No marketing page, chat UI, nested cards, grief metric, reward, streak, sensor,
  route generation, or deceased-person NPC language.

## Acceptance

- Component tests cover full quiet and glimmer paths, all exits, Agent/artifact
  retry, refresh/restart, no autoplay, provenance, attribution, and focus/error
  behavior.
- Text fits at mobile and desktop widths with no incoherent overlap.
- Full verification and `git diff --check` pass.
- Browser smoke evidence is recorded for desktop and mobile.
