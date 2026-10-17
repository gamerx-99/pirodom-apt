-- One open review per bill prevents concurrent duplicate slip submissions.
-- Payment approval only accepts an exact full-bill amount; partial/overpayment
-- policy remains unset and is intentionally not guessed here.

alter table public.payments
  drop constraint payments_status_check,
  add constraint payments_status_check
    check (status in ('uploaded', 'slipok_passed', 'slipok_failed', 'mismatch', 'pending_review', 'approved', 'rejected'));

create unique index payments_one_open_per_invoice_idx
  on public.payments (invoice_id)
  where status in ('uploaded', 'slipok_passed', 'slipok_failed', 'mismatch', 'pending_review');

create function public.approve_invoice_payment(p_payment_id uuid, p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewer_id uuid := auth.uid();
  payment_row public.payments%rowtype;
  invoice_row public.invoices%rowtype;
begin
  if reviewer_id is null or not public.is_staff() then
    raise exception 'staff authorization required';
  end if;

  select * into payment_row
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'payment not found';
  end if;
  if payment_row.status not in ('slipok_passed', 'pending_review', 'uploaded') then
    raise exception 'payment is not eligible for approval';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'verified payment amount must be positive';
  end if;
  if payment_row.status = 'slipok_passed'
     and payment_row.amount is not null
     and payment_row.amount is distinct from p_amount then
    raise exception 'entered amount differs from SlipOK result';
  end if;

  select * into invoice_row
  from public.invoices
  where id = payment_row.invoice_id
  for update;
  if not found then
    raise exception 'invoice not found';
  end if;
  if invoice_row.status not in ('issued', 'overdue', 'verifying', 'pending_review') then
    raise exception 'invoice is not payable';
  end if;
  if invoice_row.total is distinct from p_amount then
    raise exception 'payment must match the full invoice amount';
  end if;

  update public.payments
  set amount = p_amount,
      status = 'approved',
      reviewed_by = reviewer_id,
      review_reason = null
  where id = payment_row.id;

  update public.invoices
  set status = 'paid'
  where id = invoice_row.id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, before, after)
  values (
    reviewer_id,
    'payment.approve',
    'payments',
    payment_row.id,
    jsonb_build_object('status', payment_row.status, 'invoice_status', invoice_row.status),
    jsonb_build_object('status', 'approved', 'invoice_status', 'paid', 'amount', p_amount)
  );

  return payment_row.id;
end;
$$;

revoke all on function public.approve_invoice_payment(uuid, numeric) from public, anon;
grant execute on function public.approve_invoice_payment(uuid, numeric) to authenticated;
