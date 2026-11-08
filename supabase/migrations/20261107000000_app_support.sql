-- Grocery Tracker app support (2026-11-07)
-- Rollback: supabase/rollback/20261107000000_app_support_down.sql

-- 1. Security fix: the views ran as their owner, which skips row-level security,
--    so anyone holding the public key could read every household's lists,
--    repeats and spending through them. Make them run as the caller instead.
alter view public.list_items_view set (security_invoker = true);
alter view public.recurring_items_view set (security_invoker = true);
alter view public.monthly_spend_summary set (security_invoker = true);
alter view public.weekly_spend_summary set (security_invoker = true);
alter view public.monthly_category_totals set (security_invoker = true);
alter view public.monthly_store_totals set (security_invoker = true);

-- 2. Join a household with its invite code. Members can't read other
--    households, so the lookup has to happen in a security-definer function.
create or replace function public.join_household(p_invite_code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_household public.households;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_household
  from public.households
  where upper(invite_code) = upper(trim(p_invite_code));

  if not found then
    raise exception 'That invite code does not match a household';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_household.id, v_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  return v_household;
end;
$$;

revoke execute on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- 3. Close a gap: this policy let any signed-in user add themselves to any
--    household whose id they knew. create_household() and join_household()
--    are the supported ways in, and both run as the table owner.
drop policy if exists "Users can create membership when creating household" on public.household_members;

-- 4. Bought items can be saved with a trip's expense without a per-item price.
alter table public.expense_items alter column price drop not null;

-- 5. Repeats: don't add an item that is already waiting on that store's list,
--    and only signed-in users may trigger the run.
create or replace function public.process_recurring_items()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_recurring record;
  v_list_id uuid;
begin
  for v_recurring in
    select ri.*
    from public.recurring_items ri
    where ri.is_active = true
      and ri.next_add_date <= current_date
  loop
    select id into v_list_id
    from public.grocery_lists
    where household_id = v_recurring.household_id
      and store_id = v_recurring.store_id
      and is_active = true
    limit 1;

    if v_list_id is null then
      insert into public.grocery_lists (household_id, store_id, is_active)
      values (v_recurring.household_id, v_recurring.store_id, true)
      returning id into v_list_id;
    end if;

    if not exists (
      select 1 from public.list_items li
      where li.list_id = v_list_id
        and li.status = 'to_buy'
        and (
          (v_recurring.catalog_item_id is not null and li.catalog_item_id = v_recurring.catalog_item_id)
          or (v_recurring.custom_item_id is not null and li.custom_item_id = v_recurring.custom_item_id)
          or (v_recurring.catalog_item_id is null and v_recurring.custom_item_id is null
              and lower(li.item_name) = lower(v_recurring.item_name))
        )
    ) then
      insert into public.list_items (
        list_id, catalog_item_id, custom_item_id, item_name,
        quantity, unit, notes, status, added_by
      ) values (
        v_list_id, v_recurring.catalog_item_id, v_recurring.custom_item_id, v_recurring.item_name,
        v_recurring.quantity, v_recurring.unit,
        trim(coalesce(v_recurring.notes, '') || ' [Auto-added]'),
        'to_buy', v_recurring.created_by
      );
      v_count := v_count + 1;
    end if;

    -- Moves next_add_date forward (via the set_recurring_next_add_date trigger).
    update public.recurring_items set last_added_at = now() where id = v_recurring.id;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.process_recurring_items() from public, anon;
grant execute on function public.process_recurring_items() to authenticated;
