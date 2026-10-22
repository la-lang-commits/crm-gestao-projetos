create or replace function public.manage_ticket_step(p_project_id uuid,p_step_id uuid,p_action text,p_name text,p_assignee uuid,p_sla integer,p_unit text,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.projects; s public.project_workflow_steps; item record; total integer; done integer; new_order integer:=0; affected integer;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
 select * into p from public.projects where id=p_project_id for update;
 if p.id is null or not (private.is_super_admin() or private.is_group_member(p.group_id)) then raise exception 'Ticket não encontrado ou sem acesso'; end if;
 if p.status in ('Concluído','Cancelado') then raise exception 'O ticket está encerrado'; end if;
 select * into s from public.project_workflow_steps where id=p_step_id and project_id=p.id for update;
 if s.id is null then raise exception 'Etapa não encontrada'; end if;
 if s.status<>'pending' or s.started_at is not null then raise exception 'Somente etapas que ainda não começaram podem ser editadas ou excluídas'; end if;
 if char_length(trim(coalesce(p_reason,'')))<3 then raise exception 'Informe o motivo da mudança'; end if;
 if p_action='delete' then
  if not (private.is_super_admin() or private.is_group_admin(p.group_id)) then raise exception 'Somente gestores da área podem excluir etapas'; end if;
  delete from public.project_workflow_steps where id=s.id;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Não foi possível excluir a etapa'; end if;
  for item in select id,step_order from public.project_workflow_steps where project_id=p.id order by step_order loop
   new_order:=new_order+1;
   if item.step_order<>new_order then update public.project_workflow_steps set step_order=new_order where id=item.id; end if;
  end loop;
 elsif p_action='edit' then
  if char_length(trim(coalesce(p_name,''))) not between 2 and 120 then raise exception 'Informe o nome da etapa'; end if;
  if p_sla is null or p_sla not between 1 and 10000 or p_unit is null or p_unit not in ('business_days','calendar_days','hours','months') then raise exception 'Informe um prazo válido'; end if;
  if p_assignee is null or not (exists(select 1 from public.group_members where group_id=p.group_id and user_id=p_assignee) or exists(select 1 from public.area_accesses where area_id=p.group_id and user_id=p_assignee)) then raise exception 'Selecione uma pessoa desta área'; end if;
  update public.project_workflow_steps set stage_name=trim(p_name),assignee_id=p_assignee,sla_value=p_sla,sla_unit=p_unit where id=s.id;
 else raise exception 'Ação inválida'; end if;
 select count(*),count(*) filter(where status='completed') into total,done from public.project_workflow_steps where project_id=p.id;
 update public.projects set updated_at=now(),progress=case when total=0 then 0 else floor(done::numeric/total*100)::integer end where id=p.id;
 insert into public.project_events(project_id,event_type,justification,actor_user_id,subject_user_id)
 values(p.id,'alteracao',case when p_action='delete' then 'Etapa pendente excluída: '||s.stage_name else 'Etapa pendente editada: '||s.stage_name||' → '||trim(p_name)||'. Responsável: '||coalesce((select full_name from public.profiles where id=p_assignee),'Não informado')||'. SLA: '||p_sla||' '||p_unit end||'. Motivo: '||trim(p_reason)||'. A etapa atual e os prazos em andamento foram mantidos.',auth.uid(),auth.uid());
end $$;
revoke all on function public.manage_ticket_step(uuid,uuid,text,text,uuid,integer,text,text) from public,anon;
grant execute on function public.manage_ticket_step(uuid,uuid,text,text,uuid,integer,text,text) to authenticated;
