// ─── Network type detection ───────────────────────────────────────────────────
// Uses the Network Information API (available on Chromium, not on iOS Safari).
// Returns 'wifi' | 'cellular' | 'unknown'; silent no-op on unsupported browsers.

export type NetworkType = 'wifi' | 'cellular' | 'unknown'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function conn(): any {
  if (typeof navigator === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (navigator as any).connection ?? null
}

export function getNetworkType(): NetworkType {
  const c = conn()
  if (!c) return 'unknown'
  if (c.type === 'wifi')     return 'wifi'
  if (c.type === 'cellular') return 'cellular'
  return 'unknown'
}

/** Subscribe to network type changes. Returns a cleanup function. */
export function onNetworkChange(cb: (type: NetworkType) => void): () => void {
  const c = conn()
  if (!c) return () => {}
  function handler() { cb(getNetworkType()) }
  c.addEventListener('change', handler)
  return () => c.removeEventListener('change', handler)
}
