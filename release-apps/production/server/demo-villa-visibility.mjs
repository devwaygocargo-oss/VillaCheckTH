// Reserved demo account marker, shared with demo-owner verification.
// Merchant labels are editable and legacy imports differ; never infer from names.
export const demoVillaVisibilityKey = 'public_demo_villas_visible'
export function isDemoVilla(villa) {
  return /^(?:demo|try)-[a-z0-9-]+@villacheck\.example$/i.test(villa.email || '')
}
// Preserve existing visibility until Admin chooses; corrupt settings hide demos.
export const demoVillasVisibleValue = row => !row || row.value === 'true'
export async function demoVillasVisible(db) {
  return demoVillasVisibleValue(await db.prepare('SELECT value FROM system_settings WHERE key=?').get(demoVillaVisibilityKey))
}
