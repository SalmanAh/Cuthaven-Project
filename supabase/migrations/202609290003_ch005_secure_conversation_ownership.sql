-- CH-005: secure customer-support conversations with account-derived ownership
-- and opaque, hashed guest tokens. Direct client table access remains disabled.

create table if not exists public.customer_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  guest_email text,
  guest_name text,
  guest_token_hash text,
  guest_token_expires_at timestamptz,
  guest_token_revoked_at timestamptz,
  last_message_at timestamptz not null default now(),
  unread_by_customer integer not null default 0 check (unread_by_customer >= 0),
  unread_by_admin integer not null default 0 check (unread_by_admin >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_conversations
  add column if not exists guest_token_hash text,
  add column if not exists guest_token_expires_at timestamptz,
  add column if not exists guest_token_revoked_at timestamptz;

alter table public.customer_conversations
  drop constraint if exists customer_conversations_customer_id_fkey;

-- Old drafts stored auth.users IDs. Normalize matching rows to customers.id.
update public.customer_conversations cc
set customer_id = c.id
from public.customers c
where cc.customer_id = c.auth_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_conversations_customer_id_fkey'
      and conrelid = 'public.customer_conversations'::regclass
  ) then
    alter table public.customer_conversations
      add constraint customer_conversations_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete cascade not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_conversations_owner_check'
      and conrelid = 'public.customer_conversations'::regclass
  ) then
    alter table public.customer_conversations
      add constraint customer_conversations_owner_check check (
        (customer_id is not null and guest_email is null and guest_name is null and
         guest_token_hash is null) or
        (customer_id is null and guest_email is not null and guest_name is not null and
         guest_token_hash is not null)
      ) not valid;
  end if;
end $$;

create unique index if not exists customer_conversations_customer_unique
  on public.customer_conversations(customer_id)
  where customer_id is not null;
create unique index if not exists customer_conversations_guest_token_unique
  on public.customer_conversations(guest_token_hash)
  where guest_token_hash is not null;
create index if not exists customer_conversations_last_message_idx
  on public.customer_conversations(last_message_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_conversations(id) on delete cascade,
  is_admin boolean not null default false,
  sender_id uuid references auth.users(id) on delete set null,
  message text not null check (length(trim(message)) > 0 and length(message) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_conversation_created_idx
  on public.conversation_messages(conversation_id, created_at);

create or replace function public.update_conversation_after_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.customer_conversations
  set last_message_at = new.created_at,
      updated_at = now(),
      unread_by_customer = unread_by_customer + case when new.is_admin then 1 else 0 end,
      unread_by_admin = unread_by_admin + case when new.is_admin then 0 else 1 end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trigger_update_conversation_timestamp on public.conversation_messages;
drop trigger if exists conversation_message_counters on public.conversation_messages;
create trigger conversation_message_counters
after insert on public.conversation_messages
for each row execute function public.update_conversation_after_message();

alter table public.customer_conversations enable row level security;
alter table public.conversation_messages enable row level security;

-- Express uses service_role and performs explicit ownership checks. Prevent
-- browsers from bypassing the API through PostgREST, including legacy grants.
revoke all on public.customer_conversations from public, anon, authenticated;
revoke all on public.conversation_messages from public, anon, authenticated;
grant select, insert, update, delete on public.customer_conversations to service_role;
grant select, insert, update, delete on public.conversation_messages to service_role;

-- Remove legacy SECURITY DEFINER entry points that accepted caller-supplied
-- identity or conversation values and could bypass the API checks.
drop function if exists public.get_customer_unread_count(uuid, text);
drop function if exists public.get_admin_unread_count();
drop function if exists public.mark_conversation_read(uuid, boolean);

-- An older migration may have installed a second timestamp trigger.
drop trigger if exists trigger_update_conversations_updated_at
  on public.customer_conversations;

-- Remove known legacy policies; no direct-client policies are recreated.
drop policy if exists "Customers can view own conversations" on public.customer_conversations;
drop policy if exists "Guests can view own conversations by email" on public.customer_conversations;
drop policy if exists "Customers can create conversations" on public.customer_conversations;
drop policy if exists "Guests can create conversations" on public.customer_conversations;
drop policy if exists "Customers can mark own conversations as read" on public.customer_conversations;
drop policy if exists "Admins can view all conversations" on public.customer_conversations;
drop policy if exists "Admins can update conversations" on public.customer_conversations;
drop policy if exists "Customers can view own conversation messages" on public.conversation_messages;
drop policy if exists "Guests can view own conversation messages" on public.conversation_messages;
drop policy if exists "Customers can send messages in own conversations" on public.conversation_messages;
drop policy if exists "Guests can send messages in own conversations" on public.conversation_messages;
drop policy if exists "Admins can view all messages" on public.conversation_messages;
drop policy if exists "Admins can send messages" on public.conversation_messages;
