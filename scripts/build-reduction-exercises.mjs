import fs from 'node:fs';

const source=JSON.parse(fs.readFileSync('../.tools/data/exercises.json','utf8'));
const rows=fs.readFileSync('scripts/reduction-exercises.tsv','utf8').trim().split(/\r?\n/).map(line=>line.split('|'));
if(rows.length!==200||new Set(rows.map(r=>r[0])).size!==200)throw Error('Expected 200 distinct source exercises');
const previous=new Set([...Object.values(JSON.parse(fs.readFileSync('scripts/exercise-extra-map.json'))),...Object.values(JSON.parse(fs.readFileSync('scripts/exercise-expanded-map.json'))),
 'Barbell_Bench_Press_-_Medium_Grip','Seated_Cable_Rows','Dumbbell_Shoulder_Press','Wide-Grip_Lat_Pulldown','Side_Lateral_Raise','Dumbbell_Bicep_Curl','Barbell_Squat','Romanian_Deadlift','Leg_Press','Lying_Leg_Curls','Standing_Dumbbell_Calf_Raise','Dumbbell_Bench_Press','Machine_Bench_Press','Pushups','Bent_Over_Two-Dumbbell_Row','Bent_Over_Barbell_Row','Goblet_Squat','Machine_Shoulder_Military_Press','Pullups','Standing_Biceps_Cable_Curl']);
const muscles={abdominals:'Brzuch',abductors:'Pośladki',adductors:'Przywodziciele uda',biceps:'Biceps',calves:'Łydki',chest:'Klatka piersiowa',forearms:'Przedramiona',glutes:'Pośladki',hamstrings:'Tył uda',lats:'Plecy','lower back':'Prostowniki grzbietu','middle back':'Plecy',quadriceps:'Przód uda',shoulders:'Barki',traps:'Górna część pleców',triceps:'Triceps'};
const equipment={'body only':'Masa ciała',dumbbell:'Hantle',barbell:'Sztanga','e-z curl bar':'Sztanga',kettlebells:'Kettlebell',bands:'Gumy',cable:'Wyciąg',machine:'Maszyna','medicine ball':'Piłka lekarska','exercise ball':'Piłka gimnastyczna'};
const equipmentOverride={Bicycling:'Rower',Bicycling_Stationary:'Rower stacjonarny',Recumbent_Bike:'Rower stacjonarny',Elliptical_Trainer:'Orbitrek',Walking_Treadmill:'Bieżnia',Jogging_Treadmill:'Bieżnia',Running_Treadmill:'Bieżnia',Stairmaster:'Stepper',Step_Mill:'Schody treningowe',Trail_Running_Walking:'Na zewnątrz',Rope_Jumping:'Skakanka',Skating:'Rolki',Prowler_Sprint:'Sanie',Battling_Ropes:'Liny treningowe',Front_Box_Jump:'Podest',Bench_Sprint:'Podest',Side_to_Side_Box_Shuffle:'Podest',Lateral_Cone_Hops:'Znaczniki',Side_Hop_Sprint:'Znaczniki',Band_Assisted_Pull_Up:'Drążek i guma',Inverted_Row:'Drążek',Scapular_Pull_Up:'Drążek',Platform_Hamstring_Slides:'Ślizgacze',Single_Leg_High_Box_Squat:'Podest',Svend_Press:'Talerz'};
const recommended=new Set(['Walking_Treadmill','Bicycling_Stationary','Recumbent_Bike','Elliptical_Trainer','Trail_Running_Walking','Bodyweight_Squat','Butt_Lift_Bridge','Dead_Bug','Dumbbell_Squat','Monster_Walk','Band_Pull_Apart','Suspended_Row','Step-up_with_Knee_Raise','Ball_Leg_Curl','Pull_Through','One_Arm_Lat_Pulldown','Dumbbell_Bench_Press_with_Neutral_Grip','Standing_Cable_Chest_Press','Pallof_Press','Standing_Calf_Raises','Seated_Dumbbell_Curl','Machine_Triceps_Extension','Single-Leg_Leg_Extension','Glute_Kickback']);
const singleLoads=new Set(['Plie_Dumbbell_Squat','Dumbbell_Seated_One-Leg_Calf_Raise','One_Arm_Dumbbell_Bench_Press','One-Arm_Side_Laterals','One_Arm_Dumbbell_Preacher_Curl','Standing_One-Arm_Dumbbell_Triceps_Extension','Standing_Dumbbell_Triceps_Extension','One-Arm_Kettlebell_Swings','One-Arm_Kettlebell_Row','One-Arm_Kettlebell_Floor_Press','Kettlebell_Seated_Press','Kettlebell_Halo','Kettlebell_Figure_8','Kettlebell_Overhead_Triceps_Extension','Dumbbell_Side_Bend']);
const timedConditioning=new Set(['Battling_Ropes','Fast_Skipping','Carioca_Quick_Step']);
const highImpact=new Set(['Rope_Jumping','Jogging_Treadmill','Running_Treadmill','Trail_Running_Walking','Skating','Prowler_Sprint']);
const result=rows.map(([sourceId,name,text])=>{
 const ref=source.find(e=>e.id===sourceId);if(!ref||ref.images.length!==2||previous.has(sourceId))throw Error(`Missing/duplicate source: ${sourceId}`);
 const instructions=text.split('#');if(instructions.length!==3)throw Error(`Three Polish instructions required: ${sourceId}`);
 const id='fit-'+sourceId.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const cardio=ref.category==='cardio',conditioning=ref.category==='plyometrics'||timedConditioning.has(sourceId);
 const trainingType=cardio||conditioning?'cardio':'strength';
 const machineCardio=cardio&&['machine','other'].includes(ref.equipment)&&!['Rope_Jumping','Skating','Prowler_Sprint','Bicycling'].includes(sourceId);
 const key=sourceId.replaceAll('-','_');
 const kit=sourceId.startsWith('Suspended_')?'Taśmy podwieszane':equipmentOverride[sourceId]??equipmentOverride[key]??equipment[ref.equipment]??'Masa ciała';
 const loadType=cardio||conditioning?'bodyweight':ref.equipment==='dumbbell'||ref.equipment==='kettlebells'?'dumbbell':ref.equipment==='barbell'||ref.equipment==='e-z curl bar'?'barbell':ref.equipment==='cable'||ref.equipment==='machine'?'machine':'bodyweight';
 const lowImpact=!highImpact.has(sourceId)&&ref.category!=='plyometrics'&&!timedConditioning.has(sourceId);
 const alternatives=cardio?['rowing-ergometer']:['Brzuch'].includes(muscles[ref.primaryMuscles[0]])?['plank','dead-bug-placeholder']:[];
 const e={id,name,muscle:sourceId==='Band_Hip_Adductions'?'Pośladki':sourceId==='Cable_Hip_Adduction'?'Przywodziciele uda':cardio?'Całe ciało':muscles[ref.primaryMuscles[0]]??'Całe ciało',equipment:kit,loadType,pattern:cardio?'Trening tlenowy':conditioning?'Kondycja':muscles[ref.primaryMuscles[0]],instructions,
  mistakes:[cardio?'Zbyt szybkie zwiększanie tempa i pomijanie spokojnego początku oraz zakończenia.':conditioning?'Lądowanie na sztywnych kolanach i tempo przekraczające kontrolę ruchu.':ref.equipment==='bands'?'Niestabilne mocowanie, uszkodzona guma i gwałtowne puszczanie napięcia.':'Szarpanie, wstrzymywanie oddechu i zwiększanie obciążenia kosztem kontroli ruchu.'],
  alternatives:alternatives.filter(x=>x!=='dead-bug-placeholder'),sourceId,searchTerms:ref.name+' redukcja kondycja',trainingType,level:recommended.has(sourceId)?'beginner':ref.level,lowImpact,recommended:recommended.has(sourceId)};
 if(cardio||timedConditioning.has(sourceId))e.metric='seconds';
 if(cardio){e.demoViews=true;e.defaultTarget={sets:1,min:['Rope_Jumping','Prowler_Sprint'].includes(sourceId)?30:600,max:['Rope_Jumping','Prowler_Sprint'].includes(sourceId)?60:1200,rest:0};}
 if(ref.equipment==='bands')e.loadHint='opór gumy · ciężar opcjonalny';
 if(cardio)e.loadHint=machineCardio?'czas pracy · opór ustaw na urządzeniu':'czas pracy · bez dodatkowego ciężaru';
 if(singleLoads.has(sourceId)){e.loadMultiplier=1;e.loadHint=ref.equipment==='kettlebells'?'jeden kettlebell · kg':'jeden hantel · kg';}
 if(sourceId==='Close-Grip_Dumbbell_Press'){e.loadMultiplier=1;e.loadHint='jeden hantel · kg';}
 if(sourceId==='Svend_Press'){e.loadMultiplier=1;e.loadHint='łącznie oba talerze · kg';}
 if(sourceId==='Incline_Bench_Pull'){e.equipment='Sztanga';e.loadType='barbell';}
 return e;
});
fs.writeFileSync('src/data/exercises-reduction.json',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync('scripts/exercise-reduction-map.json',JSON.stringify(Object.fromEntries(result.map(e=>[e.id,e.sourceId])),null,2)+'\n');
fs.writeFileSync('public/data/exercise-reduction-sources.json',JSON.stringify({license:'Unlicense',dataset:'https://github.com/yuhonas/free-exercise-db',guidance:['https://www.cdc.gov/physical-activity-basics/guidelines/adults.html','https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity/eating-physical-activity'],exercises:result.map(e=>({id:e.id,sourceId:e.sourceId,images:source.find(s=>s.id===e.sourceId).images.map(p=>'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'+p)}))},null,2)+'\n');
console.log(JSON.stringify({added:result.length,cardio:result.filter(e=>e.trainingType==='cardio').length,recommended:result.filter(e=>e.recommended).length,lowImpact:result.filter(e=>e.lowImpact).length}));
