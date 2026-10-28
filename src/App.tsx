import {SessionDock} from './features/SessionDock';
import {WorkoutNotificationSync} from './features/WorkoutNotificationSync';
import { Component, useEffect, useRef, useState, useCallback, type CSSProperties, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import {
  ChartLineUp,
  Dumbbell,
  Home,
  RotateCcw,
  Utensils,
  WifiOff,
} from './ui/icons';
import { localDate } from "./core/math";
import { updateDaily } from "./core/db";
import { beginSession, heartbeatSession } from "./core/workouts";
import { isNative, keepScreenAwake, notificationPermission, setupNotifications } from "./core/native";
import { useStore } from "./core/store";
import type { Plan, Tab } from "./core/types";
import { Button, useUI } from "./ui/UI";
import { BrandMark, Onboarding } from "./features/Onboarding";
import { Today } from "./features/Today";
import { Training } from "./features/Training";
import { Food, AddFood } from "./features/Food";
import { NativeWidgetsSync } from './features/NativeWidgetsSync';
import { UpdateNotice } from './features/Updates';
import { Progress } from "./features/Progress";
import { Settings } from "./features/Settings";
import { foodCode } from './core/foodCode';

export default function App() {
  const { data, loading, error, reload, put } = useStore();
  const { show, run, close } = useUI();
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(localDate);
  const [online, setOnline] = useState(navigator.onLine);
  const starting = useRef(false);
  const [focusSession,setFocusSession]=useState(0);
  const [restoredFoodCode,setRestoredFoodCode]=useState('');
  const profile = data.profiles[0];
  const active = data.sessions.find(
    (s) => s.status === "active" || s.status === "paused",
  );
  useEffect(()=>{
    if(!isNative)return;
    const handle=CapacitorApp.addListener('appRestoredResult',event=>{
      if(event.pluginId!=='BarcodeScanner'||event.methodName!=='scan'||!event.success)return;
      const raw=event.data?.barcodes?.[0]?.rawValue;
      if(typeof raw==='string')void run(async()=>{setRestoredFoodCode(foodCode(raw));});
    });
    return()=>{void handle.then(h=>h.remove());};
  },[run]);
  useEffect(()=>{
    if(!restoredFoodCode||loading||!profile)return;
    setTab('food');setDate(localDate());show(<AddFood date={localDate()} initialBarcode={restoredFoodCode}/>);setRestoredFoodCode('');
  },[restoredFoodCode,loading,profile,show]);
  useEffect(()=>{if(active?.status!=='active')return;const timer=window.setInterval(()=>{void heartbeatSession().catch(()=>{});},15000);return()=>clearInterval(timer);},[active?.status]);
  useEffect(() => {
    if (!profile || loading) return;
    let cancelled = false;
    const record = () => {
      if (document.visibilityState === 'hidden') return;
      void updateDaily(localDate(), { appOpened: true }).then(changed => {
        if (changed && !cancelled) return reload();
      }).catch(() => {});
    };
    record();
    document.addEventListener('visibilitychange', record);
    window.addEventListener('pageshow', record);
    // Also covers a session that remains in the foreground across midnight.
    const timer = window.setInterval(record, 30_000);
    const native = isNative ? CapacitorApp.addListener('appStateChange', s => { if (s.isActive) record(); }) : null;
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', record);
      window.removeEventListener('pageshow', record);
      clearInterval(timer);
      void native?.then(l => l.remove());
    };
  }, [profile?.id, loading, reload]);
  useEffect(()=>{
    void keepScreenAwake(active?.status==='active' && (profile?.keepAwake ?? true)).catch(()=>{});
    return ()=>{void keepScreenAwake(false).catch(()=>{});};
  },[active?.status, profile?.keepAwake]);
  useEffect(() => {
    const listener = () => setOnline(navigator.onLine);
    window.addEventListener("online", listener);
    window.addEventListener("offline", listener);
    return () => {
      window.removeEventListener("online", listener);
      window.removeEventListener("offline", listener);
    };
  }, []);
  useEffect(() => {
    const theme = profile?.theme ?? "light";
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f4f5f8" : "#000000");
  }, [profile?.theme]);
  useEffect(() => {
    if (!isNative) return;
    const listener = CapacitorApp.addListener("backButton", () => {
      if (document.querySelector("dialog[open]")) close();
      else if (tab !== "today") setTab("today");
      else void CapacitorApp.minimizeApp();
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [tab, close]);
  const navigate = useCallback((next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const widgetNavigate = useCallback((route:string)=>{
    setDate(localDate());
    if(route==='training')setFocusSession(v=>v+1);
    navigate(route==='training'?'training':route==='progress'?'progress':(route==='food-add'||route==='food')?'food':'today');
    if(route==='food-add')show(<AddFood date={localDate()}/>);
  },[navigate,show]);
  function start(plan: Plan) {
    if (starting.current) return;
    starting.current = true;
    void run(async () => {
      if(isNative&&!profile.notificationAsked){
        await setupNotifications();const allowed=await notificationPermission();
        await put('profiles',{...profile,notifications:allowed,notificationAsked:true,updatedAt:new Date().toISOString()});
      }
      const equipment =
        data.equipment.find((e) => e.id === profile.equipmentId) ??
        data.equipment[0];
      await beginSession(plan, date, equipment.id, equipment.name);
      await reload();
      setFocusSession(v=>v+1);
      navigate("training");
    }).finally(() => {
      starting.current = false;
    });
  }
  if (loading)
    return (
      <div className="app-loading">
        <BrandMark />
        <strong>FORMA</strong>
        <span>Otwieramy Twój dziennik…</span>
      </div>
    );
  if (error)
    return (
      <div className="fatal-error">
        <h1>Nie udało się otworzyć dziennika</h1>
        <p>{error}</p>
        <Button onClick={() => location.reload()}>
          <RotateCcw size={18} />
          Spróbuj ponownie
        </Button>
      </div>
    );
  if (!profile) return <><NativeWidgetsSync navigate={widgetNavigate}/><WorkoutNotificationSync/><Onboarding /></>;
  const tabs = [
    { id: "today", label: "Dzisiaj", icon: Home },
    { id: "training", label: "Trening", icon: Dumbbell },
    { id: "food", label: "Jedzenie", icon: Utensils },
    { id: "progress", label: "Postępy", icon: ChartLineUp },
  ] as const;
  return (
    <div className={`app-shell ${active ? "has-active" : ""}`}>
      <NativeWidgetsSync navigate={widgetNavigate}/>
      <WorkoutNotificationSync/>
      <header className="app-header">
        <button
          className="brand"
          aria-label="FORMA - ekran główny"
          onClick={() => navigate("today")}
        >
          <BrandMark />
          <span>FORMA</span>
        </button>
        <nav className="desktop-nav" aria-label="Główna nawigacja">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => navigate(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {profile.demo && <span className="demo-label">DEMO</span>}
        <button className="profile-control" aria-label="Profil i ustawienia" onClick={() => show(<Settings />)}>
          <span className="avatar">{(profile.name||'F')[0].toUpperCase()}</span>
        </button>
      </header>
      <UpdateNotice/>
      {!online && (
        <div className="offline-notice">
          <WifiOff size={15} />
          Bez internetu · zapis na telefonie działa
        </div>
      )}
      <main key={tab} className={`main-content tab-${tab}`}>
        {tab === "today" ? (
          <Today
            date={date}
            setDate={setDate}
            navigate={navigate}
            start={start}
          />
        ) : tab === "training" ? (
          <Training start={start} focusSession={focusSession} />
        ) : tab === "food" ? (
          <Food date={date} setDate={setDate} />
        ) : (
          <Progress />
        )}
      </main>
      <div className="bottom-dock">
        {active && tab !== 'training'&&<SessionDock session={active} onOpen={()=>{setFocusSession(v=>v+1);navigate('training');}}/>}
        <nav className="bottom-nav" aria-label="Dolna nawigacja" style={{'--nav-pos':tabs.findIndex(t=>t.id===tab)} as CSSProperties}>
          <span className="nav-pill" aria-hidden="true"/>
          {tabs.map((t) => (
            <button
              key={t.id}
              aria-current={tab === t.id ? "page" : undefined}
              className={tab === t.id ? "active" : ""}
              onClick={() => navigate(t.id)}
            >
              <span className="nav-icon-pill"><t.icon size={22}/></span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <h1>Potrzebujemy ponownie otworzyć aplikację</h1>
        <p>Zapisane wpisy pozostają w pamięci telefonu.</p>
        <Button onClick={() => location.reload()}>Otwórz ponownie</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
