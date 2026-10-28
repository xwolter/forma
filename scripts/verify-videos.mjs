import fs from "node:fs";
const legacyIds = {
  bench: "rT7DgCr-3pg",
  row: "GZbfZ033f74",
  shoulder: "qEwKCR5JCog",
  pulldown: "CAwf7n6Luuc",
  lateral: "3VcKaXpzqRo",
  curl: "sAq_ocpRh_I",
  squat: "SW_C1A-rejs",
  rdl: "JCXUYuzwNrM",
  legpress: "IZxyjW7MPJQ",
  legcurl: "1Tq3QdYUuHs",
  calf: "_iYwv4QVFjM",
  "db-bench": "VmB1G1K7v94",
  pushup: "IODxDxX7oi4",
  "barbell-row": "vT2GjY_Umpw",
  goblet: "MeIiIdhvXT4",
  pullup: "eGo4IYlbE5g",
  "chest-machine": "xUm0BiZCWlQ",
  "db-rdl": "FQKfr1YDhEk",
  "assisted-pullup": "wFj808u2HWU",
  "shoulder-machine": "GcY6TZxfS0k",
  "db-row": "radVWm-e81I",
  "cable-lateral": "JlT2xB92lY8",
  "cable-curl": "NFzTWp2qpiE",
};
const file = "src/data/exercise-videos.json";
const result = JSON.parse(fs.readFileSync(file, "utf8"));
const ids = {...legacyIds, ...Object.fromEntries(Object.entries(result).map(([key, value])=>[key,value.id]))};
let failed = false;
for (const [exercise, id] of Object.entries(ids)) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) throw new Error(String(r.status));
    const m = await r.json();
    result[exercise] = {
      ...result[exercise],
      id,
      title: m.title,
      author: m.author_name,
      checked: new Date().toISOString().slice(0,10),
    };
    console.log(`${exercise}: ${m.title} — ${m.author_name}`);
  } catch (e) {
    failed = true;
    console.log(`FAILED ${exercise}: ${e.message}`);
  }
}
if(failed)throw new Error("A video check failed. Existing metadata has been preserved.");
fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync(
  "src/data/exercise-videos.json",
  JSON.stringify(result, null, 2),
);
