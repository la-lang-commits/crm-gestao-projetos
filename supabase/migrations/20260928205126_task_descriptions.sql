alter table public.tasks add column description text not null default '' check (length(description) <= 2000);
