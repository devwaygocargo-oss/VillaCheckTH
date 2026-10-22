import { useEffect,useState,type ReactNode } from "react"
import { createPortal } from "react-dom"

export default function CmsPreviewWindow({target,children,onClose}:{target:Window;children:ReactNode;onClose:()=>void}) {
 const [root,setRoot]=useState<HTMLElement|null>(null)
 useEffect(()=>{
  const doc=target.document
  doc.documentElement.lang="th"
  doc.title="Preview ก่อนเผยแพร่ · VillaCheck"
  const viewport=doc.createElement("meta");viewport.name="viewport";viewport.content="width=device-width,initial-scale=1";doc.head.appendChild(viewport)
  document.head.querySelectorAll('link[rel="stylesheet"],style').forEach(node=>{const copy=node.cloneNode(true) as HTMLElement;if(copy instanceof HTMLLinkElement)copy.href=(node as HTMLLinkElement).href;doc.head.appendChild(copy)})
  doc.body.style.margin="0"
  const container=doc.createElement("main");container.id="cms-browser-preview";doc.body.appendChild(container);setRoot(container)
  const timer=window.setInterval(()=>{if(target.closed)onClose()},500)
  return()=>{window.clearInterval(timer);container.remove()}
 },[target,onClose])
 return root?createPortal(<div onSubmitCapture={e=>{e.preventDefault();e.stopPropagation()}} onClickCapture={e=>{if((e.target as HTMLElement).closest("a")){e.preventDefault();e.stopPropagation()}}}>{children}</div>,root):null
}
