import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'

export function CapturePage() {
  return (
    <>
      <PageHeader
        eyebrow="Recorder entry"
        title="Capture a moment with intent."
        description="This boundary will collect the original source, recipient, meaning, visibility, and AI policy. The capture flow is reserved for its feature task."
        action={<ButtonLink to="/">Back</ButtonLink>}
      />
      <StatusPanel title="Contract ready" state="ready">
        ContextCaptureService can save an original memory through the in-memory
        RelationshipStore.
      </StatusPanel>
    </>
  )
}
