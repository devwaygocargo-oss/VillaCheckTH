import {diversifyDemoImages} from "../server/diversify-demo-images.mjs";
import {seedDemoVillaReports} from "../server/demo-villa-reports.mjs";
import {seedDemoOwnerVerification} from "../server/demo-owner-verification.mjs";
import {seedDemoReviews} from "../server/demo-reviews.mjs";
import {seedDemoUserActivity} from "../server/demo-user-activity.mjs";
import {replaceLegacyStockImages} from "../server/licensed-demo-images.mjs";
import {enrichStatusGuide} from "../server/status-guide.mjs";
import {enrichPublishedNews} from "../server/news-content.mjs";
import 'dotenv/config';
import {randomBytes} from 'node:crypto';
import {PrismaDatabaseService} from '../.build/backend/prisma.service.js';
import {removeSampleWord} from '../server/remove-sample-word.mjs';
import {seedDemo} from '../server/demo-seed.mjs';
import {advertisingApi} from '../server/advertising.mjs';
// Explicit opt-in only; never run demo seed during an application build.
if(process.env.SEED_PUBLIC_DEMO_DATA!=='true')process.exit(0);
const db=new PrismaDatabaseService();
try{
 const result=await seedDemo(db,{password:process.env.DEMO_PASSWORD || randomBytes(24).toString('base64url')});
 console.log('Licensed image replacements:',await replaceLegacyStockImages(db));
 console.log('Status guide expanded:',await enrichStatusGuide(db));
 console.log('News content expanded:',await enrichPublishedNews(db));
 console.log('Diverse demo images:',await diversifyDemoImages(db));
 console.log('Display wording updated:',await removeSampleWord(db));
 console.log('Demo User activity:',await seedDemoUserActivity(db));
 console.log('Demo Villa reports:',await seedDemoVillaReports(db));
 console.log('Demo reviews:',await seedDemoReviews(db));
 console.log('Demo owner verification:',await seedDemoOwnerVerification(db));
 const socialPlan=await db.prepare("SELECT features FROM package_catalog WHERE id='pro'").get();
 console.log('Social Verify promotion:',{singlePost:JSON.parse(socialPlan.features).some(f=>f.includes('Single Post')),videoPost:JSON.parse(socialPlan.features).some(f=>/วิดีโอ 1|วีดีโอ 1|video 1/i.test(f))});
 console.log('Free Basic dummy fixtures:',result.freeVillas);
 console.log('Public labelled sample data ready:',result.villas,'Villas. No demo Admin or payment emails created.');
 const home=await advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=home'),()=>{});
 console.log('Labelled carousel samples:',{advertisements:home.advertisements.length,dummy:home.advertisements.filter(a=>a.demo).length});
 const footer=await advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=footer'),()=>{});
 const pro=await db.prepare("SELECT active,amount FROM package_catalog WHERE id='pro'").get();
 console.log('Labelled footer sample:',{advertisements:footer.advertisements.length,proActive:Boolean(pro?.active),monthlyAmount:pro?.amount});
}finally{await db.close();}
