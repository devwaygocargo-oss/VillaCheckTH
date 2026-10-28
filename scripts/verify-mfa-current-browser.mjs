// Canonical authentication QA using existing, explicitly scoped test identities.
// Usage: node scripts/verify-mfa-current-browser.mjs staging|production deployment-receipt.json [output-directory]
// Production automation is hard-paused before any credential read until an
// explicitly authorized credential rotation has completed. Do not reuse the
// exposed diagnostic capability. Default anonymous Staging access is unchanged.
// No provider client, saved cookies, session export or business writes.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {chromium} from '../tools/qa/node_modules/playwright-core/index.mjs'
import {safeErrorType,routeLifecycle,recordRouteError,guardedRoute,bounded,closeContextSafely,installSanitizedProcessHandlers} from './mfa-browser-safety.mjs'

const targets={
 staging:{base:'https://design-villacheck.vercel.app',projectId:'prj_3A3Lygt3Z9Pt3D9p8bk693fTfHiC',scope:'reports/requested-test-accounts-v2/staging-scope.json'},
 production:{base:'https://www.villacheckth.com',projectId:'prj_AojlAe1eFqvqEnKd3FPENLbr3DtO',scope:'docs/qa/evidence/production-test-accounts-20261028/scope.json'},
}
const rawArguments=process.argv.slice(2),productionAutomation=rawArguments.includes('--production-automation'),singleCase=rawArguments.includes('--single-case'),diagnosticAdminEn=rawArguments.includes('--diagnostic-admin-en'),diagnosticSubset=singleCase||diagnosticAdminEn,argumentsWithoutFlag=rawArguments.filter(value=>!['--production-automation','--single-case','--diagnostic-admin-en'].includes(value))
const [environment,receiptPath,out='docs/reports/mfa-removal-evidence']=argumentsWithoutFlag
const rows=[],globalChecks={anonymousAccess:'NOT_RUN'},sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const safeType=safeErrorType
const mfaRoute=/mfa|totp|multi.?factor|two.?factor|step.?up/i
let browser,target,receipt,receiptSha,resultPath,scope,automationSecret,stage='input-validation',exitCode=0,expectedCases=0
let fatalObserved=false,shutdownPromise
const activeContexts=new Map()
const report={at:new Date().toISOString(),environment,rows,globalChecks,passed:false,status:'NOT_RUN',superAdmin:{status:'NOT_APPLICABLE',reason:'No existing SUPER_ADMIN role; no role hierarchy change or new account.'},primaryLoginMethods:{password:'NOT_RUN',googleCallback:'NOT_RUN_EXTERNAL_PROVIDER',emailOtpDelivery:'NOT_RUN_AUTHORIZED_DELIVERY_NOT_EXERCISED',phoneOtpDelivery:'NOT_RUN_AUTHORIZED_DELIVERY_NOT_EXERCISED'},businessWrites:0,existingSessionsRevokedByRunner:0,logoutAllRequests:0,productionAutomationExplicitlyRequested:productionAutomation,existingDiagnosticAutomationCredentialRead:false,providerProjectProtectionKeysRead:false,sessionCookiesTokensOrCsrfExported:false,passwordsTokensHeadersScreenshotsTracesOrStorageStatePersisted:false}
const allowedAutomationApiReads=new Set(['/api/config','/api/state','/api/health','/api/packages','/api/auth/me','/api/auth/admin-me','/api/auth/oauth/status','/api/user/profile','/api/user/summary','/api/user/checks','/api/merchant/profile','/api/merchant/receiving-bank','/api/merchant/villa-draft','/api/merchant/analytics','/api/merchant/reports','/api/account/privacy-requests','/api/admin/cms','/api/admin/cms/media','/api/admin/cms/history','/api/admin/owner-notifications','/api/admin/advertisements','/api/admin/social-jobs','/api/admin/readiness','/api/admin/packages'])
function approvedAutomationRead(url){if(url.origin!==targets.production.base)return false;const value=url.pathname;if(value.startsWith('/api/'))return allowedAutomationApiReads.has(value)||/^\/api\/public\/(?:cms(?:-media\/[a-f0-9-]+)?|villas|advertisements|reviews|privacy-notice|villa-photo\/[a-f0-9-]+)$/.test(value);return value==='/'||/^\/admin(?:\/login)?\/?$/.test(value)||value.startsWith('/_next/')||/\.(?:svg|png|jpe?g|webp|avif|ico|woff2?|css|js)$/.test(value)}
async function continueGuarded(route){
 if(!automationSecret)return await route.continue()
 const request=route.request(),url=new URL(request.url()),method=request.method()
 assert.equal(url.origin,targets.production.base);assert.equal(environment,'production')
 assert(['GET','HEAD'].includes(method)?approvedAutomationRead(url):method==='POST'&&['/api/auth/login','/api/auth/admin-login','/api/auth/logout','/api/auth/admin-logout'].includes(url.pathname))
 // Only this already validated request receives the diagnostic header. Never
 // set global browser headers or follow redirects while holding the credential.
 const response=await route.fetch({headers:{...request.headers(),'x-vercel-protection-bypass':automationSecret},maxRedirects:0,maxRetries:0,timeout:30000})
 return await route.fulfill({response})
}
function save(){if(resultPath)fs.writeFileSync(resultPath,JSON.stringify(report,null,2)+'\n')}
function pinReceipt(){assert.equal(sha(fs.readFileSync(receiptPath)),receiptSha,'Deployment receipt changed during QA')}
async function noMfaUi(page){
 const found=await page.locator('input,button,a,label,nav,aside,[role=dialog],h1,h2').evaluateAll(elements=>elements.some(element=>{
  if(!element.getBoundingClientRect().width||!element.getBoundingClientRect().height)return false
  const text=[element.tagName==='INPUT'?'':element.innerText,element.getAttribute('aria-label'),element.getAttribute('placeholder'),element.getAttribute('name'),element.getAttribute('id')].filter(Boolean).join(' ')
  return /\bMFA\b|\bTOTP\b|authenticator|recovery\s*codes?|multi[ -]?factor|two[ -]?factor/i.test(text)
 }))
 assert.equal(found,false,'MFA setup, challenge or settings control remains visible')
 assert(!mfaRoute.test(new URL(page.url()).pathname+new URL(page.url()).hash),'MFA route redirect remains')
}
async function choosePassword(page){const tabs=page.locator('.login-method-tabs');if(await tabs.count())await tabs.getByRole('button',{name:/password|รหัสผ่าน/i}).click();const form=page.locator('.login-email-form').filter({has:page.locator('input[type=password]')}).first();await form.waitFor();return form}
async function language(page,locale){
 if(locale==='default')return
 assert(['th','en'].includes(locale),'Unsupported QA locale')
 const button=page.locator('.language-switcher button[lang="'+locale+'"]:visible').first()
 await button.waitFor({state:'visible',timeout:15000})
 await button.click()
 await page.waitForFunction(value=>document.documentElement.lang===value,locale,{timeout:15000})
 const stored=await bounded(()=>page.evaluate(()=>{try{const value=localStorage.getItem('villacheck:locale');return value==='th'||value==='en'?value:null}catch{return null}}),5000)
 assert(stored===locale,'Requested QA locale was not persisted')
 assert((await button.getAttribute('aria-pressed'))==='true','Requested QA locale button is not active')
}
async function localeDiagnostic(page){return bounded(()=>page.evaluate(()=>{let stored=null;try{const value=localStorage.getItem('villacheck:locale');if(value==='th'||value==='en')stored=value}catch{}const rawLang=document.documentElement.lang,htmlLang=rawLang==='th'||rawLang==='en'?rawLang:null,buttons=[...document.querySelectorAll('.language-switcher button[lang=en]')].filter(button=>button.getClientRects().length>0),sidebar=document.querySelector('.portal-side'),text=sidebar?.innerText||'';return{storedLocale:stored,htmlLang,englishButtonPressed:buttons.length?buttons.some(button=>button.getAttribute('aria-pressed')==='true'):null,allVisibleEnglishButtonsPressed:buttons.length?buttons.every(button=>button.getAttribute('aria-pressed')==='true'):null,sidebarHasThaiLabels:sidebar?/[\u0e00-\u0e7f]/.test(text):null,sidebarHasEnglishCmsLabel:sidebar?/\b(?:Website CMS|CMS Website)\b/i.test(text):null,sidebarHasEnglishLogoutLabel:sidebar?/\b(?:Sign out|Log out)\b/i.test(text):null}}),5000)}
async function me(page,admin){return bounded(()=>page.evaluate(async admin=>{const response=await fetch('/api/auth/'+(admin?'admin-me':'me'),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),headers:admin?{'X-VillaCheck-Portal':'admin'}:{}});if(!response.ok)return{status:response.status};const value=await response.json();return{status:response.status,user:{id:value.user?.id,role:value.user?.role}}},admin))}
async function readStatus(page,apiPath,admin){assert(['/user/profile','/merchant/profile','/admin/cms'].includes(apiPath));return bounded(()=>page.evaluate(async({apiPath,admin})=>(await fetch('/api'+apiPath,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),headers:admin?{'X-VillaCheck-Portal':'admin'}:{}})).status,{apiPath,admin}))}
async function shellReady(page){await page.locator('.portal-content').first().waitFor({state:'attached'});await page.locator('.portal-side .portal-logout').first().waitFor({state:'attached'})}
async function dashboard(page,actor){const admin=actor.role==='admin';await page.goto(target.base+(admin?'/admin/':'/')+'#page='+(admin?'admin-cms':actor.role==='merchant'?'owner-dashboard':'user-dashboard'),{waitUntil:'domcontentloaded'});await shellReady(page)}
async function closeContext(context){const lifecycle=activeContexts.get(context)||routeLifecycle(),result=await closeContextSafely(context,lifecycle);if(result.context==='CLOSED')activeContexts.delete(context);return result}
async function shutdownBrowser(){if(shutdownPromise)return shutdownPromise;shutdownPromise=(async()=>{stage='teardown';const contexts=[];for(const [context]of activeContexts){try{contexts.push(await closeContext(context))}catch{contexts.push({context:'CLOSE_FAILED'})}}report.remainingContextTeardown=contexts;if(browser){try{await bounded(()=>browser.close(),10000);report.browserTeardown='CLOSED'}catch{report.browserTeardown='CLOSE_TIMEOUT_OR_FAILED'}}try{save()}catch{}})();return shutdownPromise}
installSanitizedProcessHandlers({phase:()=>stage,onFatal:()=>{fatalObserved=true;automationSecret=undefined;exitCode=1;report.passed=false;report.status='FAIL_CLOSED_UNHANDLED_BROWSER_ERROR';report.unhandledBrowserError=true;try{save()}catch{}return shutdownBrowser()}})
async function logoutFresh(page,actor){
 const admin=actor.role==='admin',identity=await me(page,admin)
 if(identity.status===401)return 'NO_CURRENT_QA_SESSION'
 assert.equal(identity.status,200);assert.equal(identity.user.id,actor.id,'Refuse logout when the current identity differs from the scoped actor')
 if(!await page.locator('.portal-side .portal-logout').count())await dashboard(page,actor)
 const toggle=page.locator('.portal-menu-toggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')!=='true')await toggle.click()
 const endpoint='/api/auth/'+(admin?'admin-logout':'logout'),response=page.waitForResponse(response=>new URL(response.url()).pathname===endpoint&&response.request().method()==='POST')
 await page.locator('.portal-side .portal-logout').first().click();assert.equal((await response).status(),200)
 assert.equal((await me(page,admin)).status,401,'The fresh QA browser session must be revoked')
 return 'PASS_FRESH_SESSION_ONLY'
}
async function anonymousProbe(){
 let response=await fetch(target.base+'/api/config',{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000)})
 globalChecks.anonymousConfigHttpStatus=response.status
 if([301,302,303,307,308].includes(response.status)){
  const location=new URL(response.headers.get('location')||'/',target.base)
  if(location.hostname!=='vercel.com'||!location.pathname.startsWith('/sso-api'))return{blocked:'ANONYMOUS_CANONICAL_REDIRECT_REQUIRES_INSPECTION'}
  globalChecks.anonymousRedirectCategory='VERCEL_SSO'
  if(!productionAutomation)return{blocked:environment.toUpperCase()+'_SSO_ACCESS_REQUIRED'}
  assert.equal(environment,'production');assert.equal(target.base,'https://www.villacheckth.com');assert.equal(receipt.projectId,'prj_AojlAe1eFqvqEnKd3FPENLbr3DtO');assert.equal(scope.target.neonProjectId,'green-sun-56847773');assert.equal(scope.target.database,'villacheck_production');assert.equal(scope.target.host,'ep-square-resonance-aohwf0z5.c-2.ap-southeast-1.aws.neon.tech')
  const {keychain}=await import('./production-internal-context.mjs'),existing=keychain('com.villacheck.production.green-sun-56847773','diagnostic-automation');assert.equal(typeof existing.secret,'string');assert(existing.secret.length>=16&&!/[\r\n]/.test(existing.secret));automationSecret=existing.secret;report.existingDiagnosticAutomationCredentialRead=true
  const configUrl=new URL('/api/config',target.base);assert(approvedAutomationRead(configUrl));response=await fetch(configUrl,{redirect:'manual',cache:'no-store',headers:{'x-vercel-protection-bypass':automationSecret},signal:AbortSignal.timeout(30000)});globalChecks.explicitAutomationConfigHttpStatus=response.status
  if(response.status!==200)return{blocked:'PRODUCTION_EXPLICIT_AUTOMATION_ACCESS_NOT_AVAILABLE'}
 }
 if(response.status!==200)return{blocked:'ANONYMOUS_CANONICAL_ACCESS_HTTP_'+response.status}
 const config=await response.json();globalChecks.primaryChannelAvailability={google:config.oauth?.google===true,emailOtp:config.otp?.email===true,phoneOtp:config.otp?.sms===true}
 browser=await chromium.launch({headless:true,executablePath:process.env.VC_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),lifecycle=routeLifecycle();activeContexts.set(context,lifecycle);const page=await context.newPage();let blocked=0;const errors=[]
 page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(safeType(error)))
 await context.route('**/*',guardedRoute(lifecycle,async route=>{const request=route.request(),url=new URL(request.url());if(['data:','blob:'].includes(url.protocol))return await route.continue();if(url.origin!==target.base||!['GET','HEAD'].includes(request.method())||automationSecret&&!approvedAutomationRead(url)){blocked++;return await route.abort()}return await continueGuarded(route)}))
 if(automationSecret&&context.routeWebSocket)await context.routeWebSocket('**/*',async socket=>{try{await socket.close()}catch(error){recordRouteError(lifecycle,error)}})
 try{
  const login=await page.goto(target.base+'/#page=login',{waitUntil:'domcontentloaded'});assert.equal(login.status(),200);await choosePassword(page);await noMfaUi(page)
  const languages=await page.locator('.language-switcher button[lang=en]').count()>0
  const admin=await page.goto(target.base+'/admin/login',{waitUntil:'domcontentloaded'});assert.equal(admin.status(),200);await choosePassword(page);await noMfaUi(page)
  assert.equal(blocked,0);assert.deepEqual(errors,[]);assert.equal(lifecycle.unexpectedTransportErrors,0);globalChecks.anonymousAccess=automationSecret?'SSO_HELD_EXPLICIT_AUTOMATION_LOGIN_PAGES_PASS':'PASS_LOGIN_AND_ADMIN_LOGIN_NO_MFA';globalChecks.actorCredentialReadsBeforeLoginPages=0;return{languages}
 }finally{const closed=await closeContext(context);globalChecks.loginPageContextTeardown=closed;assert.equal(closed.context,'CLOSED','Anonymous browser context did not close');assert.equal(closed.unexpectedTransportErrors,0,'Unexpected login-page transport failure')}
}
async function credentials(){
 // Deliberately invoked only AFTER anonymous access succeeds. No provider() call.
 if(environment==='staging'){
  const {requestedV2Password}=await import('./requested-test-v2-context.mjs'),password=requestedV2Password()
  return scope.actors.map(actor=>({...actor,password}))
 }
 const {keychain}=await import('./production-internal-context.mjs');assert.equal(scope.keychainService,'com.villacheck.production.green-sun-56847773.internal-tests')
 return scope.actors.map(actor=>{assert(actor.email.endsWith('@villacheck.invalid'));const saved=keychain(scope.keychainService,actor.keychainAccount);for(const key of ['id','email','role'])assert.equal(saved[key],actor[key],'Private test credential scope mismatch');assert.equal(typeof saved.password,'string');assert(saved.password.length>=10);return{...actor,password:saved.password}})
}
async function runCase(actor,width,locale){
 const admin=actor.role==='admin',loginPath='/api/auth/'+(admin?'admin-login':'login'),logoutPath='/api/auth/'+(admin?'admin-logout':'logout'),row={role:actor.role.toUpperCase(),width,locale,result:'NOT_RUN'}
 const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390,serviceWorkers:'block'}),lifecycle=routeLifecycle();activeContexts.set(context,lifecycle);const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000)
 let step='route-guard',loggedIn=false,loggedOut=false,blockedWrites=0,externalRequests=0,mfaRequests=0,mfaRedirects=0,http5xx=0;const pageErrors=[],consoleEvents=[],expectedDenialCounts={401:0,403:0}
 const expectedDenials=new Set(['/api/auth/me','/api/auth/admin-me','/api/user/profile','/api/merchant/profile'])
 const unexpectedConsoleCount=()=>{const remaining={...expectedDenialCounts};return consoleEvents.filter(event=>{if(event.code&&event.expectedPath)return false;if(event.code&&event.emptyPath&&remaining[event.code]>0){remaining[event.code]--;return false}return true}).length}
 page.on('pageerror',error=>pageErrors.push(safeType(error)))
 page.on('response',response=>{const url=new URL(response.url());if(url.origin!==target.base)return;if(response.status()>=500)http5xx++;if(expectedDenials.has(url.pathname)&&[401,403].includes(response.status()))expectedDenialCounts[response.status()]++})
 page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&mfaRoute.test(new URL(frame.url()).pathname+new URL(frame.url()).hash))mfaRedirects++})
 page.on('console',message=>{if(message.type()!=='error')return;let pathname='';try{pathname=new URL(message.location().url).pathname}catch{}const match=message.text().match(/^Failed to load resource: the server responded with a status of (401|403)\b/);consoleEvents.push({code:match?Number(match[1]):null,expectedPath:expectedDenials.has(pathname),emptyPath:!pathname})})
 await context.route('**/*',guardedRoute(lifecycle,async route=>{
   const request=route.request(),url=new URL(request.url());if(['data:','blob:'].includes(url.protocol))return await route.continue();if(url.origin!==target.base){externalRequests++;return await route.abort()}
   if(/\/auth\/mfa(?:\/|$)/i.test(url.pathname)){mfaRequests++;return await route.abort()}
   if(automationSecret&&['GET','HEAD'].includes(request.method())&&!approvedAutomationRead(url)){blockedWrites++;return await route.abort()}
   if(!['GET','HEAD'].includes(request.method())){
    if(request.method()!=='POST'||![loginPath,logoutPath].includes(url.pathname)){blockedWrites++;return await route.abort()}
    const data=request.postDataJSON();if(url.pathname===loginPath){assert.deepEqual(Object.keys(data).sort(),['email','password']);assert(data.email===actor.email,'Scoped actor mismatch');assert(data.password===actor.password,'Scoped credential mismatch')}else assert.deepEqual(data,{})
   }
   return await continueGuarded(route)
 }))
 if(automationSecret&&context.routeWebSocket)await context.routeWebSocket('**/*',async socket=>{try{await socket.close()}catch(error){recordRouteError(lifecycle,error)}})
 try{
  pinReceipt();step='password-ui-login'
  await page.goto(target.base+(admin?'/admin/login':'/#page='+(actor.role==='merchant'?'owner-auth':'login')),{waitUntil:'domcontentloaded'});assert.equal((await me(page,admin)).status,401,'Fresh context must not inherit an existing application session');await language(page,locale);const form=await choosePassword(page);await noMfaUi(page)
  if(diagnosticSubset)row.localeAfterSelection=await localeDiagnostic(page)
  if(admin)assert.equal(await form.locator('input[autocomplete=one-time-code]').count(),0)
  await form.locator('input[type=email]').fill(actor.email);await form.locator('input[type=password]').fill(actor.password)
  const response=page.waitForResponse(response=>new URL(response.url()).pathname===loginPath&&response.request().method()==='POST');await form.locator('.login-submit').click();assert.equal((await response).status(),200);loggedIn=true
  const identity=await me(page,admin);assert.equal(identity.status,200);assert.equal(identity.user.id,actor.id);assert.equal(identity.user.role,actor.role);row.login='PASS_SUPPORTED_PASSWORD_NO_MFA'
  step='role-landing';await page.waitForFunction(role=>{const selected=new URLSearchParams(location.hash.slice(1)).get('page');return role==='admin'?selected==='admin-cms':role==='merchant'?['owner-dashboard','owner-information'].includes(selected):selected==='user-dashboard'},actor.role)
  const landing=new URLSearchParams(new URL(page.url()).hash.slice(1)).get('page');row.initialLanding=landing==='owner-information'?'EXISTING_MERCHANT_PROFILE_COMPLETION':'ROLE_DASHBOARD'
  if(diagnosticSubset)row.safeLandingDiagnostic=await bounded(()=>page.evaluate(()=>({page:new URLSearchParams(location.hash.slice(1)).get('page'),portalContents:document.querySelectorAll('.portal-content').length,portalSidebars:document.querySelectorAll('.portal-side').length,logoutControls:document.querySelectorAll('.portal-side .portal-logout').length,loginScreens:document.querySelectorAll('.login-screen').length,appRoots:document.querySelectorAll('.app').length})))
  step='dashboard-shell';if(landing==='owner-information')await dashboard(page,actor);else await shellReady(page)
  await noMfaUi(page);row.dashboard='PASS_EXISTING_ROLE_LANDING_NO_MFA_REDIRECT'
  step='role-access';if(!admin){const own=actor.role==='user'?'/user/profile':'/merchant/profile';assert.equal(await readStatus(page,own,false),200)} // Admin's own identity is verified through admin-me; do not require unrelated CMS business features.
  for(const other of actor.role==='admin'?['/user/profile','/merchant/profile']:[actor.role==='user'?'/merchant/profile':'/user/profile'])assert.equal(await readStatus(page,other,admin),403)
  row.rbac='PASS_OWN_ACCESS_OTHER_ROLE_403'
  step='session-refresh';if(diagnosticSubset)row.localeBeforeReload=await localeDiagnostic(page);await page.reload({waitUntil:'domcontentloaded'});await shellReady(page);const refreshed=await me(page,admin);assert.equal(refreshed.status,200);assert.equal(refreshed.user.id,actor.id);assert.equal(refreshed.user.role,actor.role);await noMfaUi(page);row.sessionRefresh='PASS';row.localeAfterReload=await localeDiagnostic(page)
  if(locale!=='default'&&await page.locator('.language-switcher').count()){
   step='persisted-locale-after-reload';await page.waitForFunction(value=>document.documentElement.lang===value,locale,{timeout:15000});assert.equal(await page.evaluate(()=>document.documentElement.lang),locale);if(diagnosticSubset)row.localeAfterPersistWait=await localeDiagnostic(page)
  }
  step='responsive-layout';await bounded(()=>page.evaluate(()=>document.fonts.ready));await page.locator('.portal-content').first().waitFor({timeout:15000})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  step='own-fresh-session-logout';row.logout=await logoutFresh(page,actor);loggedOut=true;assert.equal(row.logout,'PASS_FRESH_SESSION_ONLY');await page.locator('.login-screen').first().waitFor({state:'attached'});await noMfaUi(page)
  assert.deepEqual(pageErrors,[]);assert.equal(unexpectedConsoleCount(),0);assert.equal(http5xx,0);assert.equal(blockedWrites,0);assert.equal(externalRequests,0);assert.equal(mfaRequests,0);assert.equal(mfaRedirects,0);assert.equal(lifecycle.unexpectedTransportErrors,0);assert(!fatalObserved)
  row.noMfaUi=true;row.mfaRequests=0;row.mfaRedirects=0;row.unexpectedJavascriptErrors=0;row.unexpectedConsoleErrors=0;row.http5xx=0;row.layoutOverflow=false;row.result='PASS'
 }catch(error){row.result='FAIL';row.failedAt=step;row.failureType=safeType(error);row.blockedWrites=blockedWrites;row.externalRequests=externalRequests;row.mfaRequests=mfaRequests;row.mfaRedirects=mfaRedirects;row.javascriptErrorCount=pageErrors.length;row.unexpectedConsoleErrorCount=unexpectedConsoleCount();row.http5xx=http5xx;try{row.localeOnFailure=await localeDiagnostic(page)}catch{row.localeOnFailure={available:false}}try{row.safeDomDiagnostic=await bounded(()=>page.evaluate(()=>({page:new URLSearchParams(location.hash.slice(1)).get('page'),portalContents:document.querySelectorAll('.portal-content').length,portalSidebars:document.querySelectorAll('.portal-side').length,logoutControls:document.querySelectorAll('.portal-side .portal-logout').length,loginForms:document.querySelectorAll('.login-email-form').length})),5000)}catch{row.safeDomDiagnostic={available:false}}}
 finally{
  if(loggedIn&&!loggedOut){try{row.cleanup=await logoutFresh(page,actor)}catch{row.cleanup='OWN_FRESH_SESSION_CLEANUP_UNVERIFIED'}}
  rows.push(row);save();row.contextTeardown=await closeContext(context);if(row.contextTeardown.context!=='CLOSED'||row.contextTeardown.unexpectedTransportErrors||fatalObserved){row.result='FAIL';row.failedAt='context-teardown';save();throw Error('Fresh browser context teardown did not finish safely')};save();console.log({environment,role:row.role,width,locale,result:row.result,...(row.failedAt?{failedAt:row.failedAt}:{})})
 }
}
async function main(){
 assert(!(singleCase&&diagnosticAdminEn),'Select one diagnostic subset only');assert(!diagnosticSubset||environment==='staging','Diagnostic subsets are Staging-only')
 assert(targets[environment]&&receiptPath,'Use staging|production and an exact deployment receipt');assert(argumentsWithoutFlag.length>=2&&argumentsWithoutFlag.length<=3&&!argumentsWithoutFlag.some(value=>value.startsWith('--')));assert(!productionAutomation||environment==='production','Restricted automation flag is Production-only');target=targets[environment];scope=JSON.parse(fs.readFileSync(target.scope));assert.equal(scope.environment,environment);assert.equal(scope.target.vercelProjectId,target.projectId);assert.equal(scope.actors.length,3);assert.deepEqual(scope.actors.map(actor=>actor.role).sort(),['admin','merchant','user'])
 const receiptBytes=fs.readFileSync(receiptPath);receipt=JSON.parse(receiptBytes);receiptSha=sha(receiptBytes);assert.equal(receipt.projectId,target.projectId);assert.equal(receipt.sourceVerified,true);assert.equal(receipt.readyState,'READY');assert(/^dpl_[A-Za-z0-9]+$/.test(receipt.id||receipt.deploymentId));assert(/^[a-f0-9]{40}$/.test(receipt.commit||receipt.sourceCommit))
 fs.mkdirSync(out,{recursive:true});const destination=path.join(out,environment+'-browser.json');assert(!fs.existsSync(destination),'Archive an existing receipt explicitly before a rerun');resultPath=destination;Object.assign(report,{base:target.base,deploymentId:receipt.id||receipt.deploymentId,sourceCommit:receipt.commit||receipt.sourceCommit,canonicalBinding:'LOCAL_EXACT_READY_DEPLOYMENT_RECEIPT; provider mapping verified separately by release runner',receiptSha256:receiptSha})
 if(productionAutomation){report.status='PRODUCTION_AUTOMATION_PAUSED_PENDING_AUTHORIZED_CREDENTIAL_ROTATION';report.blocker=report.status;report.credentialReads=0;report.authWrites=0;exitCode=2;save();console.log({environment,status:report.status,credentialReads:0,authWrites:0});return}
 stage='anonymous-preflight';const probe=await anonymousProbe();if(probe.blocked){globalChecks.anonymousAccess='BLOCKED';report.status=probe.blocked;report.blocker=probe.blocked;report.credentialReads=0;report.authWrites=0;exitCode=2;save();console.log({environment,status:report.status,credentialReads:0,authWrites:0});return}
 stage='scope-owned-test-credentials';assert(!diagnosticAdminEn||probe.languages,'Existing English controls are required for this diagnostic');const allActors=await credentials(),actors=diagnosticAdminEn?allActors.filter(actor=>actor.role==='admin'):singleCase?allActors.filter(actor=>actor.role==='user'):allActors,locales=diagnosticAdminEn?['en']:probe.languages?(singleCase?['th']:['th','en']):['default'],widths=diagnosticSubset?[1440]:[1440,390];expectedCases=actors.length*widths.length*locales.length;report.expectedCases=expectedCases;report.diagnosticSubset=diagnosticSubset;report.diagnosticSelection=diagnosticAdminEn?'ADMIN_DESKTOP_EN':singleCase?'USER_DESKTOP_TH':null;report.languageCoverage=probe.languages?'EXISTING_TH_EN_CONTROLS':'EXISTING_DEFAULT_LOCALE_NO_NEW_SWITCH_REQUIRED'
 stage='canonical-authentication-cases';for(const actor of actors)for(const width of widths)for(const locale of locales)await runCase(actor,width,locale)
 stage='final-receipt-pin';pinReceipt();report.passed=rows.length===expectedCases&&rows.every(row=>row.result==='PASS');report.status=report.passed?(diagnosticSubset?'PASS_SINGLE_DIAGNOSTIC_CASE':'PASS_IMPLEMENTED_PASSWORD_SESSION_RBAC_SCOPE'):'FAIL_AUTHENTICATION_QA';report.primaryLoginMethods.password=report.passed?(diagnosticSubset?'PASS_DIAGNOSTIC_ROLE_ONLY':'PASS_ALL_EXISTING_ROLES'):'FAIL_OR_PARTIAL';report.authWritesScope='ONLY_EXACT_ACTOR_LOGIN_AND_OWN_FRESH_CONTEXT_LOGOUT';report.authWrites=rows.filter(row=>row.login?.startsWith('PASS')).length+rows.filter(row=>row.logout==='PASS_FRESH_SESSION_ONLY'||row.cleanup==='PASS_FRESH_SESSION_ONLY').length;report.actualExternalOtpDeliveries=0;report.actualExternalOAuthCallbacks=0;save();if(!report.passed){exitCode=1;console.error({environment,cases:rows.length,passed:false,status:report.status});return}
 console.log({environment,cases:rows.length,passed:true,mfaRequests:0,existingSessionsRevoked:0,logoutAllRequests:0})
}
try{await main()}catch(error){report.passed=false;report.status='FAIL_OR_BLOCKED';report.failedAt=stage;report.failureType=safeType(error);try{save()}catch{}console.error({environment:targets[environment]?environment:'unverified',status:report.status,failedAt:stage,failureType:safeType(error)});exitCode=1}finally{await shutdownBrowser();process.exit(exitCode)}
