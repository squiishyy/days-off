export const SCALE = 1_000_000;
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export const ordinal = date => Date.parse(date + 'T00:00:00Z') / 86400000;
export const fromOrdinal = day => new Date(day * 86400000).toISOString().slice(0, 10);
export const isWeekday = date => ![0, 6].includes(new Date(date + 'T00:00:00Z').getUTCDay());
export const units = hours => Math.round(hours * SCALE);
export const hours = value => value / SCALE;
export function datesBetween(start, end) {
  if (!validDate(start) || !validDate(end) || end < start || ordinal(end) - ordinal(start) > 3660) return [];
  return Array.from({ length: ordinal(end) - ordinal(start) + 1 }, (_, i) => fromOrdinal(ordinal(start) + i));
}
export function eligibleDates(plan, start, end) {
  return datesBetween(start, end).filter(date => date >= plan.config.start && isWeekday(date) && !plan.holidays.includes(date));
}
export function isAccrual(plan, date) {
  const { config } = plan;
  return date >= config.next && date >= config.start && (ordinal(date) - ordinal(config.next)) % 14 === 0;
}
export function balanceAt(plan, date) {
  const { config, pto, holidays } = plan;
  if (date < config.start) return null;
  const deposits = Math.max(0, Math.floor((ordinal(date) - ordinal(config.next)) / 14) + 1);
  let balance = units(config.balance) + Math.round(deposits * config.rate * SCALE);
  for (const [day, amount] of Object.entries(pto)) {
    if (day >= config.start && day <= date && isWeekday(day) && !holidays.includes(day)) balance -= units(amount);
  }
  return balance;
}
export function shortfalls(plan) {
  return Object.keys(plan.pto).sort().filter(date => date >= plan.config.start && isWeekday(date) && !plan.holidays.includes(date) && balanceAt(plan, date) < 0);
}
export const DEFAULT_PTO_COLOR = '#80b8a0';
export const validColor = color => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
export function colorInk(color) {
  const rgb = [1,3,5].map(i => parseInt(color.slice(i,i+2),16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722 > .179 ? '#000000' : '#ffffff';
}
export function withRange(plan, start, end, amount, details) {
  const result = { ...plan, pto: { ...plan.pto }, ptoDetails: { ...plan.ptoDetails } };
  for (const date of eligibleDates(plan, start, end)) {
    if (amount > 0) {
      result.pto[date] = amount;
      if (details) {
        const previous = result.ptoDetails[date] || { label: '', color: DEFAULT_PTO_COLOR };
        result.ptoDetails[date] = { label: details.label === undefined ? previous.label : details.label.trim(), color: details.color === undefined ? previous.color : details.color };
      }
    } else { delete result.pto[date]; delete result.ptoDetails[date]; }
  }
  return result;
}
export function removeRange(plan, start, end) {
  const result = { ...plan, pto: { ...plan.pto }, ptoDetails: { ...plan.ptoDetails } };
  for (const date of datesBetween(start,end)) { delete result.pto[date]; delete result.ptoDetails[date]; }
  return result;
}
export function labeledRanges(plan, start, end) {
  const groups = [];
  for (const date of Object.keys(plan.pto).sort()) {
    const detail = plan.ptoDetails?.[date];
    if (date < start || date > end || !isWeekday(date) || plan.holidays.includes(date) || !detail?.label) continue;
    const previous = groups.at(-1);
    const gap = previous ? datesBetween(previous.end,date).slice(1,-1) : [];
    if (previous && previous.label === detail.label && previous.color === detail.color && gap.every(day => !isWeekday(day) || plan.holidays.includes(day))) previous.end = date;
    else groups.push({start:date,end:date,label:detail.label,color:detail.color});
  }
  return groups;
}
export function validatePlan(plan) {
  if (!plan || plan.version !== 1 || !plan.config || typeof plan.pto !== 'object' || !plan.pto || Array.isArray(plan.pto) || !Array.isArray(plan.holidays)) return false;
  if (plan.needsSetup !== undefined && typeof plan.needsSetup !== 'boolean') return false;
  if (plan.ptoDetails !== undefined) {
    if (!plan.ptoDetails || typeof plan.ptoDetails !== 'object' || Array.isArray(plan.ptoDetails) || Object.keys(plan.ptoDetails).length > 10000) return false;
    if (!Object.entries(plan.ptoDetails).every(([date, detail]) => validDate(date) && Object.hasOwn(plan.pto,date) && detail && typeof detail === 'object' && typeof detail.label === 'string' && detail.label.length <= 80 && validColor(detail.color))) return false;
  }
  if (plan.events !== undefined) {
    if (!Array.isArray(plan.events) || plan.events.length>1000) return false;
    const ids=new Set();
    for(const event of plan.events){
      if(!event || typeof event !== 'object' || typeof event.id !== 'string' || !/^[a-z0-9_-]{1,100}$/i.test(event.id) || ids.has(event.id)) return false;
      ids.add(event.id);
      if(!validDate(event.start)||!validDate(event.end)||event.end<event.start||ordinal(event.end)-ordinal(event.start)>3660||typeof event.label!=='string'||event.label.length>80||!validColor(event.color))return false;
    }
  }
  const c = plan.config;
  if (!validDate(c.start) || !validDate(c.next) || c.next < c.start) return false;
  if (![c.balance, c.rate, c.annual].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000000)) return false;
  if (Object.keys(plan.pto).length > 10000 || plan.holidays.length > 10000) return false;
  return Object.entries(plan.pto).every(([date, amount]) => validDate(date) && typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= 24) && plan.holidays.every(validDate);
}

// Plans are a separate layer: they can include weekends and never enter the PTO ledger.
export function planEvents(plan, start, end) {
  return (plan.events || []).filter(event=>event.start<=end&&event.end>=start).sort((a,b)=>a.start.localeCompare(b.start)||a.label.localeCompare(b.label));
}
export function withPlanEvent(plan, event) {
  const next = { ...event, label: event.label.trim() };
  return { ...plan, events: [...(plan.events||[]).filter(item=>item.id!==next.id),next] };
}
export function withoutPlanEvent(plan, id) {
  return { ...plan, events: (plan.events||[]).filter(event=>event.id!==id) };
}

export function replacePtoRange(plan, oldStart, oldEnd, start, end, amount, details) {
  const next=removeRange(plan,oldStart,oldEnd);
  // Keep per-day styles for mixed selections unless a field was deliberately changed.
  for(const date of eligibleDates(next,start,end))if(plan.ptoDetails?.[date])next.ptoDetails[date]=plan.ptoDetails[date];
  return withRange(next,start,end,amount,details);
}
