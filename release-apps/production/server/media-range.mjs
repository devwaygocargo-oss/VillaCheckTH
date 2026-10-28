// Parse one HTTP byte range, including suffix requests used by mobile video.
export function mediaRange(header, size) {
 if (!header) return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(header);
 if(!match||(!match[1]&&!match[2]))return {invalid:true};
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
 const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return {invalid:true};
 return {start,end};
}
