import {createBackend} from '../.build/backend/bootstrap.js'
import {PrismaDatabaseService} from '../.build/backend/prisma.service.js'
import {createUser} from '../server/database.mjs'
const {NEW_ADMIN_EMAIL:email,NEW_ADMIN_PASSWORD:password,NEW_ADMIN_NAME:name}=process.env
if(!email||!password||password.length<12||!name)throw Error('Provide NEW_ADMIN_EMAIL, NEW_ADMIN_NAME and password of at least 12 characters through a secure operator environment')
const runtime=await createBackend()
try{await createUser(runtime.app.get(PrismaDatabaseService),email,password,name,'admin');console.log('Admin provisioned')}catch{console.error('Admin provisioning failed; verify target database and existing account. Secrets are not logged.');process.exitCode=1}finally{await runtime.app.close()}
