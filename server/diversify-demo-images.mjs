import {diverseDemoImages} from './demo-image-catalog.mjs';
export const isLegacyDemoImage=value=>typeof value==='string'&&/^(?:https:\/\/design-villacheck\.vercel\.app)?\/demo\/villas\/villa-[1-9]\.jpg(?:\?.*)?$/.test(value);
export async function diversifyDemoImages(db){
 return db.transaction(async()=>{
  const marker='demo_image_diversity_v1';const saved=await db.prepare('SELECT value FROM system_settings WHERE key=?').get(marker);const assignments=saved?JSON.parse(saved.value):{};
  const used=new Set(Object.values(assignments)),shortages=[];
  const allocate=(key,kind,previous)=>{if(assignments[key])return assignments[key];const next=diverseDemoImages.find(i=>i.category===kind&&!used.has(i.url))||diverseDemoImages.find(i=>!used.has(i.url));if(!next){shortages.push(key);return previous;}used.add(next.url);assignments[key]=next.url;return next.url;};
  const villas=await db.prepare('SELECT id,photo_url FROM villas ORDER BY id').all();
  const settings=await db.prepare("SELECT key,value FROM system_settings WHERE key IN ('cms_published','cms_draft') OR key LIKE 'advertisement:%' OR key LIKE 'property_media:%' ORDER BY key").all();
  // Respect explicit Admin selections and uploads; only replace the known bundled stock photos.
  for(const villa of villas)if(diverseDemoImages.some(i=>i.url===villa.photo_url))used.add(villa.photo_url);
  for(const row of settings){for(const item of diverseDemoImages)if(row.value.includes(item.url))used.add(item.url);}
  let propertyPhotos=0,advertisements=0,cmsReleases=0,media=0;
  for(const villa of villas)if(isLegacyDemoImage(villa.photo_url)){const next=allocate('villa:'+villa.id,'property',villa.photo_url);if(next!==villa.photo_url){await db.prepare('UPDATE villas SET photo_url=? WHERE id=? AND photo_url=?').run(next,villa.id,villa.photo_url);propertyPhotos++;}}
  for(const row of settings.filter(r=>r.key.startsWith('advertisement:'))){const data=JSON.parse(row.value);let changed=false;if(isLegacyDemoImage(data.image)){const old=data.image;data.image=allocate(row.key,'property',old);changed=data.image!==old;if(isLegacyDemoImage(data.mobileImage))data.mobileImage=data.image;}else if(isLegacyDemoImage(data.mobileImage)){data.mobileImage=data.image;changed=true;}if(changed){await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(data),row.key);advertisements++;}}
  const transform=(value,path)=>{
   if(typeof value==='string')return isLegacyDemoImage(value)?allocate(path,'editorial',value):value;
   if(Array.isArray(value))return value.map((item,i)=>transform(item,path+':'+(item?.id||i)));
   if(value&&typeof value==='object'){const next={};for(const [key,item]of Object.entries(value))next[key]=key==='mobileImage'&&isLegacyDemoImage(item)&&item===value.image?item:transform(item,path+':'+key);if(isLegacyDemoImage(value.mobileImage)&&value.mobileImage===value.image)next.mobileImage=next.image;return next;}
   return value;
  };
  for(const row of settings.filter(r=>!r.key.startsWith('advertisement:'))){const data=JSON.parse(row.value),next=transform(data,row.key.startsWith('cms_')?'cms':row.key);if(JSON.stringify(next)===JSON.stringify(data))continue;if(typeof next.revision==='number')next.revision++;await db.prepare('UPDATE system_settings SET value=? WHERE key=?').run(JSON.stringify(next),row.key);if(row.key.startsWith('cms_'))cmsReleases++;else media++;}
  await db.prepare('INSERT INTO system_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(marker,JSON.stringify(assignments));
  return {propertyPhotos,advertisements,cmsReleases,media,assigned:Object.keys(assignments).length,shortages:shortages.length};
 },{timeout:120000});
}
