"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import type {TicketCollaborator} from "./ticket-collaboration";
type MyTicket={id:string;name:string;demand:string;ticket:number;status:string;ownerId:string;team:TicketCollaborator[];workflow:{id:string;stageName:string;status:string;assigneeId:string;dueAt:string|null}[]};
type MyTask={id:string;title:string;due_date:string|null;project_id:string;status:string};
export function MyActions({tickets,userId,areaId,query,onTicket,onTask}:{tickets:MyTicket[];userId:string;areaId:string;query:string;onTicket:(id:string)=>void;onTask:(id:string)=>void}){
 const [tasks,setTasks]=useState<MyTask[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError("");void supabase.from("tasks").select("id,title,due_date,project_id,status,projects!inner(group_id)").eq("projects.group_id",areaId).eq("assignee_id",userId).in("status",["Pendente","Em andamento"]).order("due_date",{ascending:true,nullsFirst:false}).then(({data,error})=>{if(live){if(error)setError("Não foi possível carregar suas tarefas.");else setTasks(data||[]);setLoading(false);}});return()=>{live=false;};},[areaId,userId,retry]);
 const match=(text:string)=>text.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"));
 const active=tickets.filter(p=>!["Concluído","Cancelado"].includes(p.status)&&match(p.name+" "+p.demand+" TK-"+String(p.ticket).padStart(6,"0")));
 const mine=active.filter(p=>p.ownerId===userId||p.team?.some(m=>m.userId===userId&&m.role==="responsible"));
 const steps=active.flatMap(p=>p.workflow.filter(s=>s.assigneeId===userId&&["pending","current"].includes(s.status)).map(s=>({...s,project:p})));
 const shownTasks=tasks.filter(t=>match(t.title+" "+(tickets.find(p=>p.id===t.project_id)?.name||"")));
 return <div className="my-actions"><div className="projects-metrics"><article><div><small>Tickets sob minha responsabilidade</small><b>{mine.length}</b></div></article><article><div><small>Minhas etapas pendentes</small><b>{steps.length}</b></div></article><article><div><small>Minhas tarefas pendentes</small><b>{loading?"…":error?"—":shownTasks.length}</b></div></article></div>
 <section><h2>Meus tickets</h2>{mine.length?mine.map(p=><button key={p.id} onClick={()=>onTicket(p.id)}><span><b>{p.name}</b><small>TK-{String(p.ticket).padStart(6,"0")} · {p.demand}</small></span><em>{p.status}</em></button>):<p>Nenhum ticket pendente atribuído a você.</p>}</section>
 <section><h2>Minhas etapas</h2>{steps.length?steps.map(s=><button key={s.id} onClick={()=>onTicket(s.project.id)}><span><b>{s.stageName}</b><small>{s.project.name}</small></span><em>{s.status==="current"?"Etapa atual":"Aguardando etapa anterior"}{s.dueAt?" · "+new Date(s.dueAt).toLocaleDateString("pt-BR"):""}</em></button>):<p>Nenhuma etapa pendente atribuída a você.</p>}</section>
 <section><h2>Minhas tarefas</h2>{loading?<p>Carregando tarefas...</p>:error?<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></p>:shownTasks.length?shownTasks.map(t=><button key={t.id} onClick={()=>onTask(t.id)}><span><b>{t.title}</b><small>{tickets.find(p=>p.id===t.project_id)?.name}</small></span><em>{t.due_date?t.due_date.split("-").reverse().join("/"):"Sem prazo"}</em></button>):<p>Nenhuma tarefa pendente atribuída a você.</p>}</section></div>;
}
