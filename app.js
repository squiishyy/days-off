import { validDate, ordinal, isWeekday, datesBetween, eligibleDates, balanceAt, hours, isAccrual, shortfalls, withRange, validatePlan } from './model.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'days-off.plan.v1';
const THEME_KEY = 'days-off.theme';
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
const iso = (year, month, day) => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const labelDate = (date, year = false) => { const [y,m,d] = date.split('-').map(Number); return `${months[m-1]} ${d}${year ? `, ${y}` : ''}`; };
const fmt = amount => Number(amount.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 });
let plan = null, draftConfig = null, pendingImport = null, setupMode = 'first';
let view = 'year', shownYear = Number(today.slice(0,4)), shownMonth = Number(today.slice(5,7))-1;
let contextDate = null, drag = null, toastTimer;
const setupForm = $('#setup-form');
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (validatePlan(parsed)) plan = parsed;
    else showStorageWarning('The saved plan could not be read. Import a backup or start a new plan.');
  }
  const theme = localStorage.getItem(THEME_KEY);
  if (['light','dark'].includes(theme)) document.documentElement.dataset.theme = theme;
} catch { showStorageWarning('Browser saving is unavailable. Export a backup to keep your plan.'); }
function showStorageWarning(message) { $('#storage-warning').textContent = message; $('#storage-warning').hidden = false; }
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); }
  catch { showStorageWarning('Your latest changes could not be saved in this browser. Export a backup to keep them.'); }
}
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500); }
function updateThemeLabel() { const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; $('#theme').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`); }
$('#theme').onclick = () => { const isDark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; const theme = isDark ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem(THEME_KEY, theme); } catch {} updateThemeLabel(); };
updateThemeLabel();
function fillSetup(config = null) {
  setupForm.elements.balance.value = config?.balance ?? 43.42;
  setupForm.elements.start.value = config?.start ?? today;
  setupForm.elements.annual.value = config?.annual ?? 18;
  setupForm.elements.next.value = config?.next ?? '';
  const derived = Number(setupForm.elements.annual.value) * 8 / 26;
  const exact = config && Math.abs(config.rate - derived) > 1e-9;
  setupForm.elements.exact.value = exact ? config.rate : '';
  $('#exact-details').open = Boolean(exact);
  updateRate();
}
function showSetup(mode) {
  setupMode = mode;
  fillSetup(plan?.config || draftConfig);
  $('#setup').hidden = false; $('#planner').hidden = true;
  $('#settings').hidden = true; $('#restart').hidden = true;
  $('#cancel-settings').hidden = mode !== 'edit';
  $('#setup-title').innerHTML = mode === 'restart' ? 'A fresh start.<br>Your settings, remembered.' : mode === 'edit' ? 'Your plan.<br>Your settings.' : 'A little setup.<br>A year of possibilities.';
  $('#setup-intro').textContent = mode === 'restart' ? 'Update your balance and dates, then plan again.' : mode === 'edit' ? 'Update your starting point. Your planned PTO stays.' : 'Start with your balance. Plan from there.';
  $('#setup-submit').innerHTML = `${mode === 'edit' ? 'Save settings' : mode === 'restart' ? 'Start a new plan' : 'Start planning'} <span aria-hidden="true">→</span>`;
  $('#setup-error').textContent = '';
}
function updateRate() {
  const annual = Number(setupForm.elements.annual.value), exact = setupForm.elements.exact.value;
  const rate = exact === '' ? annual * 8 / 26 : Number(exact);
  $('#rate-summary').textContent = `${exact === '' ? '≈ ' : ''}${fmt(rate)} hours added every 2 weeks`;
  setupForm.elements.exact.placeholder = (annual * 8 / 26).toFixed(7);
  setupForm.elements.next.min = setupForm.elements.start.value;
  setupForm.elements.next.setCustomValidity('');
}
setupForm.addEventListener('input', updateRate);
setupForm.addEventListener('submit', event => {
  event.preventDefault();
  const f = setupForm.elements;
  if (!setupForm.reportValidity()) return;
  const config = { balance: Number(f.balance.value), start: f.start.value, annual: Number(f.annual.value), next: f.next.value, rate: f.exact.value === '' ? Number(f.annual.value) * 8 / 26 : Number(f.exact.value) };
  const nextPlan = { version: 1, config, pto: setupMode === 'edit' ? plan.pto : {}, holidays: setupMode === 'edit' ? plan.holidays : [] };
  if (!validatePlan(nextPlan)) { $('#setup-error').textContent = 'Choose a next accrual date on or after the balance date, and valid PTO amounts.'; return; }
  plan = nextPlan; draftConfig = null;
  shownYear = Number(config.start.slice(0,4)); shownMonth = Number(config.start.slice(5,7))-1;
  save(); showPlanner();
});
function showPlanner() { $('#setup').hidden = true; $('#planner').hidden = false; $('#settings').hidden = false; $('#restart').hidden = false; render(); }
$('#settings').onclick = () => showSetup('edit');
$('#cancel-settings').onclick = showPlanner;
$('#restart').onclick = () => { hideContext(); $('#restart-dialog').showModal(); $('#keep-plan').focus(); };
$('#keep-plan').onclick = () => $('#restart-dialog').close();
$('#confirm-restart').onclick = () => {
  draftConfig = { ...plan.config };
  plan = { ...plan, pto: {}, holidays: [], needsSetup: true };
  // Save the cleared plan immediately; its settings survive a refresh during setup.
  save(); $('#restart-dialog').close(); showSetup('restart');
};
function dayStatus(date) {
  const holiday = plan.holidays.includes(date), amount = plan.pto[date];
  const short = !holiday && isWeekday(date) && amount && balanceAt(plan, date) !== null && balanceAt(plan, date) < 0;
  return { holiday, amount: isWeekday(date) && !holiday ? amount : null, short };
}
function makeDay(date, monthView) {
  const b = document.createElement('button'), status = dayStatus(date), disabled = date < plan.config.start;
  b.type = 'button'; b.dataset.date = date;
  b.className = `day ${monthView ? 'month-day' : 'mini-day'}${!isWeekday(date)?' weekend':''}${disabled?' before':''}${status.holiday?' holiday':status.amount?' pto':''}${status.short?' short':''}${isAccrual(plan,date)?' accrual':''}${date===today?' today':''}`;
  const day = Number(date.slice(8));
  const description = `${labelDate(date,true)}${status.holiday?', company holiday':status.amount?`, ${fmt(status.amount)} hours PTO`:''}${status.short?`, ${fmt(-hours(balanceAt(plan,date)))} hours short`:''}${isAccrual(plan,date)?`, ${fmt(plan.config.rate)} hours accrue`:''}${disabled?', before the plan starts':''}`;
  b.setAttribute('aria-label', description); b.title = description;
  if (date === today) b.setAttribute('aria-current','date');
  b.disabled = disabled;
  if (monthView) {
    const num = document.createElement('span'); num.textContent = day;
    const caption = document.createElement('span'); caption.className = 'day-label'; caption.textContent = status.holiday ? 'Holiday' : status.amount ? `${fmt(status.amount)}h PTO` : isAccrual(plan,date) ? `+${fmt(plan.config.rate)}h` : '';
    b.append(num, caption);
  } else b.textContent = day;
  b.addEventListener('keydown', event => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault(); const rect = b.getBoundingClientRect(); openContext(date, rect.left, rect.bottom, b);
    }
  });
  return b;
}
function weekdayLabels(grid, abbreviated) {
  ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].forEach(name => { const el = document.createElement('div'); el.className='weekday'; el.textContent=abbreviated?name[0]:name.slice(0,3); el.setAttribute('aria-label',name); grid.append(el); });
}
function monthGrid(year, month, large) {
  const grid=document.createElement('div'); grid.className=large?'month-grid':'mini-grid'; weekdayLabels(grid,!large);
  const offset=new Date(Date.UTC(year,month,1)).getUTCDay(),count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  for(let i=0;i<offset;i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');grid.append(blank);}
  for(let day=1;day<=count;day++)grid.append(makeDay(iso(year,month,day),large));
  return grid;
}
function render() {
  if (!plan) return;
  $('#period').textContent=view==='year'?shownYear:`${months[shownMonth]} ${shownYear}`;
  $('#year-view').setAttribute('aria-pressed', String(view==='year')); $('#month-view').setAttribute('aria-pressed', String(view==='month'));
  $('#previous').setAttribute('aria-label',`Previous ${view}`); $('#next').setAttribute('aria-label',`Next ${view}`);
  $('#plan-summary').textContent=`${fmt(plan.config.balance)}h as of ${labelDate(plan.config.start,true)} · +${fmt(plan.config.rate)}h every 2 weeks`;
  const calendar=$('#calendar'); calendar.replaceChildren(); calendar.className=view==='year'?'year-grid':'';
  if(view==='year')for(let m=0;m<12;m++){
    const section=document.createElement('section');section.className='mini-month';section.setAttribute('aria-label',`${months[m]} ${shownYear}`);
    const title=document.createElement('button');title.type='button';title.className='month-title';title.textContent=months[m];title.setAttribute('aria-label',`Open ${months[m]} ${shownYear}`);title.onclick=()=>{shownMonth=m;view='month';render();};
    section.append(title,monthGrid(shownYear,m,false));calendar.append(section);
  } else calendar.append(monthGrid(shownYear,shownMonth,true));
  const short=shortfalls(plan),count=Object.keys(plan.pto).filter(date=>date>=plan.config.start&&isWeekday(date)&&!plan.holidays.includes(date)).length;
  $('#plan-status').className=short.length?'shortfall':count?'covered':'empty-hint';
  $('#plan-status').textContent=short.length?`${short.length} PTO ${short.length===1?'day':'days'} short · first on ${labelDate(short[0],true)}`:count?'All planned PTO covered':'Your calendar is ready. Add your first time off.';
}
$('#year-view').onclick=()=>{view='year';render();};$('#month-view').onclick=()=>{view='month';render();};
function move(n){if(view==='year')shownYear+=n;else{shownMonth+=n;if(shownMonth<0){shownMonth=11;shownYear--;}if(shownMonth>11){shownMonth=0;shownYear++;}}shownYear=Math.max(1900,Math.min(2200,shownYear));hideContext();render();}
$('#previous').onclick=()=>move(-1);$('#next').onclick=()=>move(1);
function clearHighlight() { $$('.day.in-range').forEach(el=>el.classList.remove('in-range')); document.body.classList.remove('selecting'); }
function highlightRange(start,end){const [a,b]=[start,end].sort();$$('.day[data-date]').forEach(el=>el.classList.toggle('in-range',el.dataset.date>=a&&el.dataset.date<=b&&!el.disabled));}
$('#calendar').addEventListener('pointerdown',event=>{
  const day=event.target.closest('button[data-date]');if(!day||day.disabled||event.button!==0)return;
  hideContext();drag={start:day.dataset.date,end:day.dataset.date,pointer:event.pointerId,touch:event.pointerType==='touch',x:event.clientX,y:event.clientY,cancelled:false};
  if(!drag.touch){event.preventDefault();day.focus({preventScroll:true});document.body.classList.add('selecting');highlightRange(drag.start,drag.end);}
});
window.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  if(drag.touch){if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>10)drag.cancelled=true;return;}
  const day=document.elementFromPoint(event.clientX,event.clientY)?.closest('#calendar button[data-date]');
  if(day&&!day.disabled){drag.end=day.dataset.date;highlightRange(drag.start,drag.end);}
});
window.addEventListener('pointerup',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;const selection=drag;drag=null;clearHighlight();
  if(!selection.cancelled){const [start,end]=[selection.start,selection.end].sort();openPto(start,end);}
});
window.addEventListener('pointercancel',()=>{drag=null;clearHighlight();});
window.addEventListener('blur',()=>{drag=null;clearHighlight();});
$('#calendar').addEventListener('click',event=>{
  // Keyboard-generated clicks have no pointer gesture.
  const day=event.target.closest('button[data-date]');if(day&&event.detail===0&&!day.disabled)openPto(day.dataset.date,day.dataset.date);
});
$('#calendar').addEventListener('contextmenu',event=>{
  const day=event.target.closest('button[data-date]');if(!day||day.disabled)return;event.preventDefault();drag=null;clearHighlight();openContext(day.dataset.date,event.clientX,event.clientY,day);
});
let contextTrigger=null;
function hideContext(){ $('#context-menu').hidden=true; }
function openContext(date,x,y,trigger){
  contextDate=date;contextTrigger=trigger;$('#context-date').textContent=labelDate(date,true);$('#context-holiday').textContent=plan.holidays.includes(date)?'Unmark company holiday':'Mark company holiday';
  const menu=$('#context-menu');menu.hidden=false;const rect=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(x,innerWidth-rect.width-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-rect.height-8))+'px';$('#context-pto').focus();
}
window.addEventListener('pointerdown',event=>{if(!event.target.closest('#context-menu'))hideContext();});
window.addEventListener('resize',hideContext);window.addEventListener('scroll',hideContext,true);
window.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('#context-menu').hidden){hideContext();contextTrigger?.focus();}drag=null;clearHighlight();}});
$('#context-menu').addEventListener('keydown',event=>{const buttons=[$('#context-pto'),$('#context-holiday')];const index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();buttons[(index+1)%2].focus();}if(event.key==='Tab')hideContext();});
$('#context-pto').onclick=()=>{hideContext();openPto(contextDate,contextDate);};
function toggleHoliday(date){
  if(plan.holidays.includes(date)){plan.holidays=plan.holidays.filter(d=>d!==date);toast('Company holiday removed');}
  else{plan.holidays.push(date);delete plan.pto[date];toast('Company holiday marked · no PTO used');}
  save();render();
}
$('#context-holiday').onclick=()=>{const date=contextDate;hideContext();toggleHoliday(date);};
function openPto(start,end){
  if(!plan)return;hideContext();$('#pto-from').value=start;$('#pto-through').value=end;$('#pto-from').min=plan.config.start;$('#pto-through').min=start;
  $('#pto-hours').value=start===end&&plan.pto[start]?plan.pto[start]:8;$('#pto-error').textContent='';updateSelection();$('#pto-dialog').showModal();
}
$('#add-pto').onclick=()=>{const start=today>=plan.config.start?today:plan.config.start;openPto(start,start);};
function selectionValues(){return {start:$('#pto-from').value,end:$('#pto-through').value,amount:Number($('#pto-hours').value)};}
function updateSelection(){
  const {start,end,amount}=selectionValues();$('#pto-through').min=start||plan.config.start;
  const valid=validDate(start)&&validDate(end)&&end>=start&&start>=plan.config.start&&ordinal(end)-ordinal(start)<=3660&&amount>0&&amount<=24;
  const dates=valid?eligibleDates(plan,start,end):[];$('#selection-total').textContent=valid?`${dates.length} ${dates.length===1?'workday':'workdays'} · ${fmt(dates.length*amount)} hours PTO`:'Choose dates and hours';
  $('#save-pto').disabled=!valid||dates.length===0;
  $('#remove-pto').hidden=!datesBetween(start,end).some(date=>plan.pto[date]);
  const single=validDate(start)&&start===end&&start>=plan.config.start;$('#dialog-holiday').hidden=!single;
  $('#dialog-holiday').textContent=plan.holidays.includes(start)?'Unmark company holiday':'Mark company holiday';
  const result=$('#selection-result');result.className='';
  if(!valid){result.textContent='Choose an end date on or after the start date (up to 10 years).';return;}
  if(!dates.length){result.textContent='Weekends and company holidays use no PTO.';return;}
  const projected=withRange(plan,start,end,amount),allShort=shortfalls(projected),rangeShort=allShort.find(date=>dates.includes(date));
  if(rangeShort){result.textContent=`${labelDate(rangeShort)} · ${fmt(-hours(balanceAt(projected,rangeShort)))}h short`;result.className='shortfall';}
  else if(allShort.length){result.textContent=`These dates fit. ${labelDate(allShort[0],true)} is still short.`;result.className='shortfall';}
  else{result.textContent=`Covered · ${fmt(hours(balanceAt(projected,end)))}h left after ${labelDate(end)}`;}
}
$('#pto-form').addEventListener('input',updateSelection);
$('#pto-form').addEventListener('submit',event=>{
  event.preventDefault();if(!$('#pto-form').reportValidity()||$('#save-pto').disabled)return;
  const {start,end,amount}=selectionValues();plan=withRange(plan,start,end,amount);save();$('#pto-dialog').close();render();toast('PTO saved');
});
$('#remove-pto').onclick=()=>{const {start,end}=selectionValues();for(const date of datesBetween(start,end))delete plan.pto[date];save();$('#pto-dialog').close();render();toast('PTO removed');};
$('#dialog-holiday').onclick=()=>{const date=$('#pto-from').value;toggleHoliday(date);$('#pto-dialog').close();};
$$('.close-dialog').forEach(button=>button.onclick=()=>button.closest('dialog').close());
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`days-off-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup exported');};
$('#import').onclick=()=>$('#import-file').click();
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>2000000)throw Error('Backup is too large.');const parsed=JSON.parse(await file.text());if(!validatePlan(parsed))throw Error('This is not a valid Days off backup.');pendingImport=parsed;$('#import-dialog').showModal();$('#cancel-import').focus();}
  catch(error){$('#backup-status').textContent=error.message||'Unable to import this backup.';}
});
$('#cancel-import').onclick=()=>{pendingImport=null;$('#import-dialog').close();};
$('#confirm-import').onclick=()=>{if(!pendingImport)return;plan=pendingImport;pendingImport=null;save();$('#import-dialog').close();shownYear=Number(plan.config.start.slice(0,4));shownMonth=Number(plan.config.start.slice(5,7))-1;$('#backup-status').textContent='';showPlanner();toast('Backup imported');};
if(plan?.needsSetup){showSetup('restart');}else if(plan){const anchor=today>=plan.config.start?today:plan.config.start;shownYear=Number(anchor.slice(0,4));shownMonth=Number(anchor.slice(5,7))-1;showPlanner();}else showSetup('first');
