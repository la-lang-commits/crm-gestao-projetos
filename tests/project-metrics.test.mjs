import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectDuration, ownerCounts, activitySeries, nextWorkflowStep, projectsInPeriod } from '../lib/project-metrics.ts';
const project = { status: 'Em andamento', openedAt: '2026-09-21', events: [], workflow: [] };
test('uses calendar days in São Paulo, including same-day projects', () => {
  assert.equal(projectDuration(project, '2026-09-22T01:00:00Z'), 0);
  assert.equal(projectDuration(project, '2026-09-23T15:00:00Z'), 2);
});
test('completed duration ends at completion, never the last edit or today', () => {
  const completed = { ...project, status: 'Concluído', events: [{ toStatus: 'Concluído', created_at: '2026-09-22T15:00:00Z' }, { created_at: '2026-09-25T15:00:00Z' }] };
  assert.equal(projectDuration(completed, '2026-09-30T15:00:00Z'), 1);
  assert.equal(projectDuration({ ...project, status: 'Concluído' }), null);
  assert.equal(projectDuration({ ...project, status: 'Cancelado' }), null);
  assert.equal(projectDuration({ ...project, openedAt: 'invalid' }), null);
  assert.equal(projectDuration(project, '2026-09-20T15:00:00Z'), null);
});
test('supports workflow completion and reopened projects', () => {
  const workflow = [{ status: 'completed', completedAt: '2026-09-24T15:00:00Z' }];
  assert.equal(projectDuration({ ...project, status: 'Concluído', workflow }), 3);
  assert.equal(projectDuration({ ...project, workflow }, '2026-09-26T15:00:00Z'), 5);
});
test('counts identities separately and retains zero and unassigned rows', () => {
  const rows = ownerCounts([{ ownerId: 'a', owner: 'Ana', status: 'Aberto' }, { ownerId: 'b', owner: 'Ana', status: 'Concluído' }, { ownerId: '', owner: '', status: 'Pendente' }], [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ana' }, { id: 'c', name: 'Bia' }]);
  assert.equal(rows.length, 4);
  assert.equal(rows.find(r => r.id === 'c').total, 0);
  assert.equal(rows.find(r => r.id === 'a').counts.Aberto, 1);
  assert.equal(rows.reduce((n,r) => n + r.total, 0), 3);
});

 test('weekly activity deduplicates projects and uses local dates', () => {
 const p = { openedAt: '2026-09-21', updatedAt: '2026-09-22T01:00:00Z', events: [{created_at:'2026-09-21T19:00:00Z'},{created_at:'2026-09-23T15:00:00Z'},{created_at:'2026-09-24T15:00:00Z'}] };
 assert.deepEqual(activitySeries([p], 'Semanal', '2026-09-23T18:00:00Z').map(d=>d.value),[1,0,1,0,0,0,0]);
 assert.deepEqual(activitySeries([p], 'Mensal', '2026-09-23T18:00:00Z').map(d=>d.value),[0,0,0,0,0,1]);
 assert.deepEqual(activitySeries([], 'Semanal', '2026-09-23T18:00:00Z').map(d=>d.value),[0,0,0,0,0,0,0]);
 });
 test('next recipient follows workflow order and skips ignored and earlier steps', () => {
 const steps=[{order:4,status:'pending'},{order:1,status:'pending'},{order:2,status:'current'},{order:3,status:'skipped'}];
 assert.equal(nextWorkflowStep(steps)?.order,4);
 assert.equal(nextWorkflowStep([{order:1,status:'current'}]),undefined);
 assert.equal(nextWorkflowStep([{order:1,status:'completed'}]),undefined);
 });


test('period filter uses current week or month and counts each project once', () => {
 const make=(id,openedAt,events=[])=>({id,openedAt,updatedAt:'',events});
 const rows=[make('old','2026-08-01'),make('month','2026-09-03'),make('week','2026-09-21'),make('event','2026-08-01',[{created_at:'2026-09-23T15:00:00Z'}]),make('future','2026-09-25'),make('localSunday','2026-09-21T01:00:00Z')];
 assert.deepEqual(projectsInPeriod(rows,'Semanal','2026-09-23T15:00:00Z').map(p=>p.id),['week','event']);
 assert.deepEqual(projectsInPeriod(rows,'Mensal','2026-09-23T15:00:00Z').map(p=>p.id),['month','week','event','localSunday']);
});

