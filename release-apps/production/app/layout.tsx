import type { Metadata } from "next";
import localFont from "next/font/local";
import "../src/index.css";
import "../src/refinements.css";
import "../src/design-system.css";
const lineSeed = localFont({
 src: [
  { path: "../src/assets/fonts/line-seed-sans-th/LINESeedSansTH_W_Rg.woff2", weight: "400", style: "normal" },
  { path: "../src/assets/fonts/line-seed-sans-th/LINESeedSansTH_W_Bd.woff2", weight: "700", style: "normal" },
 ],
 variable: "--font-line-seed", display: "swap", preload: true,
 adjustFontFallback: "Arial", fallback: ["Tahoma", "Arial", "sans-serif"],
});
export const metadata: Metadata = {
 title: "VillaCheck", description: "ตรวจสอบ Villa ก่อนโอนเงิน",
 openGraph: {title:"VillaCheck",description:"ตรวจสอบข้อมูลที่พักและสถานะการอนุมัติก่อนโอนเงิน",type:"website",locale:"th_TH"},
 twitter:{card:"summary",title:"VillaCheck",description:"ตรวจสอบข้อมูลที่พักและสถานะการอนุมัติก่อนโอนเงิน"}
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="th" className={lineSeed.variable}><body>{children}</body></html>;
}
