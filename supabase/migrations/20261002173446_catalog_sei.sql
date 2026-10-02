alter table public.service_catalog add column sei_number text not null default '' check (length(sei_number) <= 120);

create function public.catalog_sei_inherit() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  new.sei_number := trim(new.sei_number);
  if new.sei_number = '' then
    select coalesce(max(sei_number),'') into new.sei_number
    from public.service_catalog where area_id=new.area_id and project_name=new.project_name;
  end if;
  return new;
end $$;
create trigger catalog_sei_inherit before insert on public.service_catalog for each row execute function public.catalog_sei_inherit();

create function public.catalog_sei_sync() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  update public.service_catalog set sei_number=new.sei_number
  where area_id=new.area_id and project_name=new.project_name and id<>new.id and sei_number is distinct from new.sei_number;
  return new;
end $$;
create trigger catalog_sei_sync after insert or update of sei_number on public.service_catalog for each row execute function public.catalog_sei_sync();
revoke all on function public.catalog_sei_inherit() from public,anon;
revoke all on function public.catalog_sei_sync() from public,anon;

