create or replace function public.move_ticket_kanban(p_project_id uuid,p_from_status text,p_to_status text)
returns void language plpgsql security invoker set search_path = '' as $$
declare ticket public.projects;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
 if p_to_status is null or p_to_status not in ('Aberto','Pendente','Em andamento','Concluído','Cancelado') then raise exception 'Status inválido'; end if;
 select * into ticket from public.projects where id=p_project_id for update;
 if ticket.id is null then raise exception 'Ticket não encontrado ou sem acesso'; end if;
 if ticket.status is distinct from p_from_status then raise exception 'O status foi alterado por outra pessoa. Atualize a página e tente novamente.'; end if;
 if ticket.status=p_to_status then return; end if;
 update public.projects set status=p_to_status,updated_at=now() where id=p_project_id;
 insert into public.project_events(project_id,event_type,justification,actor_user_id,subject_user_id,from_status,to_status,from_stage,to_stage,from_owner_id,to_owner_id)
 values(ticket.id,'alteracao','Status alterado no Kanban: '||ticket.status||' → '||p_to_status||'.',auth.uid(),auth.uid(),ticket.status,p_to_status,ticket.stage,ticket.stage,ticket.owner_id,ticket.owner_id);
end;
$$;
revoke all on function public.move_ticket_kanban(uuid,text,text) from public,anon;
grant execute on function public.move_ticket_kanban(uuid,text,text) to authenticated;
