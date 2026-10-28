// Pure transport-error handling. Never serialize an Error, message, stack,
// request, response or header: browser library exceptions may contain secrets.
const safeNames=new Set(['Error','AssertionError','TimeoutError','TargetClosedError','AbortError','TypeError','NetworkError'])
const safePhases=new Set(['input-validation','anonymous-preflight','scope-owned-test-credentials','canonical-authentication-cases','final-receipt-pin','teardown','local-regression'])
export function safeErrorType(error){try{return safeNames.has(error?.name)?error.name:'Error'}catch{return'Error'}}
export function targetClosed(error){try{return error?.name==='TargetClosedError'||typeof error?.message==='string'&&/^(?:(?:route|apiRequestContext)\.(?:fetch|fulfill|continue|abort): )?Target page, context or browser has been closed(?:\n|$)/.test(error.message)}catch{return false}}
export function routeLifecycle(){return{closing:false,unexpectedTransportErrors:0,ignoredClosingTargetErrors:0,errorTypes:{},pendingHandlers:new Set()}}
export function recordRouteError(state,error){
 if(state.closing&&targetClosed(error)){state.ignoredClosingTargetErrors++;return}
 state.unexpectedTransportErrors++
 const name=safeErrorType(error);state.errorTypes[name]=(state.errorTypes[name]||0)+1
}
export function guardedRoute(state,callback){
 return async route=>{
  let completed;const done=new Promise(resolve=>{completed=resolve});state.pendingHandlers.add(done)
  try{if(state.closing){await route.abort();return}await callback(route)}
  catch(error){recordRouteError(state,error);try{await route.abort()}catch(abortError){recordRouteError(state,abortError)}}
  finally{state.pendingHandlers.delete(done);completed()}
 }
}
export async function bounded(work,milliseconds=20000){let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('Bounded browser operation timed out'),{name:'TimeoutError'})),milliseconds)})])}finally{clearTimeout(timer)}}
export async function closeContextSafely(context,state,{unrouteTimeoutMs=5000,closeTimeoutMs=10000,drainTimeoutMs=5000}={}){
 state.closing=true
 let routes='REMOVED',closed='CLOSED'
 try{await bounded(()=>context.unrouteAll({behavior:'ignoreErrors'}),unrouteTimeoutMs)}catch(error){if(targetClosed(error))routes='ALREADY_CLOSED';else{routes='REMOVE_TIMEOUT_OR_FAILED';recordRouteError(state,error)}}
 try{await bounded(()=>context.close(),closeTimeoutMs)}catch(error){if(!targetClosed(error)){closed='CLOSE_TIMEOUT_OR_FAILED';recordRouteError(state,error)}}
 let handlers='DRAINED';try{await bounded(()=>Promise.all([...state.pendingHandlers]),drainTimeoutMs)}catch(error){handlers='DRAIN_TIMEOUT_OR_FAILED';recordRouteError(state,error)}
 return{routes,context:closed,handlers,activeHandlersRemaining:state.pendingHandlers.size,unexpectedTransportErrors:state.unexpectedTransportErrors,ignoredClosingTargetErrors:state.ignoredClosingTargetErrors,errorTypes:{...state.errorTypes}}
}
export function installSanitizedProcessHandlers({phase=()=> 'teardown',onFatal=async()=>{},write=line=>process.stderr.write(line),exit=code=>process.exit(code)}={}){
 let handled=false
 const handler=error=>{
  if(handled)return;handled=true
  let current='teardown';try{const selected=phase();if(safePhases.has(selected))current=selected}catch{}
  try{write(JSON.stringify({errorType:safeErrorType(error),phase:current})+'\n')}catch{}
  try{Promise.resolve(onFatal()).then(()=>exit(1),()=>exit(1))}catch{exit(1)}
 }
 process.on('uncaughtException',handler);process.on('unhandledRejection',handler)
 return()=>{process.removeListener('uncaughtException',handler);process.removeListener('unhandledRejection',handler)}
}
