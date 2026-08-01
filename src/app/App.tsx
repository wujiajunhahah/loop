import { useSyncExternalStore } from 'react'
import { CapturePage } from './pages/CapturePage'
import { HardwarePage } from './pages/HardwarePage'
import { HomePage } from './pages/HomePage'
import { RecipientPage } from './pages/RecipientPage'

const pages = {
  '/': HomePage,
  '/capture': CapturePage,
  '/recipient': RecipientPage,
  '/hardware': HardwarePage,
} as const

function subscribeToHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function getRoute() {
  return window.location.hash.slice(1) || '/'
}

function NavigationLink({ route, label }: { route: string; label: string }) {
  const currentRoute = useSyncExternalStore(subscribeToHash, getRoute)
  return (
    <a className={currentRoute === route ? 'active' : undefined} href={`#${route}`}>
      {label}
    </a>
  )
}

export function App() {
  const route = useSyncExternalStore(subscribeToHash, getRoute)
  const Page = pages[route as keyof typeof pages] ?? HomePage

  return (
    <div className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#/">
          Loop<span aria-hidden="true">.</span>
        </a>
        <div className="topbar__links">
          <NavigationLink route="/capture" label="Recorder" />
          <NavigationLink route="/recipient" label="Recipient" />
          <NavigationLink route="/hardware" label="Hardware" />
        </div>
      </nav>
      <main>
        <Page />
      </main>
      <footer>Loop MVP foundation / local mock mode</footer>
    </div>
  )
}
