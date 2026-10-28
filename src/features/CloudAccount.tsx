import { useEffect, useState } from "react";
import { Cloud, CloudOff } from '../ui/icons';
import { cloudConfig } from "../core/cloudConfig";
import type { CloudAccount as Account, CloudBackup } from "../core/cloud";
import { dbPromise, restoreBackup } from "../core/db";
import { useStore } from "../core/store";
import { Button, Confirm, Field, useUI } from "../ui/UI";

export function CloudAccount() {
  const { reload } = useStore();
  const { show, toast } = useUI();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [message, setMessage] = useState("");
  const [lastBackup, setLastBackup] = useState("");
  useEffect(() => {
    if (!cloudConfig) return;
    let active = true;
    let stop = () => {};
    void import("../core/cloud")
      .then((c) => {
        if (active)
          stop = c.observeAccount((a) => {
            setAccount(a);
            setReady(true);
            setBackups([]);
          });
      })
      .catch(() => {
        if (active)
          setMessage(
            "Nie udało się otworzyć konta. Zapis lokalny nadal działa.",
          );
      });
    void dbPromise
      .then((db) => db.get("meta", "cloud-last-backup"))
      .then((v) => {
        if (active) setLastBackup(v ?? "");
      });
    return () => {
      active = false;
      stop();
    };
  }, []);
  async function action(
    fn: (c: typeof import("../core/cloud")) => Promise<void>,
  ) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const c = await import("../core/cloud");
      try {
        await fn(c);
      } catch (e) {
        setMessage(c.cloudError(e));
      }
    } catch {
      setMessage("Nie udało się otworzyć chmury. Dane telefonu są zachowane.");
    } finally {
      setBusy(false);
    }
  }
  if (!cloudConfig)
    return (
      <div className="inline-note">
        <CloudOff size={22} />
        <p>
          <strong>Zapis na tym urządzeniu</strong>
          <br />
          Projekt Firebase czeka na podłączenie konta właściciela. Logowanie i
          kopia w chmurze nie są jeszcze aktywne. Przed zmianą telefonu
          wyeksportuj kopię JSON.
        </p>
      </div>
    );
  return (
    <section className="cloud-account">
      <h3 className="subheading">
        <Cloud size={20} /> Twoje konto i kopie
      </h3>
      {!ready ? (
        <p>Sprawdzanie konta…</p>
      ) : !account ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async (c) => {
              if (creating) {
                await c.createAccount(email, password);
                setMessage("Wysłaliśmy link potwierdzający e-mail.");
              } else await c.login(email, password);
              setPassword("");
            });
          }}
        >
          <p className="muted">
            Konto służy do prywatnych kopii danych. Wysyłanie kopii uruchamiasz
            samodzielnie.
          </p>
          <Field label="E-mail konta">
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={creating ? "Hasło · co najmniej 12 znaków" : "Hasło"}>
            <input
              type="password"
              required
              minLength={creating ? 12 : 1}
              maxLength={128}
              autoComplete={creating ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy} className="full">
            {busy ? "Łączenie…" : creating ? "Utwórz konto" : "Zaloguj się"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setCreating((v) => !v);
              setMessage("");
            }}
          >
            {creating ? "Mam już konto" : "Utwórz nowe konto"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void action(async (c) => {
                await c.resetPassword(email);
                setMessage(
                  "Jeśli konto istnieje, otrzymasz instrukcję odzyskania hasła.",
                );
              })
            }
          >
            Nie pamiętam hasła
          </Button>
        </form>
      ) : (
        <>
          <p>
            <strong>{account.email}</strong>
          </p>
          {!account.verified ? (
            <>
              <p className="inline-warning">
                Potwierdź adres e-mail przed korzystaniem z kopii.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void action(async (c) => {
                    setAccount(await c.refreshAccount());
                  })
                }
              >
                Sprawdź potwierdzenie
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void action(async (c) => {
                    await c.resendVerification();
                    setMessage("Wysłaliśmy ponownie link potwierdzający.");
                  })
                }
              >
                Wyślij link ponownie
              </Button>
            </>
          ) : (
            <>
              <p className="muted">
                Kopia obejmuje treningi, jedzenie, pomiary, plany i ustawienia.
                Własne filmy przenoś kopią JSON z filmami. To ręczne kopie, bez
                automatycznego łączenia zmian z innych telefonów.
              </p>
              {lastBackup && (
                <p className="small muted">
                  Ostatnia kopia z telefonu:{" "}
                  {new Date(lastBackup).toLocaleString("pl-PL")}
                </p>
              )}
              <Button
                disabled={busy}
                className="full"
                onClick={() =>
                  void action(async (c) => {
                    const b = await c.createCloudBackup();
                    setLastBackup(b.createdAt);
                    setMessage("Kopia została zapisana na Twoim koncie.");
                  })
                }
              >
                {busy ? "Pracuję…" : "Utwórz kopię w Firebase"}
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                className="full"
                onClick={() =>
                  void action(async (c) => {
                    const list = await c.listCloudBackups();
                    setBackups(list);
                    if (!list.length)
                      setMessage(
                        "Na tym koncie nie ma jeszcze kompletnej kopii.",
                      );
                  })
                }
              >
                Pokaż kopie tego konta
              </Button>
              {backups.map((b) => (
                <button
                  key={b.id}
                  className="list-row"
                  disabled={busy}
                  onClick={() =>
                    void action(async (c) => {
                      const data = await c.readCloudBackup(b);
                      show(
                        <Confirm
                          title="Przywrócić kopię z Firebase?"
                          text={`Kopia z ${new Date(b.createdAt).toLocaleString("pl-PL")}, ${b.count} rekordów. Zastąpi wpisy i ustawienia oraz usunie własne lokalne filmy, których chmura nie zawiera. Najpierw wyeksportuj obecną kopię JSON z filmami.`}
                          confirm="Przywróć tę kopię"
                          onConfirm={async () => {
                            await restoreBackup(data);
                            await (
                              await dbPromise
                            ).put("meta", account.uid, "cloud-owner");
                            await reload();
                            toast("Kopia z Firebase przywrócona");
                          }}
                        />,
                      );
                    })
                  }
                >
                  <span>
                    <strong>
                      {new Date(b.createdAt).toLocaleString("pl-PL")}
                    </strong>
                    <small>
                      {b.count} rekordów · dotknij, aby przejrzeć przywracanie
                    </small>
                  </span>
                </button>
              ))}
            </>
          )}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void action(async (c) => {
                await c.logout();
                setPassword("");
                setMessage(
                  "Wylogowano. Dane lokalne pozostają na tym telefonie; usuń je w ustawieniach, jeśli telefon przekazujesz innej osobie.",
                );
              })
            }
          >
            Wyloguj się
          </Button>
        </>
      )}
      {message && (
        <p role="status" className="inline-note">
          {message}
        </p>
      )}
    </section>
  );
}
