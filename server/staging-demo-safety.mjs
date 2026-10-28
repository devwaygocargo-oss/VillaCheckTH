// Build-owned Staging presentation profile; never a Production/QA profile.
export function stagingDemoEnvironment(env){
 const u=new URL(env.DATABASE_URL||env.VillaCheck_DATABASE_URL);
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.password||u.hash||!['require','verify-full'].includes(u.searchParams.get('sslmode'))||env.VERCEL_PROJECT_ID!=='prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC'||u.hostname.replace('-pooler.','.')!=='ep-lively-wildflower-azuxgq19.c-3.ap-southeast-1.aws.neon.tech'||decodeURIComponent(u.pathname.slice(1))!=='neondb'||decodeURIComponent(u.username)!=='neondb_owner'||(u.searchParams.get('schema')||'public')!=='public'||u.searchParams.has('options')||env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||env.STAGING_RELEASE_POLICY||env.QA_SYNTHETIC_GRANT_APPROVAL)throw Error('Staging Demo target/config rejected');
 const controlled=env.STAGING_SECURITY_REGISTRATION_ENABLED==='true';
 if(env.STAGING_SECURITY_REGISTRATION_ENABLED!==undefined&&!['true','false'].includes(env.STAGING_SECURITY_REGISTRATION_ENABLED))throw Error('Invalid scoped registration flag');
 const phones=[env.STAGING_REGISTRATION_PHONE_USER,env.STAGING_REGISTRATION_PHONE_MERCHANT];
 const configuredPhones=phones.filter(p=>p!==undefined&&p!=='');
 if(controlled&&(!configuredPhones.length||configuredPhones.some(p=>typeof p!=='string'||!/^\+66[689]\d{8}$/.test(p))||new Set(configuredPhones).size!==configuredPhones.length||!env.THAIBULKSMS_OTP_KEY||!env.THAIBULKSMS_OTP_SECRET))throw Error('Exact authorized test phones and provider credentials required');
 const providerKeys=['THAIBULKSMS_API_KEY','THAIBULKSMS_API_SECRET','THAIBULKSMS_SENDER','THAIBULKSMS_OTP_KEY','THAIBULKSMS_OTP_SECRET','THAIBULKSMS_EMAIL_OTP_TEMPLATE_ID'];
 const safe={...env,APP_ENV:'staging',PAYMENT_ACCESS_MODE:'DISABLED',OMISE_TEST_ENABLED:'false',SEED_DEMO_ACCOUNTS:'false',SEED_PUBLIC_DEMO_DATA:'false'};
 for(const k of Object.keys(safe))if(!(controlled&&providerKeys.includes(k))&&(/^(SMTP_|THAIBULKSMS_|LINE_CHANNEL_|GOOGLE_CLIENT_|FACEBOOK_APP_|ADMIN_|CRON_SECRET)/.test(k)||(/^OMISE_/.test(k)&&k!=='OMISE_TEST_ENABLED')))delete safe[k];return safe;
}
export {requestAllowed as stagingDemoRequestAllowed} from "./staging-interactive-policy.mjs";
function presentationRequestAllowed(method,path){
 if(method==='POST')return ['/api/auth/login','/api/auth/admin-login','/api/auth/logout','/api/auth/admin-logout'].includes(path);
 if(method!=='GET')return false;
 if(path.startsWith('/api/auth/'))return ['/api/auth/me','/api/auth/admin-me'].includes(path);
 return !path.startsWith('/api/oauth/')&&!path.startsWith('/api/admin/otp/')&&(!path.startsWith('/api/ops/')||path==='/api/ops/target-attestation');
}
