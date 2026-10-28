// Existing CLI authentication only; never read protection/bypass/SSO credentials.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
export const mfaCli='/tmp/villacheck-staging-cli/node_modules/vercel/dist/index.js';
export const mfaTeam='team_H5TvWOtVZTbtuTSapZyj6uGz';
export function mfaProviderGet(endpoint){
 assert(/^\/v(?:4\/aliases\/(?:design-villacheck\.vercel\.app|www\.villacheckth\.com)|13\/deployments\/(?:dpl_[A-Za-z0-9]+|(?:design-villacheck|villacheck-production)-[a-z0-9]+-villa-check\.vercel\.app)|6\/deployments\/dpl_[A-Za-z0-9]+\/files)$/.test(endpoint),'Only exact deployment/alias reads are permitted');
 const raw=execFileSync(process.execPath,[mfaCli,'api',endpoint,'--method','GET','--scope',mfaTeam,'--no-color'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000,maxBuffer:12*1024*1024});return JSON.parse(raw);
}
