import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'

const entries = [
  {
    title: 'Recorder',
    body: 'Record a real Context, choose its recipient, and review the source boundary.',
    to: '/capture',
  },
  {
    title: 'Recipient',
    body: 'Enter by choice, inspect provenance, and keep the resulting postcard.',
    to: '/recipient',
  },
  {
    title: 'Hardware simulator',
    body: 'Optionally exercise the hardware-neutral bridge and software fallback.',
    to: '/hardware',
  },
]

export function HomePage() {
  return (
    <>
      <PageHeader
        eyebrow="Loop offline demo"
        title="让真实的关系，继续抵达。"
        description="记录者留下真实 Context 并设定边界，接收者主动打开，Relationship Agent 只在授权范围内整理，明信片记录这次有来源的互动。"
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
        主流程可在无网络、无 API、无设备时完成“录入 Context、关系 Agent、接收者主动进入、来源追溯、远行明信片、离线 fallback”。硬件模拟器是可替换的旁路入口。
      </StatusPanel>
    </>
  )
}
