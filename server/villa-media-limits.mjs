export const villaMediaLimits=Object.freeze({images:11,coverImages:1,additionalImages:10,videos:2,maxBytes:2*1024*1024});
export async function activeVillaMedia(db,id){return(await db.prepare('SELECT value FROM system_settings WHERE key LIKE ?').all('property_media:'+id+':%')).map(r=>JSON.parse(r.value)).filter(m=>!m.removedAt)}
export function countVillaMedia(villa,media){const images=new Set(media.filter(m=>m.kind==='image').map(m=>m.url));const additionalImages=[...images].filter(url=>url!==villa.photo_url).length;if(villa.photo_url)images.add(villa.photo_url);return {images:images.size,videos:media.filter(m=>m.kind==='video').length,coverImages:villa.photo_url?1:0,additionalImages}}
const fail=message=>{throw Object.assign(Error(message),{status:409,code:'MEDIA_LIMIT_EXCEEDED'})};
export async function assertVillaCoverLimit(db,villa,nextUrl){const media=await activeVillaMedia(db,villa.id),before=countVillaMedia(villa,media),after=countVillaMedia({...villa,photo_url:nextUrl},media);if(after.additionalImages>10&&after.additionalImages>before.additionalImages)fail('รูปภาพเพิ่มเติมต้องไม่เกิน 10 รูป โดยแยกจากรูปหน้าปก 1 รูป')}
export async function assertVillaMediaLimit(db,villa,kind,replacingId){
 const current=await activeVillaMedia(db,villa.id),before=countVillaMedia(villa,current),target=replacingId?current.find(m=>m.id===replacingId):null;
 if(replacingId&&!target)throw Object.assign(Error('ไม่พบสื่อที่ต้องการเปลี่ยน'),{status:404});
 if(target?.url===villa.photo_url&&kind!=='image')throw Object.assign(Error('รูปหน้าปกต้องเป็นรูปภาพ'),{status:400});
 const remaining=current.filter(m=>m.id!==replacingId),counts=countVillaMedia(villa,remaining),additionalImages=counts.additionalImages+(kind==='image'&&target?.url!==villa.photo_url?1:0),videos=counts.videos+(kind==='video'?1:0);
 if(additionalImages>10&&additionalImages>before.additionalImages)fail('รูปภาพเพิ่มเติมต้องไม่เกิน 10 รูป โดยแยกจากรูปหน้าปก 1 รูป');
 if(videos>2&&videos>before.videos)fail('เพิ่มวิดีโอได้ไม่เกิน 2 รายการ');return target;
}
