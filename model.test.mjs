import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceAt, shortfalls, hours, withRange, eligibleDates, validatePlan, datesBetween, isAccrual, validDate } from './model.js';
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
