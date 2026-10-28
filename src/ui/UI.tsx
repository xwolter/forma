import {X as CloseIcon} from '@phosphor-icons/react/dist/csr/X';
import {CheckCircle} from '@phosphor-icons/react/dist/csr/CheckCircle';
import {WarningCircle} from '@phosphor-icons/react/dist/csr/WarningCircle';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Fire,
  Undo2,
  type LucideIcon,
} from './icons';

type UI = {
  notice: ReactNode;
  show: (content: ReactNode) => void;
  close: () => void;
  toast: (text: string, undo?: () => Promise<void>) => void;
  run: (action: () => Promise<void>, success?: string) => Promise<boolean>;
};
const UIContext = createContext<UI | null>(null);
export function UIProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<ReactNode>(null);
  type Notice={id:number;text:string;error:boolean;undo?:()=>Promise<void>};
  const [note,setNote]=useState<Notice|null>(null);
  const [held,setHeld]=useState(false);
  const [undoing,setUndoing]=useState<number|null>(null);
  const sequence=useRef(0),pendingUndo=useRef(new Set<number>());
  const publish=useCallback((text:string,undo?:()=>Promise<void>,error=false)=>{
    setHeld(false);setNote({id:++sequence.current,text,error,undo});
  },[]);
  const toast=useCallback((text:string,undo?:()=>Promise<void>)=>publish(text,undo),[publish]);
  const close=useCallback(()=>setOverlay(null),[]);
  const show=useCallback((content:ReactNode)=>{setNote(null);setOverlay(content);},[]);
  const run=useCallback(async(action:()=>Promise<void>,success?:string)=>{
    try{await action();if(success)publish(success);return true;}
    catch(e){publish(e instanceof Error?e.message:'Coś poszło nie tak. Spróbuj ponownie.',undefined,true);return false;}
  },[publish]);
  useEffect(()=>{
    if(!note||held||undoing===note.id)return;
    const id=note.id,t=setTimeout(()=>setNote(current=>current?.id===id?null:current),note.undo?12000:note.error?10000:6500);
    return()=>clearTimeout(t);
  },[note,held,undoing]);
  const notice=note&&<div role={note.error?'alert':'status'} aria-atomic="true" className={`toast ${note.error?'toast-error':''} ${note.undo?'toast-with-undo':''}`}
    onMouseEnter={()=>setHeld(true)} onMouseLeave={()=>setHeld(false)}
    onFocusCapture={()=>setHeld(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHeld(false);}}>
    <span className="toast-symbol" aria-hidden="true">{note.error?<WarningCircle size={23} weight="fill"/>:<CheckCircle size={23} weight="fill"/>}</span>
    <span className="toast-message">{note.text}</span>
    {note.undo&&<button type="button" className="toast-undo" disabled={undoing===note.id} onClick={()=>{
      const current=note;if(pendingUndo.current.has(current.id))return;
      pendingUndo.current.add(current.id);setUndoing(current.id);
      void current.undo!().then(()=>setNote(n=>n?.id===current.id?{id:++sequence.current,text:'Cofnięto zmianę',error:false}:n))
        .catch(e=>setNote(n=>n?.id===current.id?{id:++sequence.current,text:e instanceof Error?e.message:'Nie udało się cofnąć zmiany.',error:true}:n))
        .finally(()=>{pendingUndo.current.delete(current.id);setUndoing(id=>id===current.id?null:id);});
    }}><Undo2 size={18}/>{undoing===note.id?'Cofanie…':'Cofnij'}</button>}
    <button type="button" className="toast-close" aria-label="Zamknij powiadomienie" onClick={()=>{setNote(null);setHeld(false);}}><CloseIcon size={21} weight="bold"/></button>
  </div>;
  return (
    <UIContext.Provider value={{ show, close, toast, run, notice }}>
      {children}
      {overlay}
      {!overlay && notice}
    </UIContext.Provider>
  );
}
export const useUI = () => {
  const ui = useContext(UIContext);
  if (!ui) throw new Error("Brak UI");
  return ui;
};
export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      className={`button ${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function IconButton({
  icon: Icon,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={22} strokeWidth={1.8} />
    </button>
  );
}
export function Sheet({
  title,
  children,
  wide = false,
  className = "",
  onBack,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  onBack?: () => void;
}) {
  const { close, notice } = useUI();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      autoFocus
      className={`sheet ${wide ? "wide" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet-inner">
        {wide?<div className="sheet-head page-head">
          <IconButton label="Wstecz" icon={ArrowLeft} onClick={onBack ?? close} />
          <h2>{title}</h2>
        </div>:<div className="sheet-head">
          <h2>{title}</h2>
          <IconButton label={onBack ? "Wstecz" : "Zamknij"} icon={onBack ? ChevronLeft : XCircle} onClick={onBack ?? close} />
        </div>}
        {notice}
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action && (
        <button className="text-action" onClick={onAction}>
          {action}
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function DateNav({
  date,
  onChange,
  label,
}: {
  date: string;
  onChange: (date: string) => void;
  label: string;
}) {
  return (
    <label className="date-picker">
      <span>{label}</span>
      <input
        aria-label="Wybierz dzień"
        type="date"
        value={date}
        onInput={(e) => { if (e.currentTarget.value && e.currentTarget.validity.valid) onChange(e.currentTarget.value); }}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
    </label>
  );
}
export function Confirm({
  title,
  text,
  onConfirm,
  danger = false,
  confirm = "Potwierdź",
}: {
  title: string;
  text: string;
  onConfirm: () => Promise<void>;
  danger?: boolean;
  confirm?: string;
}) {
  const { run, close } = useUI();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={title}>
      <p className="muted">{text}</p>
      <div className="button-row">
        <Button variant="secondary" onClick={close}>
          Wróć
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await run(onConfirm);
            setBusy(false);
            if (ok) close();
          }}
        >
          {busy ? "Zapisywanie…" : confirm}
        </Button>
      </div>
    </Sheet>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      className="toggle-row"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
    >
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className={`toggle ${checked ? "on" : ""}`}>
        <span />
      </span>
    </button>
  );
}
export function Segments<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segments">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? "selected" : ""}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function StepHeader({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: () => void;
}) {
  return (
    <div className="step-header">
      <IconButton icon={ChevronLeft} label="Poprzedni krok" onClick={onBack} />
      <span>
        Krok {step} z {total}
      </span>
      <div className="step-dots">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < step ? "done" : ""} />
        ))}
      </div>
    </div>
  );
}
// Progress ring from the FORMA 0.8 design: draws in on mount, then eases between values.
export function Ring({value,size=64,stroke=8,color='var(--hot)',track='var(--hot-soft)',children,className=''}:{value:number;size?:number;stroke?:number;color?:string;track?:string;children?:ReactNode;className?:string}) {
  const r=(size-stroke)/2,c=2*Math.PI*r,pct=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
  return <span className={`ring ${className}`} style={{width:size,height:size}} aria-hidden="true">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke}/><circle className="ring-value" cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-pct)} style={{'--c':c} as React.CSSProperties}/></svg>
    {children&&<span className="ring-center">{children}</span>}
  </span>;
}
// Animated flame used for streaks; a grey outline flame when the day is not done yet.
export function LiveFlame({lit=true,size=36}:{lit?:boolean;size?:number}) {
  return <span className={`live-flame ${lit?'lit':''}`} style={{width:size,height:size,fontSize:size}} aria-hidden="true">{lit&&<svg width="0" height="0" style={{position:'absolute'}}><defs><linearGradient id="flameGradient" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#e2452b"/><stop offset="1" stopColor="#ffb23f"/></linearGradient></defs></svg>}<Fire size={size}/>{lit&&<><i className="spark s1"/><i className="spark s2"/></>}</span>;
}
export function Saved() {
  return (
    <span className="saved">
      <Check size={14} /> Zapisano na telefonie
    </span>
  );
}
