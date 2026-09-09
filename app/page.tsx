"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Columns3,
  Eye,
  EyeOff,
  FolderKanban,
  LayoutDashboard,
  List,
  ListChecks,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

type Role = "super" | "admin" | "member";
type Status =
  "Aberto" | "Pendente" | "Em andamento" | "Concluído" | "Cancelado";
type Priority = "Alta" | "Média" | "Baixa";
type SlaUnit = "business_days" | "calendar_days" | "hours" | "months";
type Area = { id: string; name: string; color: string };
type Member = { id: string; name: string; role: string; areaId: string };
type Label = { id: string; label_text: string; color: string };
type Event = {
  id: string;
  justification: string;
  created_at: string;
  actor?: { full_name: string };
  subject?: { full_name: string };
};
type CatalogItem = {
  id: string;
  areaId: string;
  projectName: string;
  demandName: string;
  slaDays: number;
  slaValue: number;
  slaUnit: SlaUnit;
  workflow: WorkflowTemplateStep[];
  active: boolean;
};
type WorkflowTemplateStep = {
  id: string;
  order: number;
  stageName: string;
  assigneeId: string;
  assignee: string;
  slaValue: number;
  slaUnit: SlaUnit;
};
type ProjectWorkflowStep = WorkflowTemplateStep & {
  status: "pending" | "current" | "completed" | "skipped";
  startedAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  completedLate: boolean;
};
type FieldDef = {
  id: string;
  areaId: string;
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date";
  required: boolean;
  visible: boolean;
  system: boolean;
  order: number;
};
type Project = {
  id: string;
  ticket: number;
  sei: string;
  name: string;
  demand: string;
  areaId: string;
  ownerId: string;
  owner: string;
  status: Status;
  priority: Priority;
  openedAt: string;
  slaDays: number;
  slaValue: number;
  slaUnit: SlaUnit;
  slaDueAt: string | null;
  hasDelayedStep: boolean;
  workflow: ProjectWorkflowStep[];
  stage: string;
  observation: string;
  progress: number;
  labels: Label[];
  events: Event[];
  customValues: { field_id: string; value: string }[];
};

const roleLabels: Record<Role, string> = {
  super: "Super Admin",
  admin: "Admin da área",
  member: "Membro",
};
const stages = [
  "Triagem",
  "Análise",
  "Planejamento",
  "Execução",
  "Validação",
  "Concluído",
];
const statuses: Status[] = [
  "Aberto",
  "Pendente",
  "Em andamento",
  "Concluído",
  "Cancelado",
];
const statusConfig: Record<
  Status,
  { className: string; icon: React.ReactNode }
> = {
  Aberto: { className: "open", icon: <CircleDot /> },
  Pendente: { className: "pending", icon: <Clock3 /> },
  "Em andamento": { className: "doing", icon: <Activity /> },
  Concluído: { className: "done", icon: <CheckCircle2 /> },
  Cancelado: { className: "cancelled", icon: <XCircle /> },
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const ticket = (n: number) => "TK-" + String(n).padStart(6, "0");
const slaUnitLabels: Record<SlaUnit, [string, string]> = {
  business_days: ["dia útil", "dias úteis"],
  calendar_days: ["dia corrido", "dias corridos"],
  hours: ["hora", "horas"],
  months: ["mês", "meses"],
};
const formatSla = (value: number, unit: SlaUnit) =>
  `${value} ${slaUnitLabels[unit][value === 1 ? 0 : 1]}`;
const deadlineInfo = (dueAt: string | null) => {
  if (!dueAt) return { label: "Prazo não iniciado", tone: "neutral" };
  const hours = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 3600000);
  if (hours < 0)
    return {
      label: `Atrasado há ${Math.max(1, Math.ceil(Math.abs(hours) / 24))}d`,
      tone: "late",
    };
  if (hours <= 24) return { label: "Vence em até 24h", tone: "warning" };
  return {
    label: `${Math.ceil(hours / 24)}d restantes`,
    tone: hours <= 72 ? "warning" : "ok",
  };
};
const slaInfo = (p: Project) => {
  if (["Concluído", "Cancelado"].includes(p.status))
    return { label: p.status, tone: "neutral" };
  const currentStep = p.workflow.find((step) => step.status === "current");
  if (currentStep?.dueAt && new Date(currentStep.dueAt).getTime() < Date.now())
    return { label: "Projeto atrasado · etapa atual", tone: "late" };
  if (p.hasDelayedStep)
    return { label: "Projeto atrasado · etapa anterior", tone: "late" };
  return deadlineInfo(p.slaDueAt);
};
export default function Home() {
  const [session, setSession] = useState<any>(null),
    [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  if (!ready) return <Loading text="Carregando CRM..." />;
  return session ? <Workspace user={session.user} /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const r = signup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split("@")[0] } },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (r.error) setMessage(r.error.message);
    else if (signup && !r.data.session)
      setMessage("Conta criada. Confirme o e-mail para entrar.");
  }
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-logo">LP</div>
        <p>CRM</p>
        <h1>
          Projetos organizados.
          <br />
          Áreas conectadas.
        </h1>
        <span>
          Cada área acessa somente os próprios projetos. A gestão acompanha tudo
          em um só lugar.
        </span>
        <div className="login-security">
          <ShieldCheck />
          <div>
            <b>Acesso protegido por área</b>
            <small>Permissões aplicadas diretamente no banco de dados</small>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <form onSubmit={submit}>
          <div className="lock">
            <LockKeyhole />
          </div>
          <h2>{signup ? "Crie sua conta" : "Acesse sua conta"}</h2>
          <p>Entre com seu e-mail institucional</p>
          <label>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@instituicao.gov.br"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
            />
          </label>
          {message && <div className="auth-message">{message}</div>}
          <button className="primary login-button" disabled={busy}>
            {busy ? <Loader2 /> : signup ? "Criar conta" : "Entrar"}
          </button>
          <button
            type="button"
            className="mode-button"
            onClick={() => {
              setSignup(!signup);
              setMessage("");
            }}
          >
            {signup
              ? "Já possui conta? Entrar"
              : "Primeiro acesso? Criar uma conta"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Workspace({ user }: { user: any }) {
  const [role, setRole] = useState<Role>("member"),
    [name, setName] = useState(user.email?.split("@")[0] || "Usuário"),
    [areas, setAreas] = useState<Area[]>([]),
    [areaId, setAreaId] = useState(""),
    [members, setMembers] = useState<Member[]>([]),
    [allProjects, setAllProjects] = useState<Project[]>([]),
    [catalog, setCatalog] = useState<CatalogItem[]>([]),
    [fields, setFields] = useState<FieldDef[]>([]),
    [view, setView] = useState("Início"),
    [projectMode, setProjectMode] = useState<"list" | "kanban">("list"),
    [period, setPeriod] = useState("Semanal"),
    [query, setQuery] = useState(""),
    [mobile, setMobile] = useState(false),
    [newOpen, setNewOpen] = useState(false),
    [editProject, setEditProject] = useState<Project | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [labelProject, setLabelProject] = useState(""),
    [labelText, setLabelText] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    const [pr, ar, mr, jr, cr, fr] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,platform_role")
        .eq("id", user.id)
        .single(),
      supabase.from("groups").select("id,name,color").order("created_at"),
      supabase
        .from("group_members")
        .select(
          "group_id,role,user_id,profile:profiles!group_members_user_id_fkey(id,full_name)",
        ),
      supabase
        .from("projects")
        .select(
          "id,ticket_number,sei_number,name,demand,status,priority,progress,opened_at,sla_days,sla_value,sla_unit,sla_due_at,has_delayed_step,stage,observation,group_id,owner_id,owner:profiles!projects_owner_id_fkey(full_name),workflow:project_workflow_steps(id,step_order,stage_name,assignee_id,sla_value,sla_unit,status,started_at,due_at,completed_at,completed_late,assignee:profiles!project_workflow_steps_assignee_id_fkey(full_name)),labels:project_labels(id,label_text,color),events:project_events(id,justification,created_at,actor:profiles!project_events_actor_user_id_fkey(full_name),subject:profiles!project_events_subject_user_id_fkey(full_name),custom_values:project_field_values(field_id,value)",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("service_catalog")
        .select(
          "id,area_id,project_name,demand_name,sla_days,sla_value,sla_unit,active,workflow:service_catalog_workflow_steps(id,step_order,stage_name,assignee_id,sla_value,sla_unit,assignee:profiles!service_catalog_workflow_steps_assignee_id_fkey(full_name))",
        )
        .order("project_name"),
      supabase
        .from("ticket_field_definitions")
        .select(
          "id,area_id,field_key,label,field_type,required,visible,is_system,sort_order",
        )
        .order("sort_order"),
    ]);
    if (pr.data) {
      setName(pr.data.full_name || user.email);
      setRole(
        pr.data.platform_role === "super_admin"
          ? "super"
          : mr.data?.some((x: any) => x.role === "admin")
            ? "admin"
            : "member",
      );
    }
    if (ar.data) {
      setAreas(ar.data);
      setAreaId((x) =>
        ar.data.some((a: any) => a.id === x) ? x : ar.data[0]?.id || "",
      );
    }
    setMembers(
      (mr.data || []).map((m: any) => ({
        id: m.user_id,
        name: m.profile?.full_name || "Usuário",
        role: m.role,
        areaId: m.group_id,
      })),
    );
    setCatalog(
      (cr.data || []).map((c: any) => ({
        id: c.id,
        areaId: c.area_id,
        projectName: c.project_name,
        demandName: c.demand_name,
        slaDays: c.sla_days,
        slaValue: c.sla_value,
        slaUnit: c.sla_unit,
        workflow: (c.workflow || [])
          .map((step: any) => ({
            id: step.id,
            order: step.step_order,
            stageName: step.stage_name,
            assigneeId: step.assignee_id || "",
            assignee: step.assignee?.full_name || "Sem responsável",
            slaValue: step.sla_value,
            slaUnit: step.sla_unit,
          }))
          .sort(
            (a: WorkflowTemplateStep, b: WorkflowTemplateStep) =>
              a.order - b.order,
          ),
        active: c.active,
      })),
    );
    setFields(
      (fr.data || []).map((f: any) => ({
        id: f.id,
        areaId: f.area_id,
        key: f.field_key,
        label: f.label,
        type: f.field_type,
        required: f.required,
        visible: f.visible,
        system: f.is_system,
        order: f.sort_order,
      })),
    );
    if (jr.error)
      setError("Não foi possível carregar os projetos: " + jr.error.message);
    else
      setAllProjects(
        (jr.data || []).map((p: any) => ({
          id: p.id,
          ticket: Number(p.ticket_number),
          sei: p.sei_number || "",
          name: p.name,
          demand: p.demand || "",
          areaId: p.group_id,
          ownerId: p.owner_id || "",
          owner: p.owner?.full_name || "Sem responsável",
          status: p.status,
          priority: p.priority,
          openedAt: p.opened_at,
          slaDays: p.sla_days,
          slaValue: p.sla_value,
          slaUnit: p.sla_unit,
          slaDueAt: p.sla_due_at,
          hasDelayedStep: p.has_delayed_step,
          workflow: (p.workflow || [])
            .map((step: any) => ({
              id: step.id,
              order: step.step_order,
              stageName: step.stage_name,
              assigneeId: step.assignee_id || "",
              assignee: step.assignee?.full_name || "Sem responsável",
              slaValue: step.sla_value,
              slaUnit: step.sla_unit,
              status: step.status,
              startedAt: step.started_at,
              dueAt: step.due_at,
              completedAt: step.completed_at,
              completedLate: step.completed_late,
            }))
            .sort(
              (a: ProjectWorkflowStep, b: ProjectWorkflowStep) =>
                a.order - b.order,
            ),
          stage: p.stage,
          observation: p.observation || "",
          progress: p.progress,
          labels: p.labels || [],
          events: (p.events || []).sort(
            (a: Event, b: Event) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          ),
          customValues: p.custom_values || [],
        })),
      );
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const current = areas.find((a) => a.id === areaId);
  const projects = useMemo(
    () =>
      allProjects.filter(
        (p) =>
          (!areaId || p.areaId === areaId) &&
          [p.name, p.sei, p.demand, ticket(p.ticket)]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [allProjects, areaId, query],
  );
  const scopedMembers = members.filter((m) => m.areaId === areaId);
  const areaMembers = scopedMembers.some((m) => m.id === user.id)
    ? scopedMembers
    : [
        {
          id: user.id,
          name,
          role: role === "member" ? "member" : "admin",
          areaId,
        },
        ...scopedMembers,
      ];
  const areaCatalog = catalog.filter((c) => c.areaId === areaId),
    areaFields = fields.filter((f) => f.areaId === areaId);
  async function createProject(v: NewValues) {
    const { error } = await supabase.rpc("create_project_ticket", {
      p_area_id: areaId,
      p_catalog_id: v.catalogId,
      p_sei_number: v.sei || null,
      p_opened_at: v.openedAt,
      p_stage: v.stage,
      p_status: v.status,
      p_observation: v.observation || null,
      p_priority: v.priority,
      p_owner_id: v.ownerId || user.id,
      p_labels: v.labels,
      p_custom_values: v.custom,
    });
    if (error) throw error;
    setNotice("Ticket criado com sucesso.");
    await load();
  }
  async function updateProject(v: UpdateValues) {
    const { error } = v.advance
      ? await supabase.rpc("advance_project_workflow", {
          p_project_id: v.id,
          p_justification: v.justification,
          p_subject_user_id: v.subjectId || null,
        })
      : await supabase.rpc("update_project_with_justification", {
          p_project_id: v.id,
          p_status: v.status,
          p_stage: v.stage,
          p_owner_id: v.ownerId || null,
          p_justification: v.justification,
          p_subject_user_id: v.subjectId || null,
        });
    if (error) throw error;
    setEditProject(null);
    setNotice(
      v.advance
        ? "Etapa concluída e projeto encaminhado para o próximo responsável."
        : "Projeto atualizado com justificativa registrada.",
    );
    await load();
  }
  async function addLabel(projectId: string) {
    if (!labelText.trim()) return;
    const { error } = await supabase.from("project_labels").insert({
      project_id: projectId,
      label_text: labelText.trim(),
      color: "#e3ece7",
    });
    if (error) {
      setError(error.message);
      return;
    }
    setLabelText("");
    setLabelProject("");
    await load();
  }
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="brand">
          <div className="logo">LP</div>
          <div>
            <b>CRM</b>
            <small>Gestão de Projetos</small>
          </div>
          <button onClick={() => setMobile(false)} className="close">
            <X />
          </button>
        </div>
        <nav>
          <Nav
            icon={<LayoutDashboard />}
            label="Início"
            active={view === "Início"}
            click={() => setView("Início")}
          />
          <Nav
            icon={<FolderKanban />}
            label="Projetos"
            active={view === "Projetos"}
            click={() => setView("Projetos")}
          />
          <Nav icon={<List />} label="Tarefas" />
          <Nav icon={<CalendarDays />} label="Calendário" />
          <Nav icon={<BarChart3 />} label="Relatórios" />
        </nav>
        <p className="section-label">
          ÁREAS <span>{role === "super" ? "Todas" : "Meu acesso"}</span>
        </p>
        <div className="groups">
          {areas.map((a) => (
            <button
              key={a.id}
              className={areaId === a.id ? "active" : ""}
              onClick={() => setAreaId(a.id)}
            >
              <i style={{ background: a.color }} />
              {a.name}
            </button>
          ))}
        </div>
        {role === "super" && (
          <button className="manage" onClick={() => setView("Configurações")}>
            <Building2 /> Gerenciar áreas
          </button>
        )}
        <div className="aside-foot">
          <button
            className={view === "Configurações" ? "active" : ""}
            onClick={() => setView("Configurações")}
          >
            <Settings />
            Configurações
          </button>
          <div>
            <ShieldCheck />
            Acesso isolado por área
          </div>
        </div>
      </aside>
      {mobile && <button className="scrim" onClick={() => setMobile(false)} />}
      <main>
        <header className="topbar">
          <button className="hamb" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <label className="search">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ticket, SEI, projeto ou demanda..."
            />
          </label>
          <Bell />
          <div className="profile">
            <span>{initials(name)}</span>
            <div>
              <b>{name}</b>
              <small>{roleLabels[role]}</small>
            </div>
            <button
              className="signout"
              title="Sair"
              onClick={() => supabase.auth.signOut()}
            >
              <LogOut />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="heading">
            <div>
              <p>
                {view === "Início"
                  ? "VISÃO GERAL"
                  : (current?.name || "ÁREA").toUpperCase()}
              </p>
              <h1>
                {view === "Início"
                  ? "Olá, " + name.split(" ")[0] + "!"
                  : view === "Configurações"
                    ? "Configurações"
                    : current?.name || "Sem área"}
              </h1>
              <span>
                {view === "Início"
                  ? "Acompanhe prazos, etapas e movimentações da sua área."
                  : view === "Configurações"
                    ? "Defina o catálogo e os campos usados nos tickets desta área."
                    : projects.length +
                      " projetos visíveis somente para esta área."}
              </span>
            </div>
            <div className="heading-actions">
              <span className="role-badge">
                <ShieldCheck />
                {roleLabels[role]}
              </span>
              {view === "Projetos" && areaId && (
                <NewProject
                  open={newOpen}
                  setOpen={setNewOpen}
                  area={current?.name || ""}
                  members={areaMembers}
                  userId={user.id}
                  catalog={areaCatalog}
                  fields={areaFields}
                  onCreate={createProject}
                />
              )}
            </div>
          </div>
          {error && <div className="error-banner">{error}</div>}
          {notice && (
            <div className="success-banner">
              {notice}
              <button onClick={() => setNotice("")}>
                <X />
              </button>
            </div>
          )}
          {loading ? (
            <Loading text="Atualizando dados..." inline />
          ) : view === "Configurações" ? (
            <Configuration
              role={role}
              userId={user.id}
              areaId={areaId}
              areas={areas}
              catalog={areaCatalog}
              members={areaMembers}
              fields={areaFields}
              reload={load}
              message={setNotice}
              fail={setError}
            />
          ) : areas.length === 0 ? (
            <div className="empty-state">
              <Building2 />
              <h2>Nenhuma área disponível</h2>
              <p>Cadastre uma área ou peça acesso a um administrador.</p>
            </div>
          ) : view === "Início" ? (
            <Dashboard
              projects={projects}
              fields={areaFields}
              period={period}
              setPeriod={setPeriod}
              openProjects={() => setView("Projetos")}
            />
          ) : (
            <ProjectsView
              projects={projects}
              mode={projectMode}
              setMode={setProjectMode}
              edit={setEditProject}
              fields={areaFields}
              labelProject={labelProject}
              setLabelProject={setLabelProject}
              labelText={labelText}
              setLabelText={setLabelText}
              addLabel={addLabel}
            />
          )}
        </div>
      </main>
      {editProject && (
        <EditProject
          project={editProject}
          members={areaMembers}
          role={role}
          open={!!editProject}
          setOpen={(v) => !v && setEditProject(null)}
          onUpdate={updateProject}
        />
      )}
    </div>
  );
}

function Nav({
  icon,
  label,
  active = false,
  click,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  click?: () => void;
}) {
  return (
    <button onClick={click} className={active ? "active" : ""}>
      {icon}
      {label}
    </button>
  );
}
function Loading({ text, inline = false }: { text: string; inline?: boolean }) {
  return (
    <div className={"loading " + (inline ? "inline" : "")}>
      <Loader2 />
      <span>{text}</span>
    </div>
  );
}

function Dashboard({
  projects,
  fields,
  period,
  setPeriod,
  openProjects,
}: {
  projects: Project[];
  fields: FieldDef[];
  period: string;
  setPeriod: (x: string) => void;
  openProjects: () => void;
}) {
  const counts = statuses.map((s) => ({
      s,
      n: projects.filter((p) => p.status === s).length,
    })),
    bars =
      period === "Semanal"
        ? [32, 48, 42, 67, 55, 78, 70]
        : [35, 47, 62, 58, 73, 81];
  return (
    <>
      <section className="cards status-five">
        {counts.map(({ s, n }) => (
          <article key={s} className={statusConfig[s].className}>
            <div className="metric-icon">{statusConfig[s].icon}</div>
            <div>
              <span>{s}</span>
              <strong>{n}</strong>
              <small>
                {s === "Concluído"
                  ? "Finalizados"
                  : s === "Pendente"
                    ? "Precisam de atenção"
                    : s === "Cancelado"
                      ? "Encerrados"
                      : "Projetos ativos"}
              </small>
            </div>
          </article>
        ))}
      </section>
      <section className="dash-grid">
        <article className="report">
          <header>
            <div>
              <h2>Relatório de desempenho</h2>
              <p>Projetos movimentados no período</p>
            </div>
            <div className="period">
              {["Semanal", "Mensal"].map((x) => (
                <button
                  key={x}
                  className={period === x ? "active" : ""}
                  onClick={() => setPeriod(x)}
                >
                  {x}
                </button>
              ))}
            </div>
          </header>
          <div className="chart">
            <div className="ylabels">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0</span>
            </div>
            <div className="bars">
              {bars.map((h, i) => (
                <div key={i}>
                  <span style={{ height: h + "%" }} />
                  <small>
                    {period === "Semanal"
                      ? ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][i]
                      : ["Mar", "Abr", "Mai", "Jun", "Jul", "Ago"][i]}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <footer>
            <TrendingUp />
            <b>{projects.length}</b> projetos analisados no período
          </footer>
        </article>
        <article className="summary">
          <header>
            <h2>Resumo {period.toLowerCase()}</h2>
            <p>Visão consolidada da área</p>
          </header>
          <div className="ring">
            <div>
              <strong>
                {projects.length
                  ? Math.round(
                      projects.reduce((a, p) => a + p.progress, 0) /
                        projects.length,
                    )
                  : 0}
                %
              </strong>
              <span>progresso</span>
            </div>
          </div>
          <ul>
            <li>
              <i className="g" />
              {counts[3].n} projetos concluídos
            </li>
            <li>
              <i className="b" />
              {counts[2].n} projetos em andamento
            </li>
            <li>
              <i className="y" />
              {counts[1].n} itens pendentes <b className="warn">atenção</b>
            </li>
          </ul>
        </article>
      </section>
      <section className="recent">
        <header>
          <div>
            <h2>Projetos recentes</h2>
            <p>Dados atualizados em tempo real</p>
          </div>
          <button onClick={openProjects}>Ver todos</button>
        </header>
        <TicketCards projects={projects.slice(0, 3)} fields={fields} compact />
      </section>
    </>
  );
}

type ListProps = {
  projects: Project[];
  fields: FieldDef[];
  edit?: (p: Project) => void;
  labelProject?: string;
  setLabelProject?: (id: string) => void;
  labelText?: string;
  setLabelText?: (v: string) => void;
  addLabel?: (id: string) => void;
};
function ProjectsView(
  props: ListProps & {
    mode: "list" | "kanban";
    setMode: (m: "list" | "kanban") => void;
  },
) {
  const { mode, setMode, ...rest } = props;
  return (
    <section className="recent full projects-surface">
      <header>
        <div>
          <h2>Projetos</h2>
          <p>Alterne entre a visão detalhada e o fluxo por status.</p>
        </div>
        <div className="view-switch">
          <button
            className={mode === "list" ? "active" : ""}
            onClick={() => setMode("list")}
          >
            <List />
            Lista
          </button>
          <button
            className={mode === "kanban" ? "active" : ""}
            onClick={() => setMode("kanban")}
          >
            <Columns3 />
            Kanban
          </button>
        </div>
      </header>
      {mode === "list" ? <TicketCards {...rest} /> : <Kanban {...rest} />}
    </section>
  );
}
function Kanban({ projects, edit }: ListProps) {
  return (
    <div className="kanban-board">
      {statuses.map((status) => (
        <section className="kanban-column" key={status}>
          <header>
            <span className={"status-dot " + statusConfig[status].className} />
            <b>{status}</b>
            <em>{projects.filter((p) => p.status === status).length}</em>
          </header>
          <div>
            {projects
              .filter((p) => p.status === status)
              .map((p) => (
                <button
                  className="kanban-card"
                  key={p.id}
                  onClick={() => edit?.(p)}
                >
                  <span>{ticket(p.ticket)}</span>
                  <h3>{p.name}</h3>
                  <p>{p.demand}</p>
                  <footer>
                    <small>{slaInfo(p).label}</small>
                    <i>{initials(p.owner)}</i>
                  </footer>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function TicketCards({
  projects,
  fields,
  edit,
  labelProject,
  setLabelProject,
  labelText,
  setLabelText,
  addLabel,
  compact = false,
}: ListProps & { compact?: boolean }) {
  const show = (key: string) => fields.some((f) => f.key === key && f.visible);
  return (
    <div className="ticket-list">
      {projects.length ? (
        projects.map((p) => {
          const sla = slaInfo(p),
            currentStep = p.workflow.find((step) => step.status === "current"),
            stepSla = currentStep
              ? deadlineInfo(currentStep.dueAt)
              : { label: "Sem etapa ativa", tone: "neutral" },
            latest = p.events[0],
            custom = p.customValues
              .map((v) => ({
                value: v.value,
                field: fields.find((f) => f.id === v.field_id),
              }))
              .filter((x) => x.field?.visible);
          return (
            <article className="ticket-card" key={p.id}>
              <div className="ticket-top">
                <div>
                  <span className="ticket-number">{ticket(p.ticket)}</span>
                  {show("sei") && p.sei && (
                    <span className="sei">SEI {p.sei}</span>
                  )}
                  <h3>{p.name}</h3>
                  <p>{p.demand}</p>
                </div>
                <div className="ticket-actions">
                  {show("status") && (
                    <span
                      className={"pill " + statusConfig[p.status].className}
                    >
                      {p.status}
                    </span>
                  )}
                  {edit && (
                    <button title="Atualizar projeto" onClick={() => edit(p)}>
                      <MoreHorizontal />
                    </button>
                  )}
                </div>
              </div>
              {show("stage") && (
                <div className="stage-flow">
                  {(p.workflow.length
                    ? p.workflow
                    : stages.map((stageName, order) => ({
                        id: stageName,
                        stageName,
                        order,
                        status:
                          order <= stages.indexOf(p.stage)
                            ? "completed"
                            : "pending",
                        completedLate: false,
                      }))
                  ).map((step, i, flow) => (
                    <div
                      className={`${step.status === "current" || step.status === "completed" ? "active" : ""} ${step.completedLate ? "late-step" : ""}`}
                      key={step.id}
                      title={
                        step.completedLate
                          ? "Etapa concluída com atraso"
                          : undefined
                      }
                    >
                      <i />
                      {i < flow.length - 1 && <span />}
                      <small>{step.stageName}</small>
                    </div>
                  ))}
                </div>
              )}
              <div className="ticket-meta">
                {show("openedAt") && (
                  <span>
                    <b>Abertura</b>
                    {new Date(p.openedAt + "T12:00:00").toLocaleDateString(
                      "pt-BR",
                    )}
                  </span>
                )}
                <span>
                  <b>SLA do projeto</b>
                  <em className={sla.tone}>{sla.label}</em>
                  <small>{formatSla(p.slaValue, p.slaUnit)}</small>
                </span>
                {currentStep && (
                  <span>
                    <b>SLA da etapa atual</b>
                    <em className={stepSla.tone}>{stepSla.label}</em>
                    <small>
                      {formatSla(currentStep.slaValue, currentStep.slaUnit)} ·{" "}
                      {currentStep.assignee}
                    </small>
                  </span>
                )}
                {p.hasDelayedStep && currentStep && stepSla.tone !== "late" && (
                  <span className="sla-distinction">
                    <b>Diferença dos prazos</b>
                    <em className="ok">Etapa atual no prazo</em>
                    <small>
                      O atraso do projeto veio de uma etapa anterior.
                    </small>
                  </span>
                )}
                {show("ownerId") && (
                  <span>
                    <b>Responsável</b>
                    {p.owner}
                  </span>
                )}
                {show("stage") && (
                  <span>
                    <b>Etapa atual</b>
                    {p.stage}
                  </span>
                )}
                {custom.map((x) => (
                  <span key={x.field!.id}>
                    <b>{x.field!.label}</b>
                    {x.value || "—"}
                  </span>
                ))}
              </div>
              {!compact && (
                <>
                  {show("labels") && (
                    <div className="label-line">
                      <div className="label-chips">
                        {p.labels.map((l) => (
                          <span key={l.id}>
                            <Tag />
                            {l.label_text}
                          </span>
                        ))}
                        {!p.labels.length && <small>Sem etiquetas</small>}
                      </div>
                      {labelProject === p.id ? (
                        <div className="label-add">
                          <input
                            autoFocus
                            maxLength={120}
                            value={labelText}
                            onChange={(e) => setLabelText?.(e.target.value)}
                            placeholder="Escreva uma etiqueta rápida"
                          />
                          <button onClick={() => addLabel?.(p.id)}>
                            Adicionar
                          </button>
                          <button onClick={() => setLabelProject?.("")}>
                            <X />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-label"
                          onClick={() => setLabelProject?.(p.id)}
                        >
                          <Plus />
                          Etiqueta
                        </button>
                      )}
                    </div>
                  )}
                  {show("observation") && p.observation && (
                    <div className="ticket-observation">
                      <b>Observação</b>
                      {p.observation}
                    </div>
                  )}
                  {latest && (
                    <div className="latest-note">
                      <span>Última justificativa</span>
                      <p>“{latest.justification}”</p>
                      <small>
                        {latest.subject?.full_name &&
                        latest.subject.full_name !== latest.actor?.full_name
                          ? "Referente a " + latest.subject.full_name + " · "
                          : ""}
                        Registrado por{" "}
                        <b>{latest.actor?.full_name || "Usuário"}</b> em{" "}
                        {new Date(latest.created_at).toLocaleDateString(
                          "pt-BR",
                        )}
                      </small>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })
      ) : (
        <div className="empty-projects">Nenhum projeto nesta área.</div>
      )}
    </div>
  );
}

type NewValues = {
  catalogId: string;
  sei: string;
  openedAt: string;
  stage: string;
  status: Status;
  observation: string;
  priority: Priority;
  ownerId: string;
  labels: string[];
  custom: Record<string, string>;
};
function NewProject({
  open,
  setOpen,
  area,
  members,
  userId,
  catalog,
  fields,
  onCreate,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  area: string;
  members: Member[];
  userId: string;
  catalog: CatalogItem[];
  fields: FieldDef[];
  onCreate: (v: NewValues) => Promise<void>;
}) {
  const active = catalog.filter((c) => c.active),
    projectNames = [...new Set(active.map((c) => c.projectName))],
    first = active[0];
  const fresh = (): NewValues => ({
    catalogId: first?.id || "",
    sei: "",
    openedAt: new Date().toISOString().slice(0, 10),
    stage: "Triagem",
    status: "Aberto",
    observation: "",
    priority: "Média",
    ownerId: userId,
    labels: [],
    custom: {},
  });
  const [values, setValues] = useState<NewValues>(fresh),
    [projectName, setProjectName] = useState(first?.projectName || ""),
    [labelDraft, setLabelDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      const f = active[0];
      setProjectName(f?.projectName || "");
      setValues({ ...fresh(), catalogId: f?.id || "" });
      setError("");
    }
  }, [open, area]);
  const selected = active.find((c) => c.id === values.catalogId),
    demands = active.filter((c) => c.projectName === projectName),
    visible = (key: string) => fields.some((f) => f.key === key && f.visible),
    required = (key: string) => !!fields.find((f) => f.key === key)?.required,
    set = (key: keyof NewValues, value: any) =>
      setValues((v) => ({ ...v, [key]: value }));
  async function submit() {
    const payload = {
      ...values,
      catalogId: values.catalogId || active[0]?.id || "",
    };
    if (!payload.catalogId) {
      setError("Cadastre um projeto, uma demanda e o SLA em Configurações.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onCreate(payload);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || "Não foi possível criar o ticket.");
    } finally {
      setBusy(false);
    }
  }
  function addTag() {
    const v = labelDraft.trim();
    if (v && !values.labels.includes(v)) set("labels", [...values.labels, v]);
    setLabelDraft("");
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="primary">
          <Plus />
          Novo projeto
        </button>
      </DialogTrigger>
      <DialogContent className="project-dialog">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>
            O número do ticket será gerado automaticamente. O projeto ficará
            visível somente para a área {area}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="new-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="auto-ticket">
            <span>Nº do ticket</span>
            <b>Gerado automaticamente ao salvar</b>
          </div>
          {error && (
            <div className="project-submit-error span-2" role="alert">
              <XCircle />
              <span>{error}</span>
            </div>
          )}
          {!active.length && (
            <div className="config-required span-2">
              <Settings />
              <div>
                <b>Catálogo vazio</b>
                <span>
                  Cadastre o projeto, a demanda e o SLA em Configurações.
                </span>
              </div>
            </div>
          )}
          <label>
            Projeto *
            <select
              value={projectName}
              onChange={(e) => {
                const n = e.target.value,
                  item = active.find((c) => c.projectName === n);
                setProjectName(n);
                set("catalogId", item?.id || "");
              }}
            >
              <option value="">Selecione</option>
              {projectNames.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Demanda *
            <select
              value={values.catalogId}
              onChange={(e) => set("catalogId", e.target.value)}
            >
              <option value="">Selecione</option>
              {demands.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.demandName}
                </option>
              ))}
            </select>
          </label>
          <div className="sla-preview span-2">
            <span>SLA geral do projeto e da demanda</span>
            <b>
              {selected
                ? formatSla(selected.slaValue, selected.slaUnit)
                : "Selecione uma demanda"}
            </b>
          </div>
          {selected && selected.workflow.length > 0 && (
            <div className="workflow-preview span-2">
              <header>
                <div>
                  <b>Fluxo automático por responsável</b>
                  <span>O ticket começará pela primeira etapa.</span>
                </div>
                <small>{selected.workflow.length} etapas</small>
              </header>
              <div>
                {selected.workflow.map((step) => (
                  <span key={step.id}>
                    <i>{step.order}</i>
                    <strong>{step.stageName}</strong>
                    <small>{step.assignee}</small>
                    <em>{formatSla(step.slaValue, step.slaUnit)}</em>
                  </span>
                ))}
              </div>
            </div>
          )}
          {visible("sei") && (
            <label>
              Nº do SEI{required("sei") && " *"}
              <input
                required={required("sei")}
                value={values.sei}
                onChange={(e) => set("sei", e.target.value)}
              />
            </label>
          )}
          {visible("openedAt") && (
            <label>
              Data de abertura{required("openedAt") && " *"}
              <input
                type="date"
                required={required("openedAt")}
                value={values.openedAt}
                onChange={(e) => set("openedAt", e.target.value)}
              />
            </label>
          )}
          {visible("stage") && (
            <label>
              Etapa inicial
              <select
                disabled={!!selected?.workflow.length}
                value={selected?.workflow[0]?.stageName || values.stage}
                onChange={(e) => set("stage", e.target.value)}
              >
                {selected?.workflow[0] &&
                  !stages.includes(selected.workflow[0].stageName) && (
                    <option>{selected.workflow[0].stageName}</option>
                  )}
                {stages.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          )}
          {visible("status") && (
            <label>
              Status
              <select
                value={values.status}
                onChange={(e) => set("status", e.target.value as Status)}
              >
                {statuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          )}
          {visible("ownerId") && (
            <label>
              Responsável
              <select
                disabled={!!selected?.workflow.length}
                value={selected?.workflow[0]?.assigneeId || values.ownerId}
                onChange={(e) => set("ownerId", e.target.value)}
              >
                {members.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.id === userId ? m.name + " (eu)" : m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {visible("priority") && (
            <label>
              Prioridade
              <select
                value={values.priority}
                onChange={(e) => set("priority", e.target.value as Priority)}
              >
                <option>Baixa</option>
                <option>Média</option>
                <option>Alta</option>
              </select>
            </label>
          )}
          {visible("observation") && (
            <label className="span-2">
              Observação{required("observation") && " *"}
              <textarea
                required={required("observation")}
                value={values.observation}
                onChange={(e) => set("observation", e.target.value)}
              />
            </label>
          )}
          {fields
            .filter((f) => !f.system && f.visible)
            .map((f) => (
              <label
                className={f.type === "textarea" ? "span-2" : ""}
                key={f.id}
              >
                {f.label}
                {f.required && " *"}
                {f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    value={values.custom[f.id] || ""}
                    onChange={(e) =>
                      set("custom", {
                        ...values.custom,
                        [f.id]: e.target.value,
                      })
                    }
                  />
                ) : (
                  <input
                    type={f.type}
                    required={f.required}
                    value={values.custom[f.id] || ""}
                    onChange={(e) =>
                      set("custom", {
                        ...values.custom,
                        [f.id]: e.target.value,
                      })
                    }
                  />
                )}
              </label>
            ))}
          {visible("labels") && (
            <div className="span-2 tag-editor">
              <span>Etiquetas visíveis na lista</span>
              <div>
                <input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Ex.: Aguardando retorno"
                />
                <button type="button" onClick={addTag}>
                  <Plus />
                  Adicionar
                </button>
              </div>
              <section>
                {values.labels.map((x) => (
                  <button
                    type="button"
                    key={x}
                    onClick={() =>
                      set(
                        "labels",
                        values.labels.filter((y) => y !== x),
                      )
                    }
                  >
                    <Tag />
                    {x}
                    <X />
                  </button>
                ))}
              </section>
            </div>
          )}
          <button
            type="submit"
            className="primary wide span-2"
            disabled={busy || !active.length}
          >
            {busy ? (
              <>
                <Loader2 />
                Salvando...
              </>
            ) : (
              "Criar ticket"
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LegacyConfiguration({
  role,
  userId,
  areaId,
  areas,
  catalog,
  members,
  fields,
  reload,
  message,
  fail,
}: {
  role: Role;
  userId: string;
  areaId: string;
  areas: Area[];
  catalog: CatalogItem[];
  members: Member[];
  fields: FieldDef[];
  reload: () => Promise<void>;
  message: (x: string) => void;
  fail: (x: string) => void;
}) {
  const [tab, setTab] = useState<"catalog" | "fields" | "areas">("catalog"),
    [projectName, setProjectName] = useState(""),
    [demandName, setDemandName] = useState(""),
    [sla, setSla] = useState(5),
    [slaUnit, setSlaUnit] = useState<SlaUnit>("business_days"),
    [workflowCatalogId, setWorkflowCatalogId] = useState(""),
    [fieldLabel, setFieldLabel] = useState(""),
    [fieldType, setFieldType] = useState<FieldDef["type"]>("text"),
    [areaName, setAreaName] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(action: () => PromiseLike<{ error: any }>, ok: string) {
    setBusy(true);
    fail("");
    const { error } = await action();
    setBusy(false);
    if (error) {
      fail(error.message);
      return;
    }
    message(ok);
    await reload();
  }
  async function addCatalog() {
    if (!projectName.trim() || !demandName.trim())
      return fail("Informe projeto e demanda.");
    await run(
      () =>
        supabase.from("service_catalog").insert({
          area_id: areaId,
          project_name: projectName.trim(),
          demand_name: demandName.trim(),
          sla_days: sla,
          created_by: userId,
        }),
      "Item incluído no catálogo.",
    );
    setProjectName("");
    setDemandName("");
  }
  async function addField() {
    if (fieldLabel.trim().length < 2) return fail("Informe o nome do campo.");
    await run(
      () =>
        supabase.from("ticket_field_definitions").insert({
          area_id: areaId,
          field_key: "custom_" + Date.now(),
          label: fieldLabel.trim(),
          field_type: fieldType,
          created_by: userId,
          sort_order: 100 + fields.length,
        }),
      "Campo adicionado ao formulário.",
    );
    setFieldLabel("");
  }
  async function addArea() {
    if (areaName.trim().length < 2) return fail("Informe o nome da área.");
    await run(
      () =>
        supabase.from("groups").insert({
          name: areaName.trim(),
          color: "#7f9b88",
          created_by: userId,
        }),
      "Área criada com os campos padrão.",
    );
    setAreaName("");
  }
  if (role === "member")
    return (
      <div className="settings-denied">
        <ShieldCheck />
        <h2>Configuração restrita</h2>
        <p>
          Somente o administrador da área e o Super Admin podem alterar o
          formulário.
        </p>
      </div>
    );
  return (
    <section className="settings-page">
      <div className="settings-tabs">
        <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          Projetos, demandas e SLA
        </button>
        <button
          className={tab === "fields" ? "active" : ""}
          onClick={() => setTab("fields")}
        >
          Campos do ticket
        </button>
        {role === "super" && (
          <button
            className={tab === "areas" ? "active" : ""}
            onClick={() => setTab("areas")}
          >
            Áreas
          </button>
        )}
      </div>
      {tab === "catalog" && (
        <div className="settings-card">
          <header>
            <div>
              <h2>Catálogo da área</h2>
              <p>
                Essas opções aparecem no Novo projeto. O SLA é preenchido
                automaticamente.
              </p>
            </div>
          </header>
          <div className="catalog-form">
            <label>
              Projeto
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex.: Plataforma de Sustentabilidade"
              />
            </label>
            <label>
              Demanda
              <input
                value={demandName}
                onChange={(e) => setDemandName(e.target.value)}
                placeholder="Ex.: Análise técnica"
              />
            </label>
            <label>
              Prazo do SLA
              <input
                type="number"
                min="1"
                value={sla}
                onChange={(e) => setSla(Number(e.target.value))}
              />
            </label>
            <label>
              Unidade
              <select
                value={slaUnit}
                onChange={(e) => setSlaUnit(e.target.value as SlaUnit)}
              >
                <option value="business_days">Dias úteis</option>
                <option value="calendar_days">Dias corridos</option>
                <option value="hours">Horas</option>
                <option value="months">Meses</option>
              </select>
            </label>
            <button className="primary" disabled={busy} onClick={addCatalog}>
              <Plus />
              Adicionar
            </button>
          </div>
          <div className="config-table">
            <div className="config-row head">
              <span>Projeto</span>
              <span>Demanda</span>
              <span>SLA</span>
              <span>Ações</span>
            </div>
            {catalog.map((c) => (
              <div className="config-row" key={c.id}>
                <b>{c.projectName}</b>
                <span>{c.demandName}</span>
                <span>{formatSla(c.slaValue, c.slaUnit)}</span>
                <div>
                  <button
                    title={c.active ? "Ocultar" : "Ativar"}
                    onClick={() =>
                      run(
                        () =>
                          supabase
                            .from("service_catalog")
                            .update({ active: !c.active })
                            .eq("id", c.id),
                        c.active ? "Opção ocultada." : "Opção ativada.",
                      )
                    }
                  >
                    {c.active ? <Eye /> : <EyeOff />}
                  </button>
                  <button
                    title="Excluir"
                    onClick={() =>
                      run(
                        () =>
                          supabase
                            .from("service_catalog")
                            .delete()
                            .eq("id", c.id),
                        "Opção excluída.",
                      )
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
            {!catalog.length && (
              <div className="config-empty">
                Nenhuma opção cadastrada nesta área.
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "fields" && (
        <div className="settings-card">
          <header>
            <div>
              <h2>Campos do ticket</h2>
              <p>
                Altere obrigatoriedade e visibilidade ou crie campos
                personalizados.
              </p>
            </div>
          </header>
          <div className="field-form">
            <label>
              Nome do novo campo
              <input
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="Ex.: Órgão solicitante"
              />
            </label>
            <label>
              Tipo
              <select
                value={fieldType}
                onChange={(e) =>
                  setFieldType(e.target.value as FieldDef["type"])
                }
              >
                <option value="text">Texto curto</option>
                <option value="textarea">Texto longo</option>
                <option value="number">Número</option>
                <option value="date">Data</option>
              </select>
            </label>
            <button className="primary" disabled={busy} onClick={addField}>
              <Plus />
              Adicionar campo
            </button>
          </div>
          <div className="field-list">
            <div className="core-fields-note">
              <b>Projeto e Demanda</b>
              <span>
                São campos fixos de seleção ligados ao catálogo da área.
              </span>
            </div>
            {fields.map((f) => (
              <div className="field-item" key={f.id}>
                <div>
                  <b>{f.label}</b>
                  <span>
                    {f.system ? "Campo padrão" : "Campo personalizado"}
                  </span>
                </div>
                <label className="check-control">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={() =>
                      run(
                        () =>
                          supabase
                            .from("ticket_field_definitions")
                            .update({ required: !f.required })
                            .eq("id", f.id),
                        "Obrigatoriedade atualizada.",
                      )
                    }
                  />
                  <span>Obrigatório</span>
                </label>
                <label className="check-control">
                  <input
                    type="checkbox"
                    checked={f.visible}
                    onChange={() =>
                      run(
                        () =>
                          supabase
                            .from("ticket_field_definitions")
                            .update({ visible: !f.visible })
                            .eq("id", f.id),
                        "Visibilidade atualizada.",
                      )
                    }
                  />
                  <span>Exibir</span>
                </label>
                {f.system ? (
                  <span className="fixed-field">Padrão</span>
                ) : (
                  <button
                    className="delete-field"
                    onClick={() =>
                      run(
                        () =>
                          supabase
                            .from("ticket_field_definitions")
                            .delete()
                            .eq("id", f.id),
                        "Campo excluído.",
                      )
                    }
                  >
                    <Trash2 />
                    Excluir
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "areas" && role === "super" && (
        <div className="settings-card">
          <header>
            <div>
              <h2>Áreas</h2>
              <p>
                Cadastre Secretarias, Coordenadorias ou demais áreas com dados
                isolados.
              </p>
            </div>
          </header>
          <div className="area-form">
            <input
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="Ex.: Secretaria do Meio Ambiente"
            />
            <button className="primary" disabled={busy} onClick={addArea}>
              <Plus />
              Adicionar área
            </button>
          </div>
          <div className="area-grid">
            {areas.map((a) => (
              <article key={a.id}>
                <i style={{ background: a.color }} />
                <Building2 />
                <b>{a.name}</b>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type DeleteTarget = {
  kind: "catalog" | "field" | "area";
  id: string;
  label: string;
};

const fieldTypeLabels: Record<FieldDef["type"], string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  date: "Data",
};

function Configuration({
  role,
  userId,
  areaId,
  areas,
  catalog,
  members,
  fields,
  reload,
  message,
  fail,
}: {
  role: Role;
  userId: string;
  areaId: string;
  areas: Area[];
  catalog: CatalogItem[];
  members: Member[];
  fields: FieldDef[];
  reload: () => Promise<void>;
  message: (x: string) => void;
  fail: (x: string) => void;
}) {
  const [tab, setTab] = useState<"catalog" | "fields" | "areas">("catalog");
  const [projectName, setProjectName] = useState("");
  const [demandName, setDemandName] = useState("");
  const [sla, setSla] = useState(5);
  const [slaUnit, setSlaUnit] = useState<SlaUnit>("business_days");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldDef["type"]>("text");
  const [areaName, setAreaName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editCatalog, setEditCatalog] = useState<CatalogItem | null>(null);
  const [workflowCatalogId, setWorkflowCatalogId] = useState("");
  const [workflowStage, setWorkflowStage] = useState("");
  const [workflowAssignee, setWorkflowAssignee] = useState("");
  const [workflowSla, setWorkflowSla] = useState(1);
  const [workflowUnit, setWorkflowUnit] = useState<SlaUnit>("business_days");
  const [workflowEditId, setWorkflowEditId] = useState("");
  const [editField, setEditField] = useState<FieldDef | null>(null);
  const [editArea, setEditArea] = useState<Area | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const workflowCatalog = catalog.find((c) => c.id === workflowCatalogId);

  async function run(action: () => PromiseLike<{ error: any }>, ok: string) {
    setBusy(true);
    fail("");
    const { error } = await action();
    setBusy(false);
    if (error) {
      fail(error.message);
      return false;
    }
    message(ok);
    await reload();
    return true;
  }

  async function addCatalog() {
    if (!projectName.trim() || !demandName.trim())
      return fail("Informe projeto e demanda.");
    const ok = await run(
      () =>
        supabase.from("service_catalog").insert({
          area_id: areaId,
          project_name: projectName.trim(),
          demand_name: demandName.trim(),
          sla_days: sla,
          sla_value: sla,
          sla_unit: slaUnit,
          created_by: userId,
        }),
      "Projeto e demanda adicionados.",
    );
    if (ok) {
      setProjectName("");
      setDemandName("");
    }
  }

  async function addWorkflowStep() {
    const item = catalog.find((c) => c.id === workflowCatalogId);
    if (!item || workflowStage.trim().length < 2)
      return fail("Informe o nome da etapa.");
    const nextOrder = item.workflow.length
      ? Math.max(...item.workflow.map((step) => step.order)) + 1
      : 1;
    const values = {
      catalog_id: item.id,
      area_id: areaId,
      step_order: nextOrder,
      stage_name: workflowStage.trim(),
      assignee_id: workflowAssignee || null,
      sla_value: workflowSla,
      sla_unit: workflowUnit,
      created_by: userId,
    };
    const ok = await run(
      () =>
        workflowEditId
          ? supabase
              .from("service_catalog_workflow_steps")
              .update({
                stage_name: values.stage_name,
                assignee_id: values.assignee_id,
                sla_value: values.sla_value,
                sla_unit: values.sla_unit,
              })
              .eq("id", workflowEditId)
          : supabase.from("service_catalog_workflow_steps").insert(values),
      workflowEditId ? "Etapa atualizada." : "Etapa adicionada ao fluxo.",
    );
    if (ok) {
      setWorkflowStage("");
      setWorkflowAssignee("");
      setWorkflowSla(1);
      setWorkflowUnit("business_days");
      setWorkflowEditId("");
    }
  }

  async function addField() {
    if (fieldLabel.trim().length < 2) return fail("Informe o nome do campo.");
    const ok = await run(
      () =>
        supabase.from("ticket_field_definitions").insert({
          area_id: areaId,
          field_key: "custom_" + Date.now(),
          label: fieldLabel.trim(),
          field_type: fieldType,
          created_by: userId,
          sort_order: 100 + fields.length,
        }),
      "Campo adicionado ao formulário.",
    );
    if (ok) setFieldLabel("");
  }

  async function addArea() {
    if (areaName.trim().length < 2) return fail("Informe o nome da área.");
    const ok = await run(
      () =>
        supabase.from("groups").insert({
          name: areaName.trim(),
          color: "#7f9b88",
          created_by: userId,
        }),
      "Área criada com os campos padrão.",
    );
    if (ok) setAreaName("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const action =
      target.kind === "catalog"
        ? () => supabase.from("service_catalog").delete().eq("id", target.id)
        : target.kind === "field"
          ? () =>
              supabase
                .from("ticket_field_definitions")
                .delete()
                .eq("id", target.id)
          : () => supabase.from("groups").delete().eq("id", target.id);
    const ok = await run(
      action,
      target.kind === "area"
        ? "Área e dados vinculados excluídos."
        : target.kind === "field"
          ? "Campo excluído."
          : "Projeto e demanda excluídos.",
    );
    if (ok) setDeleteTarget(null);
  }

  if (role === "member")
    return (
      <div className="settings-denied">
        <ShieldCheck />
        <h2>Configuração restrita</h2>
        <p>Somente o administrador da área e o Super Admin podem alterar.</p>
      </div>
    );

  return (
    <section className="settings-page">
      <div className="settings-tabs">
        <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          Projetos, demandas e SLA
        </button>
        <button
          className={tab === "fields" ? "active" : ""}
          onClick={() => setTab("fields")}
        >
          Campos do ticket
        </button>
        {role === "super" && (
          <button
            className={tab === "areas" ? "active" : ""}
            onClick={() => setTab("areas")}
          >
            Áreas
          </button>
        )}
      </div>

      {tab === "catalog" && (
        <div className="settings-card">
          <header>
            <div>
              <h2>Projetos, demandas e SLA</h2>
              <p>
                Cada linha representa uma combinação disponível para os tickets.
              </p>
            </div>
          </header>
          <div className="catalog-form">
            <label>
              Projeto
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex.: Plataforma de Sustentabilidade"
              />
            </label>
            <label>
              Demanda
              <input
                value={demandName}
                onChange={(e) => setDemandName(e.target.value)}
                placeholder="Ex.: Análise técnica"
              />
            </label>
            <label>
              Prazo do SLA
              <input
                type="number"
                min="1"
                value={sla}
                onChange={(e) => setSla(Number(e.target.value))}
              />
            </label>
            <label>
              Unidade
              <select
                value={slaUnit}
                onChange={(e) => setSlaUnit(e.target.value as SlaUnit)}
              >
                <option value="business_days">Dias úteis</option>
                <option value="calendar_days">Dias corridos</option>
                <option value="hours">Horas</option>
                <option value="months">Meses</option>
              </select>
            </label>
            <button className="primary" disabled={busy} onClick={addCatalog}>
              <Plus />
              Adicionar
            </button>
          </div>
          <div className="config-table">
            <div className="config-row catalog-row head">
              <span>Projeto</span>
              <span>Demanda</span>
              <span>SLA</span>
              <span>Ativo</span>
              <span>Ações</span>
            </div>
            {catalog.map((c) => (
              <div className="config-row catalog-row" key={c.id}>
                <b>{c.projectName}</b>
                <span>{c.demandName}</span>
                <span>{formatSla(c.slaValue, c.slaUnit)}</span>
                <span className={"yesno " + (c.active ? "yes" : "no")}>
                  {c.active ? "SIM" : "NÃO"}
                </span>
                <div className="row-actions">
                  <button
                    title="Configurar fluxo e responsáveis"
                    onClick={() => setWorkflowCatalogId(c.id)}
                  >
                    <ListChecks />
                  </button>
                  <button
                    title={c.active ? "Ocultar" : "Ativar"}
                    onClick={() =>
                      run(
                        () =>
                          supabase
                            .from("service_catalog")
                            .update({ active: !c.active })
                            .eq("id", c.id),
                        c.active ? "Opção ocultada." : "Opção ativada.",
                      )
                    }
                  >
                    {c.active ? <Eye /> : <EyeOff />}
                  </button>
                  <button
                    title="Editar"
                    onClick={() => setEditCatalog({ ...c })}
                  >
                    <Pencil />
                  </button>
                  <button
                    title="Excluir"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "catalog",
                        id: c.id,
                        label: c.projectName + " — " + c.demandName,
                      })
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
            {!catalog.length && (
              <div className="config-empty">
                Nenhuma opção cadastrada nesta área.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "fields" && (
        <div className="settings-card">
          <header>
            <div>
              <h2>Campos do ticket</h2>
              <p>Defina o nome, obrigatoriedade e exibição de cada campo.</p>
            </div>
          </header>
          <div className="field-form">
            <label>
              Nome do novo campo
              <input
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="Ex.: Órgão solicitante"
              />
            </label>
            <label>
              Tipo
              <select
                value={fieldType}
                onChange={(e) =>
                  setFieldType(e.target.value as FieldDef["type"])
                }
              >
                <option value="text">Texto curto</option>
                <option value="textarea">Texto longo</option>
                <option value="number">Número</option>
                <option value="date">Data</option>
              </select>
            </label>
            <button className="primary" disabled={busy} onClick={addField}>
              <Plus />
              Adicionar campo
            </button>
          </div>
          <div className="field-list">
            <div className="field-item field-head">
              <span>Campo</span>
              <span>Tipo</span>
              <span>Obrigatório</span>
              <span>Exibir</span>
              <span>Ações</span>
            </div>
            {fields.map((f) => (
              <div className="field-item" key={f.id}>
                <div>
                  <b>{f.label}</b>
                  <span>
                    {f.system ? "Campo padrão" : "Campo personalizado"}
                  </span>
                </div>
                <span className="field-type">{fieldTypeLabels[f.type]}</span>
                <button
                  className={"yesno " + (f.required ? "required" : "no")}
                  onClick={() =>
                    run(
                      () =>
                        supabase
                          .from("ticket_field_definitions")
                          .update({
                            required: !f.required,
                            visible: !f.required ? true : f.visible,
                          })
                          .eq("id", f.id),
                      "Obrigatoriedade atualizada.",
                    )
                  }
                >
                  {f.required ? "SIM" : "NÃO"}
                </button>
                <button
                  className={"yesno " + (f.visible ? "yes" : "no")}
                  onClick={() =>
                    run(
                      () =>
                        supabase
                          .from("ticket_field_definitions")
                          .update({
                            visible: !f.visible,
                            required: f.visible ? false : f.required,
                          })
                          .eq("id", f.id),
                      "Visibilidade atualizada.",
                    )
                  }
                >
                  {f.visible ? "SIM" : "NÃO"}
                </button>
                <div className="row-actions">
                  <button title="Editar" onClick={() => setEditField({ ...f })}>
                    <Pencil />
                  </button>
                  <button
                    title="Excluir"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "field",
                        id: f.id,
                        label: f.label,
                      })
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "areas" && role === "super" && (
        <div className="settings-card">
          <header>
            <div>
              <h2>Áreas</h2>
              <p>
                Cadastre e administre Secretarias, Coordenadorias e demais
                áreas.
              </p>
            </div>
          </header>
          <div className="area-form">
            <input
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="Ex.: Secretaria do Meio Ambiente"
            />
            <button className="primary" disabled={busy} onClick={addArea}>
              <Plus />
              Adicionar área
            </button>
          </div>
          <div className="config-table">
            <div className="area-row head">
              <span>Área</span>
              <span>Ações</span>
            </div>
            {areas.map((a) => (
              <div className="area-row" key={a.id}>
                <div>
                  <i style={{ background: a.color }} />
                  <Building2 />
                  <b>{a.name}</b>
                </div>
                <div className="row-actions">
                  <button
                    title="Editar nome"
                    onClick={() => setEditArea({ ...a })}
                  >
                    <Pencil />
                  </button>
                  <button
                    title="Excluir área"
                    onClick={() =>
                      setDeleteTarget({ kind: "area", id: a.id, label: a.name })
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {workflowCatalog && (
        <Dialog open onOpenChange={(v) => !v && setWorkflowCatalogId("")}>
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <DialogTitle>Fluxo por responsável</DialogTitle>
              <DialogDescription>
                {workflowCatalog.projectName} — {workflowCatalog.demandName}.
                Cada etapa começa quando a anterior é concluída.
              </DialogDescription>
            </DialogHeader>
            <div className="workflow-builder">
              <div className="workflow-total">
                <span>SLA geral do projeto</span>
                <b>
                  {formatSla(workflowCatalog.slaValue, workflowCatalog.slaUnit)}
                </b>
              </div>
              <div className="workflow-step-form">
                <label>
                  Etapa
                  <input
                    value={workflowStage}
                    onChange={(e) => setWorkflowStage(e.target.value)}
                    placeholder="Ex.: Desenvolver plataforma"
                  />
                </label>
                <label>
                  Responsável
                  <select
                    value={workflowAssignee}
                    onChange={(e) => setWorkflowAssignee(e.target.value)}
                  >
                    <option value="">Selecionar depois</option>
                    {members.map((member) => (
                      <option value={member.id} key={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Prazo
                  <input
                    type="number"
                    min="1"
                    value={workflowSla}
                    onChange={(e) => setWorkflowSla(Number(e.target.value))}
                  />
                </label>
                <label>
                  Unidade
                  <select
                    value={workflowUnit}
                    onChange={(e) => setWorkflowUnit(e.target.value as SlaUnit)}
                  >
                    <option value="business_days">Dias úteis</option>
                    <option value="calendar_days">Dias corridos</option>
                    <option value="hours">Horas</option>
                    <option value="months">Meses</option>
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={addWorkflowStep}
                >
                  {workflowEditId ? <Pencil /> : <Plus />}
                  {workflowEditId ? "Salvar etapa" : "Adicionar etapa"}
                </button>
              </div>
              <div className="workflow-step-list">
                {workflowCatalog.workflow.map((step) => (
                  <article key={step.id}>
                    <i>{step.order}</i>
                    <div>
                      <b>{step.stageName}</b>
                      <span>{step.assignee}</span>
                    </div>
                    <strong>{formatSla(step.slaValue, step.slaUnit)}</strong>
                    <div className="workflow-row-actions">
                      <button
                        title="Editar etapa"
                        onClick={() => {
                          setWorkflowEditId(step.id);
                          setWorkflowStage(step.stageName);
                          setWorkflowAssignee(step.assigneeId);
                          setWorkflowSla(step.slaValue);
                          setWorkflowUnit(step.slaUnit);
                        }}
                      >
                        <Pencil />
                      </button>
                      <button
                        title="Excluir etapa"
                        onClick={() =>
                          run(
                            () =>
                              supabase
                                .from("service_catalog_workflow_steps")
                                .delete()
                                .eq("id", step.id),
                            "Etapa excluída do fluxo.",
                          )
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </article>
                ))}
                {!workflowCatalog.workflow.length && (
                  <div className="config-empty">
                    Nenhuma etapa configurada. O ticket ainda poderá ser criado
                    manualmente.
                  </div>
                )}
              </div>
              <div className="workflow-sum">
                Soma das etapas:{" "}
                <b>
                  {workflowCatalog.workflow.reduce(
                    (sum, step) =>
                      step.slaUnit === workflowCatalog.slaUnit
                        ? sum + step.slaValue
                        : sum,
                    0,
                  )}{" "}
                  {slaUnitLabels[workflowCatalog.slaUnit][1]}
                </b>
                <small>
                  Unidades diferentes são acompanhadas separadamente.
                </small>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editCatalog && (
        <Dialog open onOpenChange={(v) => !v && setEditCatalog(null)}>
          <DialogContent className="config-dialog">
            <DialogHeader>
              <DialogTitle>Editar projeto e demanda</DialogTitle>
              <DialogDescription>
                Altere os dados que aparecem no cadastro do ticket.
              </DialogDescription>
            </DialogHeader>
            <div className="config-edit-form">
              <label>
                Projeto
                <input
                  value={editCatalog.projectName}
                  onChange={(e) =>
                    setEditCatalog({
                      ...editCatalog,
                      projectName: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Demanda
                <input
                  value={editCatalog.demandName}
                  onChange={(e) =>
                    setEditCatalog({
                      ...editCatalog,
                      demandName: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Prazo do SLA
                <input
                  type="number"
                  min="1"
                  value={editCatalog.slaValue}
                  onChange={(e) =>
                    setEditCatalog({
                      ...editCatalog,
                      slaDays: Number(e.target.value),
                      slaValue: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Unidade
                <select
                  value={editCatalog.slaUnit}
                  onChange={(e) =>
                    setEditCatalog({
                      ...editCatalog,
                      slaUnit: e.target.value as SlaUnit,
                    })
                  }
                >
                  <option value="business_days">Dias úteis</option>
                  <option value="calendar_days">Dias corridos</option>
                  <option value="hours">Horas</option>
                  <option value="months">Meses</option>
                </select>
              </label>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(
                    () =>
                      supabase
                        .from("service_catalog")
                        .update({
                          project_name: editCatalog.projectName.trim(),
                          demand_name: editCatalog.demandName.trim(),
                          sla_days: editCatalog.slaDays,
                          sla_value: editCatalog.slaValue,
                          sla_unit: editCatalog.slaUnit,
                        })
                        .eq("id", editCatalog.id),
                    "Projeto e demanda atualizados.",
                  );
                  if (ok) setEditCatalog(null);
                }}
              >
                Salvar alterações
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editField && (
        <Dialog open onOpenChange={(v) => !v && setEditField(null)}>
          <DialogContent className="config-dialog">
            <DialogHeader>
              <DialogTitle>Editar campo</DialogTitle>
              <DialogDescription>
                O nome atualizado será usado no formulário e nos tickets.
              </DialogDescription>
            </DialogHeader>
            <div className="config-edit-form">
              <label>
                Nome do campo
                <input
                  value={editField.label}
                  onChange={(e) =>
                    setEditField({ ...editField, label: e.target.value })
                  }
                />
              </label>
              <label>
                Tipo
                <select
                  disabled={editField.system}
                  value={editField.type}
                  onChange={(e) =>
                    setEditField({
                      ...editField,
                      type: e.target.value as FieldDef["type"],
                    })
                  }
                >
                  <option value="text">Texto curto</option>
                  <option value="textarea">Texto longo</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                </select>
              </label>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(
                    () =>
                      supabase
                        .from("ticket_field_definitions")
                        .update({
                          label: editField.label.trim(),
                          field_type: editField.type,
                        })
                        .eq("id", editField.id),
                    "Campo atualizado.",
                  );
                  if (ok) setEditField(null);
                }}
              >
                Salvar alterações
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editArea && (
        <Dialog open onOpenChange={(v) => !v && setEditArea(null)}>
          <DialogContent className="config-dialog">
            <DialogHeader>
              <DialogTitle>Editar nome da área</DialogTitle>
              <DialogDescription>
                A alteração será refletida em todo o CRM.
              </DialogDescription>
            </DialogHeader>
            <div className="config-edit-form">
              <label>
                Nome da área
                <input
                  value={editArea.name}
                  onChange={(e) =>
                    setEditArea({ ...editArea, name: e.target.value })
                  }
                />
              </label>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(
                    () =>
                      supabase
                        .from("groups")
                        .update({ name: editArea.name.trim() })
                        .eq("id", editArea.id),
                    "Nome da área atualizado.",
                  );
                  if (ok) setEditArea(null);
                }}
              >
                Salvar alterações
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog open onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <DialogContent className="confirm-dialog">
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
              <DialogDescription>
                {deleteTarget.kind === "area"
                  ? "Ao excluir esta área, todos os tickets, integrantes e configurações vinculados também serão removidos."
                  : "Esta ação não poderá ser desfeita."}
              </DialogDescription>
            </DialogHeader>
            <div className="delete-summary">{deleteTarget.label}</div>
            <div className="confirm-actions">
              <button onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={confirmDelete}
              >
                <Trash2 />
                Excluir definitivamente
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

type UpdateValues = {
  id: string;
  status: Status;
  stage: string;
  ownerId: string;
  justification: string;
  subjectId: string;
  advance: boolean;
};
function EditProject({
  project,
  members,
  role,
  open,
  setOpen,
  onUpdate,
}: {
  project: Project;
  members: Member[];
  role: Role;
  open: boolean;
  setOpen: (v: boolean) => void;
  onUpdate: (v: UpdateValues) => Promise<void>;
}) {
  const availableStages = [
    ...new Set([...stages, ...project.workflow.map((step) => step.stageName)]),
  ];
  const [v, setV] = useState<UpdateValues>({
      id: project.id,
      status: project.status,
      stage: project.stage,
      ownerId: project.ownerId,
      justification: "",
      subjectId: "",
      advance: false,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(advance = false) {
    if (v.justification.trim().length < 3) {
      setError("A justificativa é obrigatória.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onUpdate({ ...v, advance });
    } catch (e: any) {
      setError(e.message || "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="update-dialog">
        <DialogHeader>
          <DialogTitle>Atualizar {ticket(project.ticket)}</DialogTitle>
          <DialogDescription>
            Toda troca registra quem realizou a alteração.
          </DialogDescription>
        </DialogHeader>
        <div className="form update-form">
          <div>
            <label>
              Status
              <select
                value={v.status}
                onChange={(e) =>
                  setV({ ...v, status: e.target.value as Status })
                }
              >
                {statuses.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Etapa
              <select
                value={v.stage}
                onChange={(e) => setV({ ...v, stage: e.target.value })}
              >
                {availableStages.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Responsável
            <select
              value={v.ownerId}
              onChange={(e) => setV({ ...v, ownerId: e.target.value })}
            >
              {members.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {role !== "member" && (
            <label>
              Justificativa referente a
              <select
                value={v.subjectId}
                onChange={(e) => setV({ ...v, subjectId: e.target.value })}
              >
                <option value="">Minha própria ação</option>
                {members.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <small>
                Mesmo ao justificar por outra pessoa, seu nome aparecerá como
                autor.
              </small>
            </label>
          )}
          <label>
            Justificativa obrigatória
            <textarea
              value={v.justification}
              onChange={(e) => setV({ ...v, justification: e.target.value })}
              placeholder="Explique o motivo da alteração"
            />
          </label>
          {error && <div className="auth-message">{error}</div>}
          {project.workflow.some((step) => step.status === "current") && (
            <div className="advance-summary">
              <div>
                <b>Concluir etapa atual</b>
                <span>
                  {
                    project.workflow.find((step) => step.status === "current")
                      ?.stageName
                  }
                  {project.workflow.some((step) => step.status === "pending")
                    ? " → encaminhar para a próxima pessoa"
                    : " → concluir o projeto"}
                </span>
              </div>
              <button disabled={busy} onClick={() => submit(true)}>
                <CheckCircle2 /> Concluir e encaminhar
              </button>
            </div>
          )}
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => submit(false)}
          >
            {busy ? <Loader2 /> : "Salvar alteração e justificativa"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
