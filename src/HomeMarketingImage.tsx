import { useState } from "react";
export const homeMarketingMedia = {
  news: { src: "/illustrations/platform-updates.svg", alt: "ภาพประกอบข่าวสารแพลตฟอร์ม กระดิ่งแจ้งเตือนและรายการข้อมูล" },
  qr: { src: "/illustrations/qr-evidence.svg", alt: "ภาพประกอบการสแกนเพื่อเปิดอ่านข้อมูลตรวจสอบ โดยไม่เปิดเผยเอกสารส่วนบุคคล" },
  merchant: { src: "/illustrations/merchant-trust.svg", alt: "ภาพประกอบข้อมูลที่พักและโล่ความน่าเชื่อถือ ไม่ใช่ผลรับรองที่พักจริง" },
};
export default function HomeMarketingImage({ kind, src, className }: { kind: keyof typeof homeMarketingMedia; src?: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const fallback = homeMarketingMedia[kind];
  const custom = src && !src.startsWith("/demo/") && src !== "/villa-placeholder.svg";
  const image = custom && failed !== src ? src : fallback.src;
  return <img className={className} src={image} alt={fallback.alt} width={900} height={600} loading="lazy" decoding="async" onError={() => { if (image !== fallback.src) setFailed(image); }} />;
}
