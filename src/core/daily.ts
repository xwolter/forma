const messages = [
  "Zacznij od jednej dobrej serii.",
  "Twoje tempo też prowadzi do celu.",
  "Dziś budujesz siłę na jutro.",
  "Małe kroki. Prawdziwe postępy.",
  "Nie musisz bić rekordu, żeby zrobić postęp.",
  "Pojawienie się to już pierwszy krok.",
  "Zadbaj o ruch. Zostaw sobie siłę na życie.",
  "Liczy się Twój następny ruch.",
  "Dobra technika jest warta więcej niż dodatkowy talerz.",
  "Regeneracja też jest częścią treningu.",
  "Wróć do swojego rytmu, kiedy będziesz gotowy.",
  "Zrób dziś coś dla siebie.",
  "Spokojna konsekwencja daje moc.",
  "Twój punkt odniesienia to Ty.",
  "Nie każdy dzień musi być maksymalny.",
  "Zapisz wynik. Daj sobie szansę go poprawić.",
  "Rozgrzewka. Skupienie. Twój ruch.",
  "Jedna decyzja bliżej dobrego nawyku.",
  "Silniejsze ciało zaczyna się od cierpliwości.",
  "Dziś wystarczy dobry początek.",
  "Nie nadrabiaj odpoczynku. Korzystaj z niego.",
  "Ruch ma dawać Ci więcej energii.",
  "Powtórz to, co Ci służy.",
  "Progres lubi czas i regularność.",
  "Nie porównuj swojego początku z czyimś rekordem.",
  "Technika dziś. Siła z czasem.",
  "Trening dopasuj do dnia, który masz.",
  "Każdy świadomy ruch się liczy.",
  "Zakończ trening z poczuciem dobrze wykonanej pracy.",
  "Zadbaj o posiłek, wodę i odpoczynek.",
  "Najlepszy plan to taki, do którego chcesz wracać.",
];
export function dailyInspiration(date: string) {
  const index = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000);
  const i = Number.isFinite(index) ? index : 0;
  return {
    text: messages[((i % messages.length) + messages.length) % messages.length],
    image: ["/images/workout.webp", "/images/ready.webp"][((i % 2) + 2) % 2],
    photoIndex: ((i % 6) + 6) % 6,
  };
}
