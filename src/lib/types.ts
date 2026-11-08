// Row shapes for the GC_Tracker Supabase schema (public).

export type ItemType = 'grocery' | 'household' | 'misc';
export type ItemStatus = 'to_buy' | 'bought';
export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly';
export type ExpenseCategory = 'grocery' | 'household' | 'misc';
export type MemberRole = 'admin' | 'member';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Member {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface Store {
  id: string;
  household_id: string | null;
  name: string;
  is_preset: boolean;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  name_hindi: string | null;
  icon: string | null;
  item_type: ItemType;
  sort_order: number;
}

export interface CatalogItem {
  id: string;
  category_id: string | null;
  name: string;
  name_hindi: string | null;
  synonyms: string[] | null;
  default_unit: string | null;
  available_units: string[] | null;
  item_type: ItemType;
  suggested_stores: string[] | null;
}

export interface CustomItem {
  id: string;
  household_id: string;
  category_id: string | null;
  name: string;
  default_unit: string;
  available_units: string[];
  item_type: ItemType;
  usage_count: number;
}

export interface GroceryList {
  id: string;
  household_id: string;
  store_id: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  catalog_item_id: string | null;
  custom_item_id: string | null;
  item_name: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  status: ItemStatus;
  added_by: string | null;
  bought_by: string | null;
  bought_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringItem {
  id: string;
  household_id: string;
  store_id: string;
  catalog_item_id: string | null;
  custom_item_id: string | null;
  item_name: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  frequency: Frequency;
  day_of_week: number | null;
  day_of_month: number | null;
  is_active: boolean;
  last_added_at: string | null;
  next_add_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  household_id: string;
  store_id: string | null;
  store_name: string | null;
  amount: number;
  category: ExpenseCategory;
  expense_date: string;
  notes: string | null;
  added_by: string | null;
  created_at: string;
}

/** An item the user can pick: from the shared catalog or the household's own items. */
export type Pickable =
  | { kind: 'catalog'; item: CatalogItem }
  | { kind: 'custom'; item: CustomItem };
