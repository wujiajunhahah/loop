import { RecipientExperience } from '../../features/recipient/RecipientExperience'
import { offlineDemoService } from '../../data/offlineDemo'
import { EchoMapJourneyExperience } from '../../features/journey/ui/EchoMapJourneyExperience'

export function RecipientPage() {
  if (window.location.hash.slice(1).startsWith('/recipient/echo-map')) {
    return <EchoMapJourneyExperience data={offlineDemoService} />
  }
  return <RecipientExperience data={offlineDemoService} />
}
