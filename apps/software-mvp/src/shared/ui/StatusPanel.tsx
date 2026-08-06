import type { ReactNode } from 'react'

interface StatusPanelProps {
  title: string
  children: ReactNode
  state?: 'ready' | 'pending'
}

export function StatusPanel({
  title,
  children,
  state = 'pending',
}: StatusPanelProps) {
  return (
    <section className="status-panel">
      <div className={`status-dot status-dot--${state}`} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </section>
  )
}
