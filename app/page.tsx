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
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  LayoutDashboard,
  List,
  ListChecks,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";

type Role = "super" | "admin" | "member";
type Status =
  "Aberto" | "Pendente" | "Em andamento" | "Concluído" | "Cancelado";
type Priority = "Alta" | "Média" | "Baixa";
type SlaUnit = "business_days" | "calendar_days" | "hours" | "months";
type AccessRole = "administrator" | "manager" | "member";
type Area = { id: string; name: string; color: string };
type Member = { id: string; name: string; email?: string; phone?: string; role: string; areaId: string };
type ProfileOption = { id: string; name: string; email: string; phone?: string };
type AccessEntry = {
  id: string;
  areaId: string;
  userId: string | null;
  accountCreated: boolean;
  fullName: string;
  email: string;
  phone: string;
  accessRole: AccessRole;
  createdAt: string;
};
type Label = { id: string; label_text: string; color: string };
type Attachment = {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploader: string;
  createdAt: string;
};
type Event = {
  id: string;
  eventType: string;
  justification: string;
  created_at: string;
  actorUserId: string;
  actor?: { full_name: string };
  subject?: { full_name: string };
  fromOwner?: { full_name: string };
  toOwner?: { full_name: string };
  fromStage?: string;
  toStage?: string;
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
  catalogId: string;
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
  updatedAt: string;
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
  attachments: Attachment[];
  events: Event[];
  customValues: { field_id: string; value: string }[];
};

const roleLabels: Record<Role, string> = {
  super: "Administrador",
  admin: "Gestor",
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
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
const countBusinessDays = (from: Date, to: Date) => {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  let total = 0;
  for (const cursor = new Date(start); cursor < end; ) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) total += 1;
  }
  return total;
};
const remainingSlaUnits = (from: Date, to: Date, unit: SlaUnit) => {
  const milliseconds = Math.max(0, to.getTime() - from.getTime());
  if (unit === "hours") return Math.ceil(milliseconds / 3600000);
  if (unit === "months")
    return Math.ceil(milliseconds / (30 * 24 * 3600000));
  if (unit === "business_days") return countBusinessDays(from, to);
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
};
const deadlineInfo = (
  dueAt: string | null,
  unit: SlaUnit = "calendar_days",
) => {
  if (!dueAt) return { label: "Prazo não iniciado", tone: "neutral" };
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime()))
    return { label: "Prazo não informado", tone: "neutral" };
  const now = new Date();
  const hours = Math.ceil((due.getTime() - now.getTime()) / 3600000);
  if (hours < 0)
    return {
      label: `Atrasado há ${formatSla(
        Math.max(1, remainingSlaUnits(due, now, unit)),
        unit,
      )}`,
      tone: "late",
    };
  const remaining = remainingSlaUnits(now, due, unit);
  if (remaining === 0) return { label: "Vence hoje", tone: "warning" };
  const warningLimit = unit === "hours" ? 24 : unit === "months" ? 1 : 3;
  return {
    label: `${formatSla(remaining, unit)} ${remaining === 1 ? "restante" : "restantes"}`,
    tone: remaining <= warningLimit ? "warning" : "ok",
  };
};
const timeInCurrentStep = (project: Project) => {
  const currentStep = project.workflow.find((step) => step.status === "current");
  const startedAt = currentStep?.startedAt;
  if (!startedAt) return "—";
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 86400000),
  );
  if (days === 0) return "Hoje nesta etapa";
  return `${days} ${days === 1 ? "dia" : "dias"} nesta etapa`;
};
const slaInfo = (p: Project) => {
  if (["Concluído", "Cancelado"].includes(p.status))
    return { label: p.status, tone: "neutral" };
  const currentStep = p.workflow.find((step) => step.status === "current");
  if (currentStep?.dueAt && new Date(currentStep.dueAt).getTime() < Date.now())
    return { label: "Projeto atrasado · etapa atual", tone: "late" };
  if (p.hasDelayedStep)
    return { label: "Projeto atrasado · etapa anterior", tone: "late" };
  return deadlineInfo(p.slaDueAt, p.slaUnit);
};
const eventTitle = (event: Event) => {
  switch (event.eventType) {
    case "projeto_criado":
      return event.toOwner?.full_name
        ? `Ticket criado para ${event.toOwner.full_name}`
        : "Ticket criado";
    case "etiqueta_adicionada":
      return "Etiqueta adicionada";
    case "etiqueta_removida":
      return "Etiqueta removida";
    case "transferencia":
      return `${event.fromOwner?.full_name || "Responsável anterior"} passou o processo para ${event.toOwner?.full_name || "o próximo responsável"}`;
    case "etapa_concluida":
      return "Etapa concluída e projeto finalizado";
    case "comentario":
      return "Comentário";
    default:
      return "Projeto atualizado";
  }
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
  const [platformRole, setPlatformRole] = useState("member"),
    [name, setName] = useState(user.email?.split("@")[0] || "Usuário"),
    [areas, setAreas] = useState<Area[]>([]),
    [areaId, setAreaId] = useState(""),
    [members, setMembers] = useState<Member[]>([]),
    [profiles, setProfiles] = useState<ProfileOption[]>([]),
    [accesses, setAccesses] = useState<AccessEntry[]>([]),
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
    [detailProject, setDetailProject] = useState<Project | null>(null),
    [deleteProject, setDeleteProject] = useState<Project | null>(null),
    [deletingProject, setDeletingProject] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [labelProject, setLabelProject] = useState(""),
    [labelText, setLabelText] = useState(""),
    [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const role: Role =
    platformRole === "super_admin"
      ? "super"
      : members.some(
            (member) =>
              member.areaId === areaId &&
              member.id === user.id &&
              member.role === "admin",
          )
        ? "admin"
        : "member";
  async function load() {
    setLoading(true);
    setError("");
    const [pr, ar, mr, jr, cr, fr, ur, aa] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,platform_role")
        .eq("id", user.id)
        .single(),
      supabase.from("groups").select("id,name,color").order("created_at"),
      supabase
        .from("group_members")
        .select(
          "group_id,role,user_id,profile:profiles!group_members_user_id_fkey(id,full_name,email,phone)",
        ),
      supabase
        .from("projects")
        .select(
          "id,catalog_id,ticket_number,sei_number,name,demand,status,priority,progress,opened_at,updated_at,sla_days,sla_value,sla_unit,sla_due_at,has_delayed_step,stage,observation,group_id,owner_id,owner:profiles!projects_owner_id_fkey(full_name),workflow:project_workflow_steps(id,step_order,stage_name,assignee_id,sla_value,sla_unit,status,started_at,due_at,completed_at,completed_late,assignee:profiles!project_workflow_steps_assignee_id_fkey(full_name)),labels:project_labels(id,label_text,color),attachments:project_attachments(id,storage_path,file_name,mime_type,size_bytes,uploaded_by,created_at,uploader:profiles!project_attachments_uploaded_by_fkey(full_name)),events:project_events(id,event_type,justification,created_at,actor_user_id,from_stage,to_stage,actor:profiles!project_events_actor_user_id_fkey(full_name),subject:profiles!project_events_subject_user_id_fkey(full_name),from_owner:profiles!project_events_from_owner_id_fkey(full_name),to_owner:profiles!project_events_to_owner_id_fkey(full_name)),custom_values:project_field_values(field_id,value)",
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
      supabase.from("profiles").select("id,email,full_name,phone,auth_user_id").order("full_name"),
      supabase
        .from("area_accesses")
        .select("id,area_id,user_id,full_name,email,phone,access_role,created_at")
        .order("full_name"),
    ]);
    if (pr.data) {
      setName(pr.data.full_name || user.email);
      setPlatformRole(pr.data.platform_role);
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
        email: m.profile?.email || "",
        phone: m.profile?.phone || "",
        role: m.role,
        areaId: m.group_id,
      })),
    );
    setProfiles(
      (ur.data || []).map((profile: any) => ({
        id: profile.id,
        name: profile.full_name || profile.email,
        email: profile.email,
        phone: profile.phone || "",
      })),
    );
    setAccesses(
      (aa.data || []).map((access: any) => ({
        id: access.id,
        areaId: access.area_id,
        userId: access.user_id,
        accountCreated: Boolean((ur.data || []).find((profile: any) => profile.id === access.user_id)?.auth_user_id),
        fullName: access.full_name,
        email: access.email,
        phone: access.phone || "",
        accessRole: access.access_role,
        createdAt: access.created_at,
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
    else {
      const mappedProjects: Project[] = (jr.data || []).map((p: any) => ({
          id: p.id,
          catalogId: p.catalog_id || "",
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
          updatedAt: p.updated_at,
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
          attachments: (p.attachments || [])
            .map((attachment: any) => ({
              id: attachment.id,
              storagePath: attachment.storage_path,
              fileName: attachment.file_name,
              mimeType: attachment.mime_type || "application/octet-stream",
              sizeBytes: attachment.size_bytes,
              uploadedBy: attachment.uploaded_by,
              uploader: attachment.uploader?.full_name || "Usuário",
              createdAt: attachment.created_at,
            }))
            .sort(
              (a: Attachment, b: Attachment) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          events: (p.events || [])
            .map((event: any) => ({
              id: event.id,
              eventType: event.event_type,
              justification: event.justification,
              created_at: event.created_at,
              actorUserId: event.actor_user_id,
              actor: event.actor,
              subject: event.subject,
              fromOwner: event.from_owner,
              toOwner: event.to_owner,
              fromStage: event.from_stage,
              toStage: event.to_stage,
            }))
            .sort(
              (a: Event, b: Event) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            ),
        customValues: p.custom_values || [],
      }));
      setAllProjects(mappedProjects);
      setDetailProject((opened) =>
        opened
          ? mappedProjects.find((project) => project.id === opened.id) || null
          : null,
      );
    }
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
      : await supabase.rpc("update_project_details_with_justification", {
          p_project_id: v.id,
          p_catalog_id: v.catalogId,
          p_sei_number: v.sei || null,
          p_opened_at: v.openedAt,
          p_status: v.status,
          p_stage: v.stage,
          p_owner_id: v.ownerId || null,
          p_observation: v.observation || null,
          p_priority: v.priority,
          p_custom_values: v.custom,
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
  async function removeProject(project: Project) {
    setDeletingProject(true);
    setError("");
    try {
      const storagePaths = project.attachments.map(
        (attachment) => attachment.storagePath,
      );
      if (storagePaths.length) {
        const { error: storageError } = await supabase.storage
          .from("project-attachments")
          .remove(storagePaths);
        if (storageError) throw storageError;
      }
      const { data, error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id)
        .select("id")
        .single();
      if (deleteError) throw deleteError;
      if (!data)
        throw new Error("Você não possui permissão para excluir este projeto.");
      setDeleteProject(null);
      if (detailProject?.id === project.id) setDetailProject(null);
      setNotice(`${ticket(project.ticket)} — ${project.name} foi excluído.`);
      await load();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir este projeto.",
      );
    } finally {
      setDeletingProject(false);
    }
  }
  async function addLabel(projectId: string) {
    if (!labelText.trim()) return;
    const { error } = await supabase.rpc("add_project_label_with_event", {
      p_project_id: projectId,
      p_label_text: labelText.trim(),
    });
    if (error) {
      setError(error.message);
      return;
    }
    setLabelText("");
    setLabelProject("");
    setNotice("Etiqueta adicionada e registrada no histórico.");
    await load();
  }
  async function removeLabel(labelId: string) {
    const { error } = await supabase.rpc("remove_project_label_with_event", {
      p_label_id: labelId,
    });
    if (error) return setError(error.message);
    setNotice("Etiqueta removida e registrada no histórico.");
    await load();
  }
  async function addComment(projectId: string) {
    const comment = commentDrafts[projectId]?.trim();
    if (!comment) return;
    const { error } = await supabase.rpc("add_project_comment", {
      p_project_id: projectId,
      p_comment: comment,
      p_subject_user_id: null,
    });
    if (error) return setError(error.message);
    setCommentDrafts((drafts) => ({ ...drafts, [projectId]: "" }));
    setNotice("Comentário registrado no histórico.");
    await load();
  }
  async function removeComment(eventId: string) {
    const { data, error } = await supabase
      .from("project_events")
      .delete()
      .eq("id", eventId)
      .eq("event_type", "comentario")
      .select("id")
      .single();
    if (error) throw error;
    if (!data)
      throw new Error("Este comentário não pode ser excluído por este acesso.");
    setNotice("Comentário excluído.");
    await load();
  }
  async function uploadAttachment(project: Project, file: File) {
    if (file.size > 10 * 1024 * 1024)
      throw new Error("O anexo deve ter no máximo 10 MB.");
    const safeName =
      file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .slice(-120) || "arquivo";
    const storagePath = `${project.areaId}/${project.id}/${crypto.randomUUID()}-${safeName}`;
    const bucket = supabase.storage.from("project-attachments");
    const { error: uploadError } = await bucket.upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { error: metadataError } = await supabase
      .from("project_attachments")
      .insert({
        project_id: project.id,
        group_id: project.areaId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        uploaded_by: user.id,
      });
    if (metadataError) {
      await bucket.remove([storagePath]);
      throw metadataError;
    }
    setNotice("Anexo incluído com sucesso.");
    await load();
  }
  async function downloadAttachment(attachment: Attachment) {
    const { data, error } = await supabase.storage
      .from("project-attachments")
      .download(attachment.storagePath);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function removeAttachment(attachment: Attachment) {
    const bucket = supabase.storage.from("project-attachments");
    const { error: storageError } = await bucket.remove([attachment.storagePath]);
    if (storageError) throw storageError;
    const { error: metadataError } = await supabase
      .from("project_attachments")
      .delete()
      .eq("id", attachment.id);
    if (metadataError) throw metadataError;
    setNotice("Anexo removido.");
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
              accesses={accesses}
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
              openProject={setDetailProject}
              requestDelete={setDeleteProject}
              canDelete={role !== "member"}
              fields={areaFields}
            />
          )}
        </div>
      </main>
      {editProject && (
        <EditProject
          advanceOnly
          project={editProject}
          members={areaMembers}
          catalog={areaCatalog}
          fields={areaFields}
          role={role}
          open={!!editProject}
          setOpen={(v) => !v && setEditProject(null)}
          onUpdate={updateProject}
        />
      )}
      {detailProject && (
        <ProjectDetail
          project={detailProject}
          fields={areaFields}
          members={areaMembers}
          open={!!detailProject}
          setOpen={(value) => {
            if (!value) {
              setDetailProject(null);
              setLabelProject("");
              setLabelText("");
            }
          }}
          edit={(project) => {
            setDetailProject(null);
            setEditProject(project);
          }}
          labelProject={labelProject}
          setLabelProject={setLabelProject}
          labelText={labelText}
          setLabelText={setLabelText}
          addLabel={addLabel}
          removeLabel={removeLabel}
          commentDrafts={commentDrafts}
          setCommentDrafts={setCommentDrafts}
          addComment={addComment}
          removeComment={removeComment}
          canDeleteComment={(event) =>
            event.eventType === "comentario" &&
            event.actorUserId === user.id
          }
          quickUpdate={async ({ status, sei, ownerId, justification }) =>
            updateProject({
              id: detailProject.id,
              catalogId: detailProject.catalogId,
              sei,
              openedAt: detailProject.openedAt,
              status,
              stage: detailProject.stage,
              ownerId,
              observation: detailProject.observation,
              priority: detailProject.priority,
              custom: Object.fromEntries(
                detailProject.customValues.map((value) => [value.field_id, value.value]),
              ),
              justification,
              subjectId: "",
              advance: false,
            })
          }
          uploadAttachment={uploadAttachment}
          downloadAttachment={downloadAttachment}
          removeAttachment={removeAttachment}
          canDeleteAttachment={(attachment) =>
            attachment.uploadedBy === user.id || role !== "member"
          }
        />
      )}
      <AlertDialog
        open={!!deleteProject}
        onOpenChange={(open) => {
          if (!open && !deletingProject) setDeleteProject(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProject
                ? `${ticket(deleteProject.ticket)} — ${deleteProject.name} e todo o seu histórico, etapas, comentários e anexos serão excluídos permanentemente.`
                : "Este projeto será excluído permanentemente."}{" "}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProject}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="delete-confirm"
              disabled={deletingProject}
              onClick={(event) => {
                event.preventDefault();
                if (deleteProject) void removeProject(deleteProject);
              }}
            >
              {deletingProject ? <Loader2 className="spin" /> : <Trash2 />}
              {deletingProject ? "Excluindo..." : "Excluir projeto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  openProject?: (p: Project) => void;
  requestDelete?: (p: Project) => void;
  canDelete?: boolean;
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
      {mode === "list" ? <ProjectTable {...rest} /> : <Kanban {...rest} />}
    </section>
  );
}

function ProjectTable({
  projects,
  openProject,
  requestDelete,
  canDelete,
}: ListProps) {
  return (
    <div className="project-table-wrap">
      <div className="project-table">
        <div className="project-table-head">
          <span>Projeto</span>
          <span>Etapas</span>
          <span>Status</span>
          <span>Última atualização</span>
          <span>Responsável</span>
          <span>Prioridade</span>
          <span aria-label="Excluir projeto" title="Excluir projeto">
            <Trash2 />
          </span>
        </div>
        {projects.length ? (
          projects.map((project) => {
            const flow = project.workflow.length
              ? project.workflow
              : stages.map((stageName, order) => ({
                  id: stageName,
                  stageName,
                  order,
                  status:
                    order <= stages.indexOf(project.stage)
                      ? "completed"
                      : "pending",
                  completedLate: false,
                }));
            return (
              <article
                className="project-table-row"
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => openProject?.(project)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProject?.(project);
                  }
                }}
              >
                <div className="project-cell-name">
                  <ProjectLabels labels={project.labels} />
                  <b>{project.name}</b>
                  <small>{ticket(project.ticket)}{project.sei ? ` · SEI ${project.sei}` : ""}</small>
                  <p>{project.demand}</p>
                </div>
                <div className="table-stage-flow">
                  {flow.map((step, index) => (
                    <div
                      className={`${step.status === "current" || step.status === "completed" ? "active" : ""} ${step.status === "current" ? "current" : ""} ${step.completedLate ? "late-step" : ""}`}
                      key={step.id}
                      title={step.stageName}
                    >
                      <i>{step.status === "completed" ? "✓" : ""}</i>
                      {index < flow.length - 1 && <span />}
                      <small>{step.stageName}</small>
                    </div>
                  ))}
                </div>
                <div className="table-status">
                  <span className={`pill ${statusConfig[project.status].className}`}>
                    {project.status}
                  </span>
                  <small>{timeInCurrentStep(project)}</small>
                </div>
                <time>
                  {new Date(project.updatedAt).toLocaleDateString("pt-BR")}
                </time>
                <div className="table-owner">
                  <i>{initials(project.owner)}</i>
                  <span>{project.owner}</span>
                </div>
                <span className={`priority-pill ${project.priority.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>
                  {project.priority}
                </span>
                {canDelete ? (
                  <button
                    className="table-more project-delete"
                    title="Excluir projeto"
                    aria-label={`Excluir projeto ${project.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDelete?.(project);
                    }}
                  >
                    <Trash2 />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </article>
            );
          })
        ) : (
          <div className="empty-projects">Nenhum projeto nesta área.</div>
        )}
      </div>
      {projects.length > 0 && (
        <footer className="project-table-footer">
          <span>Mostrando {projects.length} {projects.length === 1 ? "projeto" : "projetos"}</span>
          <div><button disabled>‹</button><b>1</b><button disabled>›</button></div>
        </footer>
      )}
    </div>
  );
}
function ProjectLabels({ labels }: { labels: Label[] }) {
  if (!labels.length) return null;
  return (
    <div className="project-row-labels" aria-label="Etiquetas do projeto">
      {labels.map((label) => (
        <span
          key={label.id}
          title={label.label_text}
          style={{ backgroundColor: label.color || "#e3ece7" }}
        >
          {label.label_text}
        </span>
      ))}
    </div>
  );
}
function Kanban({
  projects,
  openProject,
  requestDelete,
  canDelete,
}: ListProps) {
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
                <article
                  className="kanban-card"
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProject?.(p)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openProject?.(p);
                    }
                  }}
                >
                  <div className="kanban-card-top">
                    <span>{ticket(p.ticket)}</span>
                    {canDelete && (
                      <button
                        className="kanban-delete"
                        title="Excluir projeto"
                        aria-label={`Excluir projeto ${p.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          requestDelete?.(p);
                        }}
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                  <ProjectLabels labels={p.labels} />
                  <h3>{p.name}</h3>
                  <p>{p.demand}</p>
                  <footer>
                    <small>{slaInfo(p).label}</small>
                    <i>{initials(p.owner)}</i>
                  </footer>
                </article>
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
  openProject,
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
              ? deadlineInfo(currentStep.dueAt, currentStep.slaUnit)
              : { label: "Sem etapa ativa", tone: "neutral" };
          return (
            <article
              className={`ticket-card summary-card ${openProject ? "clickable" : ""}`}
              key={p.id}
              role={openProject ? "button" : undefined}
              tabIndex={openProject ? 0 : undefined}
              onClick={() => openProject?.(p)}
              onKeyDown={(event) => {
                if (openProject && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  openProject(p);
                }
              }}
            >
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
                  {openProject && <Eye className="open-process-icon" />}
                </div>
              </div>
              <div className={`ticket-meta summary-meta ${compact ? "compact" : ""}`}>
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
              </div>
              {!compact && p.labels.length > 0 && (
                <div className="summary-labels">
                  {p.labels.slice(0, 4).map((label) => (
                    <span key={label.id}>{label.label_text}</span>
                  ))}
                </div>
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

type ProjectDetailProps = {
  project: Project;
  fields: FieldDef[];
  members: Member[];
  open: boolean;
  setOpen: (open: boolean) => void;
  edit: (project: Project) => void;
  labelProject: string;
  setLabelProject: (id: string) => void;
  labelText: string;
  setLabelText: (value: string) => void;
  addLabel: (id: string) => void;
  removeLabel: (id: string) => void;
  commentDrafts: Record<string, string>;
  setCommentDrafts: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  addComment: (id: string) => void;
  removeComment: (eventId: string) => Promise<void>;
  canDeleteComment: (event: Event) => boolean;
  quickUpdate: (value: {
    status: Status;
    sei: string;
    ownerId: string;
    justification: string;
  }) => Promise<void>;
  uploadAttachment: (project: Project, file: File) => Promise<void>;
  downloadAttachment: (attachment: Attachment) => Promise<void>;
  removeAttachment: (attachment: Attachment) => Promise<void>;
  canDeleteAttachment: (attachment: Attachment) => boolean;
};

function ProjectDetail({
  project,
  fields,
  members,
  open,
  setOpen,
  edit,
  labelProject,
  setLabelProject,
  labelText,
  setLabelText,
  addLabel,
  removeLabel,
  commentDrafts,
  setCommentDrafts,
  addComment,
  removeComment,
  canDeleteComment,
  quickUpdate,
  uploadAttachment,
  downloadAttachment,
  removeAttachment,
  canDeleteAttachment,
}: ProjectDetailProps) {
  const show = (key: string) => fields.some((field) => field.key === key && field.visible);
  const sla = slaInfo(project);
  const currentStep = project.workflow.find((step) => step.status === "current");
  const stepSla = currentStep
    ? deadlineInfo(currentStep.dueAt, currentStep.slaUnit)
    : { label: "Sem etapa ativa", tone: "neutral" };
  const currentStepLate = stepSla.tone === "late";
  const custom = project.customValues
    .map((value) => ({
      value: value.value,
      field: fields.find((field) => field.id === value.field_id),
    }))
    .filter((item) => item.field?.visible);
  const [quickEdit, setQuickEdit] = useState<"status" | "sei" | "owner" | null>(null);
  const [quickStatus, setQuickStatus] = useState<Status>(project.status);
  const [quickSei, setQuickSei] = useState(project.sei);
  const [quickOwnerId, setQuickOwnerId] = useState(project.ownerId);
  const [quickJustification, setQuickJustification] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [attachmentBusy, setAttachmentBusy] = useState("");
  const [commentToDelete, setCommentToDelete] = useState<Event | null>(null);
  const [commentDeleteBusy, setCommentDeleteBusy] = useState(false);
  const [commentDeleteError, setCommentDeleteError] = useState("");
  const timelineStatuses: Status[] = [
    "Aberto",
    "Pendente",
    "Em andamento",
    "Concluído",
    "Cancelado",
  ];
  const timelineIndex = timelineStatuses.indexOf(project.status);

  async function saveQuickEdit() {
    if (quickJustification.trim().length < 3) {
      setQuickError("Informe uma justificativa para registrar a alteração.");
      return;
    }
    setQuickBusy(true);
    setQuickError("");
    try {
      await quickUpdate({
        status: quickStatus,
        sei: quickSei,
        ownerId: quickOwnerId,
        justification: quickJustification.trim(),
      });
      setQuickEdit(null);
      setQuickJustification("");
    } catch (error: any) {
      setQuickError(error.message || "Não foi possível salvar a alteração.");
    } finally {
      setQuickBusy(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="process-dialog">
        <DialogHeader className="process-header">
          <DialogTitle className="sr-only">Processo {ticket(project.ticket)}</DialogTitle>
          <DialogDescription className="sr-only">Detalhes, prazos e histórico do processo.</DialogDescription>
          <div className="process-header-start">
            <div className="process-kicker">
              <span>{ticket(project.ticket)}</span>
            </div>
            {show("labels") && (
              <div className="header-label-control">
                <button
                  className="header-label-trigger"
                  onClick={() => setLabelProject(labelProject === project.id ? "" : project.id)}
                  aria-expanded={labelProject === project.id}
                >
                  <Tag /> Etiqueta
                </button>
                {labelProject === project.id && (
                  <div className="header-label-popover">
                    <b>Etiquetas do ticket</b>
                    <div className="label-chips">
                      {project.labels.map((label) => (
                        <span key={label.id}>
                          <Tag />
                          {label.label_text}
                          <button
                            title={`Remover etiqueta ${label.label_text}`}
                            aria-label={`Remover etiqueta ${label.label_text}`}
                            onClick={() => removeLabel(label.id)}
                          ><X /></button>
                        </span>
                      ))}
                      {!project.labels.length && <small>Nenhuma etiqueta adicionada.</small>}
                    </div>
                    <div className="label-add">
                      <input
                        autoFocus
                        maxLength={120}
                        value={labelText}
                        onChange={(event) => setLabelText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") addLabel(project.id);
                        }}
                        placeholder="Nome da etiqueta"
                      />
                      <button onClick={() => addLabel(project.id)}>Adicionar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="process-layout process-three-columns">
          <section className="process-column process-ticket-column">
            <header className="process-column-title">
              <div><span>1</span><div><b>Informações do ticket</b><small>Dados preenchidos na abertura</small></div></div>
            </header>
            <div className="ticket-primary-fields">
              <article>
                <b>Nome do projeto</b>
                <span>{project.name}</span>
              </article>
              <article>
                <b>Demanda</b>
                <span>{project.demand}</span>
              </article>
              <article className="editable-ticket-field">
                <b>Status</b>
                <button onClick={() => {
                  setQuickStatus(project.status);
                  setQuickSei(project.sei);
                  setQuickOwnerId(project.ownerId);
                  setQuickJustification("");
                  setQuickError("");
                  setQuickEdit("status");
                }}>
                  <span className={`pill ${statusConfig[project.status].className}`}>{project.status}</span>
                  <Pencil />
                </button>
              </article>
              <article className="editable-ticket-field">
                <b>Nº do SEI</b>
                <button onClick={() => {
                  setQuickStatus(project.status);
                  setQuickSei(project.sei);
                  setQuickOwnerId(project.ownerId);
                  setQuickJustification("");
                  setQuickError("");
                  setQuickEdit("sei");
                }}>
                  <span>{project.sei || "Não informado"}</span>
                  <Pencil />
                </button>
              </article>
            </div>
            {quickEdit && quickEdit !== "owner" && (
              <div className="quick-ticket-editor">
                <header>
                  <b>{quickEdit === "status" ? "Editar status" : "Editar nº do SEI"}</b>
                  <button onClick={() => setQuickEdit(null)} aria-label="Fechar edição"><X /></button>
                </header>
                {quickEdit === "status" ? (
                  <label>Status
                    <select value={quickStatus} onChange={(event) => setQuickStatus(event.target.value as Status)}>
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                ) : (
                  <label>Nº do SEI
                    <input autoFocus value={quickSei} onChange={(event) => setQuickSei(event.target.value)} placeholder="Informe o número do SEI" />
                  </label>
                )}
                <label>Justificativa da alteração
                  <textarea value={quickJustification} onChange={(event) => setQuickJustification(event.target.value)} placeholder="Explique por que este dado foi alterado" />
                </label>
                {quickError && <small className="quick-edit-error">{quickError}</small>}
                <button className="quick-edit-save" disabled={quickBusy} onClick={saveQuickEdit}>
                  {quickBusy ? <Loader2 /> : null} Salvar alteração
                </button>
              </div>
            )}
            <div className="ticket-secondary-fields">
              {show("openedAt") && (
                <div><b>Data de abertura</b><span>{new Date(project.openedAt + "T12:00:00").toLocaleDateString("pt-BR")}</span></div>
              )}
              {project.workflow.some((step) => step.status === "current") && (
                <button className="primary wide ticket-advance" onClick={() => edit(project)}>
                  <CheckCircle2 />
                  {project.workflow.some((step) => step.status === "pending")
                    ? "Encaminhar para próxima etapa"
                    : "Concluir projeto"}
                </button>
              )}
              <div><b>Prioridade</b><span>{project.priority}</span></div>
              {custom.map((item) => (
                <div key={item.field!.id}><b>{item.field!.label}</b><span>{item.value || "—"}</span></div>
              ))}
            </div>
          </section>

          <section className="process-column process-main process-sla-column">
            <section className="process-section process-stage-summary">
              <header>
                <div><span className="division-number">2</span><div><b>Etapa atual</b><small>Andamento e prazos do processo</small></div></div>
              </header>
              <button className="current-stage-owner" onClick={() => {
                setQuickStatus(project.status);
                setQuickSei(project.sei);
                setQuickOwnerId(project.ownerId);
                setQuickJustification("");
                setQuickError("");
                setQuickEdit("owner");
              }}>
                <span><Users />Responsável atual</span>
                <b>{project.owner}</b>
                <small>{currentStep ? `${formatSla(currentStep.slaValue, currentStep.slaUnit)} · ${stepSla.label}` : "Sem etapa de SLA ativa"}</small>
                <Pencil />
              </button>
              {quickEdit === "owner" && (
                <div className="quick-ticket-editor owner-quick-editor">
                  <header>
                    <b>Alterar responsável atual</b>
                    <button onClick={() => setQuickEdit(null)} aria-label="Fechar edição"><X /></button>
                  </header>
                  <label>Responsável
                    <select value={quickOwnerId} onChange={(event) => setQuickOwnerId(event.target.value)}>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </label>
                  <label>Justificativa da transferência
                    <textarea value={quickJustification} onChange={(event) => setQuickJustification(event.target.value)} placeholder="Explique por que o processo será transferido" />
                  </label>
                  {quickError && <small className="quick-edit-error">{quickError}</small>}
                  <button className="quick-edit-save" disabled={quickBusy || !quickOwnerId} onClick={saveQuickEdit}>
                    {quickBusy ? <Loader2 /> : null} Salvar transferência
                  </button>
                </div>
              )}
              <div className="status-pipeline" aria-label={`Esteira do processo: ${project.status}`}>
                <div className="status-pipeline-title"><Activity /><span><b>Esteira do processo</b><small>Atualizada automaticamente pelo status</small></span></div>
                <div className="status-pipeline-track">
                  {timelineStatuses.map((status, index) => {
                    const cancelled = project.status === "Cancelado";
                    const state = cancelled
                      ? status === "Cancelado" ? "current cancelled" : ""
                      : status === "Cancelado" ? "" : index < timelineIndex ? "completed" : index === timelineIndex ? "current" : "";
                    return <div className={`status-pipeline-step ${state}`} key={status}><i>{state.includes("completed") ? <CheckCircle2 /> : <span />}</i><small>{status}</small></div>;
                  })}
                </div>
              </div>
            </section>

            <section className="process-section">
              <div className="section-title-row">
                <div>
                  <h3>SLAs e responsáveis</h3>
                  <p>Prazos configurados para o projeto e para cada etapa.</p>
                </div>
                <span className={`sla-summary ${sla.tone}`}>{sla.label}</span>
              </div>
              <div className="project-sla-total">
                <div><Clock3 /><span><small>SLA total do projeto e da demanda</small><b>{formatSla(project.slaValue, project.slaUnit)}</b></span></div>
                <strong className={sla.tone}>{sla.label}</strong>
              </div>
              {project.workflow.length ? (
                <div className="sla-step-list">
                  {project.workflow.map((step) => {
                    const deadline = deadlineInfo(step.dueAt, step.slaUnit);
                    const state = step.status === "completed"
                      ? step.completedLate ? "Concluída com atraso" : "Concluída no prazo"
                      : step.status === "current" ? "Etapa atual" : "Aguardando início";
                    return (
                      <article className={step.status === "current" ? "current" : ""} key={step.id}>
                        <i>{step.order}</i>
                        <div><b>{step.stageName}</b><span>{step.assignee}</span></div>
                        <div><small>SLA da etapa</small><strong>{formatSla(step.slaValue, step.slaUnit)}</strong></div>
                        <div><small>Situação</small><strong className={step.completedLate ? "late" : deadline.tone}>{state}{step.status === "current" ? ` · ${deadline.label}` : ""}</strong></div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="process-observation">Nenhum fluxo por responsável foi configurado para este projeto.</p>
              )}
              {project.hasDelayedStep && currentStep && stepSla.tone !== "late" && (
                <div className="sla-history-note">
                  <Clock3 />
                  <div><b>Projeto atrasado por etapa anterior</b><span>A etapa atual de {currentStep.assignee} continua dentro do prazo.</span></div>
                </div>
              )}
            </section>

            <section className="process-section attachments-section">
              <div className="section-title-row">
                <div><h3>Anexos</h3><p>Arquivos privados deste ticket.</p></div>
                <label className={`attachment-upload ${attachmentBusy === "upload" ? "busy" : ""}`}>
                  {attachmentBusy === "upload" ? <Loader2 /> : <Upload />} Adicionar anexo
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    disabled={!!attachmentBusy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      setAttachmentBusy("upload");
                      setQuickError("");
                      try { await uploadAttachment(project, file); }
                      catch (error: any) { setQuickError(error.message || "Não foi possível enviar o anexo."); }
                      finally { setAttachmentBusy(""); }
                    }}
                  />
                </label>
              </div>
              {quickError && !quickEdit && <small className="quick-edit-error">{quickError}</small>}
              {project.attachments.length ? (
                <div className="attachment-list">
                  {project.attachments.map((attachment) => (
                    <article key={attachment.id}>
                      <FileText />
                      <div><b>{attachment.fileName}</b><small>{formatBytes(attachment.sizeBytes)} · {attachment.uploader} · {new Date(attachment.createdAt).toLocaleDateString("pt-BR")}</small></div>
                      <button title="Baixar anexo" disabled={!!attachmentBusy} onClick={async () => {
                        setAttachmentBusy(attachment.id);
                        try { await downloadAttachment(attachment); }
                        catch (error: any) { setQuickError(error.message || "Não foi possível baixar o anexo."); }
                        finally { setAttachmentBusy(""); }
                      }}>{attachmentBusy === attachment.id ? <Loader2 /> : <Download />}</button>
                      {canDeleteAttachment(attachment) && (
                        <button className="delete" title="Excluir anexo" disabled={!!attachmentBusy} onClick={async () => {
                          setAttachmentBusy(attachment.id);
                          try { await removeAttachment(attachment); }
                          catch (error: any) { setQuickError(error.message || "Não foi possível excluir o anexo."); }
                          finally { setAttachmentBusy(""); }
                        }}><Trash2 /></button>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="attachment-empty"><Paperclip /><span>Nenhum anexo incluído.</span></div>
              )}
            </section>
          </section>

          <aside className="process-activity">
            <header>
              <div><span className="division-number">3</span><MessageCircle /><b>Comentários e histórico</b></div>
              <small>{project.events.length} registros</small>
            </header>
            {currentStepLate && (
              <div className="late-comment-warning"><Clock3 />Esta etapa está atrasada. Registre a justificativa abaixo.</div>
            )}
            <div className="comment-composer process-comment">
              <textarea
                value={commentDrafts[project.id] || ""}
                onChange={(event) => setCommentDrafts((drafts) => ({ ...drafts, [project.id]: event.target.value }))}
                maxLength={2000}
                placeholder={currentStepLate ? "Justifique o atraso desta etapa..." : "Adicione um comentário..."}
              />
              <button onClick={() => addComment(project.id)} disabled={(commentDrafts[project.id]?.trim().length || 0) < 3}><Send />Comentar</button>
            </div>
            {project.events.length ? (
              <div className="activity-list">
                {project.events.map((event) => (
                  <article className="activity-item" key={event.id}>
                    <i>{event.eventType === "comentario" ? <MessageCircle /> : <Activity />}</i>
                    <div>
                      <div className="activity-item-title">
                        <b>{eventTitle(event)}</b>
                        {canDeleteComment(event) && (
                          <button
                            className="activity-delete"
                            title="Excluir comentário"
                            aria-label="Excluir comentário"
                            onClick={() => {
                              setCommentDeleteError("");
                              setCommentToDelete(event);
                            }}
                          >
                            <Trash2 />
                          </button>
                        )}
                      </div>
                      <p>{event.justification}</p>
                      <small>
                        {event.subject?.full_name && event.subject.full_name !== event.actor?.full_name
                          ? `Referente a ${event.subject.full_name} · `
                          : ""}
                        Registrado por <strong>{event.actor?.full_name || "Usuário"}</strong> em {new Date(event.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="activity-empty">O histórico começa com o primeiro comentário ou alteração.</p>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog
      open={!!commentToDelete}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen && !commentDeleteBusy) setCommentToDelete(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
          <AlertDialogDescription>
            O comentário escrito será excluído permanentemente. Os registros
            automáticos do processo não podem ser apagados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {commentDeleteError && (
          <div className="quick-edit-error">{commentDeleteError}</div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={commentDeleteBusy}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="delete-confirm"
            disabled={commentDeleteBusy}
            onClick={async (event) => {
              event.preventDefault();
              if (!commentToDelete) return;
              setCommentDeleteBusy(true);
              setCommentDeleteError("");
              try {
                await removeComment(commentToDelete.id);
                setCommentToDelete(null);
              } catch (error: unknown) {
                setCommentDeleteError(
                  error instanceof Error
                    ? error.message
                    : "Não foi possível excluir o comentário.",
                );
              } finally {
                setCommentDeleteBusy(false);
              }
            }}
          >
            {commentDeleteBusy ? <Loader2 className="spin" /> : <Trash2 />}
            {commentDeleteBusy ? "Excluindo..." : "Excluir comentário"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
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
  accessMembers,
  profiles,
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
  accessMembers: Member[];
  profiles: ProfileOption[];
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
    [accessUserId, setAccessUserId] = useState(""),
    [accessRole, setAccessRole] = useState<"admin" | "member">("member"),
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
  async function addAccess() {
    if (!areaId || !accessUserId) return fail("Selecione um usuário para liberar o acesso.");
    await run(
      () => supabase.from("group_members").upsert(
        { group_id: areaId, user_id: accessUserId, role: accessRole },
        { onConflict: "group_id,user_id" },
      ),
      "Acesso à área atualizado.",
    );
    setAccessUserId("");
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
            Áreas e acessos
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
          <div className="access-manager">
            <header>
              <div>
                <h3>Acessos da área selecionada</h3>
                <p>Libere perfis para testar a visão de Admin ou Membro em {areas.find((area) => area.id === areaId)?.name || "esta área"}.</p>
              </div>
              <span>{accessMembers.length} {accessMembers.length === 1 ? "acesso" : "acessos"}</span>
            </header>
            <div className="access-form">
              <label>
                Usuário cadastrado
                <select value={accessUserId} onChange={(event) => setAccessUserId(event.target.value)}>
                  <option value="">Selecione um usuário</option>
                  {profiles
                    .filter((profile) => !accessMembers.some((member) => member.id === profile.id))
                    .map((profile) => <option value={profile.id} key={profile.id}>{profile.name} — {profile.email}</option>)}
                </select>
              </label>
              <label>
                Perfil de acesso
                <select value={accessRole} onChange={(event) => setAccessRole(event.target.value as "admin" | "member")}>
                  <option value="member">Membro</option>
                  <option value="admin">Admin da área</option>
                </select>
              </label>
              <button className="primary" disabled={busy || !accessUserId} onClick={addAccess}><Plus /> Liberar acesso</button>
            </div>
            <div className="access-list">
              {accessMembers.map((member) => (
                <div className="access-row" key={member.id}>
                  <i>{initials(member.name)}</i>
                  <div><b>{member.name}</b><small>{member.email || "Usuário cadastrado"}</small></div>
                  <select
                    value={member.role}
                    onChange={(event) => run(
                      () => supabase.from("group_members").update({ role: event.target.value }).eq("group_id", areaId).eq("user_id", member.id),
                      "Perfil de acesso atualizado.",
                    )}
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin da área</option>
                  </select>
                  <button
                    title={`Remover acesso de ${member.name}`}
                    onClick={() => run(
                      () => supabase.from("group_members").delete().eq("group_id", areaId).eq("user_id", member.id),
                      "Acesso removido.",
                    )}
                  ><Trash2 /></button>
                </div>
              ))}
              {!accessMembers.length && <div className="config-empty">Nenhum acesso específico nesta área.</div>}
            </div>
          </div>
        </div>
      )}
      {tab === "areas" && role === "super" && (
        <div className="settings-card">
          <header>
            <div>
              <h2>Áreas e acessos</h2>
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
  accesses,
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
  accesses: AccessEntry[];
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
  const [accessAreaId, setAccessAreaId] = useState(areaId);
  const [accessName, setAccessName] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessPhone, setAccessPhone] = useState("");
  const [accessRole, setAccessRole] = useState<AccessRole>("member");
  const [editingAccessId, setEditingAccessId] = useState<string | null>(null);
  const [showAccessForm, setShowAccessForm] = useState(false);
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
  const selectedAreaAccesses = accesses.filter(
    (access) => access.areaId === accessAreaId,
  );

  useEffect(() => {
    if (!areas.some((area) => area.id === accessAreaId)) {
      setAccessAreaId(areas[0]?.id || "");
    }
  }, [areas, accessAreaId]);

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

  function clearAccessForm() {
    setAccessName("");
    setAccessEmail("");
    setAccessPhone("");
    setAccessRole("member");
    setEditingAccessId(null);
  }

  function closeAccessForm() {
    clearAccessForm();
    setShowAccessForm(false);
  }

  async function saveAccess() {
    if (!accessAreaId) return fail("Selecione a área deste acesso.");
    if (accessName.trim().length < 2) return fail("Informe o nome completo.");
    if (!accessEmail.includes("@")) return fail("Informe um e-mail válido.");
    const ok = await run(
      () =>
        supabase.rpc("save_area_access", {
          p_access_id: editingAccessId,
          p_area_id: accessAreaId,
          p_full_name: accessName.trim(),
          p_email: accessEmail.trim().toLowerCase(),
          p_phone: accessPhone.trim() || null,
          p_access_role: accessRole,
        }),
      editingAccessId ? "Acesso atualizado." : "Acesso cadastrado para a área.",
    );
    if (ok) closeAccessForm();
  }

  function editAccess(access: AccessEntry) {
    setAccessAreaId(access.areaId);
    setAccessName(access.fullName);
    setAccessEmail(access.email);
    setAccessPhone(access.phone);
    setAccessRole(access.accessRole);
    setEditingAccessId(access.id);
    setShowAccessForm(true);
  }

  async function changeAccessRole(access: AccessEntry, nextRole: AccessRole) {
    await run(
      () =>
        supabase.rpc("save_area_access", {
          p_access_id: access.id,
          p_area_id: access.areaId,
          p_full_name: access.fullName,
          p_email: access.email,
          p_phone: access.phone || null,
          p_access_role: nextRole,
        }),
      "Perfil de acesso atualizado.",
    );
  }

  async function removeAccess(access: AccessEntry) {
    const ok = await run(
      () => supabase.rpc("remove_area_access", { p_access_id: access.id }),
      "Acesso removido.",
    );
    if (ok && editingAccessId === access.id) closeAccessForm();
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
        <p>Somente o Gestor da área e o Administrador podem alterar.</p>
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
            Áreas e acessos
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
        <div className="settings-card areas-access-card">
          <header>
            <div>
              <h2>Áreas e acessos</h2>
              <p>Selecione uma área para administrar seus usuários.</p>
            </div>
          </header>

          <div className="areas-access-workspace">
            <aside className="areas-panel">
              <div className="areas-panel-heading">
                <div><b>Áreas</b><span>{areas.length}</span></div>
              </div>
              <div className="area-quick-add">
                <input
                  value={areaName}
                  onChange={(event) => setAreaName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addArea()}
                  placeholder="Nome da nova área"
                />
                <button className="primary" disabled={busy || areaName.trim().length < 2} onClick={addArea} title="Adicionar área" aria-label="Adicionar área"><Plus /></button>
              </div>
              <div className="area-selector-list">
                {areas.map((area) => {
                  const areaAccessCount = accesses.filter((access) => access.areaId === area.id).length;
                  return (
                    <div className={`area-selector-item ${area.id === accessAreaId ? "active" : ""}`} key={area.id}>
                      <button className="area-selector-main" onClick={() => {
                        setAccessAreaId(area.id);
                        closeAccessForm();
                      }}>
                        <i style={{ background: area.color }} />
                        <span><b>{area.name}</b><small>{areaAccessCount} {areaAccessCount === 1 ? "acesso" : "acessos"}</small></span>
                      </button>
                      <div className="area-selector-actions">
                        <button title="Editar nome" onClick={() => setEditArea({ ...area })}><Pencil /></button>
                        <button title="Excluir área" onClick={() => setDeleteTarget({ kind: "area", id: area.id, label: area.name })}><Trash2 /></button>
                      </div>
                    </div>
                  );
                })}
                {!areas.length && <div className="compact-empty">Nenhuma área cadastrada.</div>}
              </div>
            </aside>

            <section className="area-access-panel">
              <header className="area-access-header">
                <div>
                  <span>ACESSOS DA ÁREA</span>
                  <h3>{areas.find((area) => area.id === accessAreaId)?.name || "Selecione uma área"}</h3>
                  <p>{selectedAreaAccesses.length} {selectedAreaAccesses.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"}</p>
                </div>
                {accessAreaId && (
                  <button className="primary" onClick={() => {
                    clearAccessForm();
                    setShowAccessForm(true);
                  }}><Plus /> Novo acesso</button>
                )}
              </header>

              {showAccessForm && (
                <div className="access-identity-form compact-access-form">
                  <div className="compact-form-title">
                    <div><b>{editingAccessId ? "Editar acesso" : "Novo acesso"}</b><span>Dados do usuário e permissão nesta área</span></div>
                    <button onClick={closeAccessForm} title="Fechar formulário" aria-label="Fechar formulário"><X /></button>
                  </div>
                  <label>
                    Nome completo
                    <input value={accessName} onChange={(event) => setAccessName(event.target.value)} placeholder="Ex.: Maria da Silva" />
                  </label>
                  <label>
                    E-mail
                    <input type="email" value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} placeholder="nome@orgao.sp.gov.br" />
                  </label>
                  <label>
                    Telefone <small>Opcional</small>
                    <input value={accessPhone} onChange={(event) => setAccessPhone(event.target.value)} placeholder="(11) 99999-9999" />
                  </label>
                  <label>
                    Perfil de acesso
                    <select value={accessRole} onChange={(event) => setAccessRole(event.target.value as AccessRole)}>
                      <option value="administrator">Administrador</option>
                      <option value="manager">Gestor</option>
                      <option value="member">Membro</option>
                    </select>
                  </label>
                  <div className="access-role-help">
                    <ShieldCheck />
                    <div>
                      <b>{accessRole === "administrator" ? "Administrador" : accessRole === "manager" ? "Gestor" : "Membro"}</b>
                      <span>{accessRole === "administrator" ? "Acesso total a todas as áreas, configurações e processos." : accessRole === "manager" ? "Controle da equipe desta área, relatórios e aprovações." : "Acesso às atividades e tarefas do dia a dia desta área."}</span>
                    </div>
                  </div>
                  <div className="access-form-actions">
                    <button className="secondary" onClick={closeAccessForm}>Cancelar</button>
                    <button className="primary" disabled={busy || !accessAreaId} onClick={saveAccess}>{editingAccessId ? <Pencil /> : <Plus />} {editingAccessId ? "Salvar alterações" : "Cadastrar acesso"}</button>
                  </div>
                </div>
              )}

              <div className="access-list compact-access-list">
                {selectedAreaAccesses.map((access) => (
                  <div className="access-row" key={access.id}>
                    <div className="access-person"><i>{initials(access.fullName)}</i><span><b>{access.fullName}</b><small>{access.email}{access.phone ? ` · ${access.phone}` : ""}</small></span></div>
                    <select value={access.accessRole} aria-label={`Perfil de ${access.fullName}`} onChange={(event) => changeAccessRole(access, event.target.value as AccessRole)}>
                      <option value="administrator">Administrador</option>
                      <option value="manager">Gestor</option>
                      <option value="member">Membro</option>
                    </select>
                    <span className={`access-state ${access.accountCreated ? "active" : "pending"}`}>{access.accountCreated ? "Ativo" : "Convite pendente"}</span>
                    <div className="row-actions">
                      <button title="Editar acesso" onClick={() => editAccess(access)}><Pencil /></button>
                      <button title={`Remover acesso de ${access.fullName}`} onClick={() => removeAccess(access)}><Trash2 /></button>
                    </div>
                  </div>
                ))}
                {!selectedAreaAccesses.length && (
                  <div className="access-empty-state"><Users /><b>Nenhum acesso nesta área</b><span>Use “Novo acesso” para adicionar a primeira pessoa.</span></div>
                )}
              </div>
            </section>
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
  catalogId: string;
  sei: string;
  openedAt: string;
  status: Status;
  stage: string;
  ownerId: string;
  observation: string;
  priority: Priority;
  custom: Record<string, string>;
  justification: string;
  subjectId: string;
  advance: boolean;
};
function EditProject({
  advanceOnly = false,
  project,
  members,
  catalog,
  fields,
  role,
  open,
  setOpen,
  onUpdate,
}: {
  advanceOnly?: boolean;
  project: Project;
  members: Member[];
  catalog: CatalogItem[];
  fields: FieldDef[];
  role: Role;
  open: boolean;
  setOpen: (v: boolean) => void;
  onUpdate: (v: UpdateValues) => Promise<void>;
}) {
  const activeCatalog = catalog.filter((item) => item.active);
  const initialCatalog = activeCatalog.find((item) => item.id === project.catalogId);
  const [projectName, setProjectName] = useState(initialCatalog?.projectName || project.name);
  const availableStages = [
    ...new Set([
      ...stages,
      ...project.workflow.map((step) => step.stageName),
      ...activeCatalog.flatMap((item) => item.workflow.map((step) => step.stageName)),
    ]),
  ];
  const [v, setV] = useState<UpdateValues>({
      id: project.id,
      catalogId: project.catalogId,
      sei: project.sei,
      openedAt: project.openedAt,
      status: project.status,
      stage: project.stage,
      ownerId: project.ownerId,
      observation: project.observation,
      priority: project.priority,
      custom: Object.fromEntries(
        project.customValues.map((value) => [value.field_id, value.value]),
      ),
      justification: "",
      subjectId: "",
      advance: false,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selectedCatalog = activeCatalog.find((item) => item.id === v.catalogId);
  const projectNames = [...new Set(activeCatalog.map((item) => item.projectName))];
  const demands = activeCatalog.filter((item) => item.projectName === projectName);
  const visible = (key: string) => fields.some((field) => field.key === key && field.visible);
  const required = (key: string) => !!fields.find((field) => field.key === key)?.required;
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
      <DialogContent className="update-dialog full-edit-dialog">
        <DialogHeader>
          <DialogTitle>{advanceOnly ? "Encaminhar etapa" : "Editar informações"} — {ticket(project.ticket)}</DialogTitle>
          <DialogDescription>
            {advanceOnly ? "Informe a justificativa para concluir a etapa atual. O encaminhamento ficará registrado no histórico." : "Corrija os dados preenchidos na abertura. A alteração ficará registrada no histórico."}
          </DialogDescription>
        </DialogHeader>
        <div className="form update-form full-ticket-edit">
          {error && <div className="project-submit-error" role="alert"><XCircle /><span>{error}</span></div>}

          {!advanceOnly && <>
          <section>
            <h3>Projeto e demanda</h3>
            <div className="edit-grid">
              <label>
                Projeto
                <select
                  value={projectName}
                  onChange={(event) => {
                    const name = event.target.value;
                    const item = activeCatalog.find((entry) => entry.projectName === name);
                    setProjectName(name);
                    setV((value) => ({
                      ...value,
                      catalogId: item?.id || "",
                      stage: item?.workflow[0]?.stageName || value.stage,
                      ownerId: item?.workflow[0]?.assigneeId || value.ownerId,
                    }));
                  }}
                >
                  {projectNames.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              <label>
                Demanda
                <select
                  value={v.catalogId}
                  onChange={(event) => {
                    const item = activeCatalog.find((entry) => entry.id === event.target.value);
                    setV((value) => ({
                      ...value,
                      catalogId: event.target.value,
                      stage: item?.workflow[0]?.stageName || value.stage,
                      ownerId: item?.workflow[0]?.assigneeId || value.ownerId,
                    }));
                  }}
                >
                  {demands.map((item) => <option value={item.id} key={item.id}>{item.demandName}</option>)}
                </select>
              </label>
            </div>
            <div className="edit-sla-preview">
              <span>SLA cadastrado</span>
              <b>{selectedCatalog ? formatSla(selectedCatalog.slaValue, selectedCatalog.slaUnit) : "Selecione uma demanda"}</b>
              {selectedCatalog?.workflow.length ? <small>{selectedCatalog.workflow.length} etapas configuradas</small> : null}
            </div>
          </section>

          <section>
            <h3>Dados do ticket</h3>
            <div className="edit-grid">
              {visible("sei") && (
                <label>Nº do SEI{required("sei") && " *"}<input required={required("sei")} value={v.sei} onChange={(event) => setV({ ...v, sei: event.target.value })} /></label>
              )}
              {visible("openedAt") && (
                <label>Data de abertura{required("openedAt") && " *"}<input type="date" required={required("openedAt")} value={v.openedAt} onChange={(event) => setV({ ...v, openedAt: event.target.value })} /></label>
              )}
              <label>
                Prioridade
                <select value={v.priority} onChange={(event) => setV({ ...v, priority: event.target.value as Priority })}>
                  <option>Alta</option><option>Média</option><option>Baixa</option>
                </select>
              </label>
              {fields.filter((field) => !field.system && field.visible).map((field) => (
                <label key={field.id}>{field.label}{field.required && " *"}
                  {field.type === "textarea" ? (
                    <textarea required={field.required} value={v.custom[field.id] || ""} onChange={(event) => setV({ ...v, custom: { ...v.custom, [field.id]: event.target.value } })} />
                  ) : (
                    <input type={field.type} required={field.required} value={v.custom[field.id] || ""} onChange={(event) => setV({ ...v, custom: { ...v.custom, [field.id]: event.target.value } })} />
                  )}
                </label>
              ))}
            </div>
            {visible("observation") && (
              <label>Observação{required("observation") && " *"}<textarea required={required("observation")} value={v.observation} onChange={(event) => setV({ ...v, observation: event.target.value })} /></label>
            )}
          </section>

          <section>
            <h3>Andamento do processo</h3>
            <div className="edit-grid">
              <label>
                Status
                <select value={v.status} onChange={(event) => setV({ ...v, status: event.target.value as Status })}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Etapa
                <select value={v.stage} onChange={(event) => setV({ ...v, stage: event.target.value })}>
                  {availableStages.map((stage) => <option key={stage}>{stage}</option>)}
                </select>
              </label>
              <label>
                Responsável
                <select value={v.ownerId} onChange={(event) => setV({ ...v, ownerId: event.target.value })}>
                  {members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                </select>
              </label>
            </div>
          </section>

          </>}
          <section>
            <h3>Registro da alteração</h3>
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
              placeholder={advanceOnly ? "Descreva a conclusão da etapa atual" : "Explique o motivo da alteração"}
            />
          </label>
          </section>
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
          {!advanceOnly && <button
            className="primary wide"
            disabled={busy}
            onClick={() => submit(false)}
          >
            {busy ? <Loader2 /> : "Salvar alteração e justificativa"}
          </button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
