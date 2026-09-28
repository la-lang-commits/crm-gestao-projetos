import {test} from 'node:test';import assert from 'node:assert/strict';import {filterTasks,taskIsOverdue,matchesTaskMetric,sortTasksByDue} from '../lib/tasks.ts';
const tasks=[{id:'1',title:'Revisar ata',assignee_id:'a',status:'Pendente',priority:'Alta',project_id:'p',due_date:'2026-09-27'},{id:'2',title:'Enviar ata',assignee_id:'b',status:'Em andamento',priority:'Média',project_id:'q',due_date:'2026-09-28'},{id:'3',title:'Concluir',assignee_id:null,status:'Concluída',priority:'Baixa',project_id:'p',due_date:'2026-09-01'}];const f={scope:'all',query:'',status:'',priority:'',project:'',assignee:''};
test('scope and combined filters preserve correct task subsets',()=>{assert.deepEqual(filterTasks(tasks,{...f,scope:'mine'},'a').map(t=>t.id),['1']);assert.deepEqual(filterTasks(tasks,{...f,scope:'team'},'a').map(t=>t.id),['2','3']);assert.deepEqual(filterTasks(tasks,{...f,query:'ATA',priority:'Alta',project:'p'},'a').map(t=>t.id),['1']);assert.equal(filterTasks(tasks,{...f,assignee:'unassigned'},'a')[0].id,'3');});
test('overdue dates use São Paulo and exclude closed tasks',()=>{assert.equal(taskIsOverdue(tasks[0],new Date('2026-09-28T15:00:00Z')),true);assert.equal(taskIsOverdue(tasks[1],new Date('2026-09-28T15:00:00Z')),false);assert.equal(taskIsOverdue(tasks[2],new Date('2026-09-28T15:00:00Z')),false);assert.equal(taskIsOverdue(tasks[0],new Date('2026-09-28T01:00:00Z')),false);});

test('task metrics use the current São Paulo week and exclude closed tasks from active counts',()=>{
 const now=new Date('2026-09-28T15:00:00Z');
 assert.equal(matchesTaskMetric(tasks[1],'today',now),true);
 assert.equal(matchesTaskMetric(tasks[0],'late',now),true);
 assert.equal(matchesTaskMetric(tasks[0],'week',now),false);
 assert.equal(matchesTaskMetric({...tasks[0],due_date:'2026-10-04'},'week',now),true);
 assert.equal(matchesTaskMetric({...tasks[0],due_date:'2026-10-05'},'week',now),false);
 assert.equal(matchesTaskMetric(tasks[2],'done',now),true);
 assert.equal(matchesTaskMetric({...tasks[2],due_date:'2026-09-28'},'today',now),false);
});
test('deadline sorting keeps undated tasks last in both directions',()=>{
 const rows=[...tasks,{...tasks[0],id:'none',due_date:null}];
 assert.deepEqual(sortTasksByDue(rows).map(t=>t.id),['3','1','2','none']);
 assert.deepEqual(sortTasksByDue(rows,true).map(t=>t.id),['2','1','3','none']);
});

