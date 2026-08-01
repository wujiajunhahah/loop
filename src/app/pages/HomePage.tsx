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
        eyebrow="Loop offline demo"
        title="让真实的关系，继续抵达。"
        description="记录者留下真实内容并设定边界，接收者主动打开，Relationship Agent 只在授权范围内整理，戒指把这次进入变成可验证的实体入口。"
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
        可在无网络、无 API、无真实硬件时完成“记录、托付、触发、验证、呈现、继续计划、留下回应”的完整 Demo。
      </StatusPanel>
    </>
  )
}
