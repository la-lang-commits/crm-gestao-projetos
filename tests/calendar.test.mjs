import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryDay, shiftMonth, calendarWindow, deliveryStatus, buildDeliveries } from '../lib/calendar.ts';

test('calendar dates respect São Paulo midnight and preserve date-only deadlines', () => {
  assert.equal(deliveryDay('2026-10-07T01:00:00Z'), '2026-10-06');
  assert.equal(deliveryDay('2026-10-07T03:00:00Z'), '2026-10-07');
  assert.equal(deliveryDay('2026-10-07'), '2026-10-07');
  assert.equal(deliveryDay('invalid'), '');
});
test('month navigation avoids skipping February and grids run Monday to Sunday', () => {
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-01');
  assert.equal(shiftMonth('2026-12-31', 1), '2027-01-01');
  const october = calendarWindow('2026-10-06', 'month');
  assert.equal(october.start, '2026-09-28');
  assert.equal(october.end, '2026-11-01');
  assert.equal(october.days.length, 35);
  assert.ok(calendarWindow('2028-02-01', 'month').days.includes('2028-02-29'));
  assert.equal(calendarWindow('2026-10-06', 'list').start, '2026-10-01');
  assert.equal(calendarWindow('2026-10-06', 'list').end, '2026-10-31');
  const week = calendarWindow('2027-01-01', 'week');
  assert.equal(week.start, '2026-12-28');
  assert.equal(week.end, '2027-01-03');
});
test('closed deliveries are never reported overdue and today uses calendar day', () => {
  assert.equal(deliveryStatus({ status: 'Concluída', date: '2026-10-01' }, '2026-10-06').tone, 'done');
  assert.equal(deliveryStatus({ status: 'Cancelado', date: '2026-10-01' }, '2026-10-06').tone, 'cancelled');
  assert.equal(deliveryStatus({ status: 'Aberto', date: '2026-10-06' }, '2026-10-06').tone, 'today');
  assert.equal(deliveryStatus({ status: 'Aberto', date: '2026-10-05' }, '2026-10-06').tone, 'late');
});
test('deliveries use actual deadlines, preserve owners, exclude undated and out-of-area tasks', () => {
  const p = { id: 'p', name: 'Sustentabilidade', ticket: 11, demand: 'Homologação', sei: '123', ownerId: 'a', owner: 'Ana', status: 'Em andamento', slaDueAt: '2026-10-08T02:00:00Z', slaValue: 20, slaUnit: 'business_days', observation: '' };
  const t = { id: 't', project_id: 'p', title: 'Revisar', assignee_id: 'b', status: 'Pendente', due_date: '2026-10-06' };
  const events = buildDeliveries([p, { ...p, id: 'none', slaDueAt: null }], [t, { ...t, id: 'external', project_id: 'other-area' }, { ...t, id: 'undated', due_date: null }], [{ id: 'b', name: 'Bia' }]);
  assert.deepEqual(events.map(e => e.id), ['task:t', 'project:p']);
  assert.equal(events[0].assignee, 'Bia');
  assert.equal(events[1].date, '2026-10-07');
  assert.equal(events[1].sla, '20 dias úteis');
});
