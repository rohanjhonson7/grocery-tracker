import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { RealtimePostgresChangesPayload, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  CatalogItem, Category, CustomItem, GroceryList, Household, ListItem, Member, Pickable, Profile, RecurringItem, Store,
} from './types';
import { splitNote, todayISO } from './util';

// ---------------------------------------------------------------- auth

const SessionCtx = createContext<Session | null | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return <SessionCtx.Provider value={session}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);

// ---------------------------------------------------------------- toast

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-wrap" aria-live="polite">{msg && <div className="toast">{msg}</div>}</div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- household data

export interface ItemInfo {
  name: string;
  hindi: string | null;
  category: Category | null;
  note: string;
  auto: boolean;
}

export interface AddItemInput {
  storeId: string;
  pick: Pickable;
  quantity: number;
  unit: string;
  notes?: string;
}

interface AppData {
  userId: string;
  profile: Profile | null;
  households: Household[];
  household: Household | null;
  role: Member['role'] | null;
  loading: boolean;
  live: boolean;
  categories: Category[];
  catalog: CatalogItem[];
  customItems: CustomItem[];
  stores: Store[];
  lists: GroceryList[];
  items: ListItem[];
  recurring: RecurringItem[];
  members: Member[];
  profiles: Record<string, Profile>;
  showHindi: boolean;
  setShowHindi: (v: boolean) => void;
  switchHousehold: (id: string) => void;
  reloadHouseholds: () => Promise<void>;
  refreshLists: () => Promise<void>;
  refreshRecurring: () => Promise<void>;
  refreshCustom: () => Promise<void>;
  refreshStores: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  storeById: (id: string | null | undefined) => Store | undefined;
  itemInfo: (li: Pick<ListItem, 'item_name' | 'catalog_item_id' | 'custom_item_id' | 'notes'>) => ItemInfo;
  personName: (id: string | null | undefined) => string;
  ensureList: (storeId: string) => Promise<string>;
  addItem: (input: AddItemInput) => Promise<void>;
  toggleItem: (li: ListItem) => Promise<void>;
  updateItem: (id: string, patch: Partial<ListItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

const AppCtx = createContext<AppData | null>(null);

export function useApp(): AppData {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export function AppProvider({ session, children }: { session: Session; children: ReactNode }) {
  const userId = session.user.id;
  const toast = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [myMemberships, setMyMemberships] = useState<Member[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(() => readPref('gt.household', '') || null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [items, setItems] = useState<ListItem[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [showHindi, setShowHindiState] = useState(() => readPref('gt.showHindi', '1') === '1');

  const listsRef = useRef<GroceryList[]>([]);
  listsRef.current = lists;
  const itemsRef = useRef<ListItem[]>([]);
  itemsRef.current = items;

  const household = households.find((h) => h.id === householdId) ?? null;
  const role = myMemberships.find((m) => m.household_id === householdId)?.role ?? null;

  const setShowHindi = (v: boolean) => {
    setShowHindiState(v);
    writePref('gt.showHindi', v ? '1' : '0');
  };

  // ---- loaders

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile(data as Profile | null);
  }, [userId]);

  const reloadHouseholds = useCallback(async () => {
    const { data: mem } = await supabase.from('household_members').select('*').eq('user_id', userId);
    const memberships = (mem ?? []) as Member[];
    setMyMemberships(memberships);
    if (!memberships.length) {
      setHouseholds([]);
      setHouseholdId(null);
      return;
    }
    const { data: hh } = await supabase
      .from('households')
      .select('*')
      .in('id', memberships.map((m) => m.household_id))
      .order('created_at');
    const list = (hh ?? []) as Household[];
    setHouseholds(list);
    setHouseholdId((cur) => (cur && list.some((h) => h.id === cur) ? cur : list[0]?.id ?? null));
  }, [userId]);

  const loadReference = useCallback(async () => {
    const [cats, cat] = await Promise.all([
      supabase.from('item_categories').select('*').order('sort_order'),
      supabase.from('catalog_items').select('*').order('name'),
    ]);
    setCategories((cats.data ?? []) as Category[]);
    setCatalog((cat.data ?? []) as CatalogItem[]);
  }, []);

  const refreshStores = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase.from('stores').select('*').order('sort_order').order('name');
    const all = (data ?? []) as Store[];
    const mine = all.filter((s) => s.household_id === null || s.household_id === householdId);
    mine.sort((a, b) => Number(b.is_preset) - Number(a.is_preset) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    setStores(mine);
  }, [householdId]);

  const refreshCustom = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase.from('custom_items').select('*').eq('household_id', householdId).order('usage_count', { ascending: false });
    setCustomItems((data ?? []) as CustomItem[]);
  }, [householdId]);

  const refreshItemsFor = useCallback(async (ls: GroceryList[]) => {
    if (!ls.length) {
      setItems([]);
      return;
    }
    const { data } = await supabase.from('list_items').select('*').in('list_id', ls.map((l) => l.id)).order('created_at');
    setItems((data ?? []) as ListItem[]);
  }, []);

  const refreshLists = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('created_at');
    const ls = (data ?? []) as GroceryList[];
    setLists(ls);
    listsRef.current = ls;
    await refreshItemsFor(ls);
  }, [householdId, refreshItemsFor]);

  const refreshRecurring = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('household_id', householdId)
      .order('next_add_date', { ascending: true, nullsFirst: false });
    setRecurring((data ?? []) as RecurringItem[]);
  }, [householdId]);

  const refreshMembers = useCallback(async () => {
    if (!householdId) return;
    const { data } = await supabase.from('household_members').select('*').eq('household_id', householdId).order('joined_at');
    const ms = (data ?? []) as Member[];
    setMembers(ms);
    if (ms.length) {
      const { data: ps } = await supabase.from('profiles').select('*').in('id', ms.map((m) => m.user_id));
      const map: Record<string, Profile> = {};
      for (const p of (ps ?? []) as Profile[]) map[p.id] = p;
      setProfiles(map);
    }
  }, [householdId]);

  // first load: profile, memberships, reference data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.all([refreshProfile(), reloadHouseholds(), loadReference()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile, reloadHouseholds, loadReference]);

  // per-household data
  useEffect(() => {
    if (!householdId) return;
    writePref('gt.household', householdId);
    setLists([]);
    setItems([]);
    let cancelled = false;
    (async () => {
      await Promise.all([refreshStores(), refreshCustom(), refreshLists(), refreshRecurring(), refreshMembers()]);
      // Run due repeats at most once a day per device.
      const key = 'gt.repeats.' + householdId;
      if (!cancelled && readPref(key, '') !== todayISO()) {
        const { data, error } = await supabase.rpc('process_recurring_items');
        if (!error) {
          writePref(key, todayISO());
          if (typeof data === 'number' && data > 0) {
            await Promise.all([refreshLists(), refreshRecurring()]);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [householdId, refreshStores, refreshCustom, refreshLists, refreshRecurring, refreshMembers]);

  // live updates
  useEffect(() => {
    if (!householdId) return;
    const onItem = (p: RealtimePostgresChangesPayload<ListItem>) => {
      const listIds = new Set(listsRef.current.map((l) => l.id));
      if (p.eventType === 'DELETE') {
        const id = (p.old as Partial<ListItem>).id;
        if (id) setItems((cur) => cur.filter((i) => i.id !== id));
        return;
      }
      const row = p.new as ListItem;
      setItems((cur) => {
        const without = cur.filter((i) => i.id !== row.id);
        return listIds.has(row.list_id) ? [...without, row] : without;
      });
    };
    const channel = supabase
      // Unique per subscription so a quick unmount/remount never reuses a closing channel.
      .channel(`household-${householdId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_items' }, onItem)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_lists', filter: `household_id=eq.${householdId}` }, () => {
        void refreshLists();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_items', filter: `household_id=eq.${householdId}` }, () => {
        void refreshRecurring();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, () => {
        void refreshMembers();
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [householdId, refreshLists, refreshRecurring, refreshMembers]);

  // ---- lookups

  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const customById = useMemo(() => new Map(customItems.map((c) => [c.id, c])), [customItems]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const storeById = useCallback((id: string | null | undefined) => (id ? storeMap.get(id) : undefined), [storeMap]);

  const itemInfo = useCallback(
    (li: Pick<ListItem, 'item_name' | 'catalog_item_id' | 'custom_item_id' | 'notes'>): ItemInfo => {
      const cat = li.catalog_item_id ? catalogById.get(li.catalog_item_id) : undefined;
      const cus = li.custom_item_id ? customById.get(li.custom_item_id) : undefined;
      const categoryId = cat?.category_id ?? cus?.category_id ?? null;
      const { note, auto } = splitNote(li.notes);
      return {
        name: li.item_name || cus?.name || cat?.name || 'Item',
        hindi: cat?.name_hindi ?? null,
        category: categoryId ? categoryById.get(categoryId) ?? null : null,
        note,
        auto,
      };
    },
    [catalogById, customById, categoryById],
  );

  const personName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return 'someone';
      if (id === userId) return 'you';
      const n = profiles[id]?.full_name;
      return n ? n.split(/\s+/)[0] : 'someone';
    },
    [profiles, userId],
  );

  // ---- actions

  const ensureList = useCallback(
    async (storeId: string) => {
      if (!householdId) throw new Error('No household');
      const existing = listsRef.current.find((l) => l.store_id === storeId);
      if (existing) return existing.id;
      const { data: found } = await supabase
        .from('grocery_lists')
        .select('*')
        .eq('household_id', householdId)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .maybeSingle();
      let list = found as GroceryList | null;
      if (!list) {
        const { data, error } = await supabase
          .from('grocery_lists')
          .insert({ household_id: householdId, store_id: storeId, is_active: true })
          .select()
          .single();
        if (error) throw error;
        list = data as GroceryList;
      }
      const next = [...listsRef.current.filter((l) => l.id !== list!.id), list];
      listsRef.current = next;
      setLists(next);
      return list.id;
    },
    [householdId],
  );

  const addItem = useCallback(
    async ({ storeId, pick, quantity, unit, notes }: AddItemInput) => {
      const listId = await ensureList(storeId);
      const row = {
        list_id: listId,
        catalog_item_id: pick.kind === 'catalog' ? pick.item.id : null,
        custom_item_id: pick.kind === 'custom' ? pick.item.id : null,
        quantity,
        unit,
        notes: notes?.trim() || null,
        added_by: userId,
      };
      const { data, error } = await supabase.from('list_items').insert(row).select().single();
      if (error) throw error;
      setItems((cur) => [...cur.filter((i) => i.id !== (data as ListItem).id), data as ListItem]);
      if (pick.kind === 'custom') {
        const next = pick.item.usage_count + 1;
        setCustomItems((cur) => cur.map((c) => (c.id === pick.item.id ? { ...c, usage_count: next } : c)));
        await supabase.from('custom_items').update({ usage_count: next }).eq('id', pick.item.id);
      }
    },
    [ensureList, userId],
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<ListItem>) => {
      const before = itemsRef.current.find((i) => i.id === id);
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      const { error } = await supabase.from('list_items').update(patch).eq('id', id);
      if (error) {
        if (before) setItems((cur) => cur.map((i) => (i.id === id ? before : i)));
        toast("Couldn't save that change. Check your connection.");
      }
    },
    [toast],
  );

  const toggleItem = useCallback(
    async (li: ListItem) => {
      const bought = li.status !== 'bought';
      await updateItem(li.id, {
        status: bought ? 'bought' : 'to_buy',
        bought_by: bought ? userId : null,
        bought_at: bought ? new Date().toISOString() : null,
      });
    },
    [updateItem, userId],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const before = itemsRef.current.find((i) => i.id === id);
      setItems((cur) => cur.filter((i) => i.id !== id));
      const { error } = await supabase.from('list_items').delete().eq('id', id);
      if (error) {
        if (before) setItems((cur) => [...cur, before]);
        toast("Couldn't remove that item.");
      }
    },
    [toast],
  );

  const switchHousehold = (id: string) => setHouseholdId(id);

  const value: AppData = {
    userId, profile, households, household, role, loading, live,
    categories, catalog, customItems, stores, lists, items, recurring, members, profiles,
    showHindi, setShowHindi, switchHousehold, reloadHouseholds,
    refreshLists, refreshRecurring, refreshCustom, refreshStores, refreshMembers, refreshProfile,
    storeById, itemInfo, personName, ensureList, addItem, toggleItem, updateItem, deleteItem,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
