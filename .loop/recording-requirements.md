# Recording-derived interaction requirements

Source: user-supplied audio, transcribed locally for design extraction. This is a product input, not an audio asset to commit; the original local path is intentionally not retained.

## Product shape

- The physical object has two stages: creator capture while the person is present, and recipient companionship after entrustment.
- The object may be a ring/marker plus a dock or charging/audio base. The app must keep device identity, audio source, and consent separate.
- A mark/touch should help the creator save a moment, but it must not silently start a microphone, camera, or playback.

## Interaction

- Creator capture should feel like a low-pressure guided conversation. Bounded prompts and QA are preferred to a blank form or an unconstrained impersonation chat.
- The system can ask about a situation, desired future interaction, relationship, shared plan, or why a memory matters. The creator reviews and saves the result.
- A Memory Seed is a real source plus relationship, situation, and creator intent. Generated images, video, or text are derived presentations and must be labeled.
- Recipient experience is optional and exploratory. Preserve original recordings and provenance; do not claim to cure grief, make a person move on, or speak new unapproved intentions.
- Context can include weather, a photo, a shared plan, or a small daily action. Wearable data is weak context only and never a grief detector.
- A warm identity cue such as 我在 / I am here can be used as product language, but it must not imply literal presence or digital resurrection.

## Safety and platform behavior

- Explicit consent is required before capture, audio playback, or sharing.
- Hardware events can open a pending capture/recipient state; they cannot by themselves grant content or microphone permission.
- Prefer foreground BLE and visible diagnostics until a named iPhone and firmware have verified background behavior.
- Every generated presentation must show source and generated status and keep recipient responses separate from creator-authorized memory.

## Confidence

The supplied recording contains long low-information/repeated-audio sections. The requirements above are the stable, repeated design ideas extracted from the intelligible sections and should be verified against the product owner during review.
