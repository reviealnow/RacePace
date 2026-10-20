import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {workoutAPI} from '../server/workout-api';
import {validateWorkout} from '../server/workout-data';
const fixture={name:'Synthetic run',points:[{lat:25,lon:121,time:1000},{lat:25.001,lon:121,time:2000}],speedSamples:[]};
function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE workouts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, started INTEGER NOT NULL, duration REAL NOT NULL, distance REAL NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL)');
 return {sql,prepare(query:string){let args:unknown[]=[];const self={bind(...a:unknown[]){args=a;return self;},async all(){return {results:sql.prepare(query).all(...args as never[])};},async first(){return sql.prepare(query).get(...args as never[])??null;},async run(){return sql.prepare(query).run(...args as never[]);}};return self;}};
}
function request(method='GET',owner='alice',data?:unknown,origin='https://racepace.test') {return new Request('https://racepace.test/api/workouts',{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),'Content-Type':'application/json',origin},...(data?{body:JSON.stringify(data)}:{})});}
test('library persists a run across devices, deduplicates, and isolates every operation by owner',async()=>{
 const db=database();const env=db as unknown as D1Database;
 try {
 assert.equal((await workoutAPI(request('GET',''),env)).status,401);
 assert.equal((await workoutAPI(request('POST','alice',fixture,'https://elsewhere.test'),env)).status,403);
 const saved=await workoutAPI(request('POST','alice',fixture),env);assert.equal(saved.status,201);const {id}=await saved.json() as {id:string};
 const again=await workoutAPI(request('POST','alice',fixture),env);assert.equal((await again.json() as {id:string}).id,id);
 const list=await workoutAPI(request(),env);assert.equal((await list.json() as {workouts:unknown[]}).workouts.length,1);
 const loaded=await workoutAPI(request(),env,id);assert.deepEqual((await loaded.json() as {points:unknown[]}).points,fixture.points);
 assert.equal((await workoutAPI(request('GET','bob'),env,id)).status,404);
 await workoutAPI(request('DELETE','bob'),env,id);assert.equal((await workoutAPI(request(),env,id)).status,200);
 await workoutAPI(request('DELETE'),env,id);assert.equal((await workoutAPI(request(),env,id)).status,404);
 }finally{db.sql.close();}
});
test('library rejects corrupt data and bounds account storage',async()=>{
 const db=database();const env=db as unknown as D1Database;
 try {
 assert.equal((await workoutAPI(request('POST','alice',{...fixture,points:[{lat:100,lon:121,time:0}]}),env)).status,400);
 for(let i=0;i<100;i++)assert.equal((await workoutAPI(request('POST','alice',{...fixture,name:`Run ${i}`}),env)).status,201);
 assert.equal((await workoutAPI(request('POST','alice',fixture),env)).status,409);
 assert.equal((await workoutAPI(request('POST','bob',fixture),env)).status,201);
 }finally{db.sql.close();}
});
test('saved data preserves replay timing and speeds without trusting derived metrics or storing Health source',()=>{
 const data=validateWorkout({...fixture,distance:999999,speedSamples:[{start:1000,end:2000,speed:12,source:'Private device name'}]});
 assert.ok(data.workout.distance<200);assert.equal(data.workout.speedSamples[0].speed,12);assert.ok(!data.payload.includes('Private device name'));
 assert.throws(()=>validateWorkout({...fixture,speedSamples:[{start:0,end:2000,speed:12}]}));
});
