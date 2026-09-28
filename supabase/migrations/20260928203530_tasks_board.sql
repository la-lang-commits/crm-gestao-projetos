alter table public.tasks add column priority text not null default 'Média' check (priority in ('Alta','Média','Baixa'));
alter table public.tasks drop constraint tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('Pendente','Em andamento','Concluída','Cancelada'));
alter table public.tasks add constraint tasks_title_check check (length(btrim(title)) between 1 and 250);
create or replace function public.validate_task_assignment() returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
 if new.assignee_id is not null and not exists (
 select 1 from public.projects p join public.group_members gm on gm.group_id=p.group_id
 where p.id=new.project_id and gm.user_id=new.assignee_id
 ) then raise exception 'O responsável precisa pertencer à área do projeto.'; end if;
 new.updated_at=now();
 return new;
end; $$;
revoke all on function public.validate_task_assignment() from public, anon;
create trigger tasks_validate_assignment before insert or update on public.tasks for each row execute function public.validate_task_assignment();
