import { mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const flags=process.argv.slice(2),get=flag=>flags[flags.indexOf(flag)+1];
if(!flags.includes('--output')||!flags.includes('--stage'))throw Error('Usage: node mac/package.mjs --output /path/Days-Off-Mac.zip --stage /path/to/work');
const source=fileURLToPath(new URL('..',import.meta.url));
const output=path.resolve(get('--output')),stageParent=path.resolve(get('--stage'));
await mkdir(stageParent,{recursive:true});await mkdir(path.dirname(output),{recursive:true});
const stage=await mkdtemp(path.join(stageParent,'days-off-package-')),folder=path.join(stage,'Days Off');
const files=['index.html','styles.css','app.js','tour.js','model.js','server.mjs','model.test.mjs','package.json','README.md','MAC-INSTALL.md','START-HERE.txt','Install or Update Days Off.command','mac/install.sh','mac/install.mjs','mac/launch.mjs','mac/uninstall.sh'];
try{
  for(const name of files){const target=path.join(folder,name);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(source,name),target);}
  const archive=path.join(stage,'Days-Off-Mac.zip');
  execFileSync('/usr/bin/zip',['-q','-r',archive,'Days Off'],{cwd:stage,stdio:'inherit'});
  await copyFile(archive,output);
  console.log(`Ready to send: ${output}`);
}finally{await rm(stage,{recursive:true,force:true});}
