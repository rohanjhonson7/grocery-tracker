-- Undo supabase/migrations/20261107000000_app_support.sql
-- (restores the database to how it was on 2026-11-07 before the app build)

alter view public.list_items_view reset (security_invoker);
alter view public.recurring_items_view reset (security_invoker);
alter view public.monthly_spend_summary reset (security_invoker);
alter view public.weekly_spend_summary reset (security_invoker);
alter view public.monthly_category_totals reset (security_invoker);
alter view public.monthly_store_totals reset (security_invoker);

drop function if exists public.join_household(text);

create policy "Users can create membership when creating household"
  on public.household_members for insert
  with check ((auth.uid() is not null) and (user_id = auth.uid()));

-- Only succeeds if no expense_items row has a null price.
alter table public.expense_items alter column price set not null;

-- Original process_recurring_items()
create or replace function public.process_recurring_items()
returns integer
language plpgsql
security definer
as $function$
declare
  v_count integer := 0;
  v_recurring record;
  v_list_id uuid;
begin
  for v_recurring in
    select ri.* from public.recurring_items ri
    where ri.is_active = true and ri.next_add_date <= current_date
  loop
    select id into v_list_id from public.grocery_lists
    where household_id = v_recurring.household_id
      and store_id = v_recurring.store_id and is_active = true
    limit 1;
    if v_list_id is null then
      insert into public.grocery_lists (household_id, store_id, is_active)
      values (v_recurring.household_id, v_recurring.store_id, true)
      returning id into v_list_id;
    end if;
    insert into public.list_items (
      list_id, catalog_item_id, custom_item_id, item_name, quantity, unit, notes, status, added_by
    ) values (
      v_list_id, v_recurring.catalog_item_id, v_recurring.custom_item_id, v_recurring.item_name,
      v_recurring.quantity, v_recurring.unit,
      coalesce(v_recurring.notes, '') || ' [Auto-added]', 'to_buy', v_recurring.created_by
    );
    update public.recurring_items set last_added_at = now() where id = v_recurring.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

grant execute on function public.process_recurring_items() to public, anon;
