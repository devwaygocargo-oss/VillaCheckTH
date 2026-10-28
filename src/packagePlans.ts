import {t as translateSystem} from "./locale"
import { useEffect, useState } from "react";
import { api } from "./api";
export type PackagePlan = {
 phase1DisplayOnly?:boolean; activationBlocked?:boolean;
 regularAmount?: number; discountAmount?: number|null; netAmount?: number|null; pricingPending?:boolean; promotion?: {code:string;percent:number;revision:number}|null;
 id: string; name: string; slug: string; amount: number; capacity: number; description: string;
 currency: string; billingCycle: string; trialMonths: number; features: string[];
 maximumVerificationLevel: string; showPremiumBanner: boolean; isActive: boolean; sort_order: number;
};
export const selectedPlanKey = "villacheck-selected-package";
export const packageIntentKey = "villacheck-package-intent";
export const billingLabel = (cycle: string) => translateSystem(({MONTHLY:"เดือน",QUARTERLY:"3 เดือน",YEARLY:"ปี"})[cycle] || "รอบ");
export const billingValidityLabel = (cycle: string, business={monthlyInitialMonths:3,monthlyRenewalMonths:1}) => cycle === "MONTHLY"
  ? translateSystem("ค่าบริการต่อที่พัก รวมภาษี · ครั้งละ 1 เดือน หลัง Admin ยืนยันสลิป")
  : translateSystem("อายุสิทธิ์ตามรอบ {v0} หลัง Admin ยืนยันสลิป",{v0:billingLabel(cycle)});
export function planId(name: string) { return sessionStorage.getItem(selectedPlanKey) || name; }
export function usePackages(admin=false) {
 const [plans,setPlans]=useState<PackagePlan[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{ let active=true; const refresh=()=>void api<{packages:PackagePlan[]}>(admin?"/admin/packages":"/packages").then(v=>{if(active){setPlans(v.packages);setError("");}}).catch(e=>{if(active)setError(e.message);}); refresh(); const timer=window.setInterval(refresh,10000);return()=>{active=false;clearInterval(timer);};},[admin]);
 return {plans,error};
}
