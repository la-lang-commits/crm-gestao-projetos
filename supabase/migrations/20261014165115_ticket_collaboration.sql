create table public.ticket_collaborators (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check(role in ('responsible','participant')),
 primary key(project_id,user_id)
);
alter table public.ticket_collaborators enable row level security;
revoke all on public.ticket_collaborators from anon,authenticated;
grant select,insert,update,delete on public.ticket_collaborators to authenticated;
create policy collaborators_read on public.ticket_collaborators for select to authenticated using(exists(select 1 from public.projects p where p.id=ticket_collaborators.project_id and (private.is_super_admin() or private.is_group_member(p.group_id))));
create policy collaborators_insert on public.ticket_collaborators for insert to authenticated with check(
 exists(select 1 from public.projects p where p.id=ticket_collaborators.project_id and (private.is_super_admin() or private.is_group_member(p.group_id)) and
 (exists(select 1 from public.group_members m where m.group_id=p.group_id and m.user_id=ticket_collaborators.user_id)
 or exists(select 1 from public.area_accesses a where a.area_id=p.group_id and a.user_id=ticket_collaborators.user_id))));
create policy collaborators_update on public.ticket_collaborators for update to authenticated using(exists(select 1 from public.projects p where p.id=ticket_collaborators.project_id and (private.is_super_admin() or private.is_group_member(p.group_id)))) with check(
 exists(select 1 from public.projects p where p.id=ticket_collaborators.project_id and (private.is_super_admin() or private.is_group_member(p.group_id)) and
 (exists(select 1 from public.group_members m where m.group_id=p.group_id and m.user_id=ticket_collaborators.user_id)
 or exists(select 1 from public.area_accesses a where a.area_id=p.group_id and a.user_id=ticket_collaborators.user_id))));
create policy collaborators_delete on public.ticket_collaborators for delete to authenticated using(exists(select 1 from public.projects p where p.id=ticket_collaborators.project_id and (private.is_super_admin() or private.is_group_member(p.group_id))));

create or replace function public.set_ticket_team(p_project_id uuid,p_responsible uuid[],p_participants uuid[],p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.projects; person uuid; description text;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
 select * into p from public.projects where id=p_project_id for update;
 if p.id is null then raise exception 'Ticket não encontrado ou sem acesso'; end if;
 if char_length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe o motivo da alteração'; end if;
 if cardinality(coalesce(p_responsible,'{}'))+cardinality(coalesce(p_participants,'{}'))>100 then raise exception 'Limite de 100 pessoas'; end if;
 if coalesce(p_responsible,'{}') && coalesce(p_participants,'{}') then raise exception 'Uma pessoa não pode ter dois papéis'; end if;
 foreach person in array coalesce(p_responsible,'{}')||coalesce(p_participants,'{}') loop
  if person is null or not (
   exists(select 1 from public.group_members where group_id=p.group_id and user_id=person)
   or exists(select 1 from public.area_accesses where area_id=p.group_id and user_id=person)
  ) then raise exception 'Selecione somente pessoas desta área'; end if;
 end loop;
 delete from public.ticket_collaborators where project_id=p.id;
 insert into public.ticket_collaborators(project_id,user_id,role) select p.id,x,'responsible' from (select distinct unnest(coalesce(p_responsible,'{}')) x) a;
 insert into public.ticket_collaborators(project_id,user_id,role) select p.id,x,'participant' from (select distinct unnest(coalesce(p_participants,'{}')) x) a;
 select string_agg(pr.full_name||' ('||case c.role when 'responsible' then 'responsável' else 'participante' end||')',', ' order by pr.full_name) into description
 from public.ticket_collaborators c join public.profiles pr on pr.id=c.user_id where c.project_id=p.id;
 update public.projects set updated_at=now() where id=p.id;
 insert into public.project_events(project_id,event_type,justification,actor_user_id,subject_user_id)
 values(p.id,'alteracao','Equipe do ticket atualizada: '||coalesce(description,'sem pessoas adicionais')||'. Motivo: '||trim(p_reason),auth.uid(),auth.uid());
end $$;
revoke all on function public.set_ticket_team(uuid,uuid[],uuid[],text) from public,anon;
grant execute on function public.set_ticket_team(uuid,uuid[],uuid[],text) to authenticated;

create or replace function public.append_ticket_step(p_project_id uuid,p_name text,p_assignee uuid,p_sla integer,p_unit text)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.projects; n integer; active boolean; done integer;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
 select * into p from public.projects where id=p_project_id for update;
 if p.id is null then raise exception 'Ticket não encontrado ou sem acesso'; end if;
 if p.status in ('Concluído','Cancelado') then raise exception 'Reabra o ticket antes de adicionar etapas'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Informe uma etapa com 2 a 120 caracteres'; end if;
 if p_sla is null or p_sla not between 1 and 10000 or p_unit is null or p_unit not in ('business_days','calendar_days','hours','months') then raise exception 'Informe um SLA válido'; end if;
 if p_assignee is null or not (
 exists(select 1 from public.group_members where group_id=p.group_id and user_id=p_assignee)
 or exists(select 1 from public.area_accesses where area_id=p.group_id and user_id=p_assignee)) then raise exception 'Selecione um responsável desta área'; end if;
 select coalesce(max(step_order),0)+1,count(*) filter(where status='completed') into n,done from public.project_workflow_steps where project_id=p.id;
 if n>100 then raise exception 'Limite de 100 etapas atingido'; end if;
 active:=not exists(select 1 from public.project_workflow_steps where project_id=p.id and status in ('pending','current'));
 insert into public.project_workflow_steps(project_id,group_id,step_order,stage_name,assignee_id,sla_value,sla_unit,status,started_at,due_at)
 values(p.id,p.group_id,n,trim(p_name),p_assignee,p_sla,p_unit,case when active then 'current' else 'pending' end,
 case when active then now() end,case when active then private.calculate_sla_deadline(now(),p_sla,p_unit) end);
 update public.projects set updated_at=now(),progress=floor(done::numeric/n*100)::integer,
 stage=case when active then trim(p_name) else stage end,owner_id=case when active then p_assignee else owner_id end,
 stage_started_at=case when active then now() else stage_started_at end where id=p.id;
 insert into public.project_events(project_id,event_type,justification,actor_user_id,subject_user_id)
 values(p.id,'alteracao','Etapa adicionada ao fim do fluxo: '||trim(p_name)||'. O SLA geral foi mantido.',auth.uid(),auth.uid());
end $$;
revoke all on function public.append_ticket_step(uuid,text,uuid,integer,text) from public,anon;
grant execute on function public.append_ticket_step(uuid,text,uuid,integer,text) to authenticated;
