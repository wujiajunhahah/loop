import { RecipientExperience } from '../../features/recipient/RecipientExperience'
import { offlineDemoService } from '../../data/offlineDemo'

export function RecipientPage() {
  return <RecipientExperience data={offlineDemoService} />
}
