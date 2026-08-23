-- Phase 11A: provider-independent payment attempts and configurable pricing.
-- Daraja wire fields are intentionally not encoded here.

alter table public.payments drop constraint if exists payments_status_check;
do $$ begin
  if exists (select 1 from public.payments where amount <> trunc(amount)) then
    raise exception 'Existing payment amounts must be whole KES values before this migration';
  end if;
end $$;
alter table public.payments
  alter column amount type integer using amount::integer,
  add column provider text not null default 'unconfigured',
  add column currency text not null default 'KES',
  add column phone text,
  add column external_request_id text,
  add column provider_reference text,
  add column result_code text,
  add column result_description text,
  add column verification_status text not null default 'unverified',
  add column idempotency_key uuid not null default gen_random_uuid(),
  add column initiated_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add column completed_at timestamptz,
  add constraint payments_amount_positive check (amount > 0 and amount <= 100000),
  add constraint payments_currency_kes check (currency = 'KES'),
  add constraint payments_provider_format check (provider ~ '^[a-z][a-z0-9_-]{1,31}$'),
  add constraint payments_phone_format check (phone is null or phone ~ '^254[17][0-9]{8}$'),
  add constraint payments_verification_check check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));

-- Existing rows predate provider correlation. Preserve successful evidence,
-- retain failures, and close uncorrelatable pending attempts so a real provider
-- attempt can be started after migration without losing the historical row.
update public.payments set
  provider = 'legacy',
  provider_reference = mpesa_ref,
  status = case status when 'success' then 'paid' when 'pending' then 'expired' else 'failed' end,
  verification_status = case status when 'success' then 'verified' else 'rejected' end,
  completed_at = case when status = 'success' then created_at else null end,
  result_description = case when status = 'pending' then 'Legacy pending attempt closed during provider-independent payment migration.' else result_description end,
  updated_at = now();
alter table public.payments add constraint payments_status_check check (status in ('initiated', 'pending', 'paid', 'failed', 'cancelled', 'expired'));
alter table public.app_settings add column if not exists updated_at timestamptz not null default now();

create unique index payments_idempotency_key_unique on public.payments (idempotency_key);
create unique index payments_external_request_unique on public.payments (provider, external_request_id)
  where external_request_id is not null;
create unique index payments_provider_reference_unique on public.payments (provider, provider_reference)
  where provider_reference is not null;
create unique index payments_one_active_attempt_per_exam on public.payments (exam_id)
  where status in ('initiated', 'pending');
create index payments_status_created_idx on public.payments (status, created_at desc);

insert into public.app_settings (key, value)
values ('exam_package_price', jsonb_build_object('amount', 100, 'currency', 'KES'))
on conflict (key) do nothing;

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
  -- This same canonical exam-row lock is acquired first by finalization.
  select e.teacher_id, e.status into v_exam_teacher, v_exam_status
    from public.exams e where e.id = p_exam_id for update;
  if not found or v_exam_teacher <> p_teacher_id then raise exception 'exam not owned'; end if;

  select p.* into v_payment from public.payments p
    where p.exam_id = p_exam_id and p.teacher_id = p_teacher_id and p.status = 'paid'
    order by p.completed_at desc nulls last limit 1;
  if found then return v_payment; end if;
  if v_exam_status in ('paid', 'downloaded') then raise exception 'exam already unlocked'; end if;
  if v_exam_status <> 'generated' then raise exception 'exam is not ready for payment'; end if;

  select p.* into v_payment from public.payments p
    where p.exam_id = p_exam_id and p.teacher_id = p_teacher_id and p.status in ('initiated', 'pending')
    order by p.created_at desc limit 1 for update;
  if found then return v_payment; end if;

  select (s.value->>'amount')::integer into v_price from public.app_settings s where s.key = 'exam_package_price';
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

create or replace function public.finalize_verified_payment(
  p_payment_id uuid,
  p_exam_id uuid,
  p_teacher_id uuid,
  p_provider text,
  p_amount integer,
  p_currency text,
  p_provider_reference text,
  p_result_code text default null,
  p_result_description text default null
) returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_payment public.payments;
  v_exam_teacher uuid;
  v_exam_status text;
  v_updated integer;
begin
  if p_currency <> 'KES' or p_amount <= 0 or p_provider_reference is null or length(p_provider_reference) not between 4 and 80 then return false; end if;
  -- Lock the exam first, matching initiation's lock order and serialization.
  select e.teacher_id, e.status into v_exam_teacher, v_exam_status
    from public.exams e where e.id = p_exam_id for update;
  if not found or v_exam_teacher <> p_teacher_id or v_exam_status not in ('generated', 'paid', 'downloaded') then return false; end if;
  select p.* into v_payment from public.payments p where p.id = p_payment_id for update;
  if not found then return false; end if;
  if v_payment.status = 'paid' then
    return v_payment.exam_id = p_exam_id and v_payment.teacher_id = p_teacher_id and
      v_payment.provider = p_provider and v_payment.amount = p_amount and
      v_payment.currency = p_currency and v_payment.provider_reference = p_provider_reference;
  end if;
  if v_payment.status not in ('initiated', 'pending') or v_payment.exam_id <> p_exam_id or
     v_payment.teacher_id <> p_teacher_id or v_payment.provider <> p_provider or
     v_payment.amount <> p_amount or v_payment.currency <> p_currency then return false; end if;
  if exists (select 1 from public.payments p where p.provider = p_provider and p.provider_reference = p_provider_reference and p.id <> p_payment_id) then return false; end if;

  update public.payments set status = 'paid', verification_status = 'verified', provider_reference = p_provider_reference,
    mpesa_ref = p_provider_reference, result_code = left(p_result_code, 80), result_description = left(p_result_description, 500),
    completed_at = now(), updated_at = now() where id = p_payment_id;
  update public.exams set status = case when status = 'downloaded' then 'downloaded' else 'paid' end
    where id = p_exam_id and teacher_id = p_teacher_id and status in ('generated', 'paid', 'downloaded');
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'expected exactly one exam entitlement update'; end if;
  return true;
end;
$$;

revoke all on function public.begin_payment_attempt(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.finalize_verified_payment(uuid, uuid, uuid, text, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.begin_payment_attempt(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.finalize_verified_payment(uuid, uuid, uuid, text, integer, text, text, text, text) to service_role;
revoke insert, update, delete on public.payments from authenticated;
revoke select on public.payments from authenticated;
grant select (id, exam_id, teacher_id, amount, currency, status, created_at, completed_at) on public.payments to authenticated;
