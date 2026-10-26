"use client";
import {useEffect,useState} from "react";
import {Search,ArrowUpRight,ListChecks,Clock3,CalendarDays,Hourglass,RotateCcw,ChevronLeft,ChevronRight,FolderOpen} from "lucide-react";
import {supabase} from "@/lib/supabase";
import type {TicketCollaborator} from "./ticket-collaboration";
import "./my-actions.css";

type MyTicket={id:string;name:string;demand:string;ticket:number;status:string;ownerId:string;team:TicketCollaborator[];workflow:{id:string;stageName:string;status:string;assigneeId:string;dueAt:string|null}[]};
type MyTask={id:string;title:string;due_date:string|null;project_id:string;status:string};
type Item={id:string;title:string;type:"Etapa"|"Ticket"|"Tarefa";project:MyTicket|undefined;status:string;due:string|null;waiting:boolean;taskId?:string};
type Scope="all"|"late"|"today"|"waiting";
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const localDay=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const dueDay=(s:string|null)=>!s?"":s.length===10?s:localDay(new Date(s));
const ticketCode=(p:MyTicket)=>`TK-${String(p.ticket).padStart(6,"0")}`;
export function MyActions({tickets,userId,areaId,query,onTicket,onTask}:{tickets:MyTicket[];userId:string;areaId:string;query:string;onTicket:(id:string)=>void;onTask:(id:string)=>void}){
 const [tasks,setTasks]=useState<MyTask[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 const [search,setSearch]=useState(""),[type,setType]=useState("all"),[projectId,setProjectId]=useState("all"),[scope,setScope]=useState<Scope>("all"),[period,setPeriod]=useState("all"),[page,setPage]=useState(1);
 const [today,setToday]=useState(()=>localDay(new Date()));
 useEffect(()=>{const timer=setInterval(()=>setToday(localDay(new Date())),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{let live=true;setLoading(true);setTasks([]);setError("");void supabase.from("tasks").select("id,title,due_date,project_id,status,projects!inner(group_id)").eq("projects.group_id",areaId).eq("assignee_id",userId).in("status",["Pendente","Em andamento"]).order("due_date",{ascending:true,nullsFirst:false}).then(({data,error})=>{if(live){if(error)setError("Não foi possível carregar suas tarefas. Os tickets e etapas continuam disponíveis.");else setTasks(data||[]);setLoading(false);}});return()=>{live=false;};},[areaId,userId,retry]);
 const active=tickets.filter(p=>!["Concluído","Cancelado"].includes(p.status));
 const items:Item[]=active.flatMap(p=>{
  const ownSteps=p.workflow.filter(s=>s.assigneeId===userId&&["pending","current"].includes(s.status));
  const rows:Item[]=ownSteps.map(s=>({id:`step-${s.id}`,title:s.stageName,type:"Etapa",project:p,status:s.status==="current"?"Em andamento":"Aguardando etapa anterior",due:s.dueAt,waiting:s.status==="pending"}));
  if((p.ownerId===userId||p.team?.some(m=>m.userId===userId&&m.role==="responsible"))&&!ownSteps.some(s=>s.status==="current")) rows.push({id:`ticket-${p.id}`,title:p.demand||p.name,type:"Ticket",project:p,status:p.status,due:p.workflow.find(s=>s.status==="current")?.dueAt||null,waiting:false});
  return rows;
 });
 items.push(...tasks.map(t=>({id:`task-${t.id}`,title:t.title,type:"Tarefa" as const,project:tickets.find(p=>p.id===t.project_id),status:t.status,due:t.due_date,waiting:false,taskId:t.id})));
 const timing=(i:Item)=>i.waiting?"waiting":!i.due?"none":dueDay(i.due)<today?"late":dueDay(i.due)===today?"today":"upcoming";
 const counts={all:items.length,late:items.filter(i=>timing(i)==="late").length,today:items.filter(i=>timing(i)==="today").length,waiting:items.filter(i=>i.waiting).length};
 const inSevenDays=localDay(new Date(new Date(today+"T12:00:00-03:00").getTime()+7*86400000));
 const visible=items.filter(i=>{
  const text=normalize(`${i.title} ${i.project?.name||""} ${i.project?.demand||""} ${i.project?ticketCode(i.project):""}`);
  return text.includes(normalize(search))&&text.includes(normalize(query))&&(type==="all"||i.type===type)&&(projectId==="all"||i.project?.id===projectId)&&(scope==="all"||timing(i)===scope)&&(period==="all"||(period==="none"?!i.due:!i.waiting&&!!i.due&&dueDay(i.due)>=today&&dueDay(i.due)<=inSevenDays));
 }).sort((a,b)=>{const ranks={late:0,today:1,upcoming:2,none:3,waiting:4};return ranks[timing(a)]-ranks[timing(b)]||(a.due||"9999").localeCompare(b.due||"9999")||a.title.localeCompare(b.title,"pt-BR");});
 const pages=Math.max(1,Math.ceil(visible.length/10)),currentPage=Math.min(page,pages),shown=visible.slice((currentPage-1)*10,currentPage*10);
 const reset=()=>{setSearch("");setType("all");setProjectId("all");setScope("all");setPeriod("all");setPage(1);};
 const changeScope=(v:Scope)=>{setScope(v);setPeriod("all");setPage(1);};
 const projects=[...new Map(items.filter(i=>i.project).map(i=>[i.project!.id,i.project!])).values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
 return <div className="actions-hub">
  <div className="actions-summary" aria-label="Resumo das pendências">{([{id:"all",label:"Todas as pendências",icon:ListChecks,description:"Tickets, etapas e tarefas"},{id:"late",label:"Atrasadas",icon:Clock3,description:"Precisam de atenção"},{id:"today",label:"Para hoje",icon:CalendarDays,description:"Vencimento hoje"},{id:"waiting",label:"Aguardando",icon:Hourglass,description:"Dependem de etapas anteriores"}] as const).map(c=><button key={c.id} className={`actions-stat ${c.id} ${scope===c.id?"selected":""}`} aria-pressed={scope===c.id} onClick={()=>changeScope(c.id)}><span className="actions-stat-icon"><c.icon/></span><span><small>{c.label}</small><strong>{counts[c.id]}{loading&&<span aria-label="Carregando tarefas">…</span>}</strong><small>{c.description}</small></span></button>)}</div>
  <section className="actions-list"><header className="actions-list-heading"><div><h2>Sua lista de pendências</h2><p>Veja o que precisa de você e abra cada atividade para agir.</p></div><span className="actions-total">{visible.length} {visible.length===1?"pendência":"pendências"}</span></header>
  <div className="actions-filters"><label className="actions-search"><span>Buscar</span><div><Search/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Atividade, projeto ou ticket..."/></div></label><label>Tipo<select value={type} onChange={e=>{setType(e.target.value);setPage(1);}}><option value="all">Todos os tipos</option><option>Etapa</option><option>Ticket</option><option>Tarefa</option></select></label><label>Projeto<select value={projectId} onChange={e=>{setProjectId(e.target.value);setPage(1);}}><option value="all">Todos os projetos</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name} · {ticketCode(p)}</option>)}</select></label><label>Prazo<select value={period} onChange={e=>{setPeriod(e.target.value);setScope("all");setPage(1);}}><option value="all">Todos os prazos</option><option value="week">Próximos 7 dias</option><option value="none">Sem prazo</option></select></label><button className="actions-reset" onClick={reset}><RotateCcw/>Limpar</button></div>
  {query&&<p className="actions-notice">Busca geral aplicada: “{query}”. Para removê-la, limpe a busca no topo da página.</p>}
  {loading&&<p className="actions-notice" role="status">Carregando suas tarefas…</p>}{error&&<div className="actions-error" role="alert">{error}<button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></div>}
  <div className="actions-table-wrap"><table><thead><tr><th>Pendência</th><th>Projeto / ticket</th><th>Prazo</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{shown.map(i=>{const time=timing(i);return <tr key={i.id}><td><span className={`actions-kind ${i.type==="Tarefa"?"task":i.type==="Etapa"?"step":"ticket"}`}>{i.type}</span><b>{i.title}</b></td><td><span className="actions-project">{i.project?.name||"Projeto vinculado"}</span><small>{i.project?ticketCode(i.project):""}</small></td><td><span className={`actions-date ${time}`}><CalendarDays/>{i.due?dueDay(i.due).split("-").reverse().join("/"):"Sem prazo"}</span><small className={time}>{time==="late"?"Prazo vencido":time==="today"?"Vence hoje":time==="waiting"?"Ainda não iniciada":time==="upcoming"?"No prazo":"A definir"}</small></td><td><span className={`actions-status ${i.waiting?"waiting":""}`}>{i.status}</span></td><td><button className="actions-open" onClick={()=>i.taskId?onTask(i.taskId):i.project&&onTicket(i.project.id)} aria-label={`Abrir ${i.type.toLowerCase()}: ${i.title}`}>{i.taskId?"Abrir tarefa":"Abrir ticket"}<ArrowUpRight/></button></td></tr>;})}</tbody></table></div>
  {!visible.length&&!loading&&<div className="actions-empty"><FolderOpen/><h3>{items.length?"Nenhuma pendência com esses filtros":"Tudo em dia por aqui"}</h3><p>{items.length?"Ajuste a busca ou limpe os filtros para ver outras atividades.":error?"Nenhum ticket ou etapa pendente. Tente carregar as tarefas novamente.":"Quando uma atividade for atribuída a você, ela aparecerá nesta lista."}</p>{items.length>0&&<button onClick={reset}>Limpar filtros</button>}</div>}
  <footer className="actions-footer"><span role="status">{visible.length?`Mostrando ${(currentPage-1)*10+1}–${Math.min(currentPage*10,visible.length)} de ${visible.length}`:"0 pendências"}</span><div><button aria-label="Página anterior" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronLeft/></button><span>{currentPage} / {pages}</span><button aria-label="Próxima página" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}><ChevronRight/></button></div></footer>
  </section><p className="actions-footnote">Quando a etapa atual já aparece na lista, o ticket não é repetido. Etapas futuras ficam em “Aguardando”.</p>
 </div>;
}
