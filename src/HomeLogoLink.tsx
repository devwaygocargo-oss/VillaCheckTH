import type { ReactNode } from "react";

export default function HomeLogoLink({children,className="",onNavigate}:{children:ReactNode;className?:string;onNavigate:()=>void}) {
  return <a className={`home-logo-link ${className}`} href="/#page=home" aria-label="VillaCheck กลับหน้าแรก" onClick={event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    onNavigate();
  }}>{children}</a>;
}
