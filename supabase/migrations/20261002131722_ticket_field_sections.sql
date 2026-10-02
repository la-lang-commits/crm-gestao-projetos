alter table public.ticket_field_definitions add column section_key text check (section_key in ('info','stage','history'));
