-- Phase 11B: retain both identifiers returned by an accepted STK Push.
-- This migration is intentionally provider-neutral; no callback payload is stored.

alter table public.payments
  add column provider_request_id text;

alter table public.payments
  add constraint payments_provider_request_id_length
  check (provider_request_id is null or length(provider_request_id) between 1 and 160);

create unique index payments_provider_request_unique
  on public.payments (provider, provider_request_id)
  where provider_request_id is not null;

-- A real receipt is distinct from the generic provider correlation reference.
-- Existing Phase 11A finalization copied provider_reference into mpesa_ref, so
-- replace that already-deployed RPC with a forward-only signature that accepts
-- an independently sourced receipt (nullable for query-only reconciliation).
create unique index payments_mpesa_receipt_unique
  on public.payments (provider, mpesa_ref)
  where mpesa_ref is not null;

drop function if exists public.finalize_verified_payment(uuid, uuid, uuid, text, integer, text, text, text, text);

create function public.finalize_verified_payment(
  p_payment_id uuid,
  p_exam_id uuid,
  p_teacher_id uuid,
  p_provider text,
  p_amount integer,
  p_currency text,
  p_provider_reference text,
  p_mpesa_receipt text default null,
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
  if p_mpesa_receipt is not null and (length(p_mpesa_receipt) not between 4 and 80 or p_mpesa_receipt !~ '^[A-Za-z0-9]+$') then return false; end if;

  select e.teacher_id, e.status into v_exam_teacher, v_exam_status
    from public.exams e where e.id = p_exam_id for update;
  if not found or v_exam_teacher <> p_teacher_id or v_exam_status not in ('generated', 'paid', 'downloaded') then return false; end if;
  select p.* into v_payment from public.payments p where p.id = p_payment_id for update;
  if not found then return false; end if;

  if v_payment.status = 'paid' then
    if not (v_payment.exam_id = p_exam_id and v_payment.teacher_id = p_teacher_id and
      v_payment.provider = p_provider and v_payment.amount = p_amount and
      v_payment.currency = p_currency and v_payment.provider_reference = p_provider_reference) then return false; end if;
    if p_mpesa_receipt is not null then
      if v_payment.mpesa_ref is not null and v_payment.mpesa_ref <> p_mpesa_receipt then return false; end if;
      update public.payments set mpesa_ref = coalesce(mpesa_ref, p_mpesa_receipt), updated_at = now()
        where id = p_payment_id;
    end if;
    return true;
  end if;

  if v_payment.status not in ('initiated', 'pending') or v_payment.exam_id <> p_exam_id or
     v_payment.teacher_id <> p_teacher_id or v_payment.provider <> p_provider or
     v_payment.amount <> p_amount or v_payment.currency <> p_currency then return false; end if;
  if exists (select 1 from public.payments p where p.provider = p_provider and p.provider_reference = p_provider_reference and p.id <> p_payment_id) then return false; end if;
  if p_mpesa_receipt is not null and exists (select 1 from public.payments p where p.provider = p_provider and p.mpesa_ref = p_mpesa_receipt and p.id <> p_payment_id) then return false; end if;

  update public.payments set status = 'paid', verification_status = 'verified', provider_reference = p_provider_reference,
    mpesa_ref = p_mpesa_receipt, result_code = left(p_result_code, 80), result_description = left(p_result_description, 500),
    completed_at = now(), updated_at = now() where id = p_payment_id;
  update public.exams set status = case when status = 'downloaded' then 'downloaded' else 'paid' end
    where id = p_exam_id and teacher_id = p_teacher_id and status in ('generated', 'paid', 'downloaded');
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'expected exactly one exam entitlement update'; end if;
  return true;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.finalize_verified_payment(uuid, uuid, uuid, text, integer, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(uuid, uuid, uuid, text, integer, text, text, text, text, text) to service_role;

-- Preserve the Phase 11A teacher-safe projection: the new internal correlation
-- identifier is deliberately not granted to authenticated users.
