"use client";

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink, FileText, Loader2, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildDeliveries, calendarWindow, deliveryDay, deliveryStatus, shiftDay, shiftMonth, type CalendarProject, type Delivery } from '@/lib/calendar';
import type { Task } from '@/lib/tasks';
import './delivery-calendar.css';

type Props = {
  areaId: string; areas: { id: string; name: string }[]; onAreaChange: (id: string) => void;
  projects: CalendarProject[]; members: { id: string; name: string }[]; query: string;
  onOpenProject: (id: string) => void; onOpenTask: (id: string) => void;
};
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) => new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR', { ...options, timeZone: 'UTC' });

export function DeliveryCalendar({ areaId, areas, onAreaChange, projects, members, query, onOpenProject, onOpenTask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [today, setToday] = useState(() => deliveryDay(new Date()));
  const [anchor, setAnchor] = useState(today);
  const [mode, setMode] = useState<'month' | 'week' | 'list'>('month');
  const [kind, setKind] = useState<'all' | 'project' | 'task'>('all'), [owner, setOwner] = useState('');
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setToday(deliveryDay(new Date())), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    supabase.from('tasks').select('id,project_id,title,description,status,priority,assignee_id,due_date,created_at,updated_at,projects!inner(group_id)')
      .eq('projects.group_id', areaId).then(({ data, error }) => {
        if (!live) return;
        if (error) { setTasks([]); setError('Não foi possível carregar os prazos das tarefas.'); }
        else setTasks((data || []) as Task[]);
        setLoading(false);
      });
    return () => { live = false; };
  }, [areaId, retry]);
  const deliveries = buildDeliveries(projects, tasks, members);
  const range = calendarWindow(anchor, mode);
  const base = deliveries.filter(e => (!owner || (owner === 'unassigned' ? !e.assigneeId : e.assigneeId === owner)) && (!query || [e.title, e.project, e.demand, e.sei, e.assignee, 'TK-' + String(e.ticket).padStart(6, '0'), e.description].join(' ').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))));
  const periodEvents = base.filter(e => e.date >= range.start && e.date <= range.end);
  const events = periodEvents.filter(e => kind === 'all' || e.kind === kind);
  const selected = events.find(e => e.id === selectedId);
  const owners = [...new Map([...members.map(m => [m.id, m.name] as const), ...deliveries.filter(e => e.assigneeId).map(e => [e.assigneeId, e.assignee] as const)]).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const undated = projects.filter(p => !p.slaDueAt).length + tasks.filter(t => !t.due_date).length;
  const title = mode === 'week' ? `${dateLabel(range.start)} – ${dateLabel(range.end)}` : dateLabel(anchor, { month: 'long', year: 'numeric' });
  function navigate(direction: number) { setAnchor(mode === 'week' ? shiftDay(anchor, direction * 7) : shiftMonth(anchor, direction)); setSelectedId(''); }
  function eventButton(event: Delivery) {
    const deadline = deliveryStatus(event, today);
    return <button key={event.id} className={`delivery-event ${event.kind}${selectedId === event.id ? ' selected' : ''}`} aria-pressed={selectedId === event.id} aria-label={`${event.title}, ${dateLabel(event.date)}, ${deadline.label}`} onClick={() => setSelectedId(event.id)}>
      <span className="delivery-event-title"><i />{event.title}</span><span className={`delivery-badge ${deadline.tone}`}>{deadline.label}</span>
    </button>;
  }
  return <div className="delivery-page">
    <div className="delivery-filters"><div className="delivery-segments" role="group" aria-label="Tipo de entrega">{([['all', 'Todos'], ['project', 'Projetos'], ['task', 'Tarefas']] as const).map(([value, label]) => <button key={value} className={kind === value ? 'active' : ''} aria-pressed={kind === value} onClick={() => { setKind(value); setSelectedId(''); }}>{value !== 'all' && <i className={value} />}{label} ({periodEvents.filter(e => value === 'all' || e.kind === value).length})</button>)}</div>
      <label>Responsável<select value={owner} onChange={e => { setOwner(e.target.value); setSelectedId(''); }}><option value="">Todos</option><option value="unassigned">Sem responsável</option>{owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Área<select value={areaId} onChange={e => onAreaChange(e.target.value)}>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    </div>
    {loading && <p className="delivery-feedback" role="status"><Loader2 className="spin" />Carregando prazos das tarefas…</p>}
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setRetry(v => v + 1)}>Tentar novamente</button></div>}
    <div className={`delivery-workspace${selected ? ' has-details' : ''}`}>
      <section className="delivery-calendar" aria-label="Calendário de entregas"><header className="delivery-toolbar"><div className="delivery-navigation"><button aria-label="Período anterior" onClick={() => navigate(-1)}><ChevronLeft /></button><button onClick={() => { setAnchor(today); setSelectedId(''); }}>Hoje</button><button aria-label="Próximo período" onClick={() => navigate(1)}><ChevronRight /></button></div><h2 aria-live="polite">{title}</h2><div className="delivery-segments compact" role="group" aria-label="Visualização do calendário">{([['month', 'Mês'], ['week', 'Semana'], ['list', 'Lista']] as const).map(([value, label]) => <button key={value} className={mode === value ? 'active' : ''} aria-pressed={mode === value} onClick={() => { setMode(value); setSelectedId(''); }}>{label}</button>)}</div></header>
      {mode === 'list' ? <div className="delivery-agenda">{[...new Set(events.map(e => e.date))].map(day => <section key={day}><h3>{dateLabel(day, { weekday: 'long', day: '2-digit', month: 'long' })}</h3><div>{events.filter(e => e.date === day).map(eventButton)}</div></section>)}</div> : <div className="delivery-grid-scroll"><div className={`delivery-grid ${mode}`}><div className="delivery-weekdays">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <div key={day}>{day}</div>)}</div><div className="delivery-days">{range.days.map(day => <div key={day} className={`delivery-day${day.slice(0, 7) !== anchor.slice(0, 7) && mode === 'month' ? ' outside' : ''}${day === today ? ' is-today' : ''}`}><time dateTime={day} aria-label={dateLabel(day)}>{Number(day.slice(8))}{mode === 'week' && <small>/{day.slice(5, 7)}</small>}</time><div className="delivery-day-events">{events.filter(e => e.date === day).map(eventButton)}</div></div>)}</div></div></div>}
      {!events.length && !loading && <p className="delivery-empty">Nenhuma entrega com prazo neste período para os filtros selecionados.</p>}
      <footer className="delivery-footer">Projetos: vencimento do SLA total. Tarefas: prazo cadastrado. Datas no horário de Brasília.{undated > 0 && <span>{undated} {undated === 1 ? 'item sem prazo não aparece' : 'itens sem prazo não aparecem'} no calendário.</span>}</footer>
      </section>
      {selected && <aside className="delivery-detail" aria-label="Detalhes da entrega"><header><i className={selected.kind} /><h2>{selected.title}</h2><button aria-label="Fechar detalhes" onClick={() => setSelectedId('')}><X /></button></header><dl>
        <div><FileText /><dt>Tipo</dt><dd><span className={`delivery-type ${selected.kind}`}>{selected.kind === 'project' ? 'Projeto' : 'Tarefa'}</span></dd></div>
        <div><CalendarDays /><dt>Data</dt><dd>{dateLabel(selected.date, { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long' })}</dd></div>
        <div><Clock3 /><dt>Status do prazo</dt><dd><span className={`delivery-badge ${deliveryStatus(selected, today).tone}`}>{deliveryStatus(selected, today).label}</span></dd></div>
        <div><FileText /><dt>Projeto</dt><dd>{selected.project}<small>TK-{String(selected.ticket).padStart(6, '0')}</small></dd></div>
        <div><FileText /><dt>Demanda</dt><dd>{selected.demand}</dd></div>
        <div><Users /><dt>Responsável</dt><dd>{selected.assignee}</dd></div>
        {selected.sla && <div><Clock3 /><dt>SLA</dt><dd>{selected.sla}</dd></div>}
        <div><FileText /><dt>SEI</dt><dd>{selected.sei || 'Não informado'}</dd></div>
        <div><Users /><dt>Área</dt><dd>{areas.find(a => a.id === areaId)?.name}</dd></div>
      </dl><div className="delivery-description"><h3>Descrição</h3><p>{selected.description || (selected.kind === 'project' ? 'Entrega do projeto conforme o prazo total do SLA.' : 'Sem descrição cadastrada.')}</p></div><button className="primary" onClick={() => selected.kind === 'project' ? onOpenProject(selected.projectId) : onOpenTask(selected.sourceId)}><ExternalLink />{selected.kind === 'project' ? 'Abrir projeto' : 'Abrir tarefa'}</button></aside>}
    </div>
  </div>;
}
