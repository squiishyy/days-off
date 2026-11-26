import { createWalkthrough } from './tour.js';
import { validDate, ordinal, isWeekday, datesBetween, eligibleDates, balanceAt, hours, isAccrual, shortfalls, withRange, replacePtoRange, removeRange, labeledRanges, planEvents, withPlanEvent, withoutPlanEvent, DEFAULT_PTO_COLOR, colorInk, validatePlan } from './model.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'days-off.plan.v1';
const THEME_KEY = 'days-off.theme';
const APP_VERSION = '1.1.1';
let editingPlanEvent = null, originalPtoRange = null;
let labelMixed = false, colorMixed = false, labelEdited = false, colorEdited = false;
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
const iso = (year, month, day) => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const labelDate = (date, year = false) => { const [y,m,d] = date.split('-').map(Number); return `${months[m-1]} ${d}${year ? `, ${y}` : ''}`; };
const fmt = amount => Number(amount.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 });
let plan = null, draftConfig = null, pendingImport = null, setupMode = 'first';
let view = 'year', shownYear = Number(today.slice(0,4)), shownMonth = Number(today.slice(5,7))-1;
let contextDate = null, drag = null, toastTimer;
const setupForm = $('#setup-form');
const walkthrough = createWalkthrough();
$('#help').onclick = () => { hideContext(); walkthrough.show({force:true}); };
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
  const nextPlan = { version: 1, config, pto: setupMode === 'edit' ? plan.pto : {}, holidays: setupMode === 'edit' ? plan.holidays : [], ptoDetails: setupMode === 'edit' ? (plan.ptoDetails || {}) : {}, events: setupMode === 'edit' ? (plan.events || []) : [] };
  if (!validatePlan(nextPlan)) { $('#setup-error').textContent = 'Choose a next accrual date on or after the balance date, and valid PTO amounts.'; return; }
  plan = nextPlan; draftConfig = null;
  shownYear = Number(config.start.slice(0,4)); shownMonth = Number(config.start.slice(5,7))-1;
  save(); showPlanner();
});
function showPlanner() { $('#setup').hidden = true; $('#planner').hidden = false; $('#settings').hidden = false; $('#restart').hidden = false; render({focusDate:today}); walkthrough.show(); }
$('#settings').onclick = () => showSetup('edit');
$('#cancel-settings').onclick = showPlanner;
$('#restart').onclick = () => { hideContext(); $('#restart-dialog').showModal(); $('#keep-plan').focus(); };
$('#keep-plan').onclick = () => $('#restart-dialog').close();
$('#confirm-restart').onclick = () => {
  draftConfig = { ...plan.config };
  plan = { ...plan, pto: {}, ptoDetails: {}, events: [], holidays: [], needsSetup: true };
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
  const detail = status.amount ? plan.ptoDetails?.[date] : null;
  if (detail) { b.classList.add('custom-pto'); b.style.setProperty('--pto-custom',detail.color); b.style.setProperty('--pto-custom-ink',colorInk(detail.color)); }
  const plans=planEvents(plan,date,date);
  if(plans.length){b.classList.add('has-plan');b.style.setProperty('--event-color',plans[0].color);}
  const day = Number(date.slice(8));
  const description = `${labelDate(date,true)}${detail?.label?`, ${detail.label}`:''}${status.holiday?', company holiday':status.amount?`, ${fmt(status.amount)} hours PTO`:''}${status.short?`, ${fmt(-hours(balanceAt(plan,date)))} hours short`:''}${plans.length?', plans: '+plans.map(event=>event.label||'Plan').join(', '):''}${isAccrual(plan,date)?`, ${fmt(plan.config.rate)} hours accrue`:''}${disabled?', before the plan starts':''}`;
  b.setAttribute('aria-label', description); b.title = description;
  if (date === today) b.setAttribute('aria-current','date');
  b.disabled = disabled;
  if (monthView) {
    const num = document.createElement('span'); num.textContent = day;
    const caption = document.createElement('span'); caption.className = 'day-label'; caption.textContent = status.holiday ? 'Holiday' : status.amount ? `${fmt(status.amount)}h PTO` : isAccrual(plan,date) ? `+${fmt(plan.config.rate)}h` : '';
    if (detail?.label) { const label=document.createElement('span');label.className='day-trip-label';label.textContent=detail.label;b.append(num,label,caption); } else b.append(num, caption);
    if (status.short) { const warning=document.createElement('span');warning.className='shortfall-flag';warning.textContent='Short';b.append(warning); }
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
  const monthStart=iso(year,month,1),monthEnd=iso(year,month,count);
  let row=2;
  for(let week=0;week<Math.ceil((offset+count)/7);week++){
    const startDay=Math.max(1,week*7-offset+1),endDay=Math.min(count,week*7-offset+7);
    for(let day=startDay;day<=endDay;day++){
      const button=makeDay(iso(year,month,day),large);
      button.style.gridRow=row;button.style.gridColumn=new Date(Date.UTC(year,month,day)).getUTCDay()+1;
      grid.append(button);
    }
    let lanes=0;
    if(large)for(const event of planEvents(plan,iso(year,month,startDay),iso(year,month,endDay))){
      const start=[event.start,iso(year,month,startDay),monthStart].sort().at(-1);
      const end=[event.end,iso(year,month,endDay),monthEnd].sort()[0];
      const bar=document.createElement('button');bar.type='button';bar.className='calendar-plan-bar';
      bar.style.gridRow=row+(++lanes);bar.style.gridColumn=`${new Date(start+'T00:00:00Z').getUTCDay()+1} / span ${ordinal(end)-ordinal(start)+1}`;
      bar.style.setProperty('--event-color',event.color);bar.textContent=event.label||'Plan';
      bar.title=`${event.label||'Plan'} · ${labelDate(event.start)}–${labelDate(event.end)} · no PTO used`;
      bar.setAttribute('aria-label',`Edit plan ${event.label||'Plan'}, ${labelDate(event.start)} through ${labelDate(event.end)}`);
      bar.onclick=()=>openPto(event.start,event.end,{event});grid.append(bar);
    }
    row+=lanes+1;
  }
  return grid;
}
const currentYear=Number(today.slice(0,4)),currentMonthIndex=currentYear*12+Number(today.slice(5,7))-1;
let yearFirst=currentYear-1,yearLast=currentYear+1,monthFirst=currentMonthIndex-2,monthLast=currentMonthIndex+3;
let timelineObserver=null,renderGeneration=0;
function miniMonth(year,m) {
    const section=document.createElement('section');section.className='mini-month';section.setAttribute('aria-label',`${months[m]} ${year}`);
    const title=document.createElement('button');title.type='button';title.className='month-title';title.textContent=months[m];title.setAttribute('aria-label',`Open ${months[m]} ${year}`);title.onclick=()=>{view='month';monthFirst=year*12+m-2;monthLast=year*12+m+3;render({focusDate:iso(year,m,1),align:'start'});};
    section.append(title,monthGrid(year,m,false));
    const groups=labeledRanges(plan,iso(year,m,1),iso(year,m,new Date(Date.UTC(year,m+1,0)).getUTCDate()));
    const events=planEvents(plan,iso(year,m,1),iso(year,m,new Date(Date.UTC(year,m+1,0)).getUTCDate()));
    if(groups.length||events.length){
      const labels=document.createElement('div');labels.className='year-trip-labels';
      for(const group of groups){
        const button=document.createElement('button');button.type='button';button.className='year-trip-label';button.title=group.label;
        button.setAttribute('aria-label',`${group.label}, ${labelDate(group.start)}${group.end!==group.start?' through '+labelDate(group.end):''}`);
        const dot=document.createElement('i');dot.style.background=group.color;dot.setAttribute('aria-hidden','true');
        const text=document.createElement('span');text.textContent=group.label;
        const dates=document.createElement('small');dates.textContent=Number(group.start.slice(8))+(group.end!==group.start?'–'+Number(group.end.slice(8)):'');
        button.append(dot,text,dates);button.onclick=()=>openPto(group.start,group.end);labels.append(button);
      }
      for(const event of events){
        const button=document.createElement('button');button.type='button';button.className='year-trip-label year-plan-label';
        button.style.setProperty('--event-color',event.color);button.title=event.label||'Plan';
        const name=document.createElement('span');name.textContent=event.label||'Plan';
        const dates=document.createElement('small');
        const start=[event.start,iso(year,m,1)].sort().at(-1),end=[event.end,iso(year,m,new Date(Date.UTC(year,m+1,0)).getUTCDate())].sort()[0];
        dates.textContent=Number(start.slice(8))+(end!==start?'–'+Number(end.slice(8)):'');
        button.setAttribute('aria-label',`Edit plan ${event.label||'Plan'}, ${labelDate(event.start)} through ${labelDate(event.end)}`);
        button.append(name,dates);button.onclick=()=>openPto(event.start,event.end,{event});labels.append(button);
      }
      section.append(labels);
    }

  return section;
}
function yearSection(year){
  const section=document.createElement('section');section.className='timeline-year';section.dataset.year=year;
  const heading=document.createElement('h2');heading.className='timeline-heading';heading.textContent=year;
  const grid=document.createElement('div');grid.className='year-grid';
  for(let month=0;month<12;month++)grid.append(miniMonth(year,month));
  section.append(heading,grid);return section;
}
function monthSection(index){
  const year=Math.floor(index/12),month=((index%12)+12)%12;
  const section=document.createElement('section');section.className='timeline-month';section.dataset.month=iso(year,month,1);
  const heading=document.createElement('h2');heading.className='timeline-heading';heading.textContent=`${months[month]} ${year}`;
  section.append(heading,monthGrid(year,month,true));return section;
}
function scrollToDate(date,align='center'){
  const day=$(`#calendar button[data-date="${date}"]`);
  if(day){const rect=day.getBoundingClientRect();const target=align==='center'?(innerHeight-rect.height)/2:$('.app-header').getBoundingClientRect().height+$('.planner-top').getBoundingClientRect().height+65;window.scrollBy({top:rect.top-target,behavior:'auto'});}
}
function growTimeline(direction){
  if(drag||document.querySelector('dialog[open]'))return;
  const items=$('#timeline-items');if(!items)return;
  const anchor=[...items.querySelectorAll('button[data-date]')].find(day=>day.getBoundingClientRect().bottom>200);
  const anchorTop=anchor?.getBoundingClientRect().top;
  if(view==='year'){
    const year=direction<0?yearFirst-1:yearLast+1;
    if(year<1900||year>2200)return;
    if(direction<0){yearFirst=year;items.prepend(yearSection(year));}else{yearLast=year;items.append(yearSection(year));}
  }else{
    const fragment=document.createDocumentFragment();
    const start=direction<0?monthFirst-3:monthLast+1,end=direction<0?monthFirst-1:monthLast+3;
    if(start<1900*12||end>2200*12+11)return;
    for(let index=start;index<=end;index++)fragment.append(monthSection(index));
    if(direction<0){monthFirst=start;items.prepend(fragment);}else{monthLast=end;items.append(fragment);}
  }
  if(direction<0&&anchor)window.scrollBy(0,anchor.getBoundingClientRect().top-anchorTop);
}
function render({focusDate=null,align='center'}={}) {
  if(!plan)return;
  timelineObserver?.disconnect();
  const generation=++renderGeneration;
  const oldAnchor=$$('#calendar button[data-date]').find(day=>{const r=day.getBoundingClientRect();return r.bottom>200&&r.top<innerHeight;});
  const anchor=oldAnchor?{date:oldAnchor.dataset.date,top:oldAnchor.getBoundingClientRect().top}:null;
  $('#period').textContent='Your calendar';
  $('#year-view').setAttribute('aria-pressed',String(view==='year'));$('#month-view').setAttribute('aria-pressed',String(view==='month'));
  $('#plan-summary').textContent=`${fmt(plan.config.balance)}h as of ${labelDate(plan.config.start,true)} · +${fmt(plan.config.rate)}h every 2 weeks`;
  const calendar=$('#calendar');calendar.replaceChildren();calendar.className='calendar-timeline';
  const earlier=document.createElement('button');earlier.className='timeline-load';earlier.textContent=view==='year'?'Earlier years':'Earlier months';earlier.onclick=()=>growTimeline(-1);
  const items=document.createElement('div');items.id='timeline-items';
  if(view==='year')for(let year=yearFirst;year<=yearLast;year++)items.append(yearSection(year));
  else for(let index=monthFirst;index<=monthLast;index++)items.append(monthSection(index));
  const later=document.createElement('button');later.className='timeline-load';later.textContent=view==='year'?'More years':'More months';later.onclick=()=>growTimeline(1);
  calendar.append(earlier,items,later);
  const short=shortfalls(plan),count=Object.keys(plan.pto).filter(date=>date>=plan.config.start&&isWeekday(date)&&!plan.holidays.includes(date)).length,eventCount=(plan.events||[]).length;
  $('#plan-status').className=short.length?'shortfall':count?'covered':'empty-hint';
  $('#plan-status').textContent=short.length?`${short.length} PTO ${short.length===1?'day':'days'} short · first on ${labelDate(short[0],true)}`:count?'All planned PTO covered':eventCount?`${eventCount} ${eventCount===1?'plan':'plans'} · no PTO used`:'Your calendar is ready. Add your first event.';
  requestAnimationFrame(()=>{
    if(generation!==renderGeneration)return;
    if(focusDate)scrollToDate(focusDate,align);
    else if(anchor){const next=$(`#calendar button[data-date="${anchor.date}"]`);if(next)window.scrollBy(0,next.getBoundingClientRect().top-anchor.top);}
    if('IntersectionObserver' in window){timelineObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)growTimeline(entry.target===earlier?-1:1);},{rootMargin:'500px 0px'});timelineObserver.observe(earlier);timelineObserver.observe(later);}
  });
}
function todayWindow(){
  yearFirst=Math.min(yearFirst,currentYear-1);yearLast=Math.max(yearLast,currentYear+1);
  monthFirst=Math.min(monthFirst,currentMonthIndex-2);monthLast=Math.max(monthLast,currentMonthIndex+3);
}
$('#year-view').onclick=()=>{view='year';todayWindow();render({focusDate:today});};
$('#month-view').onclick=()=>{view='month';todayWindow();render({focusDate:today});};
$('#today-button').onclick=()=>{todayWindow();if(!$(`#calendar button[data-date="${today}"]`))render({focusDate:today});else scrollToDate(today);};
const chromeObserver=new ResizeObserver(()=>{document.documentElement.style.setProperty('--app-header-height',$('.app-header').getBoundingClientRect().height+'px');document.documentElement.style.setProperty('--timeline-toolbar-height',$('.planner-top').getBoundingClientRect().height+'px');});
chromeObserver.observe($('.app-header'));chromeObserver.observe($('.planner-top'));

let dragAutoFrame=0;
function dragAutoScroll(){
  if(!drag||drag.touch)return;
  const top=$('.planner-top').getBoundingClientRect().bottom+35,bottom=innerHeight-65;
  const speed=drag.lastY>bottom?12:drag.lastY<top?-12:0;
  if(speed){
    window.scrollBy(0,speed);
    const day=document.elementFromPoint(drag.lastX,drag.lastY)?.closest('#calendar button[data-date]');
    if(day&&!day.disabled){drag.end=day.dataset.date;highlightRange(drag.start,drag.end);}
  }
  dragAutoFrame=requestAnimationFrame(dragAutoScroll);
}
function clearHighlight() { cancelAnimationFrame(dragAutoFrame); $$('.day.in-range').forEach(el=>el.classList.remove('in-range')); document.body.classList.remove('selecting'); }
function highlightRange(start,end){const [a,b]=[start,end].sort();$$('.day[data-date]').forEach(el=>el.classList.toggle('in-range',el.dataset.date>=a&&el.dataset.date<=b&&!el.disabled));}
$('#calendar').addEventListener('pointerdown',event=>{
  const day=event.target.closest('button[data-date]');if(!day||day.disabled||event.button!==0)return;
  hideContext();drag={start:day.dataset.date,end:day.dataset.date,pointer:event.pointerId,touch:event.pointerType==='touch',x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,cancelled:false};
  if(!drag.touch){event.preventDefault();day.focus({preventScroll:true});document.body.classList.add('selecting');highlightRange(drag.start,drag.end);dragAutoFrame=requestAnimationFrame(dragAutoScroll);}
});
window.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;
  drag.lastX=event.clientX;drag.lastY=event.clientY;
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
$('#context-pto').onclick=()=>{hideContext();openPto(contextDate,contextDate,{newEvent:true});};
function toggleHoliday(date){
  if(plan.holidays.includes(date)){plan.holidays=plan.holidays.filter(d=>d!==date);toast('Company holiday removed');}
  else{plan.holidays.push(date);delete plan.pto[date];if(plan.ptoDetails)delete plan.ptoDetails[date];toast('Company holiday marked · no PTO used');}
  save();render();
}
$('#context-holiday').onclick=()=>{const date=contextDate;hideContext();toggleHoliday(date);};
function openPto(start,end,{newEvent=false,event=null}={}){
  if(!plan)return;hideContext();$('#pto-from').value=start;$('#pto-through').value=end;$('#pto-from').min=plan.config.start;$('#pto-through').min=start;
  editingPlanEvent=event;
  const selected=newEvent||event?[]:datesBetween(start,end).filter(date=>plan.pto[date]);
  originalPtoRange=selected.length?{start,end}:null;
  $('#event-kind').value=event?'plan':'pto';
  $('#pto-title').textContent=event?'Edit plan':selected.length?'Edit PTO':'Add event';
  const amounts=new Set(selected.map(date=>plan.pto[date]));
  $('#pto-hours').value=amounts.size===1?[...amounts][0]:8;
  const labels=new Set(selected.map(date=>plan.ptoDetails?.[date]?.label||''));
  const colors=new Set(selected.map(date=>plan.ptoDetails?.[date]?.color||DEFAULT_PTO_COLOR));
  labelMixed=labels.size>1;colorMixed=colors.size>1;labelEdited=false;colorEdited=false;
  $('#pto-label').value=event?event.label:labels.size===1?[...labels][0]:'';
  $('#pto-label').placeholder=labelMixed?'Mixed labels':'e.g. Maine or Summer trip';
  $('#pto-color').value=event?event.color:colors.size===1?[...colors][0]:DEFAULT_PTO_COLOR;
  $('#mixed-details').hidden=!labelMixed&&!colorMixed&&amounts.size<2;
  $('#mixed-details').textContent=amounts.size>1?'This range has different hours. Saving applies the hours above to each workday.':'Mixed labels or colors stay unchanged unless you edit them.';
  $('#pto-error').textContent='';updateSelection();$('#pto-dialog').showModal();
}
$('#add-pto').onclick=()=>{const start=today>=plan.config.start?today:plan.config.start;openPto(start,start,{newEvent:true});};
function selectionValues(){return {start:$('#pto-from').value,end:$('#pto-through').value,amount:Number($('#pto-hours').value)};}
function updateSelection(){
  const {start,end,amount}=selectionValues(),kind=$('#event-kind').value;
  $('#pto-through').min=start||plan.config.start;
  const rangeValid=validDate(start)&&validDate(end)&&end>=start&&start>=plan.config.start&&ordinal(end)-ordinal(start)<=3660;
  const valid=rangeValid&&(kind==='plan'||amount>0&&amount<=24);
  $('#event-hours-field').hidden=kind==='plan';
  $('#pto-hours').disabled=kind==='plan';
  $('#remove-pto').hidden=!editingPlanEvent&&!originalPtoRange;
  $('#remove-pto').textContent=editingPlanEvent?'Delete event':'Remove PTO';
  $('#save-pto').textContent=kind==='plan'?'Save event':'Save PTO';
  const dates=valid?eligibleDates(plan,start,end):[];
  $('#save-pto').disabled=!valid||(kind==='pto'&&dates.length===0);
  const result=$('#selection-result');result.className='';
  $('#dialog-holiday').hidden=kind!=='pto'||!rangeValid||start!==end;
  $('#dialog-holiday').textContent=plan.holidays.includes(start)?'Unmark company holiday':'Mark company holiday';
  if(kind==='plan'){
    $('#selection-total').textContent=rangeValid?`${ordinal(end)-ordinal(start)+1} calendar days`:'Choose dates';
    result.textContent=originalPtoRange?'This replaces the selected PTO with a plan. No PTO hours will be used.':'Plans only · no PTO hours used, including weekends and holidays.';
    return;
  }
  $('#selection-total').textContent=valid?`${dates.length} ${dates.length===1?'workday':'workdays'} · ${fmt(dates.length*amount)} hours PTO`:'Choose dates and hours';
  if(!valid){result.textContent='Choose an end date on or after the start date (up to 10 years).';return;}
  if(!dates.length){result.textContent='Weekends and company holidays use no PTO.';return;}
  let base=originalPtoRange?removeRange(plan,originalPtoRange.start,originalPtoRange.end):plan;
  const projected=withRange(base,start,end,amount),allShort=shortfalls(projected),rangeShort=allShort.find(date=>dates.includes(date));
  if(rangeShort){result.textContent=`${labelDate(rangeShort)} · ${fmt(-hours(balanceAt(projected,rangeShort)))}h short`;result.className='shortfall';}
  else if(allShort.length){result.textContent=`These dates fit. ${labelDate(allShort[0],true)} is still short.`;result.className='shortfall';}
  else{result.textContent=`Covered · ${fmt(hours(balanceAt(projected,end)))}h left after ${labelDate(end)}`;}
}
$('#pto-label').addEventListener('input',()=>{labelEdited=true;});
$('#pto-color').addEventListener('input',()=>{colorEdited=true;});
$('#pto-form').addEventListener('input',updateSelection);
$('#event-kind').addEventListener('change',updateSelection);
$('#pto-form').addEventListener('submit',event=>{
  event.preventDefault();if($('#event-kind').value==='plan')$('#pto-hours').disabled=true;
  const valid=$('#pto-form').reportValidity();$('#pto-hours').disabled=false;
  if(!valid||$('#save-pto').disabled)return;
  const {start,end,amount}=selectionValues(),kind=$('#event-kind').value;
  const details={};if(!labelMixed||labelEdited)details.label=$('#pto-label').value;if(!colorMixed||colorEdited)details.color=$('#pto-color').value;
  let next=editingPlanEvent?withoutPlanEvent(plan,editingPlanEvent.id):plan;
  if(kind==='plan'){
    if(originalPtoRange){next=removeRange(next,originalPtoRange.start,originalPtoRange.end);next=removeRange(next,start,end);}
    next=withPlanEvent(next,{id:editingPlanEvent?.id||crypto.randomUUID(),start,end,label:$('#pto-label').value,color:$('#pto-color').value});
  } else next=originalPtoRange?replacePtoRange(next,originalPtoRange.start,originalPtoRange.end,start,end,amount,details):withRange(next,start,end,amount,details);
  if(!validatePlan(next)){$('#pto-error').textContent='Please check the event dates, label, and color.';return;}
  plan=next;save();$('#pto-dialog').close();render();toast(kind==='plan'?'Event saved · no PTO used':'PTO saved');
});
$('#remove-pto').onclick=()=>{
  if(editingPlanEvent)plan=withoutPlanEvent(plan,editingPlanEvent.id);
  else if(originalPtoRange)plan=removeRange(plan,originalPtoRange.start,originalPtoRange.end);
  save();$('#pto-dialog').close();render();toast(editingPlanEvent?'Event deleted':'PTO removed');
};
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

// Keep future code updates in the same browser tab/profile. Never reload an unsaved editor.
async function checkForUpdate() {
  if (document.visibilityState !== 'visible') return;
  try {
    const response = await fetch('/health',{cache:'no-store',signal:AbortSignal.timeout(1500)});
    const health = await response.json();
    if (health.app !== 'days-off' || !health.release || health.release === APP_VERSION) return;
    const editing = !$('#setup').hidden || !!document.querySelector('dialog[open]') || !!drag;
    if (editing) $('#update-notice').hidden=false;
    else window.location.reload();
  } catch { /* The server may be restarting during an update. Try again later. */ }
}
$('#reload-update').onclick=()=>{if((!$('#setup').hidden||document.querySelector('dialog[open]'))&&!confirm('Reload now? Unsaved changes in this editor will be lost.'))return;window.location.reload();};
window.addEventListener('focus',checkForUpdate);
document.addEventListener('visibilitychange',checkForUpdate);
setInterval(checkForUpdate,15000);
