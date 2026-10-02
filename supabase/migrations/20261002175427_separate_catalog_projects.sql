create table public.catalog_projects (
 id uuid primary key default gen_random_uuid(),
 area_id uuid not null references public.groups(id) on delete cascade,
 name text not null check (length(trim(name)) between 2 and 160),
 sei_number text not null default '' check (length(sei_number)<=120),
 created_by uuid references public.profiles(id) on update cascade,
 created_at timestamptz not null default now(),
 unique(area_id,name)
);
alter table public.catalog_projects enable row level security;
grant select,insert,update,delete on public.catalog_projects to authenticated;
create policy catalog_projects_select on public.catalog_projects for select to authenticated using (private.is_super_admin() or private.is_group_member(area_id));
create policy catalog_projects_insert on public.catalog_projects for insert to authenticated with check (private.is_group_admin(area_id) and created_by=(select auth.uid()));
create policy catalog_projects_update on public.catalog_projects for update to authenticated using (private.is_group_admin(area_id)) with check (private.is_group_admin(area_id));
create policy catalog_projects_delete on public.catalog_projects for delete to authenticated using (private.is_group_admin(area_id));

insert into public.catalog_projects(area_id,name,sei_number,created_by)
select distinct on (area_id,project_name) area_id,project_name,sei_number,created_by
from public.service_catalog order by area_id,project_name,created_at;
alter table public.service_catalog add column catalog_project_id uuid references public.catalog_projects(id) on delete restrict;
update public.service_catalog c set catalog_project_id=p.id from public.catalog_projects p where p.area_id=c.area_id and p.name=c.project_name;

drop trigger catalog_sei_inherit on public.service_catalog;
drop trigger catalog_sei_sync on public.service_catalog;
drop function public.catalog_sei_inherit();
drop function public.catalog_sei_sync();

create function public.bind_catalog_project() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.catalog_projects%rowtype;
begin
 if new.catalog_project_id is null then
   select * into p from public.catalog_projects where area_id=new.area_id and name=new.project_name;
   if p.id is null then
     insert into public.catalog_projects(area_id,name,sei_number,created_by)
       values(new.area_id,new.project_name,coalesce(new.sei_number,''),new.created_by) returning * into p;
   end if;
 else
   select * into p from public.catalog_projects where id=new.catalog_project_id and area_id=new.area_id;
   if p.id is null then raise exception 'Projeto não pertence a esta área.'; end if;
 end if;
 new.catalog_project_id:=p.id;
 new.project_name:=p.name;
 new.sei_number:=p.sei_number;
 return new;
end $$;
create trigger bind_catalog_project before insert or update on public.service_catalog for each row execute function public.bind_catalog_project();
alter table public.service_catalog alter column catalog_project_id set not null;
create index service_catalog_project_idx on public.service_catalog(catalog_project_id);

create function public.sync_catalog_project() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update public.service_catalog set project_name=new.name,sei_number=new.sei_number where catalog_project_id=new.id;
 return new;
end $$;
create trigger sync_catalog_project after update of name,sei_number on public.catalog_projects for each row execute function public.sync_catalog_project();
revoke all on function public.bind_catalog_project() from public,anon;
revoke all on function public.sync_catalog_project() from public,anon;

