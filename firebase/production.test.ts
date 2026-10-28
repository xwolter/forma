import 'fake-indexeddb/auto';
import fs from 'node:fs';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,doc,getDoc,deleteDoc,collection,getDocs,query,limit,setDoc,serverTimestamp,terminate} from 'firebase/firestore';
vi.mock('../src/core/cloudConfig',async()=>{
 const fs=await import('node:fs');const c=JSON.parse(fs.readFileSync('../.tools/firebase-sdk-result.json','utf8')).structuredContent;
 return {cloudConfig:{projectId:c.projectId,apiKey:c.apiKey,appId:c.appId,authDomain:c.authDomain}};
});
import {login,logout,createCloudBackup,listCloudBackups,readCloudBackup} from '../src/core/cloud';
import {clearAll,seedCatalog,commit,dbPromise} from '../src/core/db';
import {stamp} from '../src/core/catalog';
const accounts=JSON.parse(fs.readFileSync('../.tools/firebase-test-accounts.json','utf8'));
const a=accounts[0],b=accounts[1],u=accounts[2];
let backup:Awaited<ReturnType<typeof createCloudBackup>>;
beforeAll(async()=>{
 await clearAll();await seedCatalog();await commit([{table:'profiles',value:{...stamp('me'),name:'Synthetic cloud test',height:180,age:30,goal:'maintain',days:3,equipmentId:'gym',theme:'light',waterGoal:2500,haptics:true,timerSound:false,notifications:false,demo:false}}]);
 // More than one page verifies pagination against the deployed service.
 await commit(Array.from({length:410},(_,i)=>({table:'daily' as const,value:{...stamp('day-'+i),date:new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10),water:500,complete:false}})));
});
afterAll(async()=>{
 await login(a.email,a.password);
 const db=getFirestore();
 for(const x of await listCloudBackups()){
  const ref=doc(db,'users',a.uid,'backups',x.id);
  const records=await getDocs(query(collection(ref,'records'),limit(400)));
  await deleteDoc(ref);
  // Once parent is deleted, records can no longer be listed; fixture knows numeric slots.
  await Promise.all(Array.from({length:x.count},(_,i)=>deleteDoc(doc(ref,'records',String(i)))));
 }
 await logout();await terminate(db);
});
it('live Auth enforces server password length and hides email existence',async()=>{
 await expect(createUserWithEmailAndPassword(getAuth(),'weak-'+Date.now()+'@example.test','Short123')).rejects.toMatchObject({code:'auth/password-does-not-meet-requirements'});
 for(const email of [a.email,'unknown-'+Date.now()+'@example.test'])await expect(signInWithEmailAndPassword(getAuth(),email,'WrongPassword123!')).rejects.toMatchObject({code:'auth/invalid-credential'});
});
it('live rules deny anonymous and unverified reads and writes',async()=>{
 const db=getFirestore();await logout();
 await expect(getDoc(doc(db,'users',a.uid,'backups','missing'))).rejects.toMatchObject({code:'permission-denied'});
 await login(u.email,u.password);
 await expect(createCloudBackup()).rejects.toThrow('potwierdź');
 await expect(setDoc(doc(db,'users',u.uid,'backups','test'),{version:1,count:1,createdAt:serverTimestamp(),complete:false})).rejects.toMatchObject({code:'permission-denied'});
});
it('live SDK round trips a completed backup across two record pages',async()=>{
 await login(a.email,a.password);backup=await createCloudBackup();
 expect(backup.count).toBeGreaterThan(400);
 expect((await listCloudBackups())[0].id).toBe(backup.id);
 const data=await readCloudBackup(backup);expect(data.profiles[0].name).toBe('Synthetic cloud test');expect(data.daily.length).toBe(410);
});
it('live rules isolate accounts and preserve immutable snapshots',async()=>{
 const ref=doc(getFirestore(),'users',a.uid,'backups',backup.id,'records','0');
 await expect(deleteDoc(ref)).rejects.toMatchObject({code:'permission-denied'});
 await login(b.email,b.password);expect(await listCloudBackups()).toEqual([]);
 await expect(getDoc(ref)).rejects.toMatchObject({code:'permission-denied'});
 await expect(createCloudBackup()).rejects.toThrow('innego konta');
 expect(await (await dbPromise).get('meta','cloud-owner')).toBe(a.uid);
});
