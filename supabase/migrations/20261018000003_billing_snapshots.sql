-- Billing snapshots are assembled while an invoice is a draft, then frozen
-- when it is issued. This migration does not choose billing-cycle rules.

alter table public.invoice_items
  add column meter_reading_id uuid references public.meter_readings (id);

create index invoice_items_meter_reading_idx
  on public.invoice_items (meter_reading_id)
  where meter_reading_id is not null;

create function public.guard_invoice_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'paid' and new is distinct from old then
    raise exception 'paid invoices are immutable';
  end if;

  if old.status = 'void' and new.status is distinct from old.status then
    raise exception 'void invoices cannot change status';
  end if;

  if old.status <> 'draft' and (
    new.lease_id is distinct from old.lease_id or
    new.period is distinct from old.period or
    new.issue_date is distinct from old.issue_date or
    new.due_date is distinct from old.due_date or
    new.total is distinct from old.total
  ) then
    raise exception 'issued invoice snapshots are immutable';
  end if;

  return new;
end;
$$;

create trigger invoices_guard_snapshot
before update on public.invoices
for each row execute function public.guard_invoice_snapshot();

create function public.guard_invoice_item_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  invoice_status text;
  target_invoice_id uuid;
begin
  target_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  select status into invoice_status
  from public.invoices
  where id = target_invoice_id;

  -- The parent invoice may already be absent during ON DELETE CASCADE.
  if invoice_status is null and tg_op = 'DELETE' then
    return old;
  end if;

  if invoice_status is distinct from 'draft' then
    raise exception 'invoice items can only change while the invoice is a draft';
  end if;

  -- ย้ายรายการข้ามบิล: บิลต้นทางต้องเป็นร่างด้วย ไม่งั้นดึงรายการออกจากบิลที่ชำระแล้วได้
  if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
    select status into invoice_status
    from public.invoices
    where id = old.invoice_id;
    if invoice_status is distinct from 'draft' then
      raise exception 'invoice items can only change while the invoice is a draft';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger invoice_items_guard_snapshot
before insert or update or delete on public.invoice_items
for each row execute function public.guard_invoice_item_snapshot();
