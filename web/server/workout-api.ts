import { MAX_BYTES, validateWorkout } from './workout-data';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('invalid');
  const reader = request.body?.getReader(); if (!reader) throw new Error('invalid');
  const decoder = new TextDecoder('utf-8',{fatal:true}); let result='', bytes=0;
  try { while (true) {const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES)throw new Error('size');result+=decoder.decode(value,{stream:true});}result+=decoder.decode(); }
  finally {await reader.cancel();}
  return JSON.parse(result);
}
export async function workoutAPI(request: Request, db: D1Database | undefined, id?: string) {
  const owner = request.headers.get('oai-authenticated-user-id');
  if (!owner) return json({error:'signin'},401);
  if (!db) return json({error:'unavailable'},503);
  if (id && !/^[a-f0-9]{64}$/.test(id)) return json({error:'missing'},404);
  if (!['GET','POST','DELETE','PATCH'].includes(request.method) || (id && request.method==='POST') || (!id && ['DELETE','PATCH'].includes(request.method))) return json({error:'method'},405);
  if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) return json({error:'origin'},403);
  try {
    if (request.method === 'GET' && !id) {
      const {results}=await db.prepare('SELECT id,name,started,duration,distance,created FROM workouts WHERE owner = ? ORDER BY started DESC LIMIT 100').bind(owner).all();
      return json({workouts:results});
    }
    if (request.method === 'GET') {
      const row=await db.prepare('SELECT name,payload FROM workouts WHERE id = ? AND owner = ?').bind(id,owner).first<{name:string;payload:string}>();
      return row ? json({id,...JSON.parse(row.payload),name:row.name}) : json({error:'missing'},404);
    }
    if (request.method === 'PATCH') {
      const input=await body(request);
      if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length>200) return json({error:'name'},400);
      const name=input.name.trim();
      const updated=await db.prepare('UPDATE workouts SET name = ? WHERE id = ? AND owner = ? RETURNING id,name').bind(name,id,owner).first();
      return updated ? json(updated) : json({error:'missing'},404);
    }
    if (request.method === 'DELETE') {
      await db.prepare('DELETE FROM workouts WHERE id = ? AND owner = ?').bind(id,owner).run();return json({deleted:true});
    }
    const {payload,workout}=validateWorkout(await body(request));
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+'\n'+payload));
    const key=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    // A single guarded insert enforces the quota even with concurrent requests.
    await db.prepare('INSERT OR IGNORE INTO workouts (id,owner,name,started,duration,distance,payload,created) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workouts WHERE owner = ?) < 100').bind(key,owner,workout.name,workout.points[0].time,workout.duration,workout.distance,payload,Date.now(),owner).run();
    const saved=await db.prepare('SELECT id FROM workouts WHERE id = ? AND owner = ?').bind(key,owner).first();
    return saved ? json({id:key},201) : json({error:'quota'},409);
  } catch(e) {
    if(e instanceof Error && (e.message==='size'))return json({error:'size'},413);
    if(e instanceof Error && ['invalid','points','duration','timestamps'].includes(e.message) || e instanceof SyntaxError || e instanceof TypeError)return json({error:'invalid'},400);
    return json({error:'unavailable'},503);
  }
}
