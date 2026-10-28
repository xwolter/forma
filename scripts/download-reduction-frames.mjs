import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('../.tools/data/exercises.json'));
const mapping=JSON.parse(fs.readFileSync('scripts/exercise-reduction-map.json'));
const rows=Object.entries(mapping);let index=0,completed=0;
async function worker(){while(index<rows.length){const [id,key]=rows[index++],ref=source.find(e=>e.id===key);fs.mkdirSync(`public/exercises/${id}`,{recursive:true});
 for(let i=0;i<2;i++){const path=`public/exercises/${id}/${i}.jpg`;if(fs.existsSync(path))continue;
  for(let attempt=0;;attempt++){try{const r=await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'+ref.images[i],{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(r.status);const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<500||bytes.length>1000000||bytes[0]!==255||bytes[1]!==216)throw Error('Invalid JPEG');fs.writeFileSync(path,bytes);break;}catch(err){if(attempt>=2)throw Error(`${key}/${i}: ${err}`);}}
 }if(++completed%20===0)console.log(`${completed}/${rows.length}`);
}}
await Promise.all(Array.from({length:6},worker));
const previous=JSON.parse(fs.readFileSync('src/data/exercise-frames.json'));
fs.writeFileSync('src/data/exercise-frames.json',JSON.stringify([...new Set([...previous,...Object.keys(mapping)])])+'\n');
console.log('All 400 exact exercise photographs downloaded');
