/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OMI_FRAGMENT_LAYOUT?: string
  readonly VITE_OMI_FIRMWARE_MODEL?: string
  readonly VITE_OMI_FIRMWARE_VERSION?: string
  readonly VITE_RING_DISCOVERY_NAMES?: string
  readonly VITE_RING_DISCOVERY_SERVICE_IDS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
