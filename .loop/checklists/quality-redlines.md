# Loop Quality Redlines

This is the local, OpenCode-compatible quality gate adapted from the useful
parts of AutoDev. It supplements task-specific acceptance criteria; it does
not replace them.

## Before Editing

- [ ] Read the product context, status, decisions, risks, queue, and task file.
- [ ] Claim exactly one task and confirm its allowed files.
- [ ] Record unresolved contract or product ambiguity as a Decision Request.

## Implementation Redlines

- [ ] No placeholder UI, empty handler, TODO implementation, or hard-coded
      success path is presented as a finished capability.
- [ ] No mock, fixture, or deterministic adapter is described as production
      AI, authentication, media capture, persistence, or hardware.
- [ ] Original content remains separate from derived or generated content.
- [ ] AI output has an explicit policy boundary, source Context IDs, AI label,
      generation mode, and explainable trigger reason.
- [ ] Recipient-scoped data cannot cross relationship or permission boundaries.
- [ ] Hardware remains optional and has an offline software fallback where the
      task requires a physical entry point.
- [ ] Existing product constraints are not silently downgraded to make a test
      pass.

## Review And Verification

- [ ] Perform an independent skeptical pass against acceptance criteria and
      known risks.
- [ ] Run `npm run verify`.
- [ ] Run `git diff --check`.
- [ ] Exercise the task's manual smoke path, including failure or recovery
      behavior when relevant.
- [ ] Check that README, STATUS, decisions, risks, claims, and reports agree
      with the verified result.
- [ ] Record limitations and unverified browser, media, network, or hardware
      behavior explicitly.

## Stop Conditions

Stop and request a decision when:

- a requirement conflicts with the product context or a durable decision;
- the change needs files owned by another task;
- verification requires a production service, credential, device, or media
  asset that is unavailable;
- a test passes only by weakening a stated product or safety boundary.
