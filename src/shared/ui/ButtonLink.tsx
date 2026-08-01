import type { ReactNode } from 'react'

interface ButtonLinkProps {
  children: ReactNode
  to: string
  tone?: 'primary' | 'secondary'
}

export function ButtonLink({
  children,
  to,
  tone = 'primary',
}: ButtonLinkProps) {
  return (
    <a className={`button button--${tone}`} href={`#${to}`}>
      {children}
    </a>
  )
}
