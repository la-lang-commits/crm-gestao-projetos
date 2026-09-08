"use client";
import { useMemo, useState } from "react";
import { Activity, BarChart3, Bell, CalendarDays, CheckCircle2, ChevronDown, CircleDot, Clock3, FolderKanban, LayoutDashboard, ListTodo, Menu, MoreHorizontal, Plus, Search, Settings, ShieldCheck, TrendingUp, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Role="super"|"admin"|"member"; type Status="Concluído"|"Em andamento"|"Novo"|"Pendente";
type Project={id:number;name:string;group:string;owner:string;initials:string;status:Status;priority:"Alta"|"Média"|"Baixa";updated:string;days:number;progress:number};
const groupList=[{name:"Planejamento",color:"#138a6c"},{name:"Gestão Interna",color:"#4f7ee8"},{name:"Projetos Especiais",color:"#a55dc7"},{name:"Atendimento",color:"#e49a32"}];
const data:Project[]=[
 {id:1,name:"Plano de entregas do trimestre",group:"Planejamento",owner:"Juliana Souza",initials:"JS",status:"Em andamento",priority:"Alta",updated:"Hoje, 10:42",days:2,progress:64},
 {id:2,name:"Revisão do fluxo de solicitações",group:"Planejamento",owner:"Rafael Mendes",initials:"RM",status:"Pendente",priority:"Média",updated:"Ontem, 16:20",days:9,progress:35},
 {id:3,name:"Mapeamento de indicadores",group:"Planejamento",owner:"Carla Ferreira",initials:"CF",status:"Concluído",priority:"Média",updated:"28/08/2026",days:0,progress:100},
 {id:4,name:"Painel de acompanhamento",group:"Planejamento",owner:"Lucas Silva",initials:"LS",status:"Novo",priority:"Baixa",updated:"Hoje, 09:10",days:0,progress:8},
 {id:5,name:"Ciclo de melhorias internas",group:"Gestão Interna",owner:"Ana Paula",initials:"AP",status:"Em andamento",priority:"Alta",updated:"30/08/2026",days:4,progress:52},
 {id:6,name:"Organização da base documental",group:"Projetos Especiais",owner:"Bruno Torres",initials:"BT",status:"Pendente",priority:"Baixa",updated:"25/08/2026",days:14,progress:40},
 {id:7,name:"Novo roteiro de atendimento",group:"Atendimento",owner:"Marina Reis",initials:"MR",status:"Concluído",priority:"Alta",updated:"01/09/2026",days:0,progress:100}
];
const roles:Record<Role,string>={super:"Super Admin",admin:"Admin do grupo",member:"Membro"};
const statusConfig:Record<Status,{className:string;icon:React.ReactNode}>={Concluído:{className:"done",icon:<CheckCircle2/>},"Em andamento":{className:"doing",icon:<Activity/>},Novo:{className:"new",icon:<CircleDot/>},Pendente:{className:"pending",icon:<Clock3/>}};

export default function Home(){
 const [role,setRole]=useState<Role>("super"),[group,setGroup]=useState("Planejamento"),[view,setView]=useState("Início"),[period,setPeriod]=useState("Semanal"),[query,setQuery]=useState(""),[mobile,setMobile]=useState(false),[dialog,setDialog]=useState(false);
 const groups=role==="super"?groupList:groupList.filter(x=>x.name==="Planejamento"); const current=role==="super"?group:"Planejamento";
 const projects=useMemo(()=>data.filter(p=>p.group===current&&p.name.toLowerCase().includes(query.toLowerCase())),[current,query]);
 return <div className="app">
  <aside className={"sidebar "+(mobile?"open":"")}><div className="brand"><div className="logo">LP</div><div><b>CRM</b><small>Gestão de Projetos</small></div><button onClick={()=>setMobile(false)} className="close"><X/></button></div>
   <nav><Nav icon={<LayoutDashboard/>} label="Início" active={view==="Início"} click={()=>{setView("Início");setMobile(false)}}/><Nav icon={<FolderKanban/>} label="Projetos" active={view==="Projetos"} click={()=>{setView("Projetos");setMobile(false)}}/><Nav icon={<ListTodo/>} label="Tarefas"/><Nav icon={<CalendarDays/>} label="Calendário"/><Nav icon={<BarChart3/>} label="Relatórios"/></nav>
   <p className="section-label">GRUPOS <span>{role==="super"?"Todos":"Meu grupo"}</span></p><div className="groups">{groups.map(g=><button key={g.name} className={current===g.name?"active":""} onClick={()=>setGroup(g.name)}><i style={{background:g.color}}/>{g.name}</button>)}</div>
   {role==="super"&&<button className="manage"><Users/> Gerenciar grupos</button>}
   <div className="aside-foot"><button><Settings/>Configurações</button><div><ShieldCheck/>Acesso isolado por grupo</div></div>
  </aside>{mobile&&<button className="scrim" onClick={()=>setMobile(false)}/>}
  <main><header className="topbar"><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><label className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar projetos, tarefas ou pessoas..."/></label><Bell/><div className="profile"><span>LP</span><div><b>Laís Pedroso</b><small>{roles[role]}</small></div><ChevronDown/></div></header>
   <div className="content"><div className="heading"><div><p>{view==="Início"?"VISÃO GERAL":current.toUpperCase()}</p><h1>{view==="Início"?"Olá, Laís!":current}</h1><span>{view==="Início"?"Acompanhe o andamento da sua área.":projects.length+" projetos visíveis somente para este grupo."}</span></div><div className="heading-actions"><Select value={role} onValueChange={v=>{setRole(v as Role);setGroup("Planejamento")}}><SelectTrigger className="role"><ShieldCheck/><SelectValue/></SelectTrigger><SelectContent><SelectItem value="super">Super Admin</SelectItem><SelectItem value="admin">Admin do grupo</SelectItem><SelectItem value="member">Membro</SelectItem></SelectContent></Select><NewProject open={dialog} setOpen={setDialog} group={current}/></div></div>
   {view==="Início"?<Dashboard projects={projects} period={period} setPeriod={setPeriod} openProjects={()=>setView("Projetos")}/>:<ProjectList projects={projects}/>}</div>
  </main>
 </div>
}
function Nav({icon,label,active=false,click}:{icon:React.ReactNode,label:string,active?:boolean,click?:()=>void}){return <button onClick={click} className={active?"active":""}>{icon}{label}</button>}
function Dashboard({projects,period,setPeriod,openProjects}:{projects:Project[];period:string;setPeriod:(x:string)=>void;openProjects:()=>void}){
 const counts=(["Concluído","Em andamento","Novo","Pendente"] as Status[]).map(s=>({s,n:projects.filter(p=>p.status===s).length}));
 const bars=period==="Semanal"?[42,55,48,72,64,81,76]:[38,51,67,58,76,84];
 return <><section className="cards">{counts.map(({s,n})=><article key={s} className={statusConfig[s].className}><div className="metric-icon">{statusConfig[s].icon}</div><div><span>{s}</span><strong>{n}</strong><small>{s==="Concluído"?"+2 nesta semana":s==="Em andamento"?"1 atualizado hoje":s==="Novo"?"Adicionados recentemente":"Precisam de atenção"}</small></div></article>)}</section>
  <section className="dash-grid"><article className="report"><header><div><h2>Relatório de desempenho</h2><p>Projetos movimentados no período</p></div><div className="period">{["Semanal","Mensal"].map(x=><button key={x} className={period===x?"active":""} onClick={()=>setPeriod(x)}>{x}</button>)}</div></header><div className="chart"><div className="ylabels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0</span></div><div className="bars">{bars.map((h,i)=><div key={i}><span style={{height:h+"%"}}/><small>{period==="Semanal"?["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][i]:["Mar","Abr","Mai","Jun","Jul","Ago"][i]}</small></div>)}</div></div><footer><TrendingUp/><b>+12%</b> de evolução em relação ao período anterior</footer></article>
  <article className="summary"><header><h2>Resumo {period.toLowerCase()}</h2><p>Movimentações da equipe</p></header><div className="ring"><div><strong>{period==="Semanal"?"76%":"68%"}</strong><span>progresso</span></div></div><ul><li><i className="g"/>12 tarefas concluídas <b>+18%</b></li><li><i className="b"/>8 projetos atualizados <b>+9%</b></li><li><i className="y"/>3 itens pendentes <b className="warn">atenção</b></li></ul></article></section>
  <section className="recent"><header><div><h2>Projetos recentes</h2><p>Últimas atualizações de {currentLabel(projects)}</p></div><button onClick={openProjects}>Ver todos</button></header><ProjectRows projects={projects.slice(0,4)}/></section></>
}
function currentLabel(p:Project[]){return p[0]?.group||"seu grupo"}
function ProjectList({projects}:{projects:Project[]}){return <section className="recent full"><header><div><h2>Todos os projetos</h2><p>A visualização respeita o acesso do grupo.</p></div><button>Filtros <ChevronDown/></button></header><ProjectRows projects={projects}/></section>}
function ProjectRows({projects}:{projects:Project[]}){return <div>{projects.map(p=><div className="project" key={p.id}><div className="project-main"><span className={"project-dot "+statusConfig[p.status].className}/><div><b>{p.name}</b><small>{p.owner} · Atualizado {p.updated.toLowerCase()}</small></div></div><div className="progress"><div><span style={{width:p.progress+"%"}}/></div><small>{p.progress}%</small></div><span className={"pill "+statusConfig[p.status].className}>{p.status}</span><span className={"priority "+p.priority.toLowerCase()}>{p.priority}</span><div className="avatar">{p.initials}</div><button className="more"><MoreHorizontal/></button></div>)}</div>}
function NewProject({open,setOpen,group}:{open:boolean;setOpen:(x:boolean)=>void;group:string}){return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button className="primary"><Plus/>Novo projeto</button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Novo projeto</DialogTitle><DialogDescription>Este projeto ficará visível somente para membros de {group}.</DialogDescription></DialogHeader><div className="form"><label>Nome<input placeholder="Digite o nome do projeto"/></label><label>Responsável<input placeholder="Nome do responsável"/></label><div><label>Status<select><option>Novo</option><option>Em andamento</option><option>Pendente</option></select></label><label>Prioridade<select><option>Baixa</option><option>Média</option><option>Alta</option></select></label></div><button className="primary wide" onClick={()=>setOpen(false)}>Criar projeto</button></div></DialogContent></Dialog>}
