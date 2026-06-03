create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id text primary key,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contest_participations (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null,
  user_id text not null references public.profiles(id) on delete cascade,
  status text not null default 'joined',
  joined_at timestamptz not null default now(),
  unique (contest_id, user_id)
);

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null,
  user_id text not null references public.profiles(id) on delete cascade,
  platform text not null,
  sns_url text not null,
  title text,
  status text not null default 'submitted',
  like_count bigint not null default 0 check (like_count >= 0),
  view_count bigint not null default 0 check (view_count >= 0),
  rank_score bigint generated always as ((like_count * 3) + view_count) stored,
  submitted_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (contest_id, user_id),
  unique (sns_url)
);

create index if not exists contest_entries_rank_idx
  on public.contest_entries (contest_id, rank_score desc, submitted_at asc);

create table if not exists public.organizer_payment_codes (
  code text primary key,
  label text not null,
  total_amount integer not null check (total_amount > 0),
  service_fee_amount integer not null check (service_fee_amount >= 0),
  escrow_amount integer not null check (escrow_amount >= 0),
  recognized_revenue_amount integer not null default 0 check (recognized_revenue_amount >= 0),
  prize_expense_amount integer not null default 0 check (prize_expense_amount >= 0),
  prize_offset_amount integer not null default 0 check (prize_offset_amount >= 0),
  creator_payout_income_type text not null default 'personal_service_business_income',
  creator_payout_withholding_tax_rate numeric(6, 4) not null default 0.0330,
  product_id text not null,
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'void')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  constraint organizer_payment_codes_split_check check (
    service_fee_amount = ((total_amount * 20) / 100)
    and escrow_amount = total_amount - service_fee_amount
    and recognized_revenue_amount = total_amount
    and prize_expense_amount = escrow_amount
    and prize_offset_amount = escrow_amount
  )
);

alter table public.organizer_payment_codes
  add column if not exists recognized_revenue_amount integer not null default 0 check (recognized_revenue_amount >= 0),
  add column if not exists prize_expense_amount integer not null default 0 check (prize_expense_amount >= 0),
  add column if not exists prize_offset_amount integer not null default 0 check (prize_offset_amount >= 0),
  add column if not exists creator_payout_income_type text not null default 'personal_service_business_income',
  add column if not exists creator_payout_withholding_tax_rate numeric(6, 4) not null default 0.0330;

create table if not exists public.contest_prize_payouts (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null,
  user_id text not null references public.profiles(id) on delete cascade,
  entry_id uuid references public.contest_entries(id) on delete set null,
  payment_code text references public.organizer_payment_codes(code) on delete set null,
  gross_amount integer not null check (gross_amount > 0),
  income_type text not null default 'personal_service_business_income',
  income_tax_amount integer not null check (income_tax_amount >= 0),
  local_income_tax_amount integer not null check (local_income_tax_amount >= 0),
  withholding_tax_amount integer not null check (withholding_tax_amount >= 0),
  net_amount integer not null check (net_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint contest_prize_payouts_tax_check check (
    withholding_tax_amount = income_tax_amount + local_income_tax_amount
    and net_amount = gross_amount - withholding_tax_amount
  )
);

create index if not exists contest_prize_payouts_contest_idx
  on public.contest_prize_payouts (contest_id, status, created_at desc);

create index if not exists organizer_payment_codes_status_idx
  on public.organizer_payment_codes (status, expires_at);

create table if not exists public.board_posts (
  id text primary key,
  board text not null check (board in ('anonymous', 'realname')),
  user_id text references public.profiles(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists board_posts_board_created_idx
  on public.board_posts (board, created_at desc);

alter table public.board_posts enable row level security;

drop policy if exists "board posts readable" on public.board_posts;
create policy "board posts readable"
  on public.board_posts for select
  using (true);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'board-media',
  'board-media',
  true,
  41943040,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.organizer_payment_codes (
  code,
  label,
  total_amount,
  service_fee_amount,
  escrow_amount,
  recognized_revenue_amount,
  prize_expense_amount,
  prize_offset_amount,
  creator_payout_income_type,
  creator_payout_withholding_tax_rate,
  product_id,
  status,
  expires_at
) values
  (
    'ADSDUCK-500K',
    '50만원 공모전 주최 결제 코드',
    500000,
    100000,
    400000,
    500000,
    400000,
    400000,
    'personal_service_business_income',
    0.0330,
    'contest-host-500000',
    'active',
    '2026-12-31T14:59:59.000Z'
  ),
  (
    'ADSDUCK-1000K',
    '100만원 공모전 주최 결제 코드',
    1000000,
    200000,
    800000,
    1000000,
    800000,
    800000,
    'personal_service_business_income',
    0.0330,
    'contest-host-1000000',
    'active',
    '2026-12-31T14:59:59.000Z'
  )
on conflict (code) do update set
  label = excluded.label,
  total_amount = excluded.total_amount,
  service_fee_amount = excluded.service_fee_amount,
  escrow_amount = excluded.escrow_amount,
  recognized_revenue_amount = excluded.recognized_revenue_amount,
  prize_expense_amount = excluded.prize_expense_amount,
  prize_offset_amount = excluded.prize_offset_amount,
  creator_payout_income_type = excluded.creator_payout_income_type,
  creator_payout_withholding_tax_rate = excluded.creator_payout_withholding_tax_rate,
  product_id = excluded.product_id,
  status = excluded.status,
  expires_at = excluded.expires_at;

create or replace view public.contest_entry_leaderboard as
select
  ce.id,
  ce.contest_id,
  ce.user_id,
  coalesce(p.display_name, p.email, ce.user_id) as display_name,
  p.avatar_url,
  ce.platform,
  ce.sns_url,
  ce.title,
  ce.status,
  ce.like_count,
  ce.view_count,
  ce.rank_score,
  ce.submitted_at,
  ce.last_synced_at
from public.contest_entries ce
join public.profiles p on p.id = ce.user_id
where ce.status = 'submitted';

alter table public.profiles enable row level security;
alter table public.contest_participations enable row level security;
alter table public.contest_entries enable row level security;
alter table public.organizer_payment_codes enable row level security;
alter table public.contest_prize_payouts enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable"
  on public.profiles for select
  using (true);

drop policy if exists "participations readable" on public.contest_participations;
create policy "participations readable"
  on public.contest_participations for select
  using (true);

drop policy if exists "entries readable" on public.contest_entries;
create policy "entries readable"
  on public.contest_entries for select
  using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'contest_entries'
     ) then
    alter publication supabase_realtime add table public.contest_entries;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'contest_participations'
     ) then
    alter publication supabase_realtime add table public.contest_participations;
  end if;
end $$;
