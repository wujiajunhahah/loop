# Loop Software MVP

Loop is a hardware-neutral relationship-context prototype. This repository
currently contains the software foundation: domain types, service contracts,
in-memory adapters, seed data, route skeletons, and tests. It does not contain
complete capture, agent, recipient, or hardware features.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. No API key, backend, or physical hardware is
required.

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
- `src/app`: application shell and route skeletons.
- `src/shared`: shared presentational components.
- `src/styles`: global tokens and responsive layout.
- `src/features`: reserved ownership boundaries for future feature tasks.

AI-organized content always references its source memory and remains distinct
from original content. The mock agent only selects owner-authorized memories;
it does not create new memories or new intent.

The four entry points use a dependency-free hash router so the offline build can
be opened from any static host without deep-link server configuration.
