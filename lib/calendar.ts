import type { Task } from './tasks';

export type CalendarProject = {
  id: string; name: string; ticket: number; demand: string; sei: string;
  ownerId: string; owner: string; status: string; slaDueAt: string | null;
  slaValue: number; slaUnit: string; observation: string;
};
export type Delivery = {
  id: string; sourceId: string; projectId: string; kind: 'project' | 'task';
  title: string; date: string; status: string; assigneeId: string; assignee: string;
  project: string; demand: string; sei: string; ticket: number; description: string; sla: string;
};
const zone = 'America/Sao_Paulo';
export function deliveryDay(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function shiftDay(day: string, count: number): string {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function shiftMonth(day: string, count: number): string {
  const date = new Date(day + 'T12:00:00Z');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1, 12)).toISOString().slice(0, 10);
}
export function calendarWindow(day: string, mode: 'month' | 'week' | 'list') {
  const date = new Date(day + 'T12:00:00Z');
  if (mode === 'week') {
    const start = shiftDay(day, -((date.getUTCDay() + 6) % 7));
    return { start, end: shiftDay(start, 6), days: Array.from({ length: 7 }, (_, i) => shiftDay(start, i)) };
  }
  const first = day.slice(0, 7) + '-01', last = shiftDay(shiftMonth(day, 1), -1);
  const start = shiftDay(first, -((new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7));
  const end = shiftDay(last, 6 - ((new Date(last + 'T12:00:00Z').getUTCDay() + 6) % 7));
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  return { start: mode === 'list' ? first : start, end: mode === 'list' ? last : end, days: Array.from({ length: count }, (_, i) => shiftDay(start, i)) };
}
export function deliveryStatus(event: Pick<Delivery, 'status' | 'date'>, today: string) {
  if (['Concluído', 'Concluída'].includes(event.status)) return { label: 'Concluído', tone: 'done' };
  if (['Cancelado', 'Cancelada'].includes(event.status)) return { label: 'Cancelado', tone: 'cancelled' };
  return event.date < today ? { label: 'Atrasado', tone: 'late' } : event.date === today ? { label: 'Vence hoje', tone: 'today' } : { label: 'No prazo', tone: 'ontime' };
}
export function buildDeliveries(projects: CalendarProject[], tasks: Task[], members: { id: string; name: string }[]): Delivery[] {
  const units: Record<string, string> = { business_days: 'dias úteis', calendar_days: 'dias corridos', hours: 'horas', months: 'meses' };
  const result: Delivery[] = projects.filter(p => p.slaDueAt && deliveryDay(p.slaDueAt)).map(p => ({
    id: 'project:' + p.id, sourceId: p.id, projectId: p.id, kind: 'project', title: p.demand + ' · ' + p.name,
    date: deliveryDay(p.slaDueAt!), status: p.status, assigneeId: p.ownerId, assignee: p.owner || 'Sem responsável',
    project: p.name, demand: p.demand, sei: p.sei, ticket: p.ticket, description: p.observation || '', sla: `${p.slaValue} ${units[p.slaUnit] || p.slaUnit}`,
  }));
  for (const t of tasks) {
    const p = projects.find(p => p.id === t.project_id);
    if (!p || !t.due_date || !deliveryDay(t.due_date)) continue;
    result.push({ id: 'task:' + t.id, sourceId: t.id, projectId: p.id, kind: 'task', title: t.title, date: deliveryDay(t.due_date), status: t.status,
      assigneeId: t.assignee_id || '', assignee: members.find(m => m.id === t.assignee_id)?.name || 'Sem responsável', project: p.name, demand: p.demand,
      sei: p.sei, ticket: p.ticket, description: t.description || '', sla: '' });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'pt-BR'));
}
