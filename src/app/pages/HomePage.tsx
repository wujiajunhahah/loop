import { ButtonLink, PageHeader, StatusPanel } from '../../shared/ui'

const entries = [
  {
    title: '留下记忆',
    body: '通过关系化引导，留下真实内容，并确认它可以如何被使用。',
    to: '/capture',
  },
  {
    title: '收到回应',
    body: '主动说出今天发生的事，让一段有来源的过去回应此刻。',
    to: '/recipient',
  },
  {
    title: '信物入口',
    body: '用可选的实体信物进入体验；没有硬件也能完成全部流程。',
    to: '/hardware',
  },
]

export function HomePage() {
  return (
    <>
      <PageHeader
        eyebrow="我在 W·HERE · We are here"
        title="过去的记忆，回应现在的生活。"
        description="在生前留下真实的声音、经历与关系边界；当亲友主动靠近时，让经过确认的记忆给出克制、有来源的回应。"
      />

      <div className="entry-grid">
        {entries.map((entry) => (
          <article className="entry-card" key={entry.to}>
            <p className="entry-card__index">0{entries.indexOf(entry) + 1}</p>
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
            <ButtonLink to={entry.to} tone="secondary">
              进入
            </ButtonLink>
          </article>
        ))}
      </div>

      <StatusPanel title="真实高于拟真" state="ready">
        AI 不扮演离世者，也不自由编造。每次回应都保留原始来源、授权边界与 AI 标记，并由接收者决定何时开始和结束。
      </StatusPanel>
    </>
  )
}
