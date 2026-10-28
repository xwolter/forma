import { useState } from "react";
import { BookOpen, Search, TrendingUp, Info } from "../ui/icons";
import { Sheet } from "../ui/UI";

type Group = "Wysiłek" | "Serie i plan" | "Rodzaje treningu";
type Term = { id: string; group: Group; name: string; other?: string; meaning: string; example: string; note?: string };
export const TRAINING_TERMS: Term[] = [
  {id:"rir",group:"Wysiłek",name:"RIR",other:"Reps in Reserve · powtórzenia w zapasie",meaning:"Ile kolejnych poprawnych powtórzeń prawdopodobnie udałoby Ci się zrobić, gdy kończysz serię.",example:"Mógłbyś zrobić 10, ale kończysz po 8: RIR 2.",note:"To szacunek. Z czasem nauczysz się oceniać go trafniej."},
  {id:"rpe",group:"Wysiłek",name:"RPE",other:"Rate of Perceived Exertion · odczuwany wysiłek",meaning:"Subiektywna ocena trudności serii w skali 1-10. W wersji używanej przy ciężarach wynik bliski 10 oznacza bardzo mały zapas.",example:"RPE 8 to mniej więcej RIR 2; RPE 10 to około RIR 0.",note:"Przeliczenie RPE ↔ RIR jest orientacyjne, szczególnie daleko od końca serii."},
  {id:"failure",group:"Wysiłek",name:"Upadek mięśniowy",other:"Failure",meaning:"Moment, gdy nie zrobisz już następnego powtórzenia w wymaganym zakresie ruchu i z dobrą techniką.",example:"Kończysz serię i nie dasz rady wykonać kolejnego poprawnego ruchu: około RIR 0.",note:"Nie musisz dochodzić do upadku w każdej serii. Gdy czujesz ból, przerwij ruch."},
  {id:"working-set",group:"Serie i plan",name:"Seria robocza",other:"Working set",meaning:"Seria wykonywana z obciążeniem i celem zapisanym w planie. To ona zwykle liczy się do objętości treningowej.",example:"Po rozgrzewce robisz 3 serie przysiadu po 8 powtórzeń - to 3 serie robocze."},
  {id:"warmup-set",group:"Serie i plan",name:"Seria rozgrzewkowa",other:"Warm-up set",meaning:"Lżejsza seria przygotowująca do właściwej pracy. Zostawiasz duży zapas i nie próbujesz się zmęczyć.",example:"Przed seriami roboczymi 60 kg robisz kilka kontrolowanych powtórzeń z 20 i 40 kg."},
  {id:"overload",group:"Serie i plan",name:"Stopniowe zwiększanie wymagań",other:"Progressive overload · progresywne przeciążenie",meaning:"Z czasem wykonujesz odrobinę więcej pracy albo trudniejszą wersję ruchu, zachowując dobrą technikę i regenerację.",example:"Najpierw 30 kg × 8, potem 30 kg × 10, a następnie 32,5 kg × 8.",note:"Nie musisz dokładać ciężaru na każdym treningu. Krótsza przerwa też nie zawsze oznacza lepszy postęp."},
  {id:"deload",group:"Serie i plan",name:"Lżejszy okres",other:"Deload · odciążenie",meaning:"Zaplanowany okres z mniejszą liczbą serii, niższym wysiłkiem lub lżejszym ciężarem. Pomaga ograniczyć narastające zmęczenie.",example:"Zamiast 4 trudnych serii robisz przez kilka dni 2 łatwiejsze.",note:"Nie ma jednego obowiązkowego terminu ani sposobu na deload."},
  {id:"volume",group:"Serie i plan",name:"Objętość treningowa",other:"Volume",meaning:"Ile pracy robisz w określonym czasie. W planowaniu mięśni często liczy się liczbę serii roboczych na partię w tygodniu.",example:"3 serie na plecy w poniedziałek i 3 w piątek = 6 serii tygodniowo."},
  {id:"reps",group:"Serie i plan",name:"Zakres powtórzeń",other:"Rep range",meaning:"Przedział liczby poprawnych ruchów w jednej serii. Możesz dobrać ciężar tak, aby zmieścić się w tym zakresie.",example:"Plan 8-12: 10 poprawnych powtórzeń mieści się w celu."},
  {id:"tempo",group:"Serie i plan",name:"Tempo",meaning:"Szybkość kolejnych faz powtórzenia. Cztery cyfry zwykle opisują opuszczanie, pauzę na dole, podnoszenie i pauzę na górze.",example:"Tempo 3-0-1-0: opuść przez 3 s, bez pauzy, podnieś przez 1 s, bez pauzy."},
  {id:"rest",group:"Serie i plan",name:"Przerwa",other:"Rest",meaning:"Czas odpoczynku między seriami lub ćwiczeniami. Pozwala przygotować się do kolejnego wysiłku.",example:"Przerwa 90 s zaczyna się po zapisaniu serii w FORMA."},
  {id:"hypertrophy",group:"Rodzaje treningu",name:"Hipertrofia",other:"Hypertrophy · budowanie mięśni",meaning:"Zwiększanie rozmiaru mięśni w wyniku treningu i regeneracji.",example:"Plan nastawiony na hipertrofię obejmuje regularne serie oporowe i stopniowy postęp."},
  {id:"compound",group:"Rodzaje treningu",name:"Ćwiczenie wielostawowe",other:"Compound",meaning:"Ruch, w którym pracuje kilka stawów i grup mięśniowych.",example:"Przysiad, martwy ciąg lub wiosłowanie."},
  {id:"isolation",group:"Rodzaje treningu",name:"Ćwiczenie izolowane",other:"Isolation",meaning:"Ruch skupiony głównie na jednej grupie mięśniowej i zwykle jednym stawie.",example:"Uginanie ramion na biceps lub prostowanie nóg na maszynie."},
  {id:"fbw",group:"Rodzaje treningu",name:"FBW",other:"Full Body Workout · całe ciało",meaning:"Plan, w którym na jednej sesji trenujesz główne partie całego ciała.",example:"Poniedziałek: przysiad, wyciskanie i wiosłowanie; kolejną sesję robisz po odpoczynku."},
  {id:"split",group:"Rodzaje treningu",name:"Split",other:"Plan dzielony",meaning:"Podział treningów na różne partie lub wzorce ruchu w osobne dni.",example:"Poniedziałek: góra ciała; środa: dół ciała."},
  {id:"circuit",group:"Rodzaje treningu",name:"Obwód",other:"Circuit",meaning:"Kilka ćwiczeń wykonywanych kolejno, a następnie powtarzanych od początku w rundach.",example:"Przysiad → pompka → wiosłowanie → przerwa. To jedna runda."},
  {id:"one-rm",group:"Wysiłek",name:"1RM",other:"One-repetition maximum",meaning:"Największy ciężar, z którym możesz wykonać jedno poprawne powtórzenie danego ćwiczenia.",example:"Jeśli 80 kg jest Twoim maksymalnym poprawnym pojedynczym wyciśnięciem, 1RM wynosi 80 kg.",note:"Nie trzeba testować maksimum, aby korzystać z FORMA."},
];
const GROUPS: Array<"Wszystkie" | Group> = ["Wszystkie", "Wysiłek", "Serie i plan", "Rodzaje treningu"];
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pl");

export function TrainingGlossary() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("Wszystkie");
  const [rir, setRir] = useState(2);
  const q=fold(query.trim());
  const terms=TRAINING_TERMS.filter(term=>(group==="Wszystkie"||term.group===group)&&(!q||fold(`${term.name} ${term.other??""} ${term.meaning} ${term.example}`).includes(q)));
  return <Sheet title="Słowniczek treningowy" wide className="training-glossary">
    <p className="glossary-lead">Proste wyjaśnienia pojęć z planów i dziennika FORMA. Dotknij terminu, aby zobaczyć przykład.</p>
    <section className="glossary-demo" aria-labelledby="rir-demo-title">
      <div className="glossary-demo-heading"><BookOpen size={21}/><div><strong id="rir-demo-title">Sprawdź, czym jest RIR</strong><small>Przykład z serią do 10 poprawnych powtórzeń</small></div></div>
      <div className="glossary-rep-track" role="img" aria-label={`${10-rir} wykonanych powtórzeń i ${rir} powtórzeń w zapasie`}>
        {Array.from({length:10},(_,index)=><span key={index} className={index<10-rir?"done":"reserve"}>{index+1}</span>)}
      </div>
      <div className="glossary-demo-numbers"><span><strong>{10-rir}</strong> zrobionych</span><span><strong>{rir}</strong> w zapasie</span><span><strong>≈ {10-rir}</strong> RPE</span></div>
      <label className="glossary-rir-slider">Zmień zapas: <strong>RIR {rir}</strong><input type="range" min="0" max="4" step="1" value={rir} onChange={event=>setRir(Number(event.target.value))} aria-label="Powtórzenia w zapasie"/></label>
      <p className="glossary-demo-foot">RPE to tu tylko przybliżenie. Nie sprawdzaj na siłę swojego maksimum - oceń, ile poprawnych ruchów jeszcze by zostało.</p>
    </section>
    <section className="glossary-progress" aria-label="Przykład stopniowego postępu">
      <div className="glossary-demo-heading"><TrendingUp size={21}/><div><strong>Postęp może wyglądać tak</strong><small>Przykład tego samego ćwiczenia</small></div></div>
      <div className="glossary-progress-steps"><span><small>Trening 1</small><strong>30 kg × 8</strong></span><span><small>Trening 2</small><strong>30 kg × 10</strong></span><span><small>Trening 3</small><strong>32,5 kg × 8</strong></span></div>
      <p>Najpierw więcej poprawnych powtórzeń, potem mały wzrost ciężaru. Postęp nie musi wystąpić na każdej sesji.</p>
    </section>
    <div className="glossary-search"><Search size={19}/><input aria-label="Szukaj pojęcia treningowego" placeholder="Szukaj, np. RIR, FBW, deload…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
    <div className="glossary-filters" role="group" aria-label="Kategoria pojęć">{GROUPS.map(value=><button key={value} aria-pressed={group===value} className={group===value?"active":""} onClick={()=>setGroup(value)}>{value}</button>)}</div>
    <p className="glossary-result-count">{terms.length} {terms.length===1?"pojęcie":"pojęć"}</p>
    <div className="glossary-terms">{terms.map(term=><details key={term.id} className="glossary-term"><summary><span className="glossary-term-name"><strong>{term.name}</strong>{term.other&&<small>{term.other}</small>}</span></summary><div className="glossary-term-body"><p>{term.meaning}</p><div className="glossary-term-example"><strong>Na przykład</strong><span>{term.example}</span></div>{term.note&&<p className="glossary-term-note"><Info size={16}/>{term.note}</p>}</div></details>)}</div>
    {!terms.length&&<p className="glossary-empty">Brak pojęcia. Spróbuj krótszej nazwy albo wybierz „Wszystkie”.</p>}
    <details className="glossary-sources"><summary>Na czym oparto wyjaśnienia?</summary><p>Skala RPE/RIR, zalecenia dotyczące treningu oporowego i badania nad odciążeniem. Opisy są pomocą do czytania planu, a nie sztywnymi regułami dla każdej osoby.</p><a href="https://pubmed.ncbi.nlm.nih.gov/26049792/" target="_blank" rel="noopener noreferrer">RPE i RIR - Zourdos i wsp.</a><a href="https://acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf" target="_blank" rel="noopener noreferrer">Trening oporowy - ACSM</a><a href="https://pubmed.ncbi.nlm.nih.gov/36619355/" target="_blank" rel="noopener noreferrer">Odciążenie - Bell i wsp.</a></details>
  </Sheet>;
}
