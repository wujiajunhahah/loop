import { ButtonLink } from '../../shared/ui'

const entries = [
  {
    label: '记录者',
    title: '留下记忆',
    body: '通过关系化引导，留下真实内容，并确认它可以如何被使用。',
    to: '/capture',
  },
  {
    label: '接收者',
    title: '收到回应',
    body: '主动说出今天发生的事，让一段有来源的过去回应此刻。',
    to: '/recipient',
  },
  {
    label: '实体入口',
    title: '信物入口',
    body: '用可选的实体信物进入体验；没有硬件也能完成全部流程。',
    to: '/hardware',
  },
]

export function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">我在 W·HERE · We are here</p>
          <h1>过去的记忆，<br />回应今天。</h1>
          <p className="home-hero__lead">一份会回应的记忆。保留真实声音、共同经历和表达边界，只在你主动靠近时，连接此刻。</p>
          <div className="home-hero__actions">
            <ButtonLink to="/recipient">打开留给我的记忆 <span aria-hidden="true">→</span></ButtonLink>
            <ButtonLink to="/capture" tone="secondary">开始留下记忆</ButtonLink>
          </div>
          <p className="home-hero__note"><span aria-hidden="true" /> 由你进入 · 来源可查 · 随时离开</p>
        </div>

        <figure className="memory-coordinate">
          <div aria-hidden="true" className="memory-coordinate__meta"><span>杭州 · 雨</span><span>17:40</span></div>
          <div className="memory-coordinate__route" aria-hidden="true"><span /><i /></div>
          <div aria-hidden="true" className="memory-coordinate__source">
            <small>真实记忆 · 2012</small>
            <p>“又忘记带伞。回去先把头发吹干。”</p>
            <span>妈妈留下的原声</span>
          </div>
          <div aria-hidden="true" className="memory-coordinate__today">
            <small>今天 · 由你写下</small>
            <p>下班时又下雨了。</p>
          </div>
          <figcaption className="memory-coordinate__caption"><span className="sr-only">一段妈妈留下的雨天记忆，回应女儿今天遇见的雨。</span><span aria-hidden="true">两段时间，在这里相遇。</span></figcaption>
        </figure>
      </section>

      <section className="home-paths" aria-labelledby="paths-title">
        <header className="home-paths__header">
          <p className="eyebrow">同一段关系 · 两个时间方向</p>
          <h2 id="paths-title">从留下，到被再次找到。</h2>
        </header>
        <div className="entry-grid">
        {entries.map((entry) => (
          <article className="entry-card" key={entry.to}>
            <p className="entry-card__index"><span>0{entries.indexOf(entry) + 1}</span>{entry.label}</p>
            <h2>{entry.title}</h2>
            <p>{entry.body}</p>
            <ButtonLink to={entry.to} tone="secondary">
              进入 <span aria-hidden="true">→</span>
            </ButtonLink>
          </article>
        ))}
        </div>
      </section>

      <section className="truth-statement">
        <p className="eyebrow">真实高于拟真</p>
        <blockquote>“我们不让 AI 假装成为谁。每一句回应，都能回到一段真实留下的内容。”</blockquote>
        <div className="truth-statement__rules">
          <span>原始内容不被覆盖</span><span>AI 内容明确标记</span><span>接收者拥有主动权</span>
        </div>
      </section>
    </div>
  )
}
