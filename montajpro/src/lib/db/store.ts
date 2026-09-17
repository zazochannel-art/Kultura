/**
 * Store-ul reactiv local-first.
 *
 * - Toate citirile din UI vin din memorie (populată din IndexedDB la pornire).
 * - Scrierile merg instant în memorie + IndexedDB, apoi intră în „outbox”.
 * - Motorul de sincronizare (`sync.ts`) golește outbox-ul spre Supabase când
 *   există rețea și sesiune.
 *
 * Ștergerile sunt logice (`deleted_at`) ca să se propage corect între
 * dispozitive; selectorii le filtrează.
 */
import {
  BLOB_STORE,
  OUTBOX_STORE,
  idbBulkPut,
  idbClear,
  idbGetAll,
  idbPut,
  metaGet,
  metaSet,
} from "./idb";
import { TABLE_NAMES } from "../types";
import type { BaseRow, TableName, Tables } from "../types";
import { nowISO, uid } from "../utils";

export type State = { [K in TableName]: Tables[K][] };

export interface OutboxEntry {
  /** `table:id` — o singură intrare per rând, ultima stare câștigă. */
  key: string;
  table: TableName;
  id: string;
  queued_at: string;
}

function emptyState(): State {
  return TABLE_NAMES.reduce((acc, table) => {
    acc[table] = [];
    return acc;
  }, {} as State);
}

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "local";

/** Starea sincronizării, ca obiect stabil pentru `useSyncExternalStore`. */
export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
  ready: boolean;
}

const INITIAL_SYNC_STATE: SyncState = {
  status: "idle",
  pending: 0,
  lastSyncAt: null,
  error: null,
  ready: false,
};

export class Store {
  private state: State = emptyState();
  private listeners = new Set<() => void>();
  private outbox = new Map<string, OutboxEntry>();

  ready = false;
  userId = "";
  private syncState: SyncState = INITIAL_SYNC_STATE;

  /* ------------------------- abonare (React) ------------------------ */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): State => this.state;

  getTable = <K extends TableName>(table: K): Tables[K][] =>
    this.state[table] as Tables[K][];

  getSyncState = (): SyncState => this.syncState;

  static readonly initialSyncState = INITIAL_SYNC_STATE;

  private patchSync(patch: Partial<SyncState>) {
    this.syncState = { ...this.syncState, ...patch };
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  /* ------------------------- pornire -------------------------------- */

  /**
   * Încarcă datele din IndexedDB. Dacă utilizatorul s-a schimbat (alt cont pe
   * același telefon), cache-ul local se golește ca să nu amestecăm datele.
   */
  async boot(userId: string) {
    const previous = await metaGet<string>("user_id");
    if (previous && previous !== userId) {
      await this.wipeLocal();
    }
    await metaSet("user_id", userId);
    this.userId = userId;

    const next = emptyState();
    for (const table of TABLE_NAMES) {
      const rows = await idbGetAll<BaseRow>(table);
      // @ts-expect-error — tabel cu tabel, tipul concret e garantat de schemă.
      next[table] = rows.filter((row) => !row.user_id || row.user_id === userId);
    }
    this.state = next;

    const queued = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
    this.outbox = new Map(queued.map((entry) => [entry.key, entry]));

    this.ready = true;
    this.patchSync({ ready: true, pending: this.outbox.size });
    this.emit();
  }

  async wipeLocal() {
    for (const table of TABLE_NAMES) await idbClear(table);
    await idbClear(OUTBOX_STORE);
    await idbClear(BLOB_STORE);
    for (const table of TABLE_NAMES) await metaSet(`cursor:${table}`, null);
    this.state = emptyState();
    this.outbox.clear();
    this.ready = false;
    this.patchSync({ ready: false, pending: 0, lastSyncAt: null, error: null });
    this.emit();
  }

  /* ------------------------- scrieri -------------------------------- */

  private async persist<K extends TableName>(table: K, row: Tables[K]) {
    const rows = this.state[table] as BaseRow[];
    const index = rows.findIndex((r) => r.id === row.id);
    const nextRows = index >= 0 ? [...rows] : [...rows, row];
    if (index >= 0) nextRows[index] = row;
    this.state = { ...this.state, [table]: nextRows };
    await idbPut(table, row);
    this.emit();
  }

  private async enqueue(table: TableName, id: string) {
    const entry: OutboxEntry = {
      key: `${table}:${id}`,
      table,
      id,
      queued_at: nowISO(),
    };
    this.outbox.set(entry.key, entry);
    this.patchSync({ pending: this.outbox.size });
    await idbPut(OUTBOX_STORE, entry);
  }

  async insert<K extends TableName>(
    table: K,
    data: Partial<Tables[K]>,
  ): Promise<Tables[K]> {
    const timestamp = nowISO();
    const row = {
      ...data,
      id: (data.id as string) || uid(),
      user_id: this.userId,
      created_at: (data.created_at as string) || timestamp,
      updated_at: timestamp,
      deleted_at: null,
    } as Tables[K];
    await this.persist(table, row);
    await this.enqueue(table, row.id);
    return row;
  }

  async update<K extends TableName>(
    table: K,
    id: string,
    patch: Partial<Tables[K]>,
  ): Promise<Tables[K] | null> {
    const current = (this.state[table] as BaseRow[]).find((r) => r.id === id);
    if (!current) return null;
    const row = { ...current, ...patch, updated_at: nowISO() } as Tables[K];
    await this.persist(table, row);
    await this.enqueue(table, id);
    return row;
  }

  /** Ștergere logică — rândul rămâne local până la sincronizare. */
  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    await this.update(table, id, { deleted_at: nowISO() } as Partial<Tables[K]>);
  }

  /** Șterge mai multe rânduri (ex. lucrarea și tot ce atârnă de ea). */
  async removeMany(entries: { table: TableName; id: string }[]): Promise<void> {
    for (const entry of entries) await this.remove(entry.table, entry.id);
  }

  /* ------------------------- sincronizare --------------------------- */

  getOutbox(): OutboxEntry[] {
    return [...this.outbox.values()];
  }

  outboxSize(): number {
    return this.outbox.size;
  }

  async clearOutboxEntries(keys: string[]) {
    const { idbDelete } = await import("./idb");
    for (const key of keys) {
      this.outbox.delete(key);
      await idbDelete(OUTBOX_STORE, key);
    }
    this.patchSync({ pending: this.outbox.size });
    this.emit();
  }

  /**
   * Aplică rânduri venite de la server. Rândurile aflate încă în outbox nu se
   * suprascriu: modificarea locală este mai nouă și urmează să fie trimisă.
   */
  async applyRemote<K extends TableName>(table: K, remoteRows: Tables[K][]) {
    if (!remoteRows.length) return;
    const rows = this.state[table] as BaseRow[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const toStore: BaseRow[] = [];

    for (const remote of remoteRows as unknown as BaseRow[]) {
      if (this.outbox.has(`${table}:${remote.id}`)) continue;
      const local = byId.get(remote.id);
      if (local && new Date(local.updated_at) > new Date(remote.updated_at)) continue;
      byId.set(remote.id, remote);
      toStore.push(remote);
    }

    if (!toStore.length) return;
    this.state = { ...this.state, [table]: [...byId.values()] };
    await idbBulkPut(table, toStore);
    this.emit();
  }

  setSyncStatus(status: SyncStatus, error: string | null = null) {
    this.patchSync({
      status,
      error,
      pending: this.outbox.size,
      lastSyncAt: status === "idle" ? nowISO() : this.syncState.lastSyncAt,
    });
    this.emit();
  }
}

export const store = new Store();
