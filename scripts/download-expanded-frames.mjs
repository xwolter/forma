import fs from 'node:fs';
const mapping=JSON.parse(fs.readFileSync('scripts/exercise-expanded-map.json','utf8'));
const rows=Object.entries(mapping);let index=0;
async function worker(){
 while(index<rows.length){const [id,key]=rows[index++];fs.mkdirSync(`public/exercises/${id}`,{recursive:true});
  for(let frame=0;frame<2;frame++){
   const path=`public/exercises/${id}/${frame}.jpg`;if(fs.existsSync(path))continue;
   const response=await fetch(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${encodeURIComponent(key)}/${frame}.jpg`,{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error(`${key}/${frame}: ${response.status}`);
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1000000||bytes[0]!==255||bytes[1]!==216)throw Error('Invalid photograph');fs.writeFileSync(path,bytes);
  }console.log(id);
 }
}
await Promise.all([worker(),worker(),worker()]);
const previous=JSON.parse(fs.readFileSync('src/data/exercise-frames.json','utf8'));
fs.writeFileSync('src/data/exercise-frames.json',JSON.stringify([...new Set([...previous,...Object.keys(mapping)])])+'\n');
const credits=Object.entries(mapping).map(([id,sourceId])=>({id,sourceId,source:`https://github.com/yuhonas/free-exercise-db/blob/main/exercises/${sourceId}.json`,license:'Unlicense',frames:[0,1].map(i=>`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${sourceId}/${i}.jpg`)}));
fs.writeFileSync('public/data/exercise-expanded-sources.json',JSON.stringify(credits,null,2)+'\n');
