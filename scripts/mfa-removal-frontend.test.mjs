// Local contract tests only: no provider calls, real accounts or credentials.
// Run: node --import tsx --test scripts/mfa-removal-frontend.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import AdminLogin from '../src/AdminLogin.tsx'
import OtpLogin from '../src/OtpLogin.tsx'
import {authenticateAdmin,currentAccount,logout} from '../src/api.ts'

test('Admin login renders the primary credentials without an MFA enrollment or challenge field',()=>{
 const html=renderToStaticMarkup(React.createElement(AdminLogin,{go:()=>{}}))
 assert.equal((html.match(/type="email"/g)||[]).length,1)
 assert.equal((html.match(/type="password"/g)||[]).length,1)
 assert.doesNotMatch(html,/MFA|TOTP|Authenticator|Recovery Code|one-time-code|enrollment/i)
 assert.match(html,/type="submit"/)
})

test('primary email and phone OTP selection remains present',()=>{
 const html=renderToStaticMarkup(React.createElement(OtpLogin,{onAuthenticated:()=>{}}))
 assert.match(html,/เบอร์โทรศัพท์/)
 assert.match(html,/อีเมล/)
 assert.match(html,/OTP/)
 assert.match(html,/<form/)
 assert.doesNotMatch(html,/MFA|TOTP|Authenticator|Recovery Code/i)
})

test('Admin password login sends no factor and preserves same-origin sessions, refresh and CSRF logout',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch
 const calls=[],events=[],account={id:'synthetic-admin-unit-test',email:'admin@example.invalid',role:'admin'},csrf='unit-test-csrf'
 globalThis.window={location:{pathname:'/admin/login'},dispatchEvent:event=>{events.push(event.type);return true}}
 globalThis.fetch=async(url,options)=>{
  assert(['GET','POST'].includes(options.method))
  assert(['/api/auth/admin-login','/api/auth/admin-me','/api/auth/admin-logout'].includes(url),'No external or MFA request is allowed')
  calls.push({url,...options,payload:options.body?JSON.parse(options.body):undefined})
  return new Response(JSON.stringify(url.endsWith('admin-logout')?{ok:true}:{user:account,csrf}),{status:200,headers:{'Content-Type':'application/json'}})
 }
 try{
  const loggedIn=await authenticateAdmin(account.email,'synthetic-unit-test-password','ignored-factor','ignored-recovery')
  assert.equal(loggedIn.role,'admin')
  assert.deepEqual(Object.keys(calls[0].payload).sort(),['email','password'])
  assert.equal(calls[0].credentials,'same-origin')
  assert.equal(calls[0].headers['X-VillaCheck-Portal'],'admin')
  assert.equal((await currentAccount()).id,account.id)
  await logout()
  const ended=calls.at(-1)
  assert.equal(ended.url,'/api/auth/admin-logout')
  assert.equal(ended.headers['X-CSRF-Token'],csrf)
  assert.equal(ended.credentials,'same-origin')
  assert(events.includes('auth-session-changed'))
 }finally{
  globalThis.fetch=originalFetch
  if(originalWindow===undefined)delete globalThis.window
  else globalThis.window=originalWindow
 }
})
