# Foundation Report

## Scope

The software MVP foundation is complete. It provides a runnable shell, domain
boundaries, service contracts, in-memory adapters, seed data, and route
skeletons. It does not implement the capture, agent, recipient, or hardware
feature modules.

## Technology Stack

- React 19 and TypeScript 7
- Vite 8
- Vitest 4 with jsdom and Testing Library matchers
- Dependency-free hash routing for offline/static-host compatibility
- Plain CSS design tokens and responsive layout

No backend, physical device, remote API, or API key is required.

## Directory Structure

```text
src/
  app/                    application shell and page entry skeletons
  domain/                 entities, permissions, recipient choices, events
  features/               reserved empty feature ownership boundaries
    capture/
    agent/
    recipient/
    hardware/
  adapters/contracts/     service ports
  shared/ui/              shared presentational components
  data/                   seed data and in-memory implementations
  styles/                 global visual tokens and responsive rules
  test/                   test environment setup
```

## Domain Model

The foundation defines `Person`, `Relationship`, `Memory`,
`PlannedInteraction`, `AgentPolicy`, `HardwareEvent`, and `RecipientSession`.

Key invariants:

- `Memory.original` remains separate from optional `Memory.organized` content.
- Organized content records source memory IDs and owner review status.
- Relationship-specific memory is checked against both relationship and
  recipient.
- Private memory cannot be selected by the Agent.
- `AgentPolicy.allowNewMemoryGeneration` can only be `false`.
- A permanently closed recipient session cannot be reopened by a later choice.
- Hardware types are generic events; no specific physical form is in the domain.

## Service Contracts

- `ContextCaptureService`: captures original memory through a store.
- `RelationshipStore`: stores and retrieves relationship-scoped context.
- `AgentService`: composes a presentation from authorized source memories.
- `HardwareBridge`: subscribes to generic events and controls abstract feedback.
- `PlaybackService`: starts and stops original-content playback.

All five contracts have in-memory or mock implementations under `src/data`.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Verification

- Type check: passed
- Tests: 3 files, 11 tests passed
- Production build: passed
- Dependency audit: 0 vulnerabilities

## Unresolved Risks

- In-memory state is reset on reload; persistence belongs to a later task.
- Seed audio uses a placeholder URI and has no bundled media asset yet.
- The mock Agent selects one authorized memory and does not perform remote AI
  orchestration.
- Hardware feedback methods are no-ops until a simulator UI or real adapter is
  implemented.
- Empty `src/features/*` directories are not represented by Git until their
  owning feature tasks add files.

## Integration

The foundation is ready for feature branches to build against the domain and
contract interfaces. Review the commit containing this report with
`git log -1 --oneline`.
