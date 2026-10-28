import {attestRuntimeTarget} from "../../server/target-attestation.mjs";
import type { NextApiRequest,NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";
import {productionRuntimePolicy,productionRequestAllowed,isProductionRuntime} from "../../server/production-runtime.mjs";
// Compiled with Nest's decorator metadata by build:backend before next build.
import { createBackend } from "../../.build/backend/bootstrap.js";
let backend:ReturnType<typeof createBackend>|undefined;
export const config={api:{bodyParser:false,externalResolver:true},maxDuration:60};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader("Cache-Control","no-store");
 try{
  const incomingUrl=new URL(req.url||"/","http://localhost");
  const attestation=await attestRuntimeTarget({method:req.method||"GET",path:incomingUrl.pathname,headers:req.headers,query:Object.fromEntries(incomingUrl.searchParams),env:process.env});
  if(attestation){res.status(attestation.status).json(attestation.body);return;}
  const policy=productionRuntimePolicy(process.env);
  if((isProductionRuntime(process.env)||policy.phase1)&&!productionRequestAllowed(req.method||"GET",new URL(req.url||"/","http://localhost").pathname,policy.releaseMode||(policy.phase1?"PHASE1":"PRELAUNCH"),policy)){res.status(503).json({error:"Production prelaunch: action disabled"});return;}
  backend ||= createBackend().catch((error:unknown)=>{backend=undefined;throw error;});
  const runtime=await backend;
  await new Promise<void>((resolve,reject)=>{res.once("finish",resolve);res.once("close",resolve);runtime.handler(req,res,(error:unknown)=>error?reject(error):resolve());});
  if(process.env.APP_ENV!=="production")waitUntil(runtime.domain.runMail().catch(()=>console.error("Mail delivery failed")));
 }catch{if(!res.headersSent)res.status(503).json({error:"Backend ไม่พร้อม กรุณาตรวจ PostgreSQL และ Admin config"});}
}
