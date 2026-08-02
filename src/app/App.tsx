import { useSyncExternalStore } from 'react'
import { CapturePage } from './pages/CapturePage'
import { HardwarePage } from './pages/HardwarePage'
import { HomePage } from './pages/HomePage'
import { RecipientPage } from './pages/RecipientPage'
import { HardwareBindPage, HardwareSimulatorPage, HardwareTriggerPage, hardwareSimulatorRoutes } from '../features/hardware/HardwareSimulatorPage'

const pages = {
  '/': HomePage,
  '/capture': CapturePage,
  '/capture/new': CapturePage,
  '/capture/review': CapturePage,
  '/capture/success': CapturePage,
  '/recipient': RecipientPage,
  '/hardware': HardwarePage,
  [hardwareSimulatorRoutes.overview]: HardwareSimulatorPage,
  [hardwareSimulatorRoutes.bind]: HardwareBindPage,
  [hardwareSimulatorRoutes.trigger]: HardwareTriggerPage,
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
  const active = currentRoute === route || currentRoute.startsWith(`${route}/`)
  return (
    <a className={active ? 'active' : undefined} href={`#${route}`}>
      {label}
    </a>
  )
}

export function App() {
  const route = useSyncExternalStore(subscribeToHash, getRoute)
  const Page = route.startsWith('/recipient/')
    ? RecipientPage
    : pages[route as keyof typeof pages] ?? HomePage

  return (
    <div className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#/">
          <span className="brand__cn">我在</span> W<span aria-hidden="true">·</span>HERE
        </a>
        <div className="topbar__links">
          <NavigationLink route="/capture" label="留下记忆" />
          <NavigationLink route="/recipient" label="收到回应" />
          <NavigationLink route="/hardware" label="信物入口" />
        </div>
      </nav>
      <main>
        <Page />
      </main>
      <footer>W·HERE MVP · 一份会回应的记忆 · 接收者始终拥有主动权</footer>
    </div>
  )
}
