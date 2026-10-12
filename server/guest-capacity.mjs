export function guestCapacity(value) {
  if (value === undefined || value === null || value === "") return null
  const count = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isInteger(count) || count < 1 || count > 1000)
    throw Object.assign(Error("จำนวนผู้พักต้องเป็นจำนวนเต็ม 1–1000 คน"), { status: 400 })
  return count
}
