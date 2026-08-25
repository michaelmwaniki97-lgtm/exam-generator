-- Security B1B: durable, serverless-safe payment initiation and reconciliation controls.

alter table public.payments
  add column query_next_at timestamptz,
  add column query_lease_token uuid,
  add column query_lease_until timestamptz,
  add column query_attempt_count integer not null default 0,
  add constraint payments_query_attempt_count_check check (query_attempt_count between 0 and 8),
  add constraint payments_query_lease_pair_check check (
    (query_lease_token is null and query_lease_until is null) or
    (query_lease_token is not null and query_lease_until is not null)
  );

create index payments_teacher_provider_created_idx
  on public.payments (teacher_id, provider, created_at desc);
create index payments_exam_provider_created_idx
  on public.payments (exam_id, provider, created_at desc);
create index payments_phone_provider_created_idx
  on public.payments (phone, provider, created_at desc)
  where phone is not null;

create or replace function public.begin_payment_attempt(
  p_exam_id uuid,
  p_teacher_id uuid,
  p_phone text,
  p_provider text,
  p_idempotency_key uuid
) returns public.payments
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_price integer;
  v_payment public.payments;
  v_exam_teacher uuid;
  v_exam_status text;
begin
  if p_phone !~ '^254[17][0-9]{8}$' then raise exception 'invalid phone'; end if;
  if p_provider !~ '^[a-z][a-z0-9_-]{1,31}$' then raise exception 'invalid provider'; end if;

  -- Keep the canonical exam lock first, matching finalization's lock order.
  select e.teacher_id, e.status into v_exam_teacher, v_exam_status
    from public.exams e where e.id = p_exam_id for update;
  if not found or v_exam_teacher <> p_teacher_id then raise exception 'exam not owned'; end if;

  select p.* into v_payment from public.payments p
    where p.exam_id = p_exam_id and p.teacher_id = p_teacher_id and p.status = 'paid'
    order by p.completed_at desc nulls last limit 1;
  if found then return v_payment; end if;
  if v_exam_status in ('paid', 'downloaded') then raise exception 'exam already unlocked'; end if;
  if v_exam_status <> 'generated' then raise exception 'exam is not ready for payment'; end if;

  -- Reuse is checked before quotas: duplicate clicks never consume another slot.
  select p.* into v_payment from public.payments p
    where p.exam_id = p_exam_id and p.teacher_id = p_teacher_id and p.status in ('initiated', 'pending')
    order by p.created_at desc limit 1 for update;
  if found then return v_payment; end if;

  -- Serialize quota decisions across separate serverless requests and exams.
  -- Locks are always acquired teacher first, phone second to avoid lock-order cycles.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_teacher_id::text, 1101));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_phone, 1102));

  if exists (select 1 from public.payments p where p.teacher_id = p_teacher_id and p.provider = p_provider and p.created_at > pg_catalog.now() - interval '60 seconds') then
    raise exception 'payment teacher cooldown';
  end if;
  if exists (select 1 from public.payments p where p.exam_id = p_exam_id and p.provider = p_provider and p.created_at > pg_catalog.now() - interval '60 seconds') then
    raise exception 'payment exam cooldown';
  end if;
  if exists (select 1 from public.payments p where p.phone = p_phone and p.provider = p_provider and p.created_at > pg_catalog.now() - interval '5 minutes') then
    raise exception 'payment phone cooldown';
  end if;
  if (select count(*) from public.payments p where p.teacher_id = p_teacher_id and p.provider = p_provider and p.created_at > pg_catalog.now() - interval '24 hours') >= 10 then
    raise exception 'payment teacher daily limit';
  end if;
  if (select count(*) from public.payments p where p.exam_id = p_exam_id and p.provider = p_provider and p.created_at > pg_catalog.now() - interval '24 hours') >= 3 then
    raise exception 'payment exam daily limit';
  end if;
  if (select count(*) from public.payments p where p.phone = p_phone and p.provider = p_provider and p.created_at > pg_catalog.now() - interval '24 hours') >= 5 then
    raise exception 'payment phone daily limit';
  end if;

  select (s.value->>'amount')::integer into v_price
    from public.app_settings s where s.key = 'exam_package_price';
  if v_price is null or v_price <= 0 or v_price > 100000 then raise exception 'invalid configured price'; end if;

  insert into public.payments (exam_id, teacher_id, amount, provider, currency, phone, status, verification_status, idempotency_key)
  values (p_exam_id, p_teacher_id, v_price, p_provider, 'KES', p_phone, 'initiated', 'unverified', p_idempotency_key)
  returning * into v_payment;
  return v_payment;
exception when unique_violation then
  select p.* into v_payment from public.payments p
    where p.exam_id = p_exam_id and p.teacher_id = p_teacher_id and p.status in ('initiated', 'pending', 'paid')
    order by case when p.status = 'paid' then 0 else 1 end, p.created_at desc limit 1;
  if found then return v_payment; end if;
  raise;
end;
$$;

create function public.acquire_payment_query_lease(
  p_payment_id uuid,
  p_lease_token uuid
) returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_updated integer;
begin
  if p_lease_token is null then return false; end if;
  update public.payments set
    query_lease_token = p_lease_token,
    query_lease_until = pg_catalog.now() + interval '20 seconds',
    query_attempt_count = query_attempt_count + 1,
    updated_at = pg_catalog.now()
  where id = p_payment_id
    and status in ('initiated', 'pending')
    and external_request_id is not null
    and query_attempt_count < 8
    and coalesce(query_next_at, initiated_at + interval '30 seconds') <= pg_catalog.now()
    and (query_lease_until is null or query_lease_until <= pg_catalog.now());
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create function public.complete_payment_query_lease(
  p_payment_id uuid,
  p_lease_token uuid
) returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_updated integer;
begin
  update public.payments set
    query_next_at = case when status in ('initiated', 'pending') then pg_catalog.now() + case
      when query_attempt_count = 1 then interval '30 seconds'
      when query_attempt_count = 2 then interval '60 seconds'
      when query_attempt_count = 3 then interval '120 seconds'
      else interval '300 seconds'
    end else query_next_at end,
    query_lease_token = null,
    query_lease_until = null,
    updated_at = pg_catalog.now()
  where id = p_payment_id and query_lease_token = p_lease_token;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.begin_payment_attempt(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.acquire_payment_query_lease(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_payment_query_lease(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_payment_attempt(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.acquire_payment_query_lease(uuid, uuid) to service_role;
grant execute on function public.complete_payment_query_lease(uuid, uuid) to service_role;
