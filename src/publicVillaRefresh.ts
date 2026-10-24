import {invalidatePublicVillaReads} from "./api"
// Reload DB-backed public data after Admin saves, when returning to a tab,
// and across same-origin tabs. No persisted API responses or polling cache.
const changed = 'villacheck:demo-villa-visibility-changed'
export function notifyPublicVillaVisibilityChanged() {
  invalidatePublicVillaReads()
  try { localStorage.setItem(changed, String(Date.now())) } catch { /* storage may be disabled */ }
  window.dispatchEvent(new Event(changed))
}
export function onPublicVillaRefresh(reload: () => void) {
  const visible = () => { if (document.visibilityState !== 'hidden') { invalidatePublicVillaReads(); reload() } }
  const storage = (event: StorageEvent) => { if (event.key === changed) visible() }
  window.addEventListener('focus', visible)
  window.addEventListener(changed, visible)
  window.addEventListener('storage', storage)
  document.addEventListener('visibilitychange', visible)
  return () => {
    window.removeEventListener('focus', visible)
    window.removeEventListener(changed, visible)
    window.removeEventListener('storage', storage)
    document.removeEventListener('visibilitychange', visible)
  }
}
