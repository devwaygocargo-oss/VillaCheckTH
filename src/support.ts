type Channel = "email" | "phone" | "facebook" | "instagram" | "line";
export function supportHref(channel: Channel) {
  const values: Record<Channel, string | undefined> = {
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "villacheck69@gmail.com",
    phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE,
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL,
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
    line: process.env.NEXT_PUBLIC_LINE_URL,
  };
  const value = values[channel]?.trim();
  if (!value) return undefined;
  if (channel === "email") return `mailto:${value}`;
  if (channel === "phone") return `tel:${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid URL");
    return url.href;
  } catch { return undefined; }
}
export function openSupport(channel: Channel) {
  const href = supportHref(channel);
  if (!href) { window.alert("ช่องทางติดต่อนี้ยังไม่เปิดใช้งาน กรุณาติดต่อผ่านอีเมลหรือแบบฟอร์มติดต่อ"); return; }
  if (channel === "email" || channel === "phone") window.location.href = href;
  else window.open(href, "_blank", "noopener,noreferrer");
}
