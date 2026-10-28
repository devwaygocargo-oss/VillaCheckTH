import {stagedProviderEnvironment} from "./staged-provider-configuration.mjs";
import {qaGrantRuntimeContext} from './qa-initial-grant-policy.mjs'
export const validActivationConfiguration=env=>env.PHASE1_ACTIVATION_MODE==='BLOCKED'||(env.PHASE1_ACTIVATION_MODE==='APPROVED_EXPLICIT_GRANTS'&&/^[a-zA-Z0-9_.:-]{3,120}$/.test(env.PHASE1_INITIAL_GRANT_POLICY||''))
import {productionDemoApproval,verifyProductionDemoGate} from './production-demo-gate.mjs'
// APP_ENV identifies the business environment; NODE_ENV also equals production
// on the existing Staging deployment. Production supports explicit PRELAUNCH and PHASE1; Phase2 remains disabled.
export const isProductionRuntime = env => env.APP_ENV === 'production'
export function productionRuntimePolicy(env,{allowLegacyEnvironment=false}={}) {
 env=stagedProviderEnvironment(env);
 qaGrantRuntimeContext(env)
 if(env.NODE_ENV==='production'&&!['production','staging','test'].includes(env.APP_ENV)&&!(allowLegacyEnvironment&&env.APP_ENV===undefined))throw Error('Unsafe production environment identity')
 const production=isProductionRuntime(env)
 if(!production){
  if(env.APP_ENV==='staging'&&env.STAGING_RELEASE_POLICY){
   if(env.STAGING_RELEASE_POLICY!=='PHASE1'||!env.PHASE1_REQUIREMENTS_REVISION||!validActivationConfiguration(env)||!['DISABLED','SMTP'].includes(env.PHASE1_EMAIL_OTP_DELIVERY)||env.PAYMENT_ACCESS_MODE!=='DISABLED'||env.DEMO_MODE!=='false'||env.OMISE_TEST_ENABLED!=='false'||env.COOKIE_SECURE!=='true'||(env.OTP_SECRET||'').length<32||env.SEED_DEMO_ACCOUNTS!=='false'||env.SEED_PUBLIC_DEMO_DATA!=='false')throw Error('Unsafe staging Phase1 policy')
   if(env.PHASE1_EMAIL_OTP_DELIVERY==='SMTP'&&(!env.PHASE1_EMAIL_OTP_APPROVAL||!env.SMTP_HOST||!env.SMTP_FROM||!env.SMTP_USER||!env.SMTP_PASSWORD||!['465','587'].includes(env.SMTP_PORT)))throw Error('Unsafe staging Phase1 email approval')
   return {prelaunch:false,phase1:true,releaseMode:'PHASE1',emailOtpDelivery:env.PHASE1_EMAIL_OTP_DELIVERY}
  }
  return {prelaunch:false}
 }
 productionDemoApproval(env)
 const mode=productionReleaseMode(env)
 const reject=()=>{throw Error('Unsafe production prelaunch configuration')}
 if(env.NODE_ENV!=='production'||env.PAYMENT_ACCESS_MODE!=='DISABLED'||env.OMISE_TEST_ENABLED!=='false'||env.DEMO_MODE!=='false'||env.SEED_DEMO_ACCOUNTS!=='false'||env.SEED_PUBLIC_DEMO_DATA!=='false'||env.COOKIE_SECURE!=='true'||(env.OTP_SECRET||'').length<32)reject()
 try{const origin=new URL(env.APP_URL);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)reject();const db=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(db.protocol))reject()}catch{reject()}
 // Do not inherit Staging aliases, privileged operator credentials, or provider
 // credentials into the production runtime. Validation errors never name values.
 for(const [key,value] of Object.entries(env)) {
  if(!value)continue
  if(['DIRECT_URL','BACKUP_DATABASE_URL','DATABASE_URL_UNPOOLED','VillaCheck_DATABASE_URL','VillaCheck_DATABASE_URL_UNPOOLED','VillaCheck_POSTGRES_URL_NON_POOLING','ADMIN_EMAIL','ADMIN_PASSWORD','CRON_SECRET'].includes(key))reject()
  if((/^SMTP_/.test(key)&&!(mode==='PHASE1'&&env.PHASE1_EMAIL_OTP_DELIVERY==='SMTP'))||/^(THAIBULKSMS_|LINE_CHANNEL_|GOOGLE_CLIENT_|FACEBOOK_APP_)/.test(key)||(/^OMISE_/.test(key)&&key!=='OMISE_TEST_ENABLED'))reject()
 }
 if(mode==='MEMBER_PREVIEW'||mode==='PRELAUNCH'&&(env.BUSINESS_INITIALIZATION_MODE!==undefined||env.OTP_DELIVERY_MODE!==undefined)){
  if(env.BUSINESS_INITIALIZATION_MODE!=='DISABLED_UNTIL_APPROVAL'||env.OTP_DELIVERY_MODE!=='DISABLED')reject()
  return {prelaunch:mode==='PRELAUNCH',phase1:false,releaseMode:mode,businessInitializationDisabled:true,otpDelivery:'DISABLED'}
 }
 if(mode==='PHASE1'){
  if(!/^[a-zA-Z0-9_.:-]{3,120}$/.test(env.PHASE1_REQUIREMENTS_REVISION||'')||!validActivationConfiguration(env)||!['DISABLED','SMTP'].includes(env.PHASE1_EMAIL_OTP_DELIVERY))reject()
  if(env.PHASE1_EMAIL_OTP_DELIVERY==='SMTP'&&(!/^[a-zA-Z0-9_.:-]{3,120}$/.test(env.PHASE1_EMAIL_OTP_APPROVAL||'')||!env.SMTP_HOST||!env.SMTP_FROM||!env.SMTP_USER||!env.SMTP_PASSWORD||!['465','587'].includes(env.SMTP_PORT)))reject()
  return {prelaunch:false,phase1:true,releaseMode:'PHASE1',emailOtpDelivery:env.PHASE1_EMAIL_OTP_DELIVERY}
 }
 return {prelaunch:true}
}
export async function initializeRuntimeCatalog(db,env,seed) {
 const policy=productionRuntimePolicy(env)
 const production=isProductionRuntime(env)||policy.phase1
 const catalog=await db.prepare('SELECT id FROM package_catalog LIMIT 1').get()
 if(!catalog){if(policy.businessInitializationDisabled)return;if(production)throw Error('Production catalog must be initialized separately');await db.transaction(()=>seed(db))}
}
export async function verifyProductionData(db,{allowUninitializedCatalog=false}={}) {
 await verifyProductionDemoGate(db)
 if(!allowUninitializedCatalog&&!await db.prepare('SELECT id FROM package_catalog LIMIT 1').get())throw Error('Production catalog must be initialized separately')
 if(!await db.prepare("SELECT id FROM users WHERE role='admin'").get())throw Error('Production Admin must be provisioned separately')
 for(const table of ['users','villas']){
  if(await db.prepare(`SELECT id FROM ${table} WHERE lower(email) LIKE '%.example' OR lower(email) LIKE '%.test' OR lower(email) LIKE '%@example' OR lower(email) LIKE '%@test' LIMIT 1`).get())throw Error('Production cannot contain reserved test accounts or villas')
 }
 const demo=await db.prepare("SELECT value FROM system_settings WHERE key='demo_mode'").get()
 if(demo&&demo.value!=='false')throw Error('Production demo mode must be disabled')
}
// Default deny: only public reads, local password authentication, and session
// reads may run in prelaunch. This also stops new/unreviewed outbound routes.
export function prelaunchRequestAllowed(method,path) {
 if(method==='GET')return ['/api/health','/api/config','/api/auth/me','/api/auth/admin-me'].includes(path)||path.startsWith('/api/public/')
 return method==='POST'&&['/api/auth/login','/api/auth/admin-login','/api/auth/logout','/api/auth/admin-logout'].includes(path)
}

// Explicit Phase1 route manifest: absence, unknown modes and Phase2 fail closed.
export function productionReleaseMode(env){const mode=env.PRODUCTION_RELEASE_MODE||'PRELAUNCH';if(!['PRELAUNCH','PHASE1','MEMBER_PREVIEW'].includes(mode))throw Error('Unsafe production release mode');return mode}
export function productionRequestAllowed(method,path,mode='PRELAUNCH',policy={}){
 if(method==='GET'&&(path==='/api/auth/oauth/status'||/^\/api\/auth\/oauth\/(google|line)\/(start|callback)$/.test(path))||method==='POST'&&/^\/api\/auth\/oauth\/(google|line)\/(link|reauth)$/.test(path))return true;
 if(method==='POST'&&['/api/auth/password','/api/auth/logout-all','/api/auth/recovery/request','/api/auth/recovery/verify'].includes(path))return true;
 if(!['PRELAUNCH','PHASE1','MEMBER_PREVIEW'].includes(mode))return false;
 if(path==='/api/merchant/villa-draft')return method==='GET'||mode==='PHASE1'&&method==='POST';
 if(method==='GET'&&['/api/public/privacy-notice','/api/account/privacy-requests','/api/admin/privacy-requests'].includes(path))return true;
 if(method==='POST'&&['/api/account/privacy-requests'].includes(path))return true;
 if(mode==='PRELAUNCH')return policy.businessInitializationDisabled===true?productionRequestAllowed(method,path,'MEMBER_PREVIEW'):prelaunchRequestAllowed(method,path)
 if(mode==='MEMBER_PREVIEW'){
  if(method==='POST')return ['/api/auth/login','/api/auth/admin-login','/api/auth/logout','/api/auth/admin-logout'].includes(path)
  if(method!=='GET')return false
  return ['/api/health','/api/config','/api/auth/me','/api/auth/admin-me','/api/state','/api/packages','/api/admin/packages','/api/merchant/profile','/api/user/profile','/api/user/summary','/api/user/checks','/api/reports','/api/reviews','/api/merchant/reports','/api/admin/reports','/api/admin/reviews','/api/merchant/property-media','/api/admin/property-media','/api/merchant/ownership-documents','/api/admin/ownership-documents','/api/admin/users','/api/admin/merchants','/api/admin/qr','/api/admin/accounts','/api/admin/cms','/api/admin/cms/media','/api/admin/cms/history','/api/admin/leads','/api/admin/settings','/api/admin/settings/demo-villas','/api/admin/subscriptions','/api/admin/advertisements','/api/admin/owner-verification','/api/merchant/owner-verification','/api/admin/readiness','/api/admin/receiving-bank','/api/admin/villa-pages','/api/admin/acceptance'].includes(path)||/^\/api\/(public\/(cms|villas|advertisements|reviews|reports\/RPT-[a-zA-Z0-9-]+|qr\/[^/]+|villa-photo\/[a-f0-9-]+|property-media(?:-file\/[a-f0-9-]+)?|cms-media\/[a-f0-9-]+)|(?:admin\/)?documents\/[a-f0-9-]+)$/.test(path)
 }
 if(mode!=='PHASE1')return false
 if(method==='GET')return ['/api/health','/api/config','/api/auth/me','/api/auth/admin-me','/api/packages','/api/state','/api/merchant/profile','/api/admin/villa-pages','/api/admin/packages','/api/public/cms','/api/public/villas','/api/public/property-media','/api/public/advertisements','/api/public/reviews'].includes(path)||/^\/api\/(public\/(qr\/[^/]+|villa-photo\/[a-f0-9-]+|property-media-file\/[a-f0-9-]{36}|cms-media\/[a-f0-9-]+)|admin\/qr-verification\/[^/]+|(?:admin\/)?documents\/[a-f0-9-]+)$/.test(path)
 if(method==='POST'&&/^\/api\/merchant\/villas\/[a-f0-9-]+$/.test(path))return true
 if(method==='POST')return ['/api/auth/register','/api/auth/register-user','/api/auth/registration/verify','/api/auth/login','/api/auth/admin-login','/api/auth/logout','/api/auth/admin-logout','/api/villas','/api/merchant/profile','/api/admin/villa-pages','/api/admin/acceptance'].includes(path)||/^\/api\/villas\/[a-f0-9-]+\/(review|resubmit)$/.test(path)
 return ['POST','PATCH'].includes(method)&&(/^\/api\/merchant\/villas\/[a-f0-9-]+$/.test(path)||path==='/api/merchant/profile')
}
export function phase1PackageDisplay(plan){
 const scopes={basic:'ตรวจสอบข้อมูลเบื้องต้น ไม่ใช่การรับประกัน',starter:'ตรวจสอบข้อมูลและเจ้าของผ่านช่องทางออนไลน์ ไม่ใช่การรับประกัน',pro:'ขอบเขตที่ยืนยัน: จองแล้วได้บ้าน — ยังไม่เปิดใช้ความคุ้มครองจนประกาศเงื่อนไขครบถ้วน',premium:'ขอบเขตที่ยืนยัน: บ้านจริงและตรงปก — ยังไม่เปิดใช้ความคุ้มครองจนประกาศเงื่อนไขครบถ้วน'}
 return {...plan,phase1DisplayOnly:true,activationBlocked:true,billing_cycle:"MONTHLY",billingCycle:"MONTHLY",billingScope:null,trial_months:null,trialMonths:null,taxIncluded:null,description:scopes[plan.id]||'ข้อมูลแพ็กเกจ',features:['จัดการข้อมูลที่พัก','QR และข้อมูลที่ผ่านการอนุมัติ',scopes[plan.id]||'ข้อมูลแพ็กเกจ'],guarantee:null}
}
