import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'

export function HardwarePage() {
  return (
    <>
      <PageHeader
        eyebrow="Hardware simulator"
        title="A physical signal, behind one bridge."
        description="Device-specific behavior remains outside the core model. The simulator implementation is available for a later hardware feature UI."
        action={<ButtonLink to="/">Back</ButtonLink>}
      />
      <StatusPanel title="Mock bridge connected" state="ready">
        Mark, touch, wear, confirm, and dismiss events can be emitted without a
        physical device.
      </StatusPanel>
    </>
  )
}
