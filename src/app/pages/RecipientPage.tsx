import {
  clearEchoMapEntryAuthorization,
  isEchoMapEntryAuthorized,
  RecipientExperience,
} from '../../features/recipient/RecipientExperience'
import { offlineDemoService } from '../../data/offlineDemo'
import { EchoMapJourneyExperience } from '../../features/journey/ui/EchoMapJourneyExperience'

export function RecipientPage() {
  const route = window.location.hash.slice(1)
  if (route.startsWith('/recipient/echo-map') && !isEchoMapEntryAuthorized()) {
    return <section className="recipient-shell"><p className="eyebrow">Echo Map · 需要身份确认</p><h1>请先确认这是留给你的。</h1><p className="recipient-lead">刷新或直接打开旅程不会恢复接收者授权，也不会创建新的旅程会话。</p><a className="button button--primary" href="#/recipient">回到接收者入口</a></section>
  }
  if (route.startsWith('/recipient/echo-map')) {
    return <EchoMapJourneyExperience data={offlineDemoService} />
  }
  if (route === '/recipient') clearEchoMapEntryAuthorization()
  return <RecipientExperience data={offlineDemoService} />
}
