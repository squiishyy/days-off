import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceAt, shortfalls, hours, withRange, eligibleDates, validatePlan, datesBetween, isAccrual, validDate, removeRange, labeledRanges, colorInk, planEvents, withPlanEvent, withoutPlanEvent, replacePtoRange } from './model.js';
const make = (overrides = {}) => ({ version:1, config:{start:'2027-01-01',next:'2027-01-08',balance:43.42,annual:18,rate:144/26},pto:{},holidays:[],...overrides });
test('starting balance and biweekly deposits; no retroactive deposits',()=>{
  const p=make();assert.equal(hours(balanceAt(p,'2027-01-01')),43.42);assert.equal(balanceAt(p,'2026-12-31'),null);
  assert.ok(Math.abs(hours(balanceAt(p,'2027-01-08'))-(43.42+144/26))<.000001);
  assert.equal(balanceAt(p,'2027-01-21'),balanceAt(p,'2027-01-08'));
  assert.equal(isAccrual(p,'2027-01-22'),true);assert.equal(isAccrual(p,'2027-01-15'),false);
});
test('accrual is available before same-day PTO',()=>{
  const p=make({config:{start:'2027-01-08',next:'2027-01-08',balance:0,annual:18,rate:8},pto:{'2027-01-08':8}});
  assert.equal(balanceAt(p,'2027-01-08'),0);assert.deepEqual(shortfalls(p),[]);
});
test('earlier trips change later feasibility and negative costs carry forward',()=>{
  let p=make();p=withRange(p,'2027-01-04','2027-01-08',8);p=withRange(p,'2027-01-11','2027-01-12',8);
  assert.deepEqual(shortfalls(p),['2027-01-12']);assert.ok(Math.abs(hours(balanceAt(p,'2027-01-12'))+7.041538)<.000001);
  assert.ok(balanceAt(p,'2027-01-22')<0);assert.ok(balanceAt(p,'2027-02-05')>0);
});
test('weekends, holidays, partial days, and overlapping ranges',()=>{
  let p=make({holidays:['2027-01-04']});assert.deepEqual(eligibleDates(p,'2027-01-01','2027-01-05'),['2027-01-01','2027-01-05']);
  p=withRange(p,'2027-01-01','2027-01-05',8);p=withRange(p,'2027-01-05','2027-01-05',4.25);
  assert.equal(hours(balanceAt(p,'2027-01-05')),31.17);assert.equal(p.pto['2027-01-04'],undefined);
  p.pto['2027-01-04']=8;assert.equal(hours(balanceAt(p,'2027-01-05')),31.17);
});
test('year boundary, leap days, reversed ranges, and invalid calendar dates',()=>{
  assert.deepEqual(datesBetween('2028-02-28','2028-03-01'),['2028-02-28','2028-02-29','2028-03-01']);
  assert.deepEqual(datesBetween('2027-01-05','2027-01-04'),[]);assert.equal(validDate('2027-02-29'),false);
  const p=make({config:{start:'2026-12-31',next:'2027-01-01',balance:0,annual:18,rate:5}});assert.equal(hours(balanceAt(p,'2027-01-15')),10);
});
test('27-deposit years use fixed biweekly rate, without annual reset',()=>{
  const p=make({config:{start:'2027-01-01',next:'2027-01-01',balance:0,annual:18,rate:144/26}});
  assert.ok(Math.abs(hours(balanceAt(p,'2027-12-31'))-27*144/26)<.000001);
});
test('import rejects corrupt dates, impossible amounts, and malformed shape',()=>{
  assert.equal(validatePlan(make()),true);assert.equal(validatePlan({...make(),pto:[]}),false);
  assert.equal(validatePlan(make({pto:{'2027-01-04':25}})),false);
  assert.equal(validatePlan(make({holidays:['2027-02-30']})),false);
  const p=make();p.config.next='2026-12-01';assert.equal(validatePlan(p),false);
});

test('legacy plans remain valid; adding labels and colors preserves accrual and other PTO',()=>{
  const legacy=make({pto:{'2027-01-04':4,'2027-01-05':8}});
  assert.equal(validatePlan(legacy),true);
  const edited=withRange(legacy,'2027-01-04','2027-01-04',4,{label:'Family trip',color:'#f8d262'});
  assert.equal(validatePlan(edited),true);
  assert.equal(balanceAt(edited,'2027-01-08'),balanceAt(legacy,'2027-01-08'));
  assert.equal(edited.pto['2027-01-05'],8);
  assert.equal(edited.ptoDetails['2027-01-04'].label,'Family trip');
  assert.equal(legacy.ptoDetails,undefined);
  assert.equal(validatePlan(JSON.parse(JSON.stringify(edited))),true);
});
test('metadata is retained for hours-only edits and removed with deleted PTO',()=>{
  let p=withRange(make(),'2027-01-04','2027-01-06',8,{label:'Beach',color:'#e8c357'});
  p=withRange(p,'2027-01-05','2027-01-05',4);
  assert.equal(p.ptoDetails['2027-01-05'].label,'Beach');
  p=withRange(p,'2027-01-06','2027-01-06',8,{label:'Family'});
  assert.equal(p.ptoDetails['2027-01-06'].color,'#e8c357');
  p=removeRange(p,'2027-01-04','2027-01-05');
  assert.equal(p.pto['2027-01-04'],undefined);
  assert.equal(p.ptoDetails['2027-01-05'],undefined);
  assert.equal(p.ptoDetails['2027-01-06'].label,'Family');
  assert.equal(validatePlan(p),true);
});
test('year labels group across weekends but split around other working days',()=>{
  let p=withRange(make(),'2027-01-08','2027-01-11',8,{label:'Long weekend',color:'#fbca72'});
  p=withRange(p,'2027-01-13','2027-01-13',8,{label:'Long weekend',color:'#fbca72'});
  const groups=labeledRanges(p,'2027-01-01','2027-01-31');
  assert.equal(groups.length,2);assert.equal(groups[0].end,'2027-01-11');
  assert.equal(groups[1].start,'2027-01-13');
});
test('invalid label and color metadata is rejected without blocking old backups',()=>{
  const p=withRange(make(),'2027-01-04','2027-01-04',8,{label:'Trip',color:'#ffffff'});
  assert.equal(colorInk('#ffffff'),'#000000');assert.equal(colorInk('#000011'),'#ffffff');
  p.ptoDetails['2027-01-04'].color='red;display:none';assert.equal(validatePlan(p),false);
  p.ptoDetails['2027-01-04']={label:'x'.repeat(81),color:'#ffffff'};assert.equal(validatePlan(p),false);
  p.ptoDetails={'2027-01-05':{label:'Orphan',color:'#ffffff'}};assert.equal(validatePlan(p),false);
});

test('plans span weekends and holidays without using PTO; overlapping events are independent',()=>{
  const base=make({pto:{'2027-01-04':8},holidays:['2027-01-01']});
  let p=withPlanEvent(base,{id:'maine',start:'2027-01-01',end:'2027-01-08',label:' Maine ',color:'#68aadd'});
  p=withPlanEvent(p,{id:'family',start:'2027-01-03',end:'2027-01-05',label:'Family',color:'#ddac68'});
  assert.equal(validatePlan(p),true);assert.equal(balanceAt(p,'2027-01-08'),balanceAt(base,'2027-01-08'));
  assert.equal(planEvents(p,'2027-01-04','2027-01-04').length,2);
  assert.equal(p.events[0].label,'Maine');
  p=withPlanEvent(p,{...p.events[0],start:'2027-02-01',end:'2027-02-03'});
  assert.equal(planEvents(p,'2027-01-04','2027-01-04').length,1);
  p=withoutPlanEvent(p,'maine');assert.equal(p.events.length,1);assert.equal(p.pto['2027-01-04'],8);
});
test('plan backups reject duplicate IDs and invalid ranges while retaining old backups',()=>{
  const event={id:'maine',start:'2027-01-01',end:'2027-01-08',label:'Maine',color:'#68aadd'};
  assert.equal(validatePlan(make({events:[event]})),true);
  assert.equal(validatePlan(make({events:[event,event]})),false);
  assert.equal(validatePlan(make({events:[{...event,end:'2026-12-30'}]})),false);
  assert.equal(validatePlan(make({events:[{...event,color:'invalid'}]})),false);
});
test('moving a PTO range removes old dates and preserves mixed per-day styles',()=>{
  let p=withRange(make(),'2027-01-04','2027-01-04',4,{label:'Family',color:'#ffaa33'});
  p=withRange(p,'2027-01-05','2027-01-05',8,{label:'Beach',color:'#4488cc'});
  p=replacePtoRange(p,'2027-01-04','2027-01-05','2027-01-05','2027-01-06',4,{});
  assert.equal(p.pto['2027-01-04'],undefined);assert.equal(p.ptoDetails['2027-01-04'],undefined);
  assert.equal(p.ptoDetails['2027-01-05'].label,'Beach');assert.equal(p.pto['2027-01-06'],4);
  assert.equal(validatePlan(p),true);
});

test('browser and server release versions agree so update checks cannot reload in a loop',async()=>{
  const {readFile}=await import('node:fs/promises');
  const version=JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8')).version;
  const script=await readFile(new URL('./app.js',import.meta.url),'utf8');
  const page=await readFile(new URL('./index.html',import.meta.url),'utf8');
  assert.equal(script.match(/APP_VERSION = '([^']+)'/)[1],version);
  assert.ok(page.includes(`>${'v'+version}</span>`));
});
