import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const options = process.argv.slice(2);
const value = flag => options[options.indexOf(flag)+1];
const prepareOnly = options.includes('--prepare-only');
const home = prepareOnly ? value('--test-root') : os.homedir();
if (!home || !path.isAbsolute(home)) throw Error('A valid installation home is required.');
const source = value('--source'), runtime = value('--runtime');
const support = path.join(home,'Library','Application Support','Days Off');
const appDir = path.join(support,'app');
const bundle = path.join(home,'Applications','Days Off.app');
const agent = path.join(home,'Library','LaunchAgents','com.squiishyy.daysoff.plist');
const uid = process.getuid();
const service = `gui/${uid}/com.squiishyy.daysoff`;
const xml = text => String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const shellQuote = text => "'"+text.replaceAll("'", "'\\''")+"'";
const files = ['index.html','styles.css','app.js','model.js','server.mjs','package.json','README.md','MAC-INSTALL.md'];
const run = (command,args) => execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
async function endpoint() {
  try { const response = await fetch('http://localhost:4173/health',{signal:AbortSignal.timeout(700)}); return response.ok && (await response.json()).app === 'days-off'; }
  catch { return false; }
}
async function portInUse() {
  const net = await import('node:net');
  return new Promise(resolve=>{const s=net.createConnection({host:'127.0.0.1',port:4173});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.setTimeout(700,()=>{s.destroy();resolve(true);});});
}
try {
  if (!prepareOnly) {
    let ownAgent = false;
    try { run('/bin/launchctl',['print',service]); ownAgent=true; } catch {}
    if (!ownAgent && await portInUse()) throw Error('Port 4173 is already in use. Quit any manually started Days off server (Control-C in its Terminal), then run this installer again. Your saved PTO is unaffected.');
    if (ownAgent) run('/bin/launchctl',['bootout',service]);
  }
  await mkdir(appDir,{recursive:true});
  await mkdir(path.join(support,'logs'),{recursive:true});
  await mkdir(path.dirname(agent),{recursive:true});
  await mkdir(path.join(bundle,'Contents','MacOS'),{recursive:true});
  for (const file of files) await copyFile(path.join(source,file),path.join(appDir,file));
  await copyFile(path.join(source,'mac','launch.mjs'),path.join(support,'launch.mjs'));
  await copyFile(path.join(source,'mac','uninstall.sh'),path.join(support,'Uninstall Days Off.command'));
  await writeFile(path.join(bundle,'Contents','Info.plist'),`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Days Off</string>
<key>CFBundleDisplayName</key><string>Days Off</string>
<key>CFBundleIdentifier</key><string>com.squiishyy.daysoff</string>
<key>CFBundleExecutable</key><string>DaysOff</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSUIElement</key><true/>
<key>LSMinimumSystemVersion</key><string>13.5</string>
</dict></plist>\n`);
  await writeFile(path.join(bundle,'Contents','MacOS','DaysOff'),`#!/bin/zsh\nexec ${shellQuote(runtime)} ${shellQuote(path.join(support,'launch.mjs'))} >> ${shellQuote(path.join(support,'logs','launcher.log'))} 2>&1\n`,{mode:0o755});
  await writeFile(agent,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.squiishyy.daysoff</string>
<key>ProgramArguments</key><array><string>${xml(runtime)}</string><string>${xml(path.join(appDir,'server.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(appDir)}</string>
<key>EnvironmentVariables</key><dict><key>PORT</key><string>4173</string></dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>${xml(path.join(support,'logs','server.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(support,'logs','server-error.log'))}</string>
</dict></plist>\n`);
  run('/usr/bin/plutil',['-lint',agent,path.join(bundle,'Contents','Info.plist')]);
  await writeFile(path.join(support,'installation.json'),JSON.stringify({installedAt:new Date().toISOString(),runtime,appDir,bundle,agent},null,2)+'\n');
  if (prepareOnly) { console.log(`Prepared and validated installer output at ${home}. No login service was loaded and no browser was opened.`); process.exit(0); }
  run('/bin/launchctl',['enable',service]);
  run('/bin/launchctl',['bootstrap',`gui/${uid}`,agent]);
  for (let tries=0;tries<30;tries++) { if (await endpoint()) break; await delay(300); }
  if (!await endpoint()) throw Error(`The app files were installed, but the server did not start. See ${support}/logs/server-error.log. Try opening Days Off again, or check Login Items & Extensions in System Settings.`);
  console.log(`Installed: ${bundle}\nDays off now starts in the background when you log in.\nOpen Days Off from your Applications folder at any time.\nNo Terminal window needs to stay open.\nYour browser's saved PTO stays at http://localhost:4173.\nUninstall: ${support}/Uninstall Days Off.command`);
  spawn(runtime,[path.join(support,'launch.mjs')],{stdio:'ignore',detached:true}).unref();
} catch (error) { console.error(`\nInstallation could not finish: ${error.message}`); process.exitCode=1; }
