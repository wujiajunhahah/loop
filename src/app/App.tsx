import { useEffect, useRef, useSyncExternalStore } from 'react'
import { CapturePage } from './pages/CapturePage'
import { HardwarePage } from './pages/HardwarePage'
import { HomePage } from './pages/HomePage'
import { RecipientPage } from './pages/RecipientPage'
import { HardwareBindPage, HardwareSimulatorPage, HardwareTriggerPage, hardwareSimulatorRoutes } from '../features/hardware/HardwareSimulatorPage'
import { clearEchoMapEntryAuthorization } from '../features/recipient/RecipientExperience'

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
  return (window.location.hash.slice(1).split('?')[0] || '/')
}

function NavigationLink({ route, label }: { route: string; label: string }) {
  const currentRoute = useSyncExternalStore(subscribeToHash, getRoute)
  const active = currentRoute === route || currentRoute.startsWith(`${route}/`) || (route === '/hardware' && currentRoute.startsWith('/hardware-simulator'))
  return (
    <a className={active ? 'active' : undefined} href={`#${route}`} aria-current={active ? 'page' : undefined}>
      {label}
    </a>
  )
}

export function App() {
  const route = useSyncExternalStore(subscribeToHash, getRoute)
  const mainRef = useRef<HTMLElement>(null)
  const Page = route.startsWith('/recipient/')
    ? RecipientPage
    : pages[route as keyof typeof pages] ?? HomePage

  useEffect(() => {
    const section = route.startsWith('/capture')
      ? '留下记忆'
      : route.startsWith('/recipient')
        ? '收到回应'
        : route.startsWith('/hardware')
          ? '信物入口'
          : '一份会回应的记忆'
    document.title = `${section} | 我在 W·HERE`
    if (!route.startsWith('/recipient/echo-map')) clearEchoMapEntryAuthorization()
    if (!route.startsWith('/recipient/echo-map')) mainRef.current?.focus({ preventScroll: true })
  }, [route])

  return (
    <div className="app-shell">
      <nav className="topbar" aria-label="主导航">
        <a className="brand" href="#/">
          <span className="brand__cn">我在</span> W<span aria-hidden="true">·</span>HERE
        </a>
        <div className="topbar__links">
          <NavigationLink route="/capture" label="留下记忆" />
          <NavigationLink route="/recipient" label="收到回应" />
          <NavigationLink route="/hardware" label="信物入口" />
        </div>
      </nav>
      <main ref={mainRef} tabIndex={-1}>
        <Page />
      </main>
      <footer className="site-footer"><span>W·HERE</span><span>一份会回应的记忆</span><span>真实 · 授权 · 有来源</span></footer>
    </div>
  )
}
