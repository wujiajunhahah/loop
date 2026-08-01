import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'
import { CaptureFlow } from '../../features/capture/CaptureFlow'
import { offlineDemoService } from '../../data/offlineDemo'

export function CapturePage() {
  const route = window.location.hash.slice(1) || '/capture'
  if (route !== '/capture') return <CaptureFlow route={route} service={offlineDemoService} />

  return (
    <>
      <PageHeader
        eyebrow="Recorder entry"
        title="Capture a moment with intent."
        description="This boundary will collect the original source, recipient, meaning, visibility, and AI policy. The capture flow is reserved for its feature task."
        action={<ButtonLink to="/capture/new">Start a record</ButtonLink>}
      />
      <StatusPanel title="Contract ready" state="ready">
        Choose an input, name the relationship, and confirm the AI boundary before anything is saved.
      </StatusPanel>
    </>
  )
}
