import { execFileSync, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const url='http://localhost:4173';
try { execFileSync('/bin/launchctl',['kickstart',`gui/${process.getuid()}/com.squiishyy.daysoff`],{stdio:'ignore'}); } catch {}
for(let attempt=0;attempt<30;attempt++) {
  try { const response=await fetch(url+'/health',{signal:AbortSignal.timeout(700)}); if(response.ok&&(await response.json()).app==='days-off')break; } catch {}
  await delay(300);
}
const candidates=['/Applications/Google Chrome.app',`${process.env.HOME}/Applications/Google Chrome.app`];
let chrome;
for(const candidate of candidates){try{await access(candidate);chrome=candidate;break;}catch{}}
const args=chrome?['-a',chrome,url]:[url];
spawn('/usr/bin/open',args,{stdio:'ignore'}).on('error',error=>console.error(error.message));
