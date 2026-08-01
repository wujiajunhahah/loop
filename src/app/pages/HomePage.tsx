import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'

const entries = [
  {
    title: 'Recorder',
    body: 'Prepare a real memory, its recipient, meaning, and permission boundary.',
    to: '/capture',
  },
  {
    title: 'Recipient',
    body: 'Enter by choice and decide whether to accept, postpone, skip, or close.',
    to: '/recipient',
  },
  {
    title: 'Hardware simulator',
    body: 'Exercise the hardware-neutral bridge without a connected device.',
    to: '/hardware',
  },
]

export function HomePage() {
  return (
    <>
      <PageHeader
        eyebrow="Loop foundation"
        title="A relationship can keep its context."
        description="The software foundation keeps original memories, permissions, recipient choice, and physical triggers separate and inspectable."
      />

      <div className="entry-grid">
        {entries.map((entry) => (
          <article className="entry-card" key={entry.to}>
            <p className="entry-card__index">0{entries.indexOf(entry) + 1}</p>
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
            <ButtonLink to={entry.to} tone="secondary">
              Open
            </ButtonLink>
          </article>
        ))}
      </div>

      <StatusPanel title="Offline demo foundation" state="ready">
        Seed data and in-memory adapters are active. No hardware, backend, or API
        key is required.
      </StatusPanel>
    </>
  )
}
