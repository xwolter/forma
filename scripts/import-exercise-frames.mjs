import fs from "node:fs";
const db = JSON.parse(fs.readFileSync("../.tools/data/exercises.json"));
const mapping = {
  bench: "Barbell_Bench_Press_-_Medium_Grip",
  row: "Seated_Cable_Rows",
  shoulder: "Dumbbell_Shoulder_Press",
  pulldown: "Wide-Grip_Lat_Pulldown",
  lateral: "Side_Lateral_Raise",
  curl: "Dumbbell_Bicep_Curl",
  squat: "Barbell_Squat",
  rdl: "Romanian_Deadlift",
  legpress: "Leg_Press",
  legcurl: "Lying_Leg_Curls",
  calf: "Standing_Dumbbell_Calf_Raise",
  "db-bench": "Dumbbell_Bench_Press",
  "chest-machine": "Machine_Bench_Press",
  pushup: "Pushups",
  "db-row": "Bent_Over_Two-Dumbbell_Row",
  "barbell-row": "Bent_Over_Barbell_Row",
  goblet: "Goblet_Squat",
  "shoulder-machine": "Machine_Shoulder_Military_Press",
  pullup: "Pullups",
  "cable-curl": "Standing_Biceps_Cable_Curl",
};
Object.assign(mapping, JSON.parse(fs.readFileSync('scripts/exercise-extra-map.json', 'utf8')));
for (const [id, key] of Object.entries(mapping)) {
  const ex = db.find((x) => x.id === key);
  if (!ex) throw Error(key);
  fs.mkdirSync(`public/exercises/${id}`, { recursive: true });
  for (let i = 0; i < 2; i++) {
    const r = await fetch(
      `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${ex.images[i]}`,
    );
    if (!r.ok) throw Error(`${key}: ${r.status}`);
    fs.writeFileSync(
      `public/exercises/${id}/${i}.jpg`,
      Buffer.from(await r.arrayBuffer()),
    );
  }
  console.log(id);
}
fs.writeFileSync(
  "src/data/exercise-frames.json",
  JSON.stringify(Object.keys(mapping)),
);
