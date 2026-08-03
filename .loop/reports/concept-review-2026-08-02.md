# Concept Review: Context and Bereavement-State Game Exploration

## Source

External input reviewed on 2026-08-02:
`离世者Context与遗族状态感知_游戏概念发散(1).md`.

The source explores Echo Map, Memory Garden, Unfinished List, Traveling
Messenger, seasonal food, sound collection, lighthouse, and shared-memory map
concepts. The user has confirmed that this is the intended Agent game form for
Loop. It extends the current product foundation rather than replacing its Context,
permission, provenance, and recipient-control contracts.

## Overall Judgment

The document is directionally compatible with Loop where it requires voluntary
entry, source-backed memories, bounded AI, low interruption, and recipient
control. Its `现实轻探索` direction should become the interaction form around the
existing relationship Agent.

The recommended framing is:

> The Agent directs a voluntary journey and curates source-backed memories; the
> deceased is not an NPC, and progress does not measure grief recovery.

The current P0 remains:

```text
Context capture -> owner review -> relationship-scoped Agent
-> recipient choice -> source-backed InteractionArtifact
```

## Adopt As Existing Product Principles

- The recipient actively chooses whether and how deeply to approach content.
- Original memories and AI-generated composition remain visibly separate.
- Every memory or action suggestion has provenance and a recipient boundary.
- The recipient can pause, skip, reject, close, or delete without penalty.
- No grief score, recovery percentage, streak, decay, or failure punishment.
- No generated claim that the deceased wanted an action unless that wish was
  explicitly recorded and approved.
- `远行信使` is compatible as presentation language for the existing postcard
  artifact, provided it does not imply that the deceased is still acting.

## Recommended Product Form

- **Primary gameplay: Echo Map.** The player chooses a visible journey node and
  can inspect why it was suggested before accepting it.
- **Agent role: journey director and memory curator.** It proposes, explains,
  adapts, and assembles artifacts, but never speaks as an autonomous deceased
  person or invents wishes.
- **Agent representation: Traveling Messenger.** A neutral guide carries Context
  between the archive, the journey, and the resulting postcard.
- **Per-session result: postcard.** Each journey produces a source-backed
  InteractionArtifact combining approved memory and recipient-authored present
  life content.
- **Later progression: Memory Garden.** It visualizes accumulated encounters
  without streaks, decay, death, or recovery scores.

## First Playable Vertical Slice

The first game task should implement one complete state machine:

```text
choose intensity -> inspect journey proposal -> accept or skip
-> complete one simulated or real-world action -> open sourced memory
-> add present-life response -> create postcard -> light one map node
```

It should include:

- one Echo Map node based on the rainy-day mother/daughter Context;
- quiet / glimmer / deep user-selected intensity, with no automatic upgrade;
- one recorder-authored invitation and one neutral fallback action;
- visible source IDs and AI-generation labels;
- skip, stop, reject, and permanently hide controls;
- one recipient-authored note or image reference stored separately from the
  recorder's Context;
- deterministic offline behavior for the hackathon Demo.

The first playable should not require GPS, HRV, a real route, an LLM, or hardware.
Those integrations can replace simulated inputs after the interaction is proven.

## P2 Or Out Of Current Scope

- HRV, heart rate, sleep, skin conductance, or inferred emotional state;
- continuous GPS, passive sensing, or background recording;
- Memory Garden growth and other persistent game progression;
- multi-recipient shared constellations or family state sharing;
- generated routes, health guidance, or adaptive interventions;
- a broad task system, reward economy, streak, or completion score.

## Required Evidence Before Promotion

- moderated user research with explicit consent and a distress exit path;
- evidence that sensor data adds value beyond direct user choice;
- location and health-data minimization, retention, and deletion rules;
- language review showing no digital resurrection or coercive wish framing;
- a narrow prototype that does not add persistence or hardware to the P0 Demo.

## Coordination Result

The Agent game is now a confirmed product direction. No code task is opened by
this clarification alone: the next coordination artifact should be a focused
game-design task for the first playable vertical slice, with owned files,
acceptance criteria, privacy constraints, and a rollback path. Broad progression,
sensors, and multiplayer must not enter that first task.
