// One application source, independently pinned environment targets. No secret/connection fallback.
export const applicationTargets=Object.freeze({
 staging:{projectId:'prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC',host:'ep-lively-wildflower-azuxgq19.c-3.ap-southeast-1.aws.neon.tech',database:'neondb',role:'neondb_owner'},
 production:{projectId:'prj_AojlAe1eFqvqEnKd3FPENLbr3DtO',host:'ep-square-resonance-aohwf0z5.c-2.ap-southeast-1.aws.neon.tech',database:'villacheck_production',role:'villacheck_runtime'},
});
export function sharedApplicationEnvironment(env,stagingEnvironment){
 const name=env.APP_ENV??(env.VERCEL_PROJECT_ID===applicationTargets.staging.projectId?'staging':undefined),target=applicationTargets[name];
 if(!target)throw Error('Explicit application environment required');
 let u;try{u=new URL(name==='staging'?(env.DATABASE_URL||env.VillaCheck_DATABASE_URL):env.DATABASE_URL)}catch{throw Error('Explicit environment database required')}
 const queryKeys=[...u.searchParams.keys()];if(new Set(queryKeys).size!==queryKeys.length||queryKeys.some(k=>!['sslmode','schema','channel_binding'].includes(k))||u.searchParams.has('channel_binding')&&!['require','prefer'].includes(u.searchParams.get('channel_binding')))throw Error('Connection query overrides are not allowed');
 if(env.VERCEL_PROJECT_ID!==target.projectId||!['postgres:','postgresql:'].includes(u.protocol)||!u.password||u.hash||!['require','verify-full'].includes(u.searchParams.get('sslmode'))||u.hostname.replace('-pooler.','.')!==target.host||decodeURIComponent(u.pathname.slice(1))!==target.database||decodeURIComponent(u.username)!==target.role||(u.searchParams.get('schema')||'public')!=='public'||u.searchParams.has('options')||env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Error('Application environment target rejected');
 if(name==='staging')return stagingEnvironment({...env,APP_ENV:name});
 if(env.STAGING_RELEASE_POLICY||env.QA_SYNTHETIC_GRANT_APPROVAL||env.DEMO_MODE!=='false'||env.SEED_DEMO_ACCOUNTS!=='false'||env.SEED_PUBLIC_DEMO_DATA!=='false')throw Error('Production cannot inherit Demo configuration');
 return {...env,APP_ENV:name};
}
// Safe disabled configuration is explicit. It never synthesizes business rows or approvals.
export function unconfiguredBusinessDisabled(env){return env.BUSINESS_INITIALIZATION_MODE==='DISABLED_UNTIL_APPROVAL'}
