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

create table if not exists public.point_wallets (
  user_id text primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  type text not null check (type in (
    'signup_bonus',
    'charge',
    'lecture_read',
    'lecture_post_subscription',
    'lecture_membership',
    'refund',
    'adjustment',
    'earn',
    'spend',
    'bonus',
    'penalty',
    'virtue_spend',
    'author_earning_pending',
    'author_earning_settled'
  )),
  description text,
  ref_type text,
  ref_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists point_transactions_idempotency_idx
  on public.point_transactions (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists point_transactions_user_created_idx
  on public.point_transactions (user_id, created_at desc);

alter table public.point_transactions
  drop constraint if exists point_transactions_type_check;

alter table public.point_transactions
  add constraint point_transactions_type_check check (type in (
    'signup_bonus',
    'charge',
    'lecture_read',
    'lecture_post_subscription',
    'lecture_membership',
    'refund',
    'adjustment',
    'earn',
    'spend',
    'bonus',
    'penalty',
    'virtue_spend',
    'author_earning_pending',
    'author_earning_settled'
  ));

create table if not exists public.point_charge_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'created' check (status in ('created', 'succeeded', 'failed', 'canceled', 'refunded')),
  point_transaction_id uuid references public.point_transactions(id) on delete set null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists point_charge_events_idempotency_idx
  on public.point_charge_events (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists point_charge_events_user_created_idx
  on public.point_charge_events (user_id, created_at desc);

create table if not exists public.lecture_posts (
  id text primary key,
  title text not null,
  summary text not null default '',
  body text not null,
  author_id text references public.profiles(id) on delete set null,
  author_name text not null default 'AdsDuck AI',
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden', 'deleted')),
  category text not null default 'ai-education',
  tags text[] not null default '{}',
  read_price integer not null default 500 check (read_price >= 0),
  subscribe_price integer not null default 500 check (subscribe_price >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lecture_posts_status_published_idx
  on public.lecture_posts (status, published_at desc);

create index if not exists lecture_posts_author_idx
  on public.lecture_posts (author_id, created_at desc);

create table if not exists public.lecture_post_accesses (
  user_id text not null references public.profiles(id) on delete cascade,
  post_id text not null references public.lecture_posts(id) on delete cascade,
  read_count integer not null default 0 check (read_count >= 0),
  is_subscribed boolean not null default false,
  subscribed_at timestamptz,
  locked_at timestamptz,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists lecture_post_accesses_post_idx
  on public.lecture_post_accesses (post_id, updated_at desc);

create table if not exists public.lecture_post_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  post_id text not null references public.lecture_posts(id) on delete cascade,
  purchase_price integer not null check (purchase_price >= 0),
  price_multiplier integer not null default 1 check (price_multiplier >= 1),
  point_transaction_id uuid references public.point_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists lecture_post_subscriptions_post_idx
  on public.lecture_post_subscriptions (post_id, created_at desc);

create table if not exists public.lecture_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  plan_key text not null check (plan_key in ('1m', '3m', '6m')),
  paid_points integer not null check (paid_points > 0),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'canceled', 'refunded')),
  point_transaction_id uuid references public.point_transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lecture_memberships_user_active_idx
  on public.lecture_memberships (user_id, status, expires_at desc);

create table if not exists public.lecture_author_earnings (
  id uuid primary key default gen_random_uuid(),
  author_id text references public.profiles(id) on delete set null,
  post_id text references public.lecture_posts(id) on delete set null,
  payer_user_id text references public.profiles(id) on delete set null,
  point_transaction_id uuid references public.point_transactions(id) on delete set null,
  source text not null check (source in ('read', 'post_subscription', 'locked_post_subscription')),
  gross_points integer not null check (gross_points >= 0),
  author_points integer not null check (author_points >= 0),
  platform_points integer not null check (platform_points >= 0),
  status text not null default 'pending' check (status in ('pending', 'available', 'requested', 'settled', 'held', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists lecture_author_earnings_author_idx
  on public.lecture_author_earnings (author_id, status, created_at desc);

create table if not exists public.lecture_post_price_history (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.lecture_posts(id) on delete cascade,
  previous_read_price integer not null check (previous_read_price >= 0),
  previous_subscribe_price integer not null check (previous_subscribe_price >= 0),
  next_read_price integer not null check (next_read_price >= 0),
  next_subscribe_price integer not null check (next_subscribe_price >= 0),
  reason text not null,
  changed_by_user_id text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lecture_post_price_history_post_idx
  on public.lecture_post_price_history (post_id, created_at desc);

create table if not exists public.lecture_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.lecture_posts(id) on delete cascade,
  title text not null,
  summary text not null default '',
  body text not null,
  changed_by_user_id text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lecture_post_revisions_post_idx
  on public.lecture_post_revisions (post_id, created_at desc);

create table if not exists public.lecture_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lecture_audit_logs_target_idx
  on public.lecture_audit_logs (target_type, target_id, created_at desc);

create table if not exists public.lecture_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id text references public.profiles(id) on delete set null,
  post_id text references public.lecture_posts(id) on delete set null,
  reason text not null,
  detail text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lecture_content_reports_status_idx
  on public.lecture_content_reports (status, created_at desc);

create table if not exists public.lecture_author_settlement_requests (
  id uuid primary key default gen_random_uuid(),
  author_id text references public.profiles(id) on delete set null,
  requested_points integer not null check (requested_points > 0),
  status text not null default 'requested' check (status in ('requested', 'approved', 'settled', 'rejected', 'canceled')),
  note text not null default '',
  admin_note text not null default '',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  settled_at timestamptz
);

create index if not exists lecture_author_settlement_requests_author_idx
  on public.lecture_author_settlement_requests (author_id, status, requested_at desc);

create table if not exists public.lecture_author_permissions (
  user_id text primary key references public.profiles(id) on delete cascade,
  role text not null default 'writer' check (role in ('writer', 'editor', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  approved_by_user_id text references public.profiles(id) on delete set null,
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lecture_author_permissions_status_idx
  on public.lecture_author_permissions (status, role, updated_at desc);

alter table public.lecture_author_earnings
  add column if not exists settlement_request_id uuid references public.lecture_author_settlement_requests(id) on delete set null;

create index if not exists lecture_author_earnings_settlement_idx
  on public.lecture_author_earnings (settlement_request_id, status);

insert into public.profiles (id, display_name, email)
values ('lecture-author-seed', 'AdsDuck AI', 'ai-letter@adsduck.local')
on conflict (id) do update
set display_name = excluded.display_name,
    email = excluded.email,
    updated_at = now();

insert into public.lecture_posts (
  id,
  title,
  summary,
  body,
  author_id,
  author_name,
  status,
  category,
  tags,
  published_at
) values
(
  'ai-letter-001',
  'AI 교육 트렌드 브리핑',
  '기업과 개인 학습자가 바로 확인해야 할 AI 교육 흐름을 정리합니다.',
  '이번 강의레터는 AI 교육 시장에서 반복적으로 확인되는 수요를 정리합니다. 실무자는 프롬프트 작성보다 업무 프로세스 재설계, 자동화 도구 조합, 보안 정책 이해를 함께 배워야 합니다. 교육 상품을 만들 때는 실습 데이터, 결과물 평가 기준, 반복 과제를 함께 설계해야 재구매율이 높아집니다.',
  'lecture-author-seed',
  'AdsDuck AI',
  'published',
  'ai-education',
  array['AI', '교육', '트렌드'],
  now() - interval '2 days'
),
(
  'ai-letter-002',
  '강의 커리큘럼에 넣을 자동화 실습',
  'AI 자동화 강의에서 반응이 좋은 실습 주제를 정리합니다.',
  '자동화 강의는 단순 도구 소개로 끝나면 만족도가 낮습니다. 수강생이 자신의 업무 문서를 가져와 분류, 요약, 답변 초안 작성, 검수 체크리스트 생성을 직접 연결해보게 해야 합니다. 실습은 작은 업무 하나를 끝까지 자동화하는 방식이 좋습니다.',
  'lecture-author-seed',
  'AdsDuck AI',
  'published',
  'ai-education',
  array['자동화', '커리큘럼', '실습'],
  now() - interval '1 day'
)
on conflict (id) do nothing;

create or replace function public.ensure_point_wallet(p_user_id text)
returns public.point_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.point_wallets%rowtype;
begin
  insert into public.point_wallets (user_id, balance)
  values (p_user_id, 5000)
  on conflict (user_id) do nothing
  returning * into v_wallet;

  if v_wallet.user_id is not null then
    insert into public.point_transactions (
      user_id,
      amount,
      balance_after,
      type,
      description,
      ref_type,
      ref_id,
      idempotency_key
    ) values (
      p_user_id,
      5000,
      5000,
      'signup_bonus',
      'Signup bonus',
      'point_wallet',
      p_user_id,
      'signup-bonus'
    )
    on conflict do nothing;

    return v_wallet;
  end if;

  select *
    into v_wallet
    from public.point_wallets
   where user_id = p_user_id;

  return v_wallet;
end;
$$;

create or replace function public.credit_points(
  p_user_id text,
  p_amount integer,
  p_description text default 'Point charge',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.point_wallets%rowtype;
  v_existing public.point_transactions%rowtype;
  v_transaction public.point_transactions%rowtype;
begin
  if p_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount', 'error', 'Amount must be positive.');
  end if;

  perform public.ensure_point_wallet(p_user_id);

  if coalesce(p_idempotency_key, '') <> '' then
    select *
      into v_existing
      from public.point_transactions
     where user_id = p_user_id
       and idempotency_key = p_idempotency_key;

    if v_existing.id is not null then
      select * into v_wallet from public.point_wallets where user_id = p_user_id;
      return jsonb_build_object(
        'ok', true,
        'reused', true,
        'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
        'transaction', to_jsonb(v_existing)
      );
    end if;
  end if;

  select *
    into v_wallet
    from public.point_wallets
   where user_id = p_user_id
   for update;

  update public.point_wallets
     set balance = balance + p_amount,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  insert into public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    ref_type,
    ref_id,
    idempotency_key
  ) values (
    p_user_id,
    p_amount,
    v_wallet.balance,
    'charge',
    p_description,
    'point_charge',
    p_user_id,
    nullif(p_idempotency_key, '')
  )
  returning * into v_transaction;

  insert into public.point_charge_events (
    user_id,
    amount,
    status,
    point_transaction_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    p_amount,
    'succeeded',
    v_transaction.id,
    nullif(p_idempotency_key, ''),
    jsonb_build_object('description', p_description)
  )
  on conflict do nothing;

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

create or replace function public.record_point_transaction(
  p_user_id text,
  p_amount integer,
  p_type text default 'adjustment',
  p_description text default 'Point transaction',
  p_ref_type text default null,
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.point_wallets%rowtype;
  v_existing public.point_transactions%rowtype;
  v_transaction public.point_transactions%rowtype;
  v_type text := coalesce(nullif(p_type, ''), 'adjustment');
begin
  if p_amount = 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount', 'error', 'Amount must not be zero.');
  end if;

  if v_type not in (
    'signup_bonus',
    'charge',
    'lecture_read',
    'lecture_post_subscription',
    'lecture_membership',
    'refund',
    'adjustment',
    'earn',
    'spend',
    'bonus',
    'penalty',
    'virtue_spend',
    'author_earning_pending',
    'author_earning_settled'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_type', 'error', 'Invalid point transaction type.');
  end if;

  perform public.ensure_point_wallet(p_user_id);

  if coalesce(p_idempotency_key, '') <> '' then
    select *
      into v_existing
      from public.point_transactions
     where user_id = p_user_id
       and idempotency_key = p_idempotency_key;

    if v_existing.id is not null then
      select * into v_wallet from public.point_wallets where user_id = p_user_id;
      return jsonb_build_object(
        'ok', true,
        'reused', true,
        'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
        'transaction', to_jsonb(v_existing)
      );
    end if;
  end if;

  select *
    into v_wallet
    from public.point_wallets
   where user_id = p_user_id
   for update;

  if v_wallet.balance + p_amount < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_points',
      'error', 'Insufficient points.',
      'requiredPoints', abs(p_amount),
      'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at)
    );
  end if;

  update public.point_wallets
     set balance = balance + p_amount,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  insert into public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    ref_type,
    ref_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    p_amount,
    v_wallet.balance,
    v_type,
    p_description,
    p_ref_type,
    p_ref_id,
    nullif(p_idempotency_key, ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_transaction;

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
    'transaction', to_jsonb(v_transaction)
  );
end;
$$;

create or replace function public.lecture_read_post(
  p_user_id text,
  p_post_id text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.lecture_posts%rowtype;
  v_wallet public.point_wallets%rowtype;
  v_access public.lecture_post_accesses%rowtype;
  v_existing public.point_transactions%rowtype;
  v_transaction public.point_transactions%rowtype;
  v_earning public.lecture_author_earnings%rowtype;
  v_has_membership boolean := false;
  v_author_points integer := 0;
  v_platform_points integer := 0;
  v_next_read_count integer := 0;
begin
  select *
    into v_post
    from public.lecture_posts
   where id = p_post_id
     and status in ('published', 'hidden');

  if v_post.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Lecture post not found.');
  end if;

  perform public.ensure_point_wallet(p_user_id);

  insert into public.lecture_post_accesses (user_id, post_id)
  values (p_user_id, p_post_id)
  on conflict (user_id, post_id) do nothing;

  select *
    into v_access
    from public.lecture_post_accesses
   where user_id = p_user_id
     and post_id = p_post_id
   for update;

  select exists (
    select 1
      from public.lecture_memberships
     where user_id = p_user_id
       and status = 'active'
       and expires_at > now()
  ) into v_has_membership;

  if v_has_membership or v_access.is_subscribed then
    update public.lecture_post_accesses
       set last_read_at = now(),
           updated_at = now()
     where user_id = p_user_id
       and post_id = p_post_id
     returning * into v_access;

    insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
    values (
      p_user_id,
      case when v_has_membership then 'lecture_read_membership' else 'lecture_read_subscribed' end,
      'lecture_post',
      p_post_id,
      jsonb_build_object('chargedPoints', 0)
    );

    return jsonb_build_object(
      'ok', true,
      'accessType', case when v_has_membership then 'membership' else 'post_subscription' end,
      'chargedPoints', 0,
      'post', jsonb_build_object(
        'id', v_post.id,
        'title', v_post.title,
        'summary', v_post.summary,
        'body', v_post.body,
        'readPrice', v_post.read_price,
        'subscribePrice', v_post.subscribe_price,
        'authorName', v_post.author_name
      ),
      'access', jsonb_build_object(
        'readCount', v_access.read_count,
        'remainingReads', greatest(0, 3 - v_access.read_count),
        'isSubscribed', v_access.is_subscribed,
        'isLocked', v_access.locked_at is not null,
        'lockedAt', v_access.locked_at,
        'lastReadAt', v_access.last_read_at
      )
    );
  end if;

  if v_post.status <> 'published' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Lecture post not found.');
  end if;

  if v_access.locked_at is not null or v_access.read_count >= 3 then
    update public.lecture_post_accesses
       set locked_at = coalesce(locked_at, now()),
           updated_at = now()
     where user_id = p_user_id
       and post_id = p_post_id
     returning * into v_access;

    return jsonb_build_object(
      'ok', false,
      'code', 'locked',
      'error', 'This lecture post is locked. Subscribe with the locked-post price to read it again.',
      'unlockPrice', v_post.subscribe_price * 5,
      'access', jsonb_build_object(
        'readCount', v_access.read_count,
        'remainingReads', 0,
        'isSubscribed', v_access.is_subscribed,
        'isLocked', true,
        'lockedAt', v_access.locked_at
      )
    );
  end if;

  if coalesce(p_idempotency_key, '') <> '' then
    select *
      into v_existing
      from public.point_transactions
     where user_id = p_user_id
       and idempotency_key = p_idempotency_key;

    if v_existing.id is not null then
      return jsonb_build_object(
        'ok', true,
        'reused', true,
        'accessType', 'paid_read',
        'chargedPoints', abs(v_existing.amount),
        'post', jsonb_build_object(
          'id', v_post.id,
          'title', v_post.title,
          'summary', v_post.summary,
          'body', v_post.body,
          'readPrice', v_post.read_price,
          'subscribePrice', v_post.subscribe_price,
          'authorName', v_post.author_name
        ),
        'access', jsonb_build_object(
          'readCount', v_access.read_count,
          'remainingReads', greatest(0, 3 - v_access.read_count),
          'isSubscribed', v_access.is_subscribed,
          'isLocked', v_access.locked_at is not null,
          'lockedAt', v_access.locked_at,
          'lastReadAt', v_access.last_read_at
        )
      );
    end if;
  end if;

  select *
    into v_wallet
    from public.point_wallets
   where user_id = p_user_id
   for update;

  if v_wallet.balance < v_post.read_price then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_points',
      'error', 'Not enough points.',
      'requiredPoints', v_post.read_price,
      'wallet', jsonb_build_object('balance', v_wallet.balance)
    );
  end if;

  update public.point_wallets
     set balance = balance - v_post.read_price,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  insert into public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    ref_type,
    ref_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    -v_post.read_price,
    v_wallet.balance,
    'lecture_read',
    'AI lecture post read',
    'lecture_post',
    p_post_id,
    nullif(p_idempotency_key, ''),
    jsonb_build_object('postId', p_post_id, 'readPrice', v_post.read_price)
  )
  returning * into v_transaction;

  v_next_read_count := v_access.read_count + 1;

  update public.lecture_post_accesses
     set read_count = v_next_read_count,
         last_read_at = now(),
         locked_at = case when v_next_read_count >= 3 then coalesce(locked_at, now()) else locked_at end,
         updated_at = now()
   where user_id = p_user_id
     and post_id = p_post_id
   returning * into v_access;

  v_author_points := floor(v_post.read_price * 0.7);
  v_platform_points := v_post.read_price - v_author_points;

  if v_post.author_id is not null and v_post.read_price > 0 then
    insert into public.lecture_author_earnings (
      author_id,
      post_id,
      payer_user_id,
      point_transaction_id,
      source,
      gross_points,
      author_points,
      platform_points
    ) values (
      v_post.author_id,
      p_post_id,
      p_user_id,
      v_transaction.id,
      'read',
      v_post.read_price,
      v_author_points,
      v_platform_points
    )
    returning * into v_earning;
  end if;

  insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    p_user_id,
    'lecture_read_paid',
    'lecture_post',
    p_post_id,
    jsonb_build_object(
      'chargedPoints', v_post.read_price,
      'readCount', v_access.read_count,
      'locked', v_access.locked_at is not null,
      'transactionId', v_transaction.id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'accessType', 'paid_read',
    'chargedPoints', v_post.read_price,
    'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
    'transaction', to_jsonb(v_transaction),
    'earning', case when v_earning.id is null then null else to_jsonb(v_earning) end,
    'post', jsonb_build_object(
      'id', v_post.id,
      'title', v_post.title,
      'summary', v_post.summary,
      'body', v_post.body,
      'readPrice', v_post.read_price,
      'subscribePrice', v_post.subscribe_price,
      'authorName', v_post.author_name
    ),
    'access', jsonb_build_object(
      'readCount', v_access.read_count,
      'remainingReads', greatest(0, 3 - v_access.read_count),
      'isSubscribed', v_access.is_subscribed,
      'isLocked', v_access.locked_at is not null,
      'lockedAt', v_access.locked_at,
      'lastReadAt', v_access.last_read_at
    )
  );
end;
$$;

create or replace function public.lecture_subscribe_post(
  p_user_id text,
  p_post_id text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.lecture_posts%rowtype;
  v_wallet public.point_wallets%rowtype;
  v_access public.lecture_post_accesses%rowtype;
  v_existing public.point_transactions%rowtype;
  v_transaction public.point_transactions%rowtype;
  v_earning public.lecture_author_earnings%rowtype;
  v_price integer := 0;
  v_multiplier integer := 1;
  v_author_points integer := 0;
  v_platform_points integer := 0;
begin
  select *
    into v_post
    from public.lecture_posts
   where id = p_post_id
     and status = 'published'
   for update;

  if v_post.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Lecture post not found.');
  end if;

  perform public.ensure_point_wallet(p_user_id);

  insert into public.lecture_post_accesses (user_id, post_id)
  values (p_user_id, p_post_id)
  on conflict (user_id, post_id) do nothing;

  select *
    into v_access
    from public.lecture_post_accesses
   where user_id = p_user_id
     and post_id = p_post_id
   for update;

  if v_access.is_subscribed then
    return jsonb_build_object(
      'ok', true,
      'reused', true,
      'accessType', 'post_subscription',
      'chargedPoints', 0,
      'post', jsonb_build_object(
        'id', v_post.id,
        'title', v_post.title,
        'summary', v_post.summary,
        'body', v_post.body,
        'readPrice', v_post.read_price,
        'subscribePrice', v_post.subscribe_price,
        'authorName', v_post.author_name
      ),
      'access', jsonb_build_object(
        'readCount', v_access.read_count,
        'remainingReads', greatest(0, 3 - v_access.read_count),
        'isSubscribed', true,
        'isLocked', false,
        'lockedAt', null,
        'subscribedAt', v_access.subscribed_at
      )
    );
  end if;

  if coalesce(p_idempotency_key, '') <> '' then
    select *
      into v_existing
      from public.point_transactions
     where user_id = p_user_id
       and idempotency_key = p_idempotency_key;

    if v_existing.id is not null then
      return jsonb_build_object(
        'ok', true,
        'reused', true,
        'accessType', 'post_subscription',
        'chargedPoints', abs(v_existing.amount),
        'post', jsonb_build_object(
          'id', v_post.id,
          'title', v_post.title,
          'summary', v_post.summary,
          'body', v_post.body,
          'readPrice', v_post.read_price,
          'subscribePrice', v_post.subscribe_price,
          'authorName', v_post.author_name
        ),
        'access', jsonb_build_object(
          'readCount', v_access.read_count,
          'remainingReads', greatest(0, 3 - v_access.read_count),
          'isSubscribed', v_access.is_subscribed,
          'isLocked', v_access.locked_at is not null,
          'lockedAt', v_access.locked_at,
          'subscribedAt', v_access.subscribed_at
        )
      );
    end if;
  end if;

  v_multiplier := case when v_access.locked_at is not null or v_access.read_count >= 3 then 5 else 1 end;
  v_price := v_post.subscribe_price * v_multiplier;

  select *
    into v_wallet
    from public.point_wallets
   where user_id = p_user_id
   for update;

  if v_wallet.balance < v_price then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_points',
      'error', 'Not enough points.',
      'requiredPoints', v_price,
      'wallet', jsonb_build_object('balance', v_wallet.balance)
    );
  end if;

  update public.point_wallets
     set balance = balance - v_price,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  insert into public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    ref_type,
    ref_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    -v_price,
    v_wallet.balance,
    'lecture_post_subscription',
    case when v_multiplier = 5 then 'AI lecture locked post subscription' else 'AI lecture post subscription' end,
    'lecture_post',
    p_post_id,
    nullif(p_idempotency_key, ''),
    jsonb_build_object('postId', p_post_id, 'subscribePrice', v_post.subscribe_price, 'priceMultiplier', v_multiplier)
  )
  returning * into v_transaction;

  update public.lecture_post_accesses
     set is_subscribed = true,
         subscribed_at = now(),
         locked_at = null,
         updated_at = now()
   where user_id = p_user_id
     and post_id = p_post_id
   returning * into v_access;

  insert into public.lecture_post_subscriptions (
    user_id,
    post_id,
    purchase_price,
    price_multiplier,
    point_transaction_id
  ) values (
    p_user_id,
    p_post_id,
    v_price,
    v_multiplier,
    v_transaction.id
  )
  on conflict (user_id, post_id) do nothing;

  insert into public.lecture_post_price_history (
    post_id,
    previous_read_price,
    previous_subscribe_price,
    next_read_price,
    next_subscribe_price,
    reason,
    changed_by_user_id
  ) values (
    p_post_id,
    v_post.read_price,
    v_post.subscribe_price,
    v_post.read_price + 100,
    v_post.subscribe_price + 100,
    'post_subscription',
    p_user_id
  );

  update public.lecture_posts
     set read_price = read_price + 100,
         subscribe_price = subscribe_price + 100,
         updated_at = now()
   where id = p_post_id
   returning * into v_post;

  v_author_points := floor(v_price * 0.7);
  v_platform_points := v_price - v_author_points;

  if v_post.author_id is not null and v_price > 0 then
    insert into public.lecture_author_earnings (
      author_id,
      post_id,
      payer_user_id,
      point_transaction_id,
      source,
      gross_points,
      author_points,
      platform_points
    ) values (
      v_post.author_id,
      p_post_id,
      p_user_id,
      v_transaction.id,
      case when v_multiplier = 5 then 'locked_post_subscription' else 'post_subscription' end,
      v_price,
      v_author_points,
      v_platform_points
    )
    returning * into v_earning;
  end if;

  insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    p_user_id,
    'lecture_post_subscribed',
    'lecture_post',
    p_post_id,
    jsonb_build_object(
      'chargedPoints', v_price,
      'priceMultiplier', v_multiplier,
      'transactionId', v_transaction.id,
      'nextReadPrice', v_post.read_price,
      'nextSubscribePrice', v_post.subscribe_price
    )
  );

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'accessType', 'post_subscription',
    'chargedPoints', v_price,
    'priceMultiplier', v_multiplier,
    'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
    'transaction', to_jsonb(v_transaction),
    'earning', case when v_earning.id is null then null else to_jsonb(v_earning) end,
    'post', jsonb_build_object(
      'id', v_post.id,
      'title', v_post.title,
      'summary', v_post.summary,
      'body', v_post.body,
      'readPrice', v_post.read_price,
      'subscribePrice', v_post.subscribe_price,
      'authorName', v_post.author_name
    ),
    'access', jsonb_build_object(
      'readCount', v_access.read_count,
      'remainingReads', greatest(0, 3 - v_access.read_count),
      'isSubscribed', true,
      'isLocked', false,
      'lockedAt', null,
      'subscribedAt', v_access.subscribed_at
    )
  );
end;
$$;

create or replace function public.purchase_lecture_membership(
  p_user_id text,
  p_plan_key text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.point_wallets%rowtype;
  v_existing public.point_transactions%rowtype;
  v_transaction public.point_transactions%rowtype;
  v_membership public.lecture_memberships%rowtype;
  v_price integer := 0;
  v_duration interval := interval '0 days';
  v_current_expires timestamptz;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
begin
  v_price := case p_plan_key
    when '1m' then 50000
    when '3m' then 120000
    when '6m' then 200000
    else 0
  end;

  v_duration := case p_plan_key
    when '1m' then interval '1 month'
    when '3m' then interval '3 months'
    when '6m' then interval '6 months'
    else interval '0 days'
  end;

  if v_price <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_plan', 'error', 'Invalid membership plan.');
  end if;

  perform public.ensure_point_wallet(p_user_id);

  if coalesce(p_idempotency_key, '') <> '' then
    select *
      into v_existing
      from public.point_transactions
     where user_id = p_user_id
       and idempotency_key = p_idempotency_key;

    if v_existing.id is not null then
      select *
        into v_membership
        from public.lecture_memberships
       where point_transaction_id = v_existing.id
       limit 1;

      select * into v_wallet from public.point_wallets where user_id = p_user_id;

      return jsonb_build_object(
        'ok', true,
        'reused', true,
        'chargedPoints', abs(v_existing.amount),
        'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
        'membership', case when v_membership.id is null then null else to_jsonb(v_membership) end
      );
    end if;
  end if;

  select max(expires_at)
    into v_current_expires
    from public.lecture_memberships
   where user_id = p_user_id
     and status = 'active'
     and expires_at > now();

  v_starts_at := greatest(now(), coalesce(v_current_expires, now()));
  v_expires_at := v_starts_at + v_duration;

  select *
    into v_wallet
    from public.point_wallets
   where user_id = p_user_id
   for update;

  if v_wallet.balance < v_price then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_points',
      'error', 'Not enough points.',
      'requiredPoints', v_price,
      'wallet', jsonb_build_object('balance', v_wallet.balance)
    );
  end if;

  update public.point_wallets
     set balance = balance - v_price,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_wallet;

  insert into public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    ref_type,
    ref_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    -v_price,
    v_wallet.balance,
    'lecture_membership',
    'AI lecture membership',
    'lecture_membership',
    p_plan_key,
    nullif(p_idempotency_key, ''),
    jsonb_build_object('planKey', p_plan_key, 'startsAt', v_starts_at, 'expiresAt', v_expires_at)
  )
  returning * into v_transaction;

  insert into public.lecture_memberships (
    user_id,
    plan_key,
    paid_points,
    starts_at,
    expires_at,
    point_transaction_id
  ) values (
    p_user_id,
    p_plan_key,
    v_price,
    v_starts_at,
    v_expires_at,
    v_transaction.id
  )
  returning * into v_membership;

  insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    p_user_id,
    'lecture_membership_purchased',
    'lecture_membership',
    v_membership.id::text,
    jsonb_build_object('chargedPoints', v_price, 'planKey', p_plan_key, 'expiresAt', v_expires_at)
  );

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'chargedPoints', v_price,
    'wallet', jsonb_build_object('balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
    'transaction', to_jsonb(v_transaction),
    'membership', to_jsonb(v_membership)
  );
end;
$$;

create or replace function public.request_lecture_author_settlement(
  p_author_id text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_minimum integer := 10000;
  v_request public.lecture_author_settlement_requests%rowtype;
begin
  select coalesce(sum(author_points), 0)
    into v_total
    from public.lecture_author_earnings
   where author_id = p_author_id
     and status in ('pending', 'available');

  if v_total < v_minimum then
    return jsonb_build_object(
      'ok', false,
      'code', 'below_minimum',
      'error', 'Settlement request amount is below the minimum.',
      'minimumPoints', v_minimum,
      'availablePoints', v_total
    );
  end if;

  insert into public.lecture_author_settlement_requests (
    author_id,
    requested_points,
    note
  ) values (
    p_author_id,
    v_total,
    coalesce(p_note, '')
  )
  returning * into v_request;

  update public.lecture_author_earnings
     set status = 'requested',
         settlement_request_id = v_request.id
   where author_id = p_author_id
     and status in ('pending', 'available');

  insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    p_author_id,
    'lecture_author_settlement_requested',
    'lecture_author_settlement_request',
    v_request.id::text,
    jsonb_build_object('requestedPoints', v_total)
  );

  return jsonb_build_object(
    'ok', true,
    'request', to_jsonb(v_request),
    'requestedPoints', v_total,
    'minimumPoints', v_minimum
  );
end;
$$;

create or replace function public.admin_settle_lecture_author_request(
  p_actor_user_id text,
  p_request_id uuid,
  p_admin_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.lecture_author_settlement_requests%rowtype;
begin
  select *
    into v_request
    from public.lecture_author_settlement_requests
   where id = p_request_id
   for update;

  if v_request.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Settlement request not found.');
  end if;

  if v_request.status not in ('requested', 'approved') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'error', 'Settlement request cannot be settled.');
  end if;

  update public.lecture_author_settlement_requests
     set status = 'settled',
         admin_note = coalesce(p_admin_note, ''),
         decided_at = coalesce(decided_at, now()),
         settled_at = now()
   where id = p_request_id
   returning * into v_request;

  update public.lecture_author_earnings
     set status = 'settled'
   where settlement_request_id = p_request_id
     and status = 'requested';

  insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    p_actor_user_id,
    'lecture_author_settlement_settled',
    'lecture_author_settlement_request',
    p_request_id::text,
    jsonb_build_object('requestedPoints', v_request.requested_points)
  );

  return jsonb_build_object('ok', true, 'request', to_jsonb(v_request));
end;
$$;

create or replace function public.admin_refund_point_transaction(
  p_actor_user_id text,
  p_transaction_id uuid,
  p_reason text default '',
  p_revoke_access boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.point_transactions%rowtype;
  v_existing_refund public.point_transactions%rowtype;
  v_wallet public.point_wallets%rowtype;
  v_refund public.point_transactions%rowtype;
  v_refund_amount integer := 0;
begin
  select *
    into v_original
    from public.point_transactions
   where id = p_transaction_id
   for update;

  if v_original.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Transaction not found.');
  end if;

  if v_original.amount >= 0 then
    return jsonb_build_object('ok', false, 'code', 'not_refundable', 'error', 'Only spend transactions can be refunded.');
  end if;

  if v_original.type not in ('lecture_read', 'lecture_post_subscription', 'lecture_membership') then
    return jsonb_build_object('ok', false, 'code', 'not_refundable', 'error', 'Transaction type is not refundable.');
  end if;

  select *
    into v_existing_refund
    from public.point_transactions
   where type = 'refund'
     and ref_type = 'point_transaction'
     and ref_id = p_transaction_id::text
   limit 1;

  if v_existing_refund.id is not null then
    return jsonb_build_object(
      'ok', true,
      'reused', true,
      'refund', to_jsonb(v_existing_refund),
      'refundedPoints', v_existing_refund.amount
    );
  end if;

  v_refund_amount := abs(v_original.amount);

  select *
    into v_wallet
    from public.point_wallets
   where user_id = v_original.user_id
   for update;

  update public.point_wallets
     set balance = balance + v_refund_amount,
         updated_at = now()
   where user_id = v_original.user_id
   returning * into v_wallet;

  insert into public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    ref_type,
    ref_id,
    idempotency_key,
    metadata
  ) values (
    v_original.user_id,
    v_refund_amount,
    v_wallet.balance,
    'refund',
    'AI lecture refund',
    'point_transaction',
    p_transaction_id::text,
    'refund-' || p_transaction_id::text,
    jsonb_build_object(
      'reason', coalesce(p_reason, ''),
      'originalType', v_original.type,
      'originalRefType', v_original.ref_type,
      'originalRefId', v_original.ref_id,
      'revokeAccess', p_revoke_access
    )
  )
  returning * into v_refund;

  update public.lecture_author_earnings
     set status = 'refunded'
   where point_transaction_id = p_transaction_id;

  if p_revoke_access and v_original.type = 'lecture_read' then
    update public.lecture_post_accesses
       set read_count = greatest(0, read_count - 1),
           locked_at = case when read_count - 1 >= 3 then locked_at else null end,
           updated_at = now()
     where user_id = v_original.user_id
       and post_id = v_original.ref_id;
  elsif p_revoke_access and v_original.type = 'lecture_post_subscription' then
    update public.lecture_post_accesses
       set is_subscribed = false,
           subscribed_at = null,
           locked_at = case when read_count >= 3 then coalesce(locked_at, now()) else locked_at end,
           updated_at = now()
     where user_id = v_original.user_id
       and post_id = v_original.ref_id;

    delete from public.lecture_post_subscriptions
     where user_id = v_original.user_id
       and post_id = v_original.ref_id;
  elsif p_revoke_access and v_original.type = 'lecture_membership' then
    update public.lecture_memberships
       set status = 'refunded'
     where point_transaction_id = p_transaction_id;
  end if;

  insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    p_actor_user_id,
    'lecture_transaction_refunded',
    'point_transaction',
    p_transaction_id::text,
    jsonb_build_object(
      'refundedPoints', v_refund_amount,
      'refundTransactionId', v_refund.id,
      'reason', coalesce(p_reason, ''),
      'revokeAccess', p_revoke_access
    )
  );

  return jsonb_build_object(
    'ok', true,
    'refund', to_jsonb(v_refund),
    'wallet', jsonb_build_object('userId', v_wallet.user_id, 'balance', v_wallet.balance, 'updatedAt', v_wallet.updated_at),
    'refundedPoints', v_refund_amount
  );
end;
$$;

create or replace function public.admin_update_lecture_access(
  p_actor_user_id text,
  p_user_id text,
  p_post_id text,
  p_read_count integer default null,
  p_is_subscribed boolean default null,
  p_unlock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access public.lecture_post_accesses%rowtype;
begin
  if not exists (select 1 from public.lecture_posts where id = p_post_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Lecture post not found.');
  end if;

  perform public.ensure_point_wallet(p_user_id);

  insert into public.lecture_post_accesses (user_id, post_id)
  values (p_user_id, p_post_id)
  on conflict (user_id, post_id) do nothing;

  update public.lecture_post_accesses
     set read_count = case when p_read_count is null then read_count else greatest(0, p_read_count) end,
         is_subscribed = case when p_is_subscribed is null then is_subscribed else p_is_subscribed end,
         subscribed_at = case
           when p_is_subscribed = true and subscribed_at is null then now()
           when p_is_subscribed = false then null
           else subscribed_at
         end,
         locked_at = case when p_unlock then null else locked_at end,
         updated_at = now()
   where user_id = p_user_id
     and post_id = p_post_id
   returning * into v_access;

  insert into public.lecture_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (
    p_actor_user_id,
    'lecture_access_admin_updated',
    'lecture_post_access',
    p_user_id || ':' || p_post_id,
    jsonb_build_object(
      'readCount', v_access.read_count,
      'isSubscribed', v_access.is_subscribed,
      'lockedAt', v_access.locked_at,
      'unlock', p_unlock
    )
  );

  return jsonb_build_object(
    'ok', true,
    'access', jsonb_build_object(
      'userId', v_access.user_id,
      'postId', v_access.post_id,
      'readCount', v_access.read_count,
      'isSubscribed', v_access.is_subscribed,
      'lockedAt', v_access.locked_at,
      'subscribedAt', v_access.subscribed_at,
      'lastReadAt', v_access.last_read_at
    )
  );
end;
$$;

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
alter table public.point_wallets enable row level security;
alter table public.point_transactions enable row level security;
alter table public.point_charge_events enable row level security;
alter table public.lecture_posts enable row level security;
alter table public.lecture_post_accesses enable row level security;
alter table public.lecture_post_subscriptions enable row level security;
alter table public.lecture_memberships enable row level security;
alter table public.lecture_author_earnings enable row level security;
alter table public.lecture_post_price_history enable row level security;
alter table public.lecture_post_revisions enable row level security;
alter table public.lecture_audit_logs enable row level security;
alter table public.lecture_content_reports enable row level security;
alter table public.lecture_author_settlement_requests enable row level security;
alter table public.lecture_author_permissions enable row level security;

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
