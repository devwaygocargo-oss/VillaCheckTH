export function qrReference(value: string): string | null {
  const raw = value.trim()
  const valid = (code: string | null) =>
    code && /^VC-[a-z0-9-]{4,100}$/i.test(code) ? code : null
  if (valid(raw)) return raw
  try {
    const url = new URL(raw)
    if (!["https:", "http:"].includes(url.protocol)) return null
    return valid(new URLSearchParams(url.hash.slice(1)).get("item"))
  } catch {
    return null
  }
}
