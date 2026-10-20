import { useEffect, useRef, useState } from "react";
import { api } from "./api";

type Asset = { id:string; name:string; mime:string; kind:string; size:number; uploadedAt:string; url:string };
type Submission = { villaId:string; villaName?:string; month:string; status:string; notes:string; adminNote:string; revision:number; assets:Asset[]; submittedAt?:string; reviewedBy?:string };
type Villa = { id:string; name:string; packageId:string; canUpload:boolean };
type Snapshot = { month:string; villas:Villa[]; submissions:Submission[]; limits:{chunkBytes:number; imageBytes:number; videoBytes:number; images:number; videos:number} };
const labels:Record<string,string> = { draft:"ร่าง · ยังไม่ส่งให้ทีม", submitted:"ส่งให้ทีมแล้ว · รอตรวจไฟล์", accepted:"ทีมรับไฟล์แล้ว", changes:"ทีมขอแก้ไขไฟล์" };
const currentMonth = () => new Date(Date.now()+7*3600000).toISOString().slice(0,7);
const size = (bytes:number) => bytes<1024*1024?`${Math.max(1,Math.ceil(bytes/1024)).toLocaleString("th-TH")} KB`:`${(bytes/1024/1024).toLocaleString("th-TH",{maximumFractionDigits:1})} MB`;
const readPart = (blob:Blob) => new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("อ่านไฟล์ไม่สำเร็จ"));reader.readAsDataURL(blob);});

export default function SocialMaterials({admin=false,villaId=""}:{admin?:boolean;villaId?:string}) {
  const [month,setMonth]=useState(currentMonth),[selected,setSelected]=useState(villaId),[data,setData]=useState<Snapshot|null>(null),[notes,setNotes]=useState(""),[confirmed,setConfirmed]=useState(false),[reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState(""),[progress,setProgress]=useState<{name:string;percent:number}|null>(null),[downloading,setDownloading]=useState("");
  const working=useRef(false),cancelled=useRef(false),loadSequence=useRef(0),input=useRef<HTMLInputElement>(null);
  const path=admin?"/admin/social-materials":"/merchant/social-materials";
  const load=async()=>{const seq=++loadSequence.current;const next=await api<Snapshot>(`${path}?month=${month}`);if(seq===loadSequence.current)setData(next);return next;};
  useEffect(()=>{let active=true;setLoading(true);setError("");setData(null);setMessage("");void load().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;loadSequence.current++;};},[month,admin]);
  useEffect(()=>{if(admin||!data||selected)return;setSelected((data.villas.find(v=>v.canUpload)||data.villas.find(v=>data.submissions.some(s=>s.villaId===v.id)))?.id||"");},[data,selected,admin]);
  const submission=data?.submissions.find(s=>s.villaId===selected),villa=data?.villas.find(v=>v.id===selected);
  useEffect(()=>{setNotes(submission?.notes||"");setConfirmed(false);},[selected,month]);
  // Populate a saved brief after the initial fetch without overwriting typing
  // when uploading another file refreshes the same submission.
  const initialized=useRef("");
  useEffect(()=>{const id=`${month}:${selected}`;if(data?.month===month&&initialized.current!==id){initialized.current=id;setNotes(submission?.notes||"");setConfirmed(false);}},[data,month,selected,submission]);
  const nextMonth=new Date(currentMonth()+"-01T00:00:00Z");nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);
  const editable=(!submission||["draft","changes"].includes(submission.status))&&Boolean(villa?.canUpload)&&[currentMonth(),nextMonth.toISOString().slice(0,7)].includes(month);
  const execute=async(work:()=>Promise<void>)=>{if(working.current)return;working.current=true;setBusy(true);setError("");setMessage("");try{await work();}catch(e){setError(e instanceof Error?e.message:"ดำเนินการไม่สำเร็จ");}finally{working.current=false;setBusy(false);}};
  const upload=(files:File[])=>execute(async()=>{
    if(!data||!selected||!files.length)return;
    let images=submission?.assets.filter(a=>a.kind==="image").length||0,videos=submission?.assets.filter(a=>a.kind==="video").length||0;
    for(const file of files){const image=file.type.startsWith("image/");if(!["image/jpeg","image/png","video/mp4","video/quicktime"].includes(file.type))throw Error("เลือกภาพ JPG/PNG หรือวิดีโอ MP4/MOV");if(file.size<12||file.size>(image?data.limits.imageBytes:data.limits.videoBytes))throw Error(`${file.name}: ${image?"ภาพไม่เกิน 2 MB":"วิดีโอไม่เกิน 50 MB"}`);if((image?++images:++videos)>(image?data.limits.images:data.limits.videos))throw Error("ส่งภาพได้ไม่เกิน 10 ไฟล์และวิดีโอ 2 ไฟล์ต่อชุดรายเดือน");}
    cancelled.current=false;
    for(const file of files){
      if(cancelled.current)break;
      let uploadId="";
      try{
        const session=await api<{uploadId:string;chunkBytes:number}>(path,{action:"start",villaId:selected,month,name:file.name,mime:file.type,size:file.size});uploadId=session.uploadId;
        for(let offset=0,index=0;offset<file.size;offset+=session.chunkBytes,index++){
          if(cancelled.current)break;
          setProgress({name:file.name,percent:Math.floor(offset/file.size*100)});
          const base64=await readPart(file.slice(offset,offset+session.chunkBytes));
          // A retry sends the identical indexed part; the server deduplicates it.
          try{await api(path,{action:"part",villaId:selected,month,uploadId,index,base64});}catch(e){if(cancelled.current)throw e;await api(path,{action:"part",villaId:selected,month,uploadId,index,base64});}
        }
        if(cancelled.current){await api(path,{action:"cancel",month,uploadId});break;}
        await api(path,{action:"finish",villaId:selected,month,uploadId});uploadId="";setProgress({name:file.name,percent:100});await load();
      }catch(e){if(uploadId)await api(path,{action:"cancel",month,uploadId}).catch(()=>{});throw e;}
      finally{setProgress(null);}
    }
    setMessage(cancelled.current?"ยกเลิกไฟล์ที่กำลังส่งแล้ว ไฟล์ที่อัปโหลดครบก่อนหน้านี้ยังอยู่ในร่าง":"อัปโหลดครบแล้ว ตรวจไฟล์และกดส่งให้ทีม Social ด้านล่าง");
  });
  const download=async(asset:Asset)=>{
    if(downloading)return;setDownloading(asset.id);setError("");
    try{
      const parts:ArrayBuffer[]=[];let offset=0;
      while(offset<asset.size){const response=await fetch(asset.url,{credentials:"same-origin",headers:{Range:`bytes=${offset}-${Math.min(asset.size-1,offset+1024*1024-1)}`}});if(!response.ok)throw Error("ดาวน์โหลดไม่สำเร็จ กรุณาเข้าสู่ระบบและลองใหม่");const bytes=await response.arrayBuffer();if(!bytes.byteLength)throw Error("ไฟล์ไม่ครบ");const expected=Math.min(1024*1024,asset.size-offset);if(bytes.byteLength!==expected)throw Error("ขนาดไฟล์ที่ได้รับไม่ตรงกัน");parts.push(bytes);offset+=bytes.byteLength;}
      const url=URL.createObjectURL(new Blob(parts,{type:asset.mime})),anchor=document.createElement("a");anchor.href=url;anchor.download=asset.name;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setError(e instanceof Error?e.message:"ดาวน์โหลดไม่สำเร็จ");}finally{setDownloading("");}
  };
  const assets=(row:Submission)=> <div className="social-material-grid">{row.assets.map(asset=><article className="social-material-card" key={asset.id}>
    {asset.kind==="image"?<a href={asset.url} target="_blank" rel="noopener noreferrer"><img src={asset.url} alt={asset.name} loading="lazy"/></a>:<video src={asset.url} controls playsInline preload="none" aria-label={asset.name}/>}
    <strong>{asset.name}</strong><small>{asset.kind==="image"?"รูปภาพ":"วิดีโอต้นฉบับ"} · {size(asset.size)}</small>
    <div className="button-row"><button type="button" disabled={Boolean(downloading)} onClick={()=>void download(asset)}>{downloading===asset.id?"กำลังดาวน์โหลด…":"ดาวน์โหลดไฟล์"}</button>{!admin&&editable&&<button type="button" disabled={busy} onClick={()=>void execute(async()=>{await api(path,{action:"delete",villaId:selected,month,assetId:asset.id,revision:submission?.revision||0});await load();setMessage("ลบไฟล์แล้ว");})}>ลบไฟล์</button>}</div>
  </article>)}</div>;
  return <section className="merchant-panel social-materials" aria-label={admin?"ไฟล์โปรโมทที่ Merchant ส่ง":"ส่งไฟล์ให้ทีม Social"}>
    <div className="social-material-heading"><div><span className="kicker">SOCIAL MEDIA / CREATIVE BRIEF</span><h2>{admin?"ไฟล์โปรโมทจากเจ้าของที่พัก":"ส่งภาพและวิดีโอให้ทีมโปรโมท"}</h2></div><button type="button" disabled={busy||loading} onClick={()=>void execute(async()=>{const next=await load();setNotes(next.submissions.find(s=>s.villaId===selected)?.notes||"");setMessage("โหลดข้อมูลล่าสุดแล้ว");})}>โหลดไฟล์ล่าสุด</button></div>
    <p>สำหรับแพ็กเกจ 2,990 และ 4,990 · ส่งสื่อต้นฉบับพร้อมบรีฟแยกตามที่พักและเดือน ทีมงานจะนำไปจัดทำคอนเทนต์บน Social ของ VillaCheck</p>
    <p className="social-material-hint">2,990: ภาพเดี่ยว 1 โพสต์/เดือน · 4,990: ภาพเดี่ยว 1 โพสต์ + วิดีโอ 1 ชิ้น/เดือน รวมงบโฆษณา จำนวนไฟล์ต้นฉบับที่ส่งไม่เพิ่มจำนวนชิ้นงานตามสิทธิ์</p>
    <div className="social-material-filters"><label>เดือนสำหรับงานโปรโมท<input type="month" value={month} disabled={busy} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label>{!villaId&&<label>ที่พัก<select disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">{admin?"ทุกที่พัก":"เลือกที่พัก"}</option>{data?.villas.map(v=><option key={v.id} value={v.id}>{v.name}{!v.canUpload?" · ยังไม่มีสิทธิ์ส่งไฟล์":""}</option>)}</select></label>}</div>
    {error&&<p role="alert" className="form-message">{error}</p>}{message&&<p role="status" className="form-message">{message}</p>}
    {loading?<p role="status">กำลังโหลดไฟล์โปรโมท…</p>:admin?<>
      {data?.submissions.filter(s=>(!selected||s.villaId===selected)&&s.status!=="draft").map(row=><article className="social-material-submission" key={row.villaId}>
        <h3>{row.villaName} · {row.month}</h3><p><strong>{labels[row.status]}</strong>{row.submittedAt&&` · ส่ง ${new Date(row.submittedAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`}</p>
        <p className="cms-prose">บรีฟ: {row.notes||"ไม่ได้ระบุบรีฟเพิ่มเติม"}</p>{row.adminNote&&<p className="cms-prose">คำตอบจากทีม: {row.adminNote}</p>}{row.reviewedBy&&<small>ผู้ตรวจล่าสุด: {row.reviewedBy}</small>}{assets(row)}
        {["submitted","accepted"].includes(row.status)&&<div className="portal-form"><label>ข้อความตอบกลับ / สิ่งที่ต้องแก้ไข<textarea maxLength={2000} value={reviewNotes[row.villaId]??row.adminNote} onChange={e=>setReviewNotes({...reviewNotes,[row.villaId]:e.target.value})}/></label><div className="button-row">{[["accepted","รับไฟล์แล้ว"],["changes","ขอแก้ไขไฟล์"]].map(([action,label])=><button type="button" key={action} disabled={busy} onClick={()=>void execute(async()=>{await api(path,{action,villaId:row.villaId,month,revision:row.revision,adminNote:reviewNotes[row.villaId]??row.adminNote});await load();setMessage("บันทึกผลตรวจไฟล์แล้ว");})}>{label}</button>)}</div></div>}
      </article>)}
      {!data?.submissions.some(s=>(!selected||s.villaId===selected)&&s.status!=="draft")&&<p>ยังไม่มีชุดไฟล์ส่งให้ทีมในเดือนนี้</p>}
    </>:!selected?<p>เลือกที่พักเพื่อส่งไฟล์โปรโมท</p>:<>
      <p className="social-material-status">{labels[submission?.status||"draft"]}</p>{submission?.adminNote&&<p className="form-message cms-prose">คำตอบจากทีม: {submission.adminNote}</p>}
      {!villa?.canUpload&&<p>การส่งไฟล์ใหม่ต้องมีแพ็กเกจ 2,990 หรือ 4,990 ที่ยังใช้งานและที่พักผ่านอนุมัติ ไฟล์ที่ส่งไว้ยังดูและดาวน์โหลดได้</p>}
      {submission&&assets(submission)}
      {editable&&<div className="portal-form social-material-upload"><h3>ไฟล์ต้นฉบับสำหรับเดือน {month}</h3><p>ภาพ JPG/PNG ไม่เกิน 2 MB ต่อไฟล์ สูงสุด 10 ภาพ · วิดีโอ MP4/MOV ไม่เกิน 50 MB ต่อไฟล์ สูงสุด 2 ไฟล์ ส่งได้เดือนปัจจุบันหรือเดือนถัดไป</p>
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime" disabled={busy} aria-label="เลือกภาพและวิดีโอสำหรับโปรโมท Social" onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value="";void upload(files);}}/>
        {progress&&<div className="social-material-progress" role="status"><span>{progress.name} · {progress.percent}%</span><progress aria-label="ความคืบหน้าอัปโหลด" value={progress.percent} max={100}/><button type="button" onClick={()=>{cancelled.current=true;}}>ยกเลิกอัปโหลด</button></div>}
        <label>บรีฟ / จุดเด่น / ข้อความที่อยากให้โปรโมท<textarea aria-label="บรีฟ / จุดเด่น / ข้อความที่อยากให้โปรโมท" maxLength={2000} placeholder="เช่น จุดเด่นที่พัก กลุ่มลูกค้า โปรโมชั่น และช่องทางติดต่อที่ต้องการให้ใส่" value={notes} disabled={busy} onChange={e=>setNotes(e.target.value)}/></label>
        <button type="button" disabled={busy} onClick={()=>void execute(async()=>{await api(path,{action:"draft",villaId:selected,month,revision:submission?.revision||0,notes});await load();setMessage("บันทึกบรีฟเป็นร่างแล้ว ยังไม่ส่งให้ทีม");})}>บันทึกบรีฟเป็นร่าง</button>
        <label className="social-material-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>ยืนยันว่ามีสิทธิ์ใช้ภาพและวิดีโอเหล่านี้ และอนุญาตให้ VillaCheck ใช้จัดทำและเผยแพร่คอนเทนต์โปรโมทที่พัก</label>
        <button type="button" className="primary-button" disabled={busy||!confirmed||!submission?.assets.length} onClick={()=>void execute(async()=>{await api(path,{action:"submit",villaId:selected,month,revision:submission?.revision||0,notes,confirmed});await load();setMessage("ส่งไฟล์และบรีฟให้ทีม Social แล้ว ติดตามคำตอบได้ที่นี่");})}>ส่งไฟล์และบรีฟให้ทีม Social</button>
      </div>}{villa?.canUpload&&!editable&&(!submission||["draft","changes"].includes(submission.status))&&<p>เดือนนี้ดูประวัติได้ การส่งหรือแก้ไฟล์เปิดสำหรับเดือนปัจจุบันและเดือนถัดไป</p>}
    </>}
  </section>;
}
