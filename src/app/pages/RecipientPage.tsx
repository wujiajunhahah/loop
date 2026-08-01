import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'

export function RecipientPage() {
  return (
    <>
      <PageHeader
        eyebrow="Recipient entry"
        title="You decide when to open it."
        description="Recipient sessions explicitly support accept, postpone, skip, and permanent close. The recipient journey is reserved for its feature task."
        action={<ButtonLink to="/">Back</ButtonLink>}
      />
      <StatusPanel title="Consent boundary ready" state="ready">
        Session transitions and relationship-scoped memory retrieval are covered
        by the foundation tests.
      </StatusPanel>
    </>
  )
}
