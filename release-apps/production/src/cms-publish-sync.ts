export const cmsPublishStorageKey="villacheck-cms-published"
export function notifyCmsPublished(){
 window.dispatchEvent(new Event("cms-published"))
 try{localStorage.setItem(cmsPublishStorageKey,`${Date.now()}:${Math.random()}`)}catch{/* Storage may be unavailable in private browsing. */}
}
