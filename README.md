# Loop Software MVP

Loop is a hardware-neutral relationship-context prototype. The repository now
contains an offline end-to-end MVP: creator capture, relationship-scoped policy,
Relationship Agent presentation, recipient choice, planned interaction, and a
verified hardware simulator.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. No API key, backend, or physical hardware is
required.

## Demo path

1. Open `Recorder`, create a memory for Lin, choose the AI boundary, and optionally create the shared plan.
2. Open `Hardware simulator`, bind `loop-demo-device` as Mei, and entrust it to `person-lin`.
3. Trigger a `touch` event. The verified event returns to the recipient entry.
4. Enter as Lin, confirm identity, inspect the original and AI-organized provenance, and play audio only by explicit choice.
5. Accept the invitation, continue the plan, and save a response.

All state is in memory and resets on reload. The simulator proof is `LOOP-DEMO`.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

- `src/domain`: hardware-independent entities and permission rules.
- `src/adapters/contracts`: ports for capture, storage, agent orchestration,
  hardware events, and playback.
- `src/data`: fixed demo data and in-memory implementations.
- `src/app`: application shell and integrated routes.
- `src/shared`: shared presentational components.
- `src/styles`: global tokens and responsive layout.
- `src/features`: capture, agent, recipient, and hardware flows.

AI-organized content always references its source memory and remains distinct
from original content. The mock agent only selects owner-authorized memories;
it does not create new memories or new intent.

The four entry points use a dependency-free hash router so the offline build can
be opened from any static host without deep-link server configuration.
