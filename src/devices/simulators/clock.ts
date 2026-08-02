import type { DeterministicClock } from './types'

export function createDeterministicClock(
  initial = '2026-08-03T00:00:00.000Z',
): DeterministicClock {
  const initialMilliseconds = Date.parse(initial)
  if (!Number.isFinite(initialMilliseconds)) {
    throw new Error('The simulator clock requires an ISO timestamp.')
  }
  let current = initialMilliseconds
  return {
    now: () => new Date(current).toISOString(),
    advance(milliseconds) {
      if (!Number.isFinite(milliseconds)) {
        throw new Error('The simulator clock requires finite durations.')
      }
      current += milliseconds
      return new Date(current).toISOString()
    },
    set(value) {
      const next = Date.parse(value)
      if (!Number.isFinite(next)) throw new Error('The simulator clock requires an ISO timestamp.')
      current = next
    },
    reset() {
      current = initialMilliseconds
      return new Date(current).toISOString()
    },
  }
}
