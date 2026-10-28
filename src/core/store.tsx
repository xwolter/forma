import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { commit, emptyData, loadData, seedCatalog, type Mutation } from "./db";
import type { AppData, TableName, Tables } from "./types";
import { pauseRunningSessions } from './workouts';
import { recoverNotificationSession } from './workoutNotification';

type Store = {
  data: AppData;
  loading: boolean;
  error: string;
  mutate: (ops: Mutation[]) => Promise<void>;
  put: <K extends TableName>(table: K, value: Tables[K]) => Promise<void>;
  remove: (table: TableName, id: string) => Promise<void>;
  reload: () => Promise<void>;
  busy: boolean;
};
const StoreContext = createContext<Store | null>(null);
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("forma-data");
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setData(await loadData());
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await seedCatalog();
        if(!(await recoverNotificationSession()))await pauseRunningSessions();
        const d = await loadData();
        if (active) {
          setData(d);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError(
            "Nie udało się otworzyć pamięci telefonu. Zwolnij miejsce i spróbuj ponownie.",
          );
          setLoading(false);
        }
      }
    })();
    const listener = () => {
      void reload().catch(() => setError("Nie udało się odświeżyć danych."));
    };
    channel?.addEventListener("message", listener);
    return () => {
      active = false;
      channel?.removeEventListener("message", listener);
    };
  }, [reload]);
  const mutate = useCallback(
    async (ops: Mutation[]) => {
      if (!ops.length) return;
      setBusy(true);
      try {
        await commit(ops);
        await reload();
        channel?.postMessage("change");
      } catch {
        throw new Error(
          "Nie udało się zapisać. Sprawdź wolne miejsce i spróbuj ponownie.",
        );
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  const put = useCallback(
    <K extends TableName>(table: K, value: Tables[K]) =>
      mutate([{ table, value }]),
    [mutate],
  );
  const remove = useCallback(
    (table: TableName, id: string) => mutate([{ table, remove: id }]),
    [mutate],
  );
  return (
    <StoreContext.Provider
      value={{ data, loading, error, mutate, put, remove, reload, busy }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export const useStore = () => {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Brak dostawcy danych");
  return store;
};
