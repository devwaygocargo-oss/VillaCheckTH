// Public presentation only: original account names and review records stay unchanged.
export function privateReviewerLabel(name) {
 const first=[...String(name||'').trim()][0];
 return first&&/\p{L}/u.test(first)?first+'…':'Member';
}
export function publicReviewPage(records,searchParams) {
 const published=records.filter(r=>r.status==='published'&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5);
 const integer=(key,fallback,max)=>{const raw=searchParams.get(key);if(raw===null)return fallback;const value=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<1||value>max)throw Object.assign(Error('Invalid review pagination'),{status:400,code:'REVIEW_QUERY_INVALID'});return value};
 const page=integer('page',1,1000000),pageSize=integer('pageSize',6,24),ratingRaw=searchParams.get('rating')||'',rating=ratingRaw?Number(ratingRaw):null,sort=searchParams.get('sort')||'newest';
 if(ratingRaw&&!/^[1-5]$/.test(ratingRaw)||!['newest','oldest','highest','lowest'].includes(sort))throw Object.assign(Error('Invalid review filter'),{status:400,code:'REVIEW_QUERY_INVALID'});
 const distribution=Object.fromEntries([5,4,3,2,1].map(stars=>[stars,published.filter(r=>r.rating===stars).length]));
 const summary={count:published.length,average:published.length?Math.round(published.reduce((sum,r)=>sum+r.rating,0)/published.length*10)/10:null,distribution};
 const filtered=published.filter(r=>rating===null||r.rating===rating).sort((a,b)=>{
  const date=String(b.createdAt||'').localeCompare(String(a.createdAt||''))||String(a.id).localeCompare(String(b.id));
  return sort==='highest'?b.rating-a.rating||date:sort==='lowest'?a.rating-b.rating||date:sort==='oldest'?-date:date;
 });
 const total=filtered.length;
 return {summary,pagination:{page,pageSize,total,totalPages:Math.ceil(total/pageSize),hasNext:page*pageSize<total},reviews:filtered.slice((page-1)*pageSize,page*pageSize).map(r=>({id:r.id,rating:r.rating,content:r.content,author:privateReviewerLabel(r.author),createdAt:r.createdAt,publishedAt:r.publishedAt||r.reviewedAt||null,reply:r.reply?{content:r.reply.content,author:privateReviewerLabel(r.reply.author),at:r.reply.at}:null}))};
}
