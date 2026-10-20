import 'dotenv/config';
import {randomBytes} from 'node:crypto';
import {PrismaDatabaseService} from '../.build/backend/prisma.service.js';
import {seedDemo} from '../server/demo-seed.mjs';
import {advertisingApi} from '../server/advertising.mjs';
// User-authorized demo deployment. Disable with SEED_PUBLIC_DEMO_DATA=false.
if(process.env.VERCEL!=='1'||process.env.SEED_PUBLIC_DEMO_DATA==='false')process.exit(0);
const db=new PrismaDatabaseService();
try{
 const result=await seedDemo(db,{password:process.env.DEMO_PASSWORD || randomBytes(24).toString('base64url')});
 console.log('Free Basic dummy fixtures:',result.freeVillas);
 console.log('Public labelled sample data ready:',result.villas,'Villas. No demo Admin or payment emails created.');
 const home=await advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=home'),()=>{});
 console.log('Labelled carousel samples:',{advertisements:home.advertisements.length,dummy:home.advertisements.filter(a=>a.demo).length});
 const footer=await advertisingApi(db,null,{method:'GET'},'/api/public/advertisements',new URL('http://localhost?placement=footer'),()=>{});
 const pro=await db.prepare("SELECT active,amount FROM package_catalog WHERE id='pro'").get();
 console.log('Labelled footer sample:',{advertisements:footer.advertisements.length,proActive:Boolean(pro?.active),monthlyAmount:pro?.amount});
}finally{await db.close();}
