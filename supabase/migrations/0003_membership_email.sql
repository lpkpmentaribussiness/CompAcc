alter table public.memberships
  add column if not exists email text;

update public.memberships m
set email = lower(u.email)
from auth.users u
where m.user_id = u.id
  and m.email is null;

alter table public.memberships
  alter column email set not null;

alter table public.memberships
  add constraint memberships_email_format check (email = lower(trim(email)) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') not valid;

alter table public.memberships validate constraint memberships_email_format;

create unique index if not exists memberships_tenant_email_idx
  on public.memberships (tenant_id, email);
