import { useState, useEffect } from "react";
import { Film, Play, Pause, BookOpen } from '../ui/icons';
import videos from "../data/exercise-videos.json";
import frames from "../data/exercise-frames.json";
import { openExternal } from "../core/native";
import { Button, useUI } from "../ui/UI";
import { exerciseById } from '../core/catalog';
import { FABRYKA_ATLAS_HOME,FABRYKA_ATLAS_LINKS } from '../data/fabryka-atlas';
export function ExerciseDemo({ id }: { id: string }) {
  const { run } = useUI();
  const [frame, setFrame] = useState(0);
  const [playing,setPlaying]=useState(false);
  const views=exerciseById(id)?.demoViews;
  useEffect(()=>{setFrame(0);setPlaying(false);},[id]);
  useEffect(()=>{if(!playing)return;const t=setInterval(()=>{if(document.visibilityState==='visible')setFrame(v=>v===0?1:0);},1800);return()=>clearInterval(t);},[playing]);
  const video = (videos as Record<string,{id:string;title:string;author:string;note?:string}>)[id];
  return (
    <section className="exercise-demo">
      {frames.includes(id) && (
        <>
          <div className="exercise-frames">
            <img
              src={`/exercises/${id}/${frame}.jpg`}
              alt={views?`Zdjęcie ćwiczenia ${frame+1}`:`${frame === 0 ? "Pozycja początkowa" : "Pozycja końcowa"} ćwiczenia`}
            />
          </div>
          <div className="frame-controls">
            <button
              className={frame === 0 ? "active" : ""}
              aria-pressed={frame===0}
              onClick={() => {setPlaying(false);setFrame(0);}}
            >
              {views?'1 · Widok':'1 · Początek'}
            </button>
            <button
              className={frame === 1 ? "active" : ""}
              aria-pressed={frame===1}
              onClick={() => {setPlaying(false);setFrame(1);}}
            >
              {views?'2 · Widok':'2 · Koniec'}
            </button>
          </div>
          <Button variant="secondary" className="full" aria-pressed={playing} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={18}/>:<Play size={18}/>} {playing?(views?'Zatrzymaj pokaz zdjęć':'Zatrzymaj pokaz pozycji'):views?'Uruchom pokaz zdjęć':'Uruchom pokaz pozycji'}</Button>
          <small className="muted">
            {views?'Dwa zdjęcia ćwiczenia dostępne offline.':'Dwie pozycje dostępne offline.'} · free-exercise-db (domena publiczna). Pokaz zmienia zdjęcia, nie przedstawia pełnego toru ruchu. Szczegóły znajdziesz w instrukcji poniżej.
          </small>
        </>
      )}
      {video && (
        <div className="demo-video-link">
          <Film size={26} />
          <div>
            <strong>Film z wykonaniem</strong>
            <p>{video.title}</p>
            <small>{video.author} · film w języku oryginału</small>
            {video.note&&<p className="demo-variant">{video.note}</p>}
          </div>
          <Button
            className="full"
            onClick={() =>
              void run(() =>
                openExternal(`https://www.youtube.com/watch?v=${video.id}`),
              )
            }
          >
            <Play size={18} />
            Obejrzyj w YouTube
          </Button>
          <small>
            Wymaga internetu. Film otworzy się w YouTube lub przeglądarce;
            zapisane serie zostają w aplikacji.
          </small>
        </div>
      )}
      <div className="exercise-atlas-link">
        <BookOpen size={21} aria-hidden="true"/>
        <span><strong>Atlas Fabryki Siły</strong><small>{FABRYKA_ATLAS_LINKS[id]?'Instrukcja tego ćwiczenia na stronie źródłowej.':'Przejrzyj ćwiczenia na stronie źródłowej.'} Wymaga internetu.</small></span>
        <Button variant="secondary" onClick={()=>void run(()=>openExternal(FABRYKA_ATLAS_LINKS[id]??FABRYKA_ATLAS_HOME))}>Otwórz</Button>
      </div>
    </section>
  );
}
