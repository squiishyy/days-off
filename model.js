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
export function withRange(plan, start, end, amount) {
  const result = { ...plan, pto: { ...plan.pto } };
  for (const date of eligibleDates(plan, start, end)) {
    if (amount > 0) result.pto[date] = amount;
    else delete result.pto[date];
  }
  return result;
}
export function validatePlan(plan) {
  if (!plan || plan.version !== 1 || !plan.config || typeof plan.pto !== 'object' || !plan.pto || Array.isArray(plan.pto) || !Array.isArray(plan.holidays)) return false;
  if (plan.needsSetup !== undefined && typeof plan.needsSetup !== 'boolean') return false;
  const c = plan.config;
  if (!validDate(c.start) || !validDate(c.next) || c.next < c.start) return false;
  if (![c.balance, c.rate, c.annual].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000000)) return false;
  if (Object.keys(plan.pto).length > 10000 || plan.holidays.length > 10000) return false;
  return Object.entries(plan.pto).every(([date, amount]) => validDate(date) && typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= 24) && plan.holidays.every(validDate);
}
