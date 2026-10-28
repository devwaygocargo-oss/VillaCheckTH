import {useEffect,useState} from "react";
import {api} from "./api";
export default function DemoNotice(){
 const [demo,setDemo]=useState(false);
 useEffect(()=>{let active=true;const refresh=()=>{void api<{demoMode:boolean}>("/config").then(r=>{if(active)setDemo(r.demoMode)}).catch(()=>{});};refresh();const timer=window.setInterval(refresh,60000);return()=>{active=false;clearInterval(timer)};},[]);
 return demo?<aside className="demo-notice" aria-label="สถานะโหมดสาธิต">เว็บไซต์อยู่ในโหมดสาธิต · ข้อมูลที่ระบุ Demo ใช้ทดสอบเท่านั้น ไม่ใช่รายการให้ชำระเงินจริง</aside>:null;
}
