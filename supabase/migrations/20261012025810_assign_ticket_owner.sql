create or replace function public.assign_ticket_owner(p_project_id uuid,p_owner_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
declare old_row public.projects;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
 if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Informe o motivo da atribuição'; end if;
 select * into old_row from public.projects where id=p_project_id for update;
 if old_row.id is null then raise exception 'Ticket não encontrado ou sem acesso'; end if;
 if old_row.status in ('Concluído','Cancelado') then raise exception 'Este ticket está encerrado'; end if;
 if not exists(select 1 from public.group_members where group_id=old_row.group_id and user_id=p_owner_id)
 and not exists(select 1 from public.area_accesses where area_id=old_row.group_id and user_id=p_owner_id)
 then raise exception 'Selecione uma pessoa desta área'; end if;
 if old_row.owner_id is not distinct from p_owner_id then return; end if;
 update public.projects set owner_id=p_owner_id,updated_at=now() where id=p_project_id;
 insert into public.project_events(project_id,event_type,justification,actor_user_id,subject_user_id,from_owner_id,to_owner_id,from_status,to_status,from_stage,to_stage)
 values(p_project_id,'transferencia',trim(p_reason),auth.uid(),auth.uid(),old_row.owner_id,p_owner_id,old_row.status,old_row.status,old_row.stage,old_row.stage);
end;
$$;
revoke all on function public.assign_ticket_owner(uuid,uuid,text) from public,anon;
grant execute on function public.assign_ticket_owner(uuid,uuid,text) to authenticated;
