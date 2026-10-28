// Opt-in technical QA grants are never financial/Production authorization.
export const isolatedQaGrantTarget=Object.freeze({projectId:'icy-breeze-79743545',branchId:'br-aged-mud-b3h2rtxp',endpointId:'ep-solitary-rain-b3dx6378',database:'villacheck_qa_phase1',schema:'public',vercelProjectId:'prj_1gljCrsEBewkisCFuqT3zRBxVkQE'})
const reject=()=>{throw Error('QA synthetic grant requires isolated QA identity and explicit approval')}
const approvedReference=value=>typeof value==='string'&&/^QA_ONLY:[a-zA-Z0-9_.:-]{3,100}$/.test(value)
export function qaGrantRuntimeContext(env={}){
 const approvalReference=env.QA_SYNTHETIC_GRANT_APPROVAL
 if(!approvalReference)return undefined
 let u;try{u=new URL(env.DATABASE_URL)}catch{reject()}
 const t=isolatedQaGrantTarget
 if(!approvedReference(approvalReference)||env.APP_ENV!=='staging'||env.VERCEL_PROJECT_ID!==t.vercelProjectId||env.STAGING_RELEASE_POLICY!=='PHASE1'||env.PHASE1_ACTIVATION_MODE!=='APPROVED_EXPLICIT_GRANTS'||env.PHASE1_INITIAL_GRANT_POLICY!==approvalReference||!['postgres:','postgresql:'].includes(u.protocol)||u.hostname.replace('-pooler.','.')!=='ep-solitary-rain-b3dx6378.c-4.ap-southeast-1.aws.neon.tech'||decodeURIComponent(u.pathname.slice(1))!==t.database||decodeURIComponent(u.username)!=='villacheck_qa_runtime'||u.searchParams.get('sslmode')!=='verify-full'||!u.password||u.hash||env.NODE_TLS_REJECT_UNAUTHORIZED==='0'||u.searchParams.has('options')||(u.searchParams.get('schema')||'public')!=='public')reject()
 return {scope:'ISOLATED_QA_ONLY',approvalReference,target:t}
}
export function assertQaSyntheticGrant(db,{terms,qaContext}){
 const t=isolatedQaGrantTarget,c=db.connectionIdentity
 if(terms?.scope!=='ISOLATED_QA_ONLY'||qaContext?.scope!=='ISOLATED_QA_ONLY'||!approvedReference(qaContext.approvalReference)||terms.approvalReference!==qaContext.approvalReference||Object.entries(t).some(([k,v])=>terms.target?.[k]!==v||qaContext.target?.[k]!==v))reject()
 // Test-only escape is confined to a disposable localhost connection and an
 // actual test process; Vercel/Production cannot opt into it with a flag.
 if(qaContext.localRehearsal===true){if(process.env.APP_ENV!=='test'||!['localhost','127.0.0.1'].includes(c?.host))reject();return}
 if(c?.host?.replace('-pooler.','.')!=='ep-solitary-rain-b3dx6378.c-4.ap-southeast-1.aws.neon.tech'||c.database!==t.database||!['villacheck_qa_owner','villacheck_qa_runtime'].includes(c.role))reject()
}

export async function verifyQaSyntheticGrant(db,args){
 assertQaSyntheticGrant(db,args)
 if(args.qaContext.localRehearsal===true)return
 const id=await db.prepare('SELECT current_database() AS database,current_schema() AS schema,current_user AS role').get()
 if(id?.database!==isolatedQaGrantTarget.database||id.schema!=='public'||!['villacheck_qa_owner','villacheck_qa_runtime'].includes(id.role))reject()
}
