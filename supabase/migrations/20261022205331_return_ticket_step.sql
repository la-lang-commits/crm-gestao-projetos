create or replace function public.return_ticket_step(p_project_id uuid,p_current_step uuid,p_target_step uuid,p_assignee uuid,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare p public.projects; c public.project_workflow_steps; t public.project_workflow_steps; snapshot text; total integer; done integer;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
 select * into p from public.projects where id=p_project_id for update;
 if p.id is null or not (private.is_super_admin() or private.is_group_member(p.group_id)) then raise exception 'Ticket não encontrado ou sem acesso'; end if;
 if p.status in ('Concluído','Cancelado') then raise exception 'O ticket está encerrado'; end if;
 select * into c from public.project_workflow_steps where project_id=p.id and status='current' for update;
 if c.id is null or c.id is distinct from p_current_step then raise exception 'A etapa atual mudou. Atualize o ticket e tente novamente'; end if;
 select * into t from public.project_workflow_steps where id=p_target_step and project_id=p.id for update;
 if t.id is null or t.step_order>=c.step_order or t.status<>'completed' then raise exception 'Selecione uma etapa anterior concluída'; end if;
 if char_length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'Informe o motivo da devolução'; end if;
 if p_assignee is null or not (exists(select 1 from public.group_members where group_id=p.group_id and user_id=p_assignee) or exists(select 1 from public.area_accesses where area_id=p.group_id and user_id=p_assignee)) then raise exception 'Selecione uma pessoa desta área'; end if;
 select string_agg(stage_name||' [situação: '||status||'; início: '||coalesce(started_at::text,'—')||'; prazo: '||coalesce(due_at::text,'—')||'; conclusão: '||coalesce(completed_at::text,'—')||'; responsável: '||coalesce(assignee_id::text,'—')||']', E'\n' order by step_order) into snapshot from public.project_workflow_steps where project_id=p.id and step_order between t.step_order and c.step_order;
 update public.project_workflow_steps set status='pending',started_at=null,due_at=null,completed_at=null,completed_late=false where project_id=p.id and step_order between t.step_order and c.step_order;
 update public.project_workflow_steps set status='current',assignee_id=p_assignee,started_at=now(),due_at=private.calculate_sla_deadline(now(),t.sla_value,t.sla_unit) where id=t.id;
 select count(*),count(*) filter(where status='completed') into total,done from public.project_workflow_steps where project_id=p.id;
 update public.projects set owner_id=p_assignee,stage=t.stage_name,stage_started_at=now(),status='Em andamento',updated_at=now(),progress=floor(done::numeric/greatest(total,1)*100)::integer where id=p.id;
 insert into public.project_events(project_id,event_type,justification,actor_user_id,subject_user_id,from_owner_id,to_owner_id,from_status,to_status,from_stage,to_stage)
 values(p.id,'transferencia','Devolução para a etapa '||t.stage_name||'. Motivo: '||trim(p_reason)||E'\nA etapa foi reaberta com novo prazo. O prazo geral do ticket foi mantido.\nRegistro anterior das etapas reabertas:\n'||snapshot,auth.uid(),p_assignee,p.owner_id,p_assignee,p.status,'Em andamento',c.stage_name,t.stage_name);
end $$;
revoke all on function public.return_ticket_step(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.return_ticket_step(uuid,uuid,uuid,uuid,text) to authenticated;
