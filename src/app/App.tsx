import { useSyncExternalStore } from 'react'
import { CapturePage } from './pages/CapturePage'
import { HardwarePage } from './pages/HardwarePage'
import { HomePage } from './pages/HomePage'
import { RecipientPage } from './pages/RecipientPage'
import { DeviceCenterPage } from '../features/devices/DeviceCenterPage'
import { HardwareBindPage, HardwareSimulatorPage, HardwareTriggerPage, hardwareSimulatorRoutes } from '../features/hardware/HardwareSimulatorPage'

const pages = {
  '/': HomePage,
  '/capture': CapturePage,
  '/capture/new': CapturePage,
  '/capture/review': CapturePage,
  '/capture/success': CapturePage,
  '/recipient': RecipientPage,
  '/devices': DeviceCenterPage,
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
  const isCurrent = currentRoute === route || currentRoute.startsWith(`${route}/`)
  return (
    <a
      aria-current={isCurrent ? 'page' : undefined}
      className={isCurrent ? 'active' : undefined}
      href={`#${route}`}
    >
      {label}
    </a>
  )
}

export function App() {
  const route = useSyncExternalStore(subscribeToHash, getRoute)
  const Page = route.startsWith('/recipient/')
    ? RecipientPage
    : route.startsWith('/devices/')
      ? DeviceCenterPage
      : pages[route as keyof typeof pages] ?? HomePage

  return (
    <div className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#/">
          Loop<span aria-hidden="true">.</span>
        </a>
        <div className="topbar__links">
          <NavigationLink route="/capture" label="Recorder" />
          <NavigationLink route="/recipient" label="Recipient" />
          <NavigationLink route="/devices" label="Devices" />
        </div>
      </nav>
      <main>
        <Page />
      </main>
      <footer>Loop MVP / offline mock mode / recipient remains in control</footer>
    </div>
  )
}
