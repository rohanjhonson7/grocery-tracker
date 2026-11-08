# Grocery Tracker

Phone-first web app for shared household grocery lists, built on the existing Supabase project **GC_Tracker** (`sfhsvnjxleryfvqcrbxo`).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also on your Wi-Fi IP, for testing on a phone)
npm run build      # type-check + production build into dist/
```

Config lives in `.env.local` (see `.env.example`). The publishable key is meant for browsers; row-level security protects the data.

## Screens

| Route | What it does | Tables |
|---|---|---|
| `/` | Lists per store, quick add, upcoming repeats | grocery_lists, list_items, recurring_items |
| `/list/:id` | Shop a list: tick items off, live across the household | list_items (realtime) |
| `/list/:id/finish` | Keep or move leftovers, clear the cart, optionally log spend | expenses, expense_items |
| `/repeats` | Weekly / biweekly / monthly / bimonthly items | recurring_items |
| `/spending` | Monthly total, by store, by category | expenses |
| `/family` | Household, members, invite code, stores, Hindi names | households, household_members, profiles, stores |

Due repeats are added by `process_recurring_items()`, which the app calls once a day per device when it opens.

## Database update

`supabase/migrations/20261107000000_app_support.sql` must be run once (Supabase dashboard → SQL Editor). It:

1. **Fixes a data leak**: the six views ran as their owner and skipped row-level security, so anyone with the public key could read every household's lists and spending through them.
2. Adds `join_household(invite_code)` so family can join with the code.
3. Removes a policy that let any signed-in user add themselves to a household by id.
4. Lets trip item breakdowns be saved without per-item prices.
5. Stops repeats from adding an item that's already waiting on the list.

To undo it: `supabase/rollback/20261107000000_app_support_down.sql`.
