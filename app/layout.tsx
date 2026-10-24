import type { Metadata } from "next";
import "../src/index.css";
import "../src/refinements.css";
export const metadata: Metadata = {
 title: "VillaCheck", description: "ตรวจสอบ Villa ก่อนโอนเงิน",
 openGraph: {title:"VillaCheck",description:"ตรวจสอบข้อมูลที่พักและสถานะการอนุมัติก่อนโอนเงิน",type:"website",locale:"th_TH"},
 twitter:{card:"summary",title:"VillaCheck",description:"ตรวจสอบข้อมูลที่พักและสถานะการอนุมัติก่อนโอนเงิน"}
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="th"><body>{children}</body></html>;
}
