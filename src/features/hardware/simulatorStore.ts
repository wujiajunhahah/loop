import {
  MockHardwareBridge,
  type TriggerSource,
} from '../../adapters/hardware'
import type { EntryEvent } from '../../domain'
import { HardwareFlowController } from './HardwareFlowController'
import { BrowserRecipientFlowNotifier } from './recipientNotifier'

const bridge = new MockHardwareBridge()

// Temporary typing shim for the legacy recipient subscriber outside TASK-014's scope.
type LegacySimulatorView = Omit<MockHardwareBridge, 'subscribe'> & {
  subscribe(
    listener: (
      event: EntryEvent & { readonly eventType?: TriggerSource | 'simulated' },
    ) => void,
  ): () => void
}

export const simulatorBridge = bridge as LegacySimulatorView
export const simulatorController = new HardwareFlowController(
  bridge,
  new BrowserRecipientFlowNotifier(),
)
