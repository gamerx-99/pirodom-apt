-- Images remain in private Storage. Keep the submission, verification and web
-- notification in Postgres, including uploads whose final status write fails.
alter table public.payments
  add column submitted_by uuid references public.profiles (id);

alter table public.notifications
  add column payment_id uuid references public.payments (id);

create unique index notifications_payment_web_idx
  on public.notifications (profile_id, payment_id)
  where channel = 'web' and type = 'payment_uploaded';

create index payment_verifications_payment_idx
  on public.payment_verifications (payment_id);

-- Web alerts are server-generated; clients can only read notifications.
revoke insert, update, delete on public.notifications from anon, authenticated;

create function public.log_payment_upload()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.notifications (profile_id, type, channel, payment_id)
  select id, 'payment_uploaded', 'web', new.id
  from public.profiles where role in ('owner', 'admin');

  insert into public.audit_logs (actor_id, action, table_name, record_id, after)
  values (new.submitted_by, 'payment.upload.received', 'payments', new.id,
    jsonb_build_object('invoice_id', new.invoice_id, 'status', new.status, 'slip_path', new.slip_path));
  return new;
end;
$$;

revoke all on function public.log_payment_upload() from public, anon, authenticated;
create trigger payments_log_upload after insert on public.payments
for each row execute function public.log_payment_upload();

-- Existing open submissions must also appear when the admin opens the web app.
insert into public.notifications (profile_id, type, channel, payment_id)
select s.id, 'payment_uploaded', 'web', p.id
from public.profiles s cross join public.payments p
where s.role in ('owner', 'admin')
  and p.status in ('uploaded', 'slipok_passed', 'slipok_failed', 'mismatch', 'pending_review')
on conflict do nothing;

-- Only trusted server code calls this function: the upload route checks invoice
-- ownership, and the staff action checks the session/role before using its key.
-- Derive the status from the SAME saved verification, never from client input.
-- INVOKER retains service_role's existing grants/RLS behavior.
create function public.finalize_invoice_payment_verification(p_payment_id uuid, p_actor_id uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  payment_row public.payments%rowtype;
  invoice_row public.invoices%rowtype;
  verification_row public.payment_verifications%rowtype;
  verification_count integer;
  result jsonb;
  next_status text;
  verified_amount numeric;
begin
  -- Same lock order as approve/reject: payment, then invoice.
  select * into payment_row from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if payment_row.status not in ('uploaded', 'slipok_passed', 'slipok_failed', 'mismatch', 'pending_review') then
    raise exception 'payment is not open for review';
  end if;
  select * into invoice_row from public.invoices where id = payment_row.invoice_id for update;
  if invoice_row.status not in ('issued', 'overdue', 'verifying', 'pending_review') then
    raise exception 'invoice is not payable';
  end if;

  next_status := payment_row.status;
  if payment_row.status = 'uploaded' then
    select count(*) into verification_count from public.payment_verifications
    where payment_id = payment_row.id and provider = 'slipok';
    if verification_count <> 1 then raise exception 'saved verification unavailable or ambiguous'; end if;
    select * into verification_row from public.payment_verifications
    where payment_id = payment_row.id and provider = 'slipok';
    result := verification_row.result::jsonb;
    next_status := result->>'status';
    if next_status is null or next_status not in ('slipok_passed', 'slipok_failed', 'mismatch', 'pending_review') then
      raise exception 'saved verification invalid';
    end if;
    if result ? 'amount' and result->'amount' <> 'null'::jsonb then
      if jsonb_typeof(result->'amount') <> 'number' then raise exception 'saved verification amount invalid'; end if;
      verified_amount := (result->>'amount')::numeric;
    end if;
    if next_status = 'slipok_passed' and (
      verified_amount is null or verified_amount <= 0 or verified_amount is distinct from invoice_row.total
      or coalesce(verification_row.provider_reference, '') = ''
      or verification_row.provider_reference is distinct from result->>'reference'
    ) then raise exception 'saved verification does not match invoice'; end if;

    update public.payments set status = next_status, amount = verified_amount where id = payment_row.id;
  end if;

  if invoice_row.status <> 'pending_review' then
    update public.invoices set status = 'pending_review' where id = invoice_row.id;
  end if;
  if payment_row.status = 'uploaded' or invoice_row.status <> 'pending_review' then
    insert into public.audit_logs (actor_id, action, table_name, record_id, before, after)
    values (p_actor_id, 'payment.verification.finalize', 'payments', payment_row.id,
      jsonb_build_object('status', payment_row.status, 'invoice_status', invoice_row.status),
      jsonb_build_object('status', next_status, 'invoice_status', 'pending_review'));
  end if;
  return next_status;
end;
$$;

revoke all on function public.finalize_invoice_payment_verification(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_invoice_payment_verification(uuid, uuid) to service_role;
