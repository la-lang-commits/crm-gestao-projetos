type TimedProject = {
  status: string;
  openedAt: string;
  events: { toStage?: string; toStatus?: string; created_at: string }[];
  workflow: { status: string; completedAt: string | null }[];
};
function calendarDay(value: string): number {
  if (!value) return NaN;
  const date = new Date(value.length === 10 ? value + 'T12:00:00-03:00' : value);
  if (!Number.isFinite(date.getTime())) return NaN;
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}
export function projectDuration(project: TimedProject, now = new Date().toISOString()): number | null {
  if (project.status === 'Cancelado') return null;
  let end = now;
  if (project.status === 'Concluído') {
    const events = project.events.filter(e => e.toStatus === 'Concluído' || e.toStage === 'Concluído').map(e => e.created_at);
    const finished = project.workflow.length > 0 && project.workflow.every(s => s.status === 'completed' || s.status === 'skipped');
    const candidates = events.length ? events : finished ? project.workflow.flatMap(s => s.completedAt ? [s.completedAt] : []) : [];
    const valid = candidates.filter(d => Number.isFinite(new Date(d).getTime())).sort((a,b) => Date.parse(b) - Date.parse(a));
    if (!valid.length) return null;
    end = valid[0];
  }
  const days = (calendarDay(end) - calendarDay(project.openedAt)) / 86400000;
  return Number.isFinite(days) && days >= 0 ? days : null;
}
export function ownerCounts(projects: { ownerId: string; owner: string; status: string }[], members: { id: string; name: string }[]) {
  const rows = new Map<string, { id: string; name: string; counts: Record<string, number>; total: number }>();
  for (const m of members) rows.set(m.id, { id: m.id, name: m.name, counts: {}, total: 0 });
  for (const p of projects) {
    const id = p.ownerId || 'unassigned';
    const row = rows.get(id) || { id, name: p.ownerId ? p.owner : 'Sem responsável', counts: {}, total: 0 };
    row.counts[p.status] = (row.counts[p.status] || 0) + 1;
    row.total++;
    rows.set(id, row);
  }
  return [...rows.values()].sort((a,b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
}
