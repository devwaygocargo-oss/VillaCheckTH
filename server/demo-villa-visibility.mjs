// Existing seed provenance; never classify by a public villa name containing Demo.
export const demoVillaVisibilityKey = 'public_demo_villas_visible'
export function isDemoVilla(villa) {
  return /^demo-[a-z0-9-]+@villacheck\.example$/i.test(villa.email || '') &&
    ['ธุรกิจสาธิต — ไม่ใช่ที่พักจริง','DEMO business - no real bookings'].includes(villa.merchant)
}
// Preserve existing visibility until Admin chooses; corrupt settings hide demos.
export const demoVillasVisibleValue = row => !row || row.value === 'true'
export async function demoVillasVisible(db) {
  return demoVillasVisibleValue(await db.prepare('SELECT value FROM system_settings WHERE key=?').get(demoVillaVisibilityKey))
}
