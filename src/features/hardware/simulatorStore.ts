import { MockHardwareBridge } from '../../adapters/hardware'
import { HardwareFlowController } from './HardwareFlowController'
import { BrowserRecipientFlowNotifier } from './recipientNotifier'

export const simulatorBridge = new MockHardwareBridge()
export const simulatorController = new HardwareFlowController(
  simulatorBridge,
  new BrowserRecipientFlowNotifier(),
)
