import extraExercises from '../data/exercises-extra.json';
import expandedExercises from '../data/exercises-expanded.json';
import reductionExercises from '../data/exercises-reduction.json';
import type {
  Exercise,
  Plan,
  PlanExercise,
  Product,
  RecordBase,
} from "./types";
export const stamp = (id: string = crypto.randomUUID()): RecordBase => ({
  id,
  updatedAt: new Date().toISOString(),
  schemaVersion: 1,
});
export const EXERCISES: Exercise[] = [...extraExercises as Exercise[], ...expandedExercises as Exercise[], ...reductionExercises as Exercise[],
  {
    id: "bench",
    name: "Wyciskanie sztangi leżąc",
    muscle: "Klatka piersiowa",
    equipment: "Sztanga",
    pattern: "Wypychanie poziome",
    loadType: "barbell",
    instructions: [
      "Ustaw oczy pod sztangą, stopy stabilnie na podłodze.",
      "Ściągnij łopatki i utrzymaj stabilny tułów.",
      "Opuść sztangę w kontrolowany sposób w okolice dolnej części klatki.",
      "Wyciśnij, utrzymując nadgarstki nad przedramionami. Korzystaj z asekuracji.",
    ],
    mistakes: [
      "Odbijanie sztangi od klatki.",
      "Odrywanie pośladków i utrata stabilności.",
    ],
    alternatives: ["db-bench", "chest-machine", "pushup"],
  },
  {
    id: "row",
    name: "Wiosłowanie na wyciągu",
    muscle: "Plecy",
    equipment: "Wyciąg",
    pattern: "Przyciąganie poziome",
    loadType: "machine",
    instructions: [
      "Ustaw stabilnie stopy i lekko ugnij kolana.",
      "Utrzymuj tułów bez kołysania.",
      "Przyciągnij uchwyt do tułowia, prowadząc łokcie w tył.",
      "Powoli wróć do pozycji początkowej.",
    ],
    mistakes: ["Szarpanie tułowiem.", "Unoszenie barków do uszu."],
    alternatives: ["db-row", "barbell-row"],
  },
  {
    id: "shoulder",
    name: "Wyciskanie hantli siedząc",
    muscle: "Barki",
    equipment: "Hantle",
    pattern: "Wypychanie pionowe",
    loadType: "dumbbell",
    instructions: [
      "Ustaw stabilne oparcie i oprzyj plecy.",
      "Trzymaj hantle na wysokości barków i nadgarstki w linii przedramienia.",
      "Wyciśnij w górę bez nadmiernego wyginania pleców.",
      "Opuść hantle w wygodnym, kontrolowanym zakresie.",
    ],
    mistakes: [
      "Nadmierne odchylanie tułowia.",
      "Utrata kontroli przy opuszczaniu.",
    ],
    alternatives: ["shoulder-machine"],
  },
  {
    id: "pulldown",
    name: "Ściąganie drążka wyciągu",
    muscle: "Plecy",
    equipment: "Wyciąg",
    pattern: "Przyciąganie pionowe",
    loadType: "machine",
    instructions: [
      "Ustaw blokadę ud i stabilnie usiądź.",
      "Przyciągnij drążek przed sobą w kierunku górnej części klatki.",
      "Prowadź łokcie w dół bez szarpania.",
      "Powoli wyprostuj ramiona w wygodnym zakresie.",
    ],
    mistakes: ["Ściąganie drążka za kark.", "Rozpędzanie ciężaru tułowiem."],
    alternatives: ["assisted-pullup", "pullup"],
  },
  {
    id: "lateral",
    name: "Unoszenie hantli bokiem",
    muscle: "Barki",
    equipment: "Hantle",
    pattern: "Odwodzenie ramion",
    loadType: "dumbbell",
    instructions: [
      "Stań stabilnie z lekko ugiętymi łokciami.",
      "Unoś ramiona bokiem do wygodnej wysokości.",
      "Utrzymuj barki swobodnie i nie szarp ciężarem.",
      "Kontroluj opuszczanie.",
    ],
    mistakes: ["Zbyt duży ciężar i kołysanie tułowiem."],
    alternatives: ["cable-lateral"],
  },
  {
    id: "curl",
    name: "Uginanie ramion z hantlami",
    muscle: "Biceps",
    equipment: "Hantle",
    pattern: "Zginanie łokcia",
    loadType: "dumbbell",
    instructions: [
      "Stań stabilnie, łokcie trzymaj blisko tułowia.",
      "Zegnij łokcie, unosząc hantle bez kołysania.",
      "Powoli opuść hantle.",
    ],
    mistakes: ["Przenoszenie łokci w przód.", "Zarzucanie ciężaru."],
    alternatives: ["cable-curl"],
  },
  {
    id: "squat",
    name: "Przysiad ze sztangą",
    muscle: "Nogi",
    equipment: "Sztanga",
    pattern: "Przysiad",
    loadType: "barbell",
    instructions: [
      "Ustaw sztangę na stojakach i zabezpieczenia na właściwej wysokości.",
      "Ustaw stopy i napnij tułów przed ruchem.",
      "Ugnij biodra i kolana w wygodnym zakresie, utrzymując stopy stabilnie.",
      "Wstań, zachowując kontrolę nad tułowiem i kolanami.",
    ],
    mistakes: ["Utrata napięcia tułowia.", "Odrywanie pięt."],
    alternatives: ["goblet", "legpress"],
  },
  {
    id: "rdl",
    name: "Martwy ciąg rumuński",
    muscle: "Tył uda · pośladki",
    equipment: "Sztanga",
    pattern: "Zawias biodrowy",
    loadType: "barbell",
    instructions: [
      "Stań stabilnie, trzymaj sztangę blisko nóg.",
      "Lekko ugnij kolana i cofnij biodra.",
      "Opuść ciężar do zakresu, w którym utrzymujesz stabilny tułów.",
      "Wyprostuj biodra, nie przeprostowując pleców.",
    ],
    mistakes: [
      "Odsuwanie sztangi od ciała.",
      "Ruch z dolnej części pleców zamiast bioder.",
    ],
    alternatives: ["db-rdl"],
  },
  {
    id: "legpress",
    name: "Wypychanie na suwnicy",
    muscle: "Nogi",
    equipment: "Maszyna",
    pattern: "Przysiad",
    loadType: "machine",
    instructions: [
      "Ustaw siedzisko i stopy zgodnie z budową maszyny.",
      "Trzymaj miednicę i plecy przy oparciu.",
      "Ugnij nogi w kontrolowanym, wygodnym zakresie.",
      "Wypchnij platformę bez gwałtownego blokowania kolan.",
    ],
    mistakes: ["Odrywanie miednicy od oparcia."],
    alternatives: ["squat", "goblet"],
  },
  {
    id: "legcurl",
    name: "Uginanie nóg na maszynie",
    muscle: "Tył uda",
    equipment: "Maszyna",
    pattern: "Zginanie kolana",
    loadType: "machine",
    instructions: [
      "Dopasuj oś maszyny do kolan.",
      "Ustaw wałek i stabilnie oprzyj tułów.",
      "Zegnij nogi bez unoszenia bioder.",
      "Powoli wróć.",
    ],
    mistakes: ["Szarpanie i unoszenie bioder."],
    alternatives: ["db-rdl"],
  },
  {
    id: "calf",
    name: "Wspięcia na palce",
    muscle: "Łydki",
    equipment: "Hantle",
    pattern: "Zgięcie podeszwowe",
    loadType: "dumbbell",
    instructions: [
      "Ustaw stabilne podparcie i równowagę.",
      "Unieś pięty w kontrolowany sposób.",
      "Powoli opuść do wygodnego zakresu.",
    ],
    mistakes: ["Sprężynowanie i pośpiech."],
    alternatives: [],
  },
  {
    id: "db-bench",
    name: "Wyciskanie hantli leżąc",
    muscle: "Klatka piersiowa",
    equipment: "Hantle",
    pattern: "Wypychanie poziome",
    loadType: "dumbbell",
    instructions: [
      "Ułóż się stabilnie na ławce i oprzyj stopy.",
      "Ustaw hantle nad klatką, nadgarstki w linii przedramion.",
      "Opuść w wygodnym zakresie, a następnie wyciśnij.",
    ],
    mistakes: ["Niestabilne nadgarstki."],
    alternatives: ["bench", "chest-machine", "pushup"],
  },
  {
    id: "chest-machine",
    name: "Wyciskanie na maszynie",
    muscle: "Klatka piersiowa",
    equipment: "Maszyna",
    pattern: "Wypychanie poziome",
    loadType: "machine",
    instructions: [
      "Ustaw siedzisko tak, by uchwyty były na wygodnej wysokości.",
      "Oprzyj plecy i stabilnie ustaw stopy.",
      "Wypchnij uchwyty bez gwałtownego prostowania łokci.",
    ],
    mistakes: ["Unoszenie barków."],
    alternatives: ["bench", "db-bench", "pushup"],
  },
  {
    id: "pushup",
    name: "Pompki",
    muscle: "Klatka piersiowa",
    equipment: "Masa ciała",
    pattern: "Wypychanie poziome",
    loadType: "bodyweight",
    instructions: [
      "Ustaw dłonie stabilnie i utrzymaj napięty tułów.",
      "Opuść ciało jako całość w wygodnym zakresie.",
      "Odepchnij się, zachowując stabilną pozycję.",
    ],
    mistakes: ["Opadanie bioder."],
    alternatives: ["db-bench", "bench"],
  },
  {
    id: "db-row",
    name: "Wiosłowanie hantlami",
    muscle: "Plecy",
    equipment: "Hantle",
    pattern: "Przyciąganie poziome",
    loadType: "dumbbell",
    instructions: [
      "Wykonaj skłon przez cofnięcie bioder.",
      "Utrzymuj tułów stabilnie.",
      "Przyciągnij hantle, prowadząc łokcie w tył.",
      "Opuść powoli.",
    ],
    mistakes: ["Kołysanie tułowiem."],
    alternatives: ["row", "barbell-row"],
  },
  {
    id: "barbell-row",
    name: "Wiosłowanie sztangą",
    muscle: "Plecy",
    equipment: "Sztanga",
    pattern: "Przyciąganie poziome",
    loadType: "barbell",
    instructions: [
      "Cofnij biodra i ustaw stabilny tułów.",
      "Przyciągnij sztangę blisko ciała.",
      "Opuść powoli bez zmiany ustawienia pleców.",
    ],
    mistakes: ["Szarpanie ciężarem."],
    alternatives: ["row", "db-row"],
  },
  {
    id: "goblet",
    name: "Przysiad goblet",
    muscle: "Nogi",
    equipment: "Hantle",
    pattern: "Przysiad",
    loadType: "dumbbell",
    instructions: [
      "Trzymaj jeden hantel oburącz przed klatką.",
      "Zejdź do wygodnego przysiadu ze stabilnymi stopami.",
      "Wstań, utrzymując napięcie tułowia.",
    ],
    mistakes: ["Odrywanie pięt."],
    alternatives: ["squat", "legpress"],
  },
  {
    id: "db-rdl",
    name: "Rumuński ciąg z hantlami",
    muscle: "Tył uda · pośladki",
    equipment: "Hantle",
    pattern: "Zawias biodrowy",
    loadType: "dumbbell",
    instructions: [
      "Trzymaj dwa hantle blisko nóg.",
      "Cofnij biodra przy lekko ugiętych kolanach.",
      "Wróć do pozycji stojącej z kontrolą.",
    ],
    mistakes: ["Zaokrąglanie pleców."],
    alternatives: ["rdl"],
  },
  {
    id: "shoulder-machine",
    name: "Wyciskanie barków na maszynie",
    muscle: "Barki",
    equipment: "Maszyna",
    pattern: "Wypychanie pionowe",
    loadType: "machine",
    instructions: [
      "Dopasuj siedzisko i oprzyj plecy.",
      "Wyciśnij uchwyty w wygodnym zakresie.",
      "Powoli wróć.",
    ],
    mistakes: ["Przeprost lędźwi."],
    alternatives: ["shoulder"],
  },
  {
    id: "assisted-pullup",
    name: "Podciąganie z asystą",
    muscle: "Plecy",
    equipment: "Maszyna",
    pattern: "Przyciąganie pionowe",
    loadType: "assistance",
    instructions: [
      "Wybierz poziom asysty i stabilnie ustaw się na podparciu.",
      "Przyciągnij ciało bez szarpania.",
      "Powoli opuść. Mniejsza asysta oznacza większą trudność.",
    ],
    mistakes: ["Kołysanie ciałem."],
    alternatives: ["pulldown", "pullup"],
  },
  {
    id: "pullup",
    name: "Podciąganie",
    muscle: "Plecy",
    equipment: "Drążek",
    pattern: "Przyciąganie pionowe",
    loadType: "bodyweight",
    instructions: [
      "Złap stabilnie drążek.",
      "Podciągnij się w wygodnym zakresie bez kołysania.",
      "Opuść ciało w kontrolowany sposób.",
    ],
    mistakes: ["Szarpanie i kołysanie."],
    alternatives: ["pulldown", "assisted-pullup"],
  },
  {
    id: "cable-lateral",
    name: "Unoszenie ramion na wyciągu",
    muscle: "Barki",
    equipment: "Wyciąg",
    pattern: "Odwodzenie ramion",
    loadType: "machine",
    instructions: [
      "Ustaw uchwyty i stań stabilnie.",
      "Unoś ramiona bokiem w wygodnym zakresie.",
      "Powoli wróć.",
    ],
    mistakes: ["Szarpanie tułowiem."],
    alternatives: ["lateral"],
  },
  {
    id: "cable-curl",
    name: "Uginanie ramion na wyciągu",
    muscle: "Biceps",
    equipment: "Wyciąg",
    pattern: "Zginanie łokcia",
    loadType: "machine",
    instructions: [
      "Ustaw uchwyt i stań stabilnie.",
      "Zegnij łokcie bez ruchu tułowiem.",
      "Opuść powoli.",
    ],
    mistakes: ["Kołysanie tułowiem."],
    alternatives: ["curl"],
  },
];
export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id)!;
export const loadLabel = (type: Exercise["loadType"], exerciseId?: string) =>
  (exerciseId && exerciseById(exerciseId)?.loadHint) || (type === "dumbbell"
    ? ["goblet","goblet-box-squat"].includes(exerciseId??'')
      ? "jeden hantel · kg"
      : "na rękę · kg"
    : type === "barbell"
      ? "łącznie · kg"
      : type === "assistance"
        ? "asysta · kg"
        : type === "bodyweight"
          ? "dodatkowo · kg"
          : "stos · kg");
const slot = (
  exerciseId: string,
  sets = 3,
  min = 8,
  max = 12,
  rest = 90,
): PlanExercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  sets,
  min,
  max,
  rest,
  rir: 2,
  notes: "",
});
export function initialPlans(): Plan[] {
  return [
    {
      ...stamp("upper-a"),
      name: "Góra ciała A",
      subtitle: "Klatka · plecy · ramiona",
      minutes: 55,
      version: 1,
      weekdays: [1, 5],
      exercises: [
        "bench",
        "row",
        "shoulder",
        "pulldown",
        "lateral",
        "curl",
      ].map((id) => slot(id)),
    },
    {
      ...stamp("lower-a"),
      name: "Dół ciała A",
      subtitle: "Nogi · pośladki · łydki",
      minutes: 50,
      version: 1,
      weekdays: [3],
      exercises: ["squat", "rdl", "legpress", "legcurl", "calf"].map((id) =>
        slot(id),
      ),
    },
    {
      ...stamp("fullbody"),
      name: "Całe ciało",
      subtitle: "Trening wszystkich głównych partii",
      minutes: 45,
      version: 1,
      weekdays: [],
      exercises: ["goblet", "db-bench", "row", "db-rdl", "shoulder"].map((id) =>
        slot(id, 3, 8, 12),
      ),
    },
  ];
}
export function scheduleStarterPlans(plans: Plan[], frequency: number): Plan[] {
  const daysByCount: Record<number, number[]> = {
    1: [3],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  const days = daysByCount[frequency] ?? daysByCount[3];
  return plans.map((p) => {
    if (!["upper-a", "lower-a", "fullbody"].includes(p.id)) return p;
    const weekdays =
      frequency <= 3
        ? p.id === "fullbody"
          ? days
          : []
        : p.id === "upper-a"
          ? days.filter((_, i) => i % 2 === 0)
          : p.id === "lower-a"
            ? days.filter((_, i) => i % 2 === 1)
            : [];
    return { ...p, weekdays, updatedAt: new Date().toISOString() };
  });
}
export function initialProducts(): Product[] {
  const rows: [string, string, number, number, number, number][] = [
    ["Płatki owsiane", "suche", 370, 13, 7, 60],
    ["Skyr naturalny", "sprawdź etykietę", 64, 12, 0.2, 4],
    ["Banan", "bez skórki", 89, 1.1, 0.3, 22.8],
    ["Pierś z kurczaka", "surowa", 106, 23, 1.3, 0],
    ["Ryż biały", "suchy", 350, 7, 0.7, 78],
    ["Jajko", "bez skorupki", 143, 12.6, 9.5, 0.7],
    ["Oliwa z oliwek", "", 884, 0, 100, 0],
    ["Brokuł", "surowy", 34, 2.8, 0.4, 6.6],
    ["Chleb żytni", "", 240, 6.5, 1.7, 48],
    ["Twaróg półtłusty", "", 133, 19, 4.7, 3.7],
    ["Mleko 2%", "", 50, 3.4, 2, 4.8],
    ["Jabłko", "", 52, 0.3, 0.2, 13.8],
  ];
  return rows.map(([name, brand, kcal, protein, fat, carbs], i) => ({
    ...stamp(`food-${i}`),
    name,
    brand,
    kcal,
    protein,
    fat,
    carbs,
    unit: name.startsWith("Mleko") ? "ml" : "g",
    barcode: "",
    favorite: false,
    source: "Wartości orientacyjne - porównaj z etykietą",
  }));
}
