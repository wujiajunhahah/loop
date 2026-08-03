import { useEffect, useRef, useState, type ReactNode } from 'react'
import './memory-game.css'

type Chapter = '看见' | '说' | '寻找' | '去做' | '你在'

const chapters: Array<{ name: Chapter; label: string; detail: string }> = [
  { name: '看见', label: '我在，你看见', detail: '从留下的东西开始' },
  { name: '说', label: '我在，你说', detail: '把今天放进来' },
  { name: '寻找', label: '我在，你寻找', detail: '沿着线索靠近' },
  { name: '去做', label: '我在，你去做', detail: '让记忆回到生活' },
  { name: '你在', label: '你在', detail: '带着关系继续' },
]

const memories = [
  {
    title: '雨窗',
    meta: '日常层 · 2012.07.16',
    text: '“又忘记带伞。回去先把头发吹干。”',
    source: 'Mei 的原声 · asset-rain-01',
    color: 'blue',
  },
  {
    title: '番茄和鸡蛋',
    meta: '关系层 · 厨房',
    text: '她总说，先把鸡蛋炒得松一点，才像家里的味道。',
    source: '共同习惯 · context-kitchen-02',
    color: 'orange',
  },
  {
    title: '没有寄出的感谢',
    meta: '深层表达 · 需主动打开',
    text: '有些话她没有说完，但留下了一个可以慢慢理解的开头。',
    source: 'Mei 主动留下 · context-letter-03',
    color: 'green',
  },
]

const clues = [
  { key: 'sound', title: '一段声音', hint: '雨落在窗台，像很远的掌声。', reveal: '它属于“雨窗”，不是天气记录，是她在等你回家的那天。', source: 'context-rainy-day · asset-rain-01' },
  { key: 'object', title: '一件物品', hint: '一把伞，伞柄上有被磨亮的痕迹。', reveal: '这把伞总放在门后。她说，家里总要有一把给忘记带伞的人。', source: 'context-umbrella-object · Mei 留下' },
  { key: 'route', title: '一条路线', hint: '菜市场 → 河边 → 旧楼下。', reveal: '那是她买完菜后最常走的路，经过河边时会给你发一张模糊的照片。', source: 'context-market-route · Mei 留下' },
]

function ChapterRail({ active, unlocked }: { active: number; unlocked: number }) {
  return (
    <aside className="memory-game__rail" aria-label="记忆旅程章节">
      <div className="memory-game__rail-brand"><span>W·HERE</span><small>一份会回应的记忆</small></div>
      <div className="memory-game__rail-list">
        {chapters.map((chapter, index) => (
          <div className={`chapter-marker ${index === active ? 'is-active' : ''} ${index <= unlocked ? 'is-unlocked' : ''}`} key={chapter.name}>
            <span className="chapter-marker__line" aria-hidden="true" />
            <span className="chapter-marker__number">0{index + 1}</span>
            <span className="chapter-marker__name">{chapter.name}</span>
          </div>
        ))}
      </div>
      <p className="memory-game__rail-note">所有内容都可以<br />随时离开，稍后再来。</p>
    </aside>
  )
}

function SourceStamp({ children, tone = 'original' }: { children: ReactNode; tone?: 'original' | 'derived' | 'recipient' }) {
  return <span className={`source-stamp source-stamp--${tone}`}><i aria-hidden="true" />{children}</span>
}

function MemoryGame() {
  const [active, setActive] = useState(0)
  const [unlocked, setUnlocked] = useState(0)
  const [selectedMemory, setSelectedMemory] = useState(0)
  const [note, setNote] = useState('')
  const [found, setFound] = useState<string[]>([])
  const [actionDone, setActionDone] = useState(false)
  const [newChapter, setNewChapter] = useState('')
  const [finished, setFinished] = useState(false)
  const chapterHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    chapterHeadingRef.current?.focus({ preventScroll: true })
  }, [active])

  const moveTo = (next: number) => {
    setActive(next)
    setUnlocked((current) => Math.max(current, next))
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  const continueFromSay = () => moveTo(2)
  const continueFromSeek = () => moveTo(3)

  return (
    <section className="memory-game" aria-label="W·HERE 记忆旅程">
      <header className="memory-game__topline">
        <div><span className="memory-game__kicker">MEMORY ROOM / 01</span><span className="memory-game__relationship">Mei → Lin · 一段母女关系</span></div>
        <a href="#/" className="memory-game__exit">离开旅程 <span aria-hidden="true">↗</span></a>
      </header>

      <div className="memory-game__body">
        <ChapterRail active={active} unlocked={unlocked} />

        <div className="memory-game__stage">
          {active === 0 && (
            <section className="chapter chapter--see" aria-labelledby="chapter-see-title">
              <div className="chapter__intro">
                <p className="chapter__eyebrow">CHAPTER 01 · 记忆不是全部同时打开的</p>
                <h1 id="chapter-see-title" ref={chapterHeadingRef} tabIndex={-1}>我在，<em>你看见。</em></h1>
                <p className="chapter__lead">先从一些日常的小东西开始。你可以靠近，也可以停在这里。每一张卡片都来自 Mei 主动留下的内容。</p>
              </div>
              <div className="archive-table">
                <div className="archive-table__top"><span>MEI 的记忆抽屉</span><span>03 ITEMS · 可查看</span></div>
                <div className="archive-table__cards">
                  {memories.map((memory, index) => (
                    <button className={`memory-card memory-card--${memory.color} ${index === selectedMemory ? 'is-selected' : ''}`} key={memory.title} onClick={() => setSelectedMemory(index)}>
                      <span className="memory-card__pin" aria-hidden="true" />
                      <span className="memory-card__meta">{memory.meta}</span>
                      <strong>{memory.title}</strong>
                      <span className="memory-card__text">{memory.text}</span>
                      <span className="memory-card__index">0{index + 1}</span>
                    </button>
                  ))}
                </div>
                <div className="archive-table__detail">
                  <div className="archive-table__object" aria-hidden="true"><span>{selectedMemory === 0 ? '雨' : selectedMemory === 1 ? '家' : '信'}</span></div>
                  <div><SourceStamp>{memories[selectedMemory].source}</SourceStamp><p>{memories[selectedMemory].text}</p><small>原始内容保留 · 没有被 AI 改写</small></div>
                </div>
              </div>
              <div className="chapter__footer"><span>你可以先看见，不必马上回答。</span><button className="game-button game-button--dark" onClick={() => moveTo(1)}>把今天放进来 <span aria-hidden="true">→</span></button></div>
            </section>
          )}

          {active === 1 && (
            <section className="chapter chapter--say" aria-labelledby="chapter-say-title">
              <div className="chapter__intro chapter__intro--narrow">
                <p className="chapter__eyebrow">CHAPTER 02 · 你的今天也属于这段关系</p>
                <h1 id="chapter-say-title" ref={chapterHeadingRef} tabIndex={-1}>我在，<em>你说。</em></h1>
                <p className="chapter__lead">过去不会替你回答。你可以把现在的生活、没有说完的话，或者一件正在面对的事，放在这里。</p>
              </div>
              <div className="say-workspace">
                <div className="say-workspace__prompt"><span className="prompt-mark">“</span><p>今天有什么，让你想起她？</p><span className="prompt-caption">不需要说得完整。</span></div>
                <label className="memory-textarea"><span className="sr-only">写下今天想说的话</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="写下一句话，或者只写几个词……" rows={6} /><span className="memory-textarea__foot"><SourceStamp tone="recipient">写于今天 · Lin</SourceStamp><span>{note.length} / 240</span></span></label>
              </div>
              <div className="chapter__footer"><button className="game-button game-button--quiet" onClick={() => moveTo(0)}>← 回到上一段</button><button className="game-button game-button--dark" onClick={continueFromSay}>{note.trim() ? '保存这一页' : '先不写，也可以'} <span aria-hidden="true">→</span></button></div>
            </section>
          )}

          {active === 2 && (
            <section className="chapter chapter--seek" aria-labelledby="chapter-seek-title">
              <div className="chapter__intro">
                <p className="chapter__eyebrow">CHAPTER 03 · 记忆留下了线索</p>
                <h1 id="chapter-seek-title" ref={chapterHeadingRef} tabIndex={-1}>我在，<em>你寻找。</em></h1>
                <p className="chapter__lead">没有答错。你只是在不同的入口，遇见同一段关系的不同侧面。</p>
              </div>
              <div className="clue-board">
                <div className="clue-board__header"><span>一场雨留下了三种说法</span><span>{found.length} / 3 已找到</span></div>
                <div className="clue-board__grid">
                  {clues.map((clue) => {
                    const isFound = found.includes(clue.key)
                    return <button className={`clue-card ${isFound ? 'is-found' : ''}`} key={clue.key} onClick={() => setFound((current) => current.includes(clue.key) ? current : [...current, clue.key])}>
                      <span className="clue-card__symbol" aria-hidden="true">{clue.key === 'sound' ? '◒' : clue.key === 'object' ? '⌂' : '⌁'}</span><strong>{clue.title}</strong><span>{isFound ? clue.reveal : clue.hint}</span>{isFound ? <SourceStamp>{clue.source}</SourceStamp> : <small>点击寻找</small>}
                    </button>
                  })}
                </div>
              </div>
              <div className="chapter__footer"><button className="game-button game-button--quiet" onClick={() => moveTo(1)}>← 回到上一段</button><span>探索记忆，不是证明你记得多少。</span><button className="game-button game-button--dark" onClick={continueFromSeek}>把它带回生活 <span aria-hidden="true">→</span></button></div>
            </section>
          )}

          {active === 3 && (
            <section className="chapter chapter--do" aria-labelledby="chapter-do-title">
              <div className="chapter__intro chapter__intro--narrow">
                <p className="chapter__eyebrow">CHAPTER 04 · 现实是记忆的下一页</p>
                <h1 id="chapter-do-title" ref={chapterHeadingRef} tabIndex={-1}>我在，<em>你去做。</em></h1>
                <p className="chapter__lead">选一件轻一点的事，让过去在今天发生一次。系统不会检测你有没有做到，只有你自己知道。</p>
              </div>
              <div className="action-scene">
                <div className="action-scene__window" aria-hidden="true"><span className="window-rain window-rain--one" /><span className="window-rain window-rain--two" /><span className="window-rain window-rain--three" /><span className="window-light" /></div>
                <div className="action-scene__copy"><span className="action-scene__label">今天 · 一分钟</span><h2>去窗边，<br />看一会儿雨。</h2><p>不是她的要求。只是 Loop 为你留的一小段空白。</p><SourceStamp tone="derived">建议由 Loop 提供 · 不是 Mei 的留言</SourceStamp></div>
                <button className={`game-button ${actionDone ? 'game-button--done' : 'game-button--orange'}`} onClick={() => setActionDone(true)}>{actionDone ? '我记下来了' : '我做了这件事'} <span aria-hidden="true">{actionDone ? '✓' : '→'}</span></button>
              </div>
              <div className="new-chapter"><label htmlFor="new-chapter-note">如果愿意，留下这一刻的新章节</label><textarea id="new-chapter-note" value={newChapter} onChange={(event) => setNewChapter(event.target.value)} placeholder="今天的窗边，是什么样的？" rows={3} /><div><SourceStamp tone="recipient">只写入 Lin 的新章节</SourceStamp><span>{newChapter.length} / 240</span></div></div>
              <div className="chapter__footer"><button className="game-button game-button--quiet" onClick={() => moveTo(2)}>← 回到上一段</button><button className="game-button game-button--dark" disabled={!actionDone} onClick={() => moveTo(4)}>继续往前 <span aria-hidden="true">→</span></button></div>
            </section>
          )}

          {active === 4 && (
            <section className="chapter chapter--here" aria-labelledby="chapter-here-title">
              <div className="here-constellation" aria-hidden="true"><span className="constellation-dot constellation-dot--a" /><span className="constellation-dot constellation-dot--b" /><span className="constellation-dot constellation-dot--c" /><span className="constellation-line constellation-line--a" /><span className="constellation-line constellation-line--b" /></div>
              <div className="chapter__intro chapter__intro--final">
                <p className="chapter__eyebrow">CHAPTER 05 · 关系不会替你生活</p>
                <h1 id="chapter-here-title" ref={chapterHeadingRef} tabIndex={-1}>你在。</h1>
                <p className="chapter__lead">你已经看见了她留下的东西，也把今天放了进来。接下来不是继续寻找一个终点，而是带着这段关系，去过你的生活。</p>
              </div>
              {newChapter.trim() ? <div className="here-letter"><span className="here-letter__mark">Lin / today</span><p>{newChapter}</p><footer><span>一份新的章节</span><SourceStamp tone="recipient">由你写下</SourceStamp></footer></div> : <div className="here-letter here-letter--empty"><span className="here-letter__mark">今天没有新增章节</span><p>这一刻不必被写下来，也同样可以继续往前。</p><footer><span>没有生成替代内容</span><SourceStamp tone="derived">未写入任何人的 Context</SourceStamp></footer></div>}
              <div className="here-actions"><button className="game-button game-button--dark" onClick={() => setFinished(true)}>{finished ? '这一段已收好' : '收好这一段'} <span aria-hidden="true">{finished ? '✓' : '→'}</span></button><a className="game-button game-button--quiet" href="#/">离开，不需要通关 <span aria-hidden="true">↗</span></a></div>
              {finished && <p className="here-confirmation">你随时可以回来。没有倒计时，也没有需要完成的下一关。</p>}
            </section>
          )}
        </div>
      </div>
    </section>
  )
}

export { MemoryGame }
