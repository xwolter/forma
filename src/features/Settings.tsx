import {resultMetric,resultUnit} from '../core/exerciseMetrics';
import legacyFoods from '../data/foods-usda-legacy.json';
import { backupData } from '../core/db';
import { useRef, useState } from "react";
import { version as appVersion } from "../../package.json";
import importedFoods from "../data/foods-pl.json";
import usdaFoods from '../data/foods-usda.json';
import { Widgets } from './Widgets';
import { Updates } from './Updates';
import {
  ChevronRight,
  Calculator,
  BookOpen,
  Download,
  Dumbbell,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  Target,
  Palette,
  MapPin,
  LayoutGrid,
  CloudArrowUp,
  ArrowCircleUp,
} from '../ui/icons';
import {
  clearAll,
  commit,
  dbPromise,
  loadData,
  restoreBackup,
  seedCatalog,
  validateBackup,
} from "../core/db";
import { stamp } from "../core/catalog";
import { fmt, localDate, numberInput } from "../core/math";
import {
  exportFile,
  notificationPermission,
  setupNotifications,
  spotifyUrl,
} from "../core/native";
import { useStore } from "../core/store";
import type { Equipment, Media } from "../core/types";
import { Button, Confirm, Field, Sheet, Toggle, useUI } from "../ui/UI";
import { GoalForm } from "./forms";
import { Calculators } from "./Calculators";
import { TrainingGlossary } from "./TrainingGlossary";
import { CloudAccount } from "./CloudAccount";

export function Settings() {
  const { data, put, reload } = useStore();
  const { show, run, toast } = useUI();
  const profile = data.profiles[0];
  const [view, setView] = useState<"home" | "profile" | "appearance" | "equipment" | "data">("home");
  const [name, setName] = useState(profile.name);
  const [water, setWater] = useState(
    profile.waterGoal ? String(profile.waterGoal) : "",
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [spotify, setSpotify] = useState(profile.spotify ?? "");
  const [height, setHeight] = useState(
    profile.height ? String(profile.height) : "",
  );
  const [age, setAge] = useState(profile.age ? String(profile.age) : "");
  const patch = (change: Partial<typeof profile>) =>
    put("profiles", {
      ...profile,
      ...change,
      updatedAt: new Date().toISOString(),
    });
  async function backup() {
    const allData = backupData(await loadData());
    const media = includeMedia ? await (await dbPromise).getAll("media") : [];
    const serialized = await Promise.all(
      media.map(async (m) => {
        const buffer = await m.blob.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return { ...m, blob: btoa(binary) };
      }),
    );
    await exportFile(
      `FORMA-kopia-${localDate()}.json`,
      JSON.stringify({
        format: "forma-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        data: allData,
        media: serialized,
      }),
    );
  }
  async function importFile(file: File) {
    if (file.size > 200 * 1024 * 1024)
      throw new Error("Kopia jest zbyt duża. Maksymalnie 200 MB.");
    const parsed = JSON.parse(await file.text());
    const next = validateBackup(parsed);
    const media = Array.isArray(parsed.media) ? parsed.media : [];
    if (
      media.length > 100 ||
      media.some(
        (m: Record<string, unknown>) =>
          typeof m.id !== "string" ||
          typeof m.blob !== "string" ||
          typeof m.mime !== "string" ||
          !m.mime.startsWith("video/"),
      )
    )
      throw new Error("Nieprawidłowe filmy w kopii.");
    const files: Media[] = media.map((m: Record<string, string>) => {
      const bytes = Uint8Array.from(atob(m.blob), (c: string) =>
        c.charCodeAt(0),
      );
      if (bytes.length > 50 * 1024 * 1024)
        throw new Error("Film w kopii przekracza 50 MB.");
      return {
        ...stamp(m.id),
        exerciseId: m.id,
        blob: new Blob([bytes], { type: m.mime }),
        mime: m.mime,
        name: String(m.name ?? "film"),
      };
    });
    show(
      <Confirm
        title="Przywrócić kopię danych?"
        text={`Kopia zawiera ${next.sessions.length} treningów, ${next.food.length} wpisów jedzenia, ${next.measurements.length} pomiarów i ${files.length} filmów. Zastąpi bieżące dane i filmy na tym urządzeniu. Najpierw wyeksportuj obecną kopię.`}
        confirm="Przywróć kopię"
        onConfirm={async () => {
          await restoreBackup(next, files);
          await reload();
          toast("Kopia przywrócona");
        }}
      />,
    );
  }
  async function csv() {
    const escape = (value: unknown) => {
      let s = String(value ?? "");
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return `"${s.replaceAll('"', '""')}"`;
    };
    const lines = [
      [
        "typ",
        "data",
        "nazwa",
        "ciężar_kg",
        "wynik",
        "porcja",
        "jednostka",
        "kcal",
        "białko_g",
        "tłuszcz_g",
        "węglowodany_g",
        "status",
      ],
    ];
    for (const e of data.food) {
      const factor = e.quick ? 1 : e.grams / 100;
      lines.push([
        "jedzenie",
        e.date,
        e.name,
        "",
        "",
        String(e.grams),
        e.unit,
        String(e.nutrients.kcal * factor),
        e.nutrients.protein === null
          ? ""
          : String(e.nutrients.protein * factor),
        e.nutrients.fat === null ? "" : String(e.nutrients.fat * factor),
        e.nutrients.carbs === null ? "" : String(e.nutrients.carbs * factor),
        e.status,
      ]);
    }
    for (const s of data.sets.filter((s) => s.done)) {
      const session = data.sessions.find((v) => v.id === s.sessionId);
      lines.push([
        "seria",
        session?.date ?? "",
        `${s.exerciseId} · ${session?.equipmentName ?? ""}`,
        String(s.weight),
        String(s.reps),
        "",
        resultUnit(resultMetric(s)),
        "",
        "",
        "",
        "",
        s.type,
      ]);
    }
    for (const m of data.measurements)
      lines.push([
        "masa",
        m.date,
        m.note,
        String(m.value),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    await exportFile(
      `FORMA-dziennik-${localDate()}.csv`,
      "\uFEFF" + lines.map((row) => row.map(escape).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <Sheet title={view === "home" ? "" : ({profile:"Profil i cele",appearance:"Wygląd i trening",equipment:"Miejsca i sprzęt",data:"Konto i kopie"} as const)[view]} wide className="forma-settings" onBack={view === "home" ? undefined : () => setView("home")}>
      {view === "home" && <div className="settings-menu">
      <h1 className="settings-title rise">Ustawienia</h1>
      <button className="card settings-profile rise d1" onClick={() => setView("profile")}>
        <div className="avatar-large">{profile.name[0].toUpperCase()}</div>
        <div className="row-text">
          <h3>{profile.name}</h3>
          <p>{profile.demo ? "Tryb demonstracyjny" : `${({reduce:'Redukcja',maintain:'Utrzymanie',build:'Budowa masy'} as Record<string,string>)[profile.goal]??'Profil lokalny'} · ${profile.days} treningi/tydz.`}</p>
        </div>
        <ChevronRight size={20}/>
      </button>
      <div className="card list-card rise d2">
      <button className="list-row" onClick={() => setView("profile")}><span className="icon-bubble acc"><Target size={20}/></span><span className="row-text"><strong>Profil i cele</strong><small>Kalorie, makro, dni treningowe</small></span><ChevronRight size={18}/></button>
      <div className="row-divider"/>
      <button className="list-row" onClick={() => setView("appearance")}><span className="icon-bubble pro"><Palette size={20}/></span><span className="row-text"><strong>Wygląd i trening</strong><small>Motyw, wibracje, powiadomienia</small></span><ChevronRight size={18}/></button>
      <div className="row-divider"/>
      <button className="list-row" onClick={() => setView("equipment")}><span className="icon-bubble hot"><MapPin size={20}/></span><span className="row-text"><strong>Miejsca i sprzęt</strong><small>Aktywne: {data.equipment.find(e=>e.id===profile.equipmentId)?.name??'-'}</small></span><ChevronRight size={18}/></button>
      <div className="row-divider"/>
      <button className="list-row" onClick={() => show(<Calculators/>)}><span className="icon-bubble sunk"><Calculator size={20}/></span><span className="row-text"><strong>Kalkulatory</strong><small>kcal, makro, talerze</small></span><ChevronRight size={18}/></button>
      <div className="row-divider"/>
      <button className="list-row" onClick={() => show(<TrainingGlossary/>)}><span className="icon-bubble pro"><BookOpen size={20}/></span><span className="row-text"><strong>Słowniczek treningowy</strong><small>RIR, RPE, serie i plan</small></span><ChevronRight size={18}/></button>
      <div className="row-divider"/>
      <button className="list-row" aria-label="Widżety ekranu głównego" onClick={() => show(<Widgets/>)}><span className="icon-bubble info"><LayoutGrid size={20}/></span><span className="row-text"><strong>Widżety</strong><small>Woda, dzień, seria</small></span><ChevronRight size={18}/></button>
      </div>
      <h3 className="settings-menu-title">Dane</h3>
      <div className="card list-card rise d3">
      <button className="list-row" onClick={() => setView("data")}><span className="icon-bubble water"><CloudArrowUp size={20}/></span><span className="row-text"><strong>Konto i kopie</strong><small>Kopie ręczne, eksport i przywracanie</small></span><ChevronRight size={18}/></button>
      <div className="row-divider"/>
      <button className="list-row" aria-label="Aktualizacje aplikacji" onClick={() => show(<Updates/>)}><span className="icon-bubble ok"><ArrowCircleUp size={20}/></span><span className="row-text"><strong>Aktualizacje</strong><small>Wersja {appVersion}</small></span><ChevronRight size={18}/></button>
      </div>
      <p className="version-note">FORMA {appVersion} · dane zapisane na tym telefonie</p>
      </div>}
      {view === "profile" && <div className="settings-page">
      <Field label="Twoje imię">
        <input
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name !== profile.name)
              void run(() => patch({ name: name.trim() }));
          }}
        />
      </Field>
      <Field label="Cel nawodnienia · ml">
        <div className="inline-field">
          <input
            inputMode="numeric"
            placeholder="Bez ustawionego celu"
            value={water}
            onChange={(e) => setWater(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() =>
              void run(async () => {
                const n = water.trim() ? numberInput(water) : null;
                if (n !== null && (!Number.isFinite(n) || n <= 0 || n > 15000))
                  throw new Error("Sprawdź cel nawodnienia.");
                await patch({ waterGoal: n });
              }, "Cel wody zapisany")
            }
          >
            Zapisz
          </Button>
        </div>
      </Field>
      <div className="form-grid">
        <Field label="Wzrost · cm">
          <input
            inputMode="decimal"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </Field>
        <Field label="Wiek · lata">
          <input
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </Field>
      </div>
      <Button
        variant="secondary"
        onClick={() =>
          void run(async () => {
            const h = height.trim() ? numberInput(height) : null;
            const a = age.trim() ? numberInput(age) : null;
            if (
              (h !== null && (!Number.isFinite(h) || h < 100 || h > 250)) ||
              (a !== null && (!Number.isInteger(a) || a < 1 || a > 120))
            )
              throw new Error(
                "Sprawdź wzrost (100-250 cm) i wiek (1-120 lat).",
              );
            await patch({ height: h, age: a });
          }, "Profil zaktualizowany")
        }
      >
        Zapisz dane profilu
      </Button>
      <button className="list-row" onClick={() => show(<GoalForm />)}>
        <span>
          <strong>Kalorie i makro</strong>
          <small>Cele z datą obowiązywania</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <Field label="Twój tygodniowy cel · dni z treningiem">
        <select
          value={profile.days}
          onChange={(e) =>
            void run(() => patch({ days: Number(e.target.value) }))
          }
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>
      </div>}
      {view === "appearance" && <div className="settings-page">
      <div className="settings-theme"><strong>Motyw</strong><div><button className={profile.theme !== "dark" ? "active" : ""} aria-pressed={profile.theme !== "dark"} onClick={() => void run(() => patch({ theme: "light" }))}>Jasny</button><button className={profile.theme === "dark" ? "active" : ""} aria-pressed={profile.theme === "dark"} onClick={() => void run(() => patch({ theme: "dark" }))}>Ciemny</button></div></div>
      <Toggle
        checked={profile.keepAwake ?? true}
        onChange={() => void run(() => patch({ keepAwake: !(profile.keepAwake ?? true) }))}
        label="Ekran aktywny podczas treningu"
        description="Zapobiega wygaszaniu ekranu podczas aktywnej sesji."
      />
      <Toggle
        checked={profile.haptics}
        onChange={() => void run(() => patch({ haptics: !profile.haptics }))}
        label="Wibracja po serii"
      />
      <Toggle
        checked={profile.notifications}
        onChange={() => void run(async () => {
          if (profile.notifications) { await patch({ notifications: false }); return; }
          await setupNotifications();
          if (!await notificationPermission()) { toast("Powiadomienia nie są włączone. Timer na ekranie nadal działa."); return; }
          await patch({ notifications: true, notificationAsked: true });
        })}
        label="Powiadomienie treningu i koniec przerwy"
        description="Wymaga zgody Androida. System może opóźnić powiadomienie w tle."
      />
      <Field label="Twoja playlista Spotify · opcjonalnie">
        <input
          type="url"
          value={spotify}
          placeholder="https://open.spotify.com/playlist/…"
          onChange={(e) => setSpotify(e.target.value)}
        />
      </Field>
      <Button
        variant="secondary"
        onClick={() =>
          void run(async () => {
            const url = spotify.trim() ? spotifyUrl(spotify.trim()) : "";
            await patch({ spotify: url });
          }, "Skrót Spotify zapisany")
        }
      >
        Zapisz playlistę
      </Button>
      </div>}
      {view === "equipment" && <div className="settings-page">
      <Field label="Aktywny profil miejsca">
        <select
          value={profile.equipmentId}
          onChange={(e) =>
            void run(() => patch({ equipmentId: e.target.value }))
          }
        >
          {data.equipment.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      {data.equipment.map((e) => (
        <button
          className="list-row"
          key={e.id}
          onClick={() => show(<EquipmentForm equipment={e} />)}
        >
          <Dumbbell size={22} />
          <span>
            <strong>{e.name}</strong>
            <small>
              Skok {fmt(e.step, 2)} kg · {e.types.join(", ")}
            </small>
          </span>
          <ChevronRight size={20} />
        </button>
      ))}
      <Button variant="ghost" onClick={() => show(<EquipmentForm />)}>
        <Plus size={18} />
        Dodaj miejsce lub profil maszyny
      </Button>
      </div>}
      {view === "data" && <div className="settings-page">
      <h3 className="subheading">Twoje dane i kopie</h3>
      <button
        className="list-row"
        onClick={() =>
          show(
            <Sheet title="Źródła danych">
              <h3>Jedzenie</h3>
              <p>
                © Open Food Facts contributors. Baza danych: ODbL 1.0; zawartość
                rekordów: Database Contents License. Zaimportowano {importedFoods.length} produktów
                oznaczonych jako sprzedawane w Polsce, 23-24 października 2026.
                Oddzielne podstawowe produkty bez marki mają jawnie oznaczone
                wartości orientacyjne.
              </p>
              <p>
                To baza społecznościowa. Porównuj kod, wartości i podstawę g/ml
                z etykietą; możesz je poprawić. Brakująca wartość makro oznacza
                brak danych.
              </p>
              <p>Dodatkowo {legacyFoods.length} pozycji z USDA SR Legacy 2018. Część nazw pozostaje w języku oryginalnym; polskie hasła pomagają w wyszukiwaniu podstawowych grup. Nie zastępuj nimi etykiety konkretnej marki.</p><p>{usdaFoods.length} produktów i potraw z USDA FoodData Central, FNDDS 2021-2023, wydanie 2024. Nazwy przetłumaczono, zachowując oryginalny opis. Energia i makro nie są zmieniane; wszystkie wartości tego źródła dotyczą 100 g. Domowe danie może mieć inne proporcje. Dane USDA: domena publiczna / CC0.</p><a href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noreferrer">USDA · źródło i dokumentacja</a><p className="muted small">Zdjęcia przy jedzeniu to ilustracje kategorii, nie zdjęcia konkretnych produktów.</p>
              <p>
                <a
                  href="https://world.openfoodfacts.org/terms-of-use"
                  target="_blank"
                  rel="noreferrer"
                >
                  Warunki i licencja Open Food Facts
                </a>
              </p>
              <h3>Ćwiczenia</h3>
              <p>
                Filmy należą do twórców wskazanych przy każdym materiale.
                Otwierają się na YouTube. Zdjęcia pozycji:
                yuhonas/free-exercise-db, licencja Unlicense według
                repozytorium.
              </p>
              <p>
                <a
                  href="https://github.com/yuhonas/free-exercise-db"
                  target="_blank"
                  rel="noreferrer"
                >
                  Źródło zdjęć ćwiczeń
                </a>
              </p>
              <h3>Kalkulator energii</h3>
              <p>
                Mifflin i współautorzy, 1990, PMID 2305711. Szacunek dla
                zdrowych osób dorosłych; aktywność jest dodatkowym założeniem
                użytkownika.
              </p>
              <p>
                Zdjęcia główne są wygenerowanymi ilustracjami sportowymi. Teksty
                motywacyjne są własnymi tekstami aplikacji.
              </p>
            </Sheet>,
          )
        }
      >
        <span>
          <strong>Źródła i licencje</strong>
          <small>Produkty, filmy i przeliczenia</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <CloudAccount />
      <Toggle
        checked={includeMedia}
        onChange={() => setIncludeMedia((v) => !v)}
        label="Dołącz filmy do kopii"
        description="Zwiększa rozmiar eksportowanego pliku"
      />
      <button className="list-row" onClick={() => void run(backup)}>
        <Download size={22} />
        <span>
          <strong>Eksportuj kopię JSON</strong>
          <small>Treningi, jedzenie, pomiary i ustawienia</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <button className="list-row" onClick={() => void run(csv)}>
        <FileSpreadsheet size={22} />
        <span>
          <strong>Eksportuj dziennik CSV</strong>
          <small>Do arkusza lub omówienia z trenerem</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <button className="list-row" onClick={() => fileRef.current?.click()}>
        <Upload size={22} />
        <span>
          <strong>Przywróć kopię</strong>
          <small>Wybierz plik JSON wyeksportowany z FORMA</small>
        </span>
        <ChevronRight size={20} />
      </button>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run(() => importFile(f));
          e.target.value = "";
        }}
      />
      <div className="privacy-note">
        <ShieldCheck size={20} />
        <p>
          Brak analityki i modeli AI. Wpisy zapisują się na telefonie; kopię w
          Firebase wysyłasz samodzielnie po podłączeniu konta. Wyszukiwanie
          online przekazuje nazwę lub kod produktu do Open Food Facts.
        </p>
      </div>
      {profile.demo && (
        <Button
          className="full"
          onClick={() =>
            show(
              <Confirm
                title="Przejść na własne dane?"
                text="Usuniemy dane demonstracyjne i otworzymy konfigurację Twojego profilu. Twoje dodane i zaimportowane plany zostaną zachowane."
                confirm="Ustaw własny profil"
                onConfirm={async () => {
                  const ownPlans = data.plans.filter(p=>!["upper-a","lower-a","fullbody"].includes(p.id));
                  await clearAll();
                  await seedCatalog();
                  if(ownPlans.length)await commit(ownPlans.map(value=>({table:'plans' as const,value})));
                  await reload();
                }}
              />,
            )
          }
        >
          Zacznij z własnymi danymi
        </Button>
      )}
      <Button
        variant="ghost"
        className="full danger-text"
        onClick={() =>
          show(
            <Confirm
              title="Usunąć wszystkie dane z telefonu?"
              text="Usuniemy profil, treningi, jedzenie, pomiary i dodane filmy. Ta operacja wymaga kopii, jeśli chcesz później odzyskać wpisy."
              danger
              confirm="Usuń wszystkie dane"
              onConfirm={async () => {
                await clearAll();
                await seedCatalog();
                await reload();
              }}
            />,
          )
        }
      >
        <Trash2 size={18} />
        Usuń wszystkie dane
      </Button>
      <p className="version-note"><Smartphone size={14} /> FORMA {appVersion}</p>
      </div>}
    </Sheet>
  );
}
function EquipmentForm({ equipment }: { equipment?: Equipment }) {
  const { put } = useStore();
  const { run, close } = useUI();
  const [name, setName] = useState(equipment?.name ?? "");
  const [types, setTypes] = useState(equipment?.types ?? ["Masa ciała"]);
  const [step, setStep] = useState(String(equipment?.step ?? 2.5));
  const [notes, setNotes] = useState(equipment?.notes ?? "");
  return (
    <Sheet title={equipment ? "Profil sprzętu" : "Nowe miejsce"}>
      <Field label="Nazwa miejsca lub maszyny">
        <input
          value={name}
          maxLength={80}
          placeholder="np. Siłownia · wyciąg nr 2"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Najmniejszy skok ciężaru · kg">
        <input
          inputMode="decimal"
          value={step}
          onChange={(e) => setStep(e.target.value)}
        />
      </Field>
      <div className="equipment-types">
        {["Sztanga", "Hantle", "Maszyna", "Wyciąg", "Drążek", "Masa ciała", "Kettlebell", "Kółko"].map(
          (t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={types.includes(t)}
                onChange={() =>
                  setTypes((v) =>
                    v.includes(t) ? v.filter((x) => x !== t) : [...v, t],
                  )
                }
              />
              {t}
            </label>
          ),
        )}
      </div>
      <Field label="Ustawienia i notatki">
        <textarea
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <p className="muted small">
        Inna maszyna powinna mieć własny profil, aby nie mieszać historii
        obciążeń.
      </p>
      <Button
        className="full"
        onClick={() =>
          void run(async () => {
            const n = numberInput(step);
            if (!name.trim() || !Number.isFinite(n) || n <= 0 || n > 100)
              throw new Error("Podaj nazwę i prawidłowy skok ciężaru.");
            await put("equipment", {
              ...equipment,
              ...stamp(equipment?.id),
              name: name.trim(),
              types,
              step: n,
              notes,
            });
            close();
          }, "Profil sprzętu zapisany")
        }
      >
        Zapisz profil
      </Button>
    </Sheet>
  );
}
