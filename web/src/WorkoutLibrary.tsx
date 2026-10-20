import {useEffect,useState,useRef} from 'react';
import {buildWorkout,sampledSpeed,type GPSPoint,type SpeedSample,type Workout} from './workout';
import type {Language} from './i18n';
type Saved = {id:string;name:string;started:number;duration:number;distance:number};
async function api<T = unknown>(path='', options?:RequestInit) {
 const response=await fetch('/api/workouts'+path,{...options,cache:'no-store',headers:{'Content-Type':'application/json',...options?.headers}});
 let result;try{result=await response.json();}catch{throw new Error('unavailable');}
 if(!response.ok)throw new Error((result as {error?:string}).error??'unavailable');return result as T;
}
export default function WorkoutLibrary({language,workout,onOpen}:{language:Language;workout:Workout|null;onOpen:(w:Workout)=>void}) {
 const t=(en:string,zh:string)=>language==='en'?en:zh;
 const [rows,setRows]=useState<Saved[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[deleting,setDeleting]=useState<string|null>(null);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;void refresh();return()=>{alive.current=false;};},[]);
 async function refresh(){setBusy(true);setError('');try{const data=await api<{workouts:Saved[]}>();if(alive.current)setRows(data.workouts);}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setBusy(false);}}
 async function save(){if(!workout||workout.demo)return;setBusy(true);setError('');setMessage('');try{await api('',{method:'POST',body:JSON.stringify({name:workout.name,points:workout.points.map(({lat,lon,time,originalTime,recordedSpeed,breakBefore})=>({lat,lon,time,originalTime,recordedSpeed,breakBefore})),speedSamples:workout.speedSamples})});if(alive.current){setMessage('saved');await refresh();}}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setBusy(false);}}
 async function open(id:string){setBusy(true);setError('');setMessage('');try{const data=await api<{name:string;points:GPSPoint[];speedSamples:SpeedSample[]}>('/'+id);const next=buildWorkout(data.points,data.name);next.speedSamples=data.speedSamples;next.recordedSpeedCount+=next.points.filter(p=>sampledSpeed(data.speedSamples??[],p.time)!==undefined).length;if(alive.current)onOpen(next);}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setBusy(false);}}
 async function remove(id:string){setBusy(true);setError('');try{await api('/'+id,{method:'DELETE'});if(alive.current){setDeleting(null);setMessage('deleted');await refresh();}}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setBusy(false);}}
 const explanation=error==='signin'?t('Sign in with the same account on both devices to access your library.','請在兩個裝置登入同一帳號，以存取你的紀錄。'):error==='size'?t('This route is too large to save (1.5 MB replay-data limit). Local replay still works.','此路線超過儲存上限（重播資料 1.5 MB），仍可在本機重播。'):error==='quota'?t('Your library holds up to 100 runs. Delete a saved run before adding another.','最多可儲存 100 次跑步，請先刪除舊紀錄再新增。'):error==='missing'?t('This run is no longer in your library. Refresh the list.','這次跑步已不在紀錄中，請重新整理列表。'):t('Could not access your library. Please retry. Your imported run is still on this device.','暫時無法存取紀錄，請重試。已匯入的跑步仍保留於此裝置。');
 return <section className="panel workout-library" aria-label={t('My runs','我的跑步紀錄')}>
  <div className="section-heading"><h2>{t('My runs','我的跑步紀錄')}</h2><button className="text-button" disabled={busy} onClick={()=>void refresh()}>{t('Refresh','重新整理')}</button></div>
  <p>{t('Save a run here, then sign in to RacePace with the same account on your phone. Open a run to replay, export MP4, or share.','將跑步存到這裡，再於手機用同一帳號登入 RacePace。開啟紀錄即可重播、匯出 MP4 或分享。')}</p>
  {workout&&!workout.demo&&<div className="library-save"><p>{t('Saving uploads this run’s GPS route, timestamps and replay speeds to your private account. The original files and full Apple Health export are not uploaded.','儲存會將本次 GPS 路線、時間與重播速度上傳到你的私人帳號，不會上傳原始檔案或完整 Apple Health 匯出檔。')}</p><button className="primary" disabled={busy} onClick={()=>void save()}>{t('Save to my library','儲存到我的紀錄')}</button></div>}
  {busy&&<p role="status">{t('Working…','處理中⋯')}</p>}
  {error&&<p role="alert">{explanation} {error==='signin'&&<a href="/signin-with-chatgpt?return_to=%2F%3Fview%3Dreplay" target="_top">{t('Sign in','登入')}</a>}</p>}
  {message&&<p role="status">{message==='saved'?t('Saved. This run is available on your other devices.','已儲存，可在其他裝置開啟。'):t('Deleted from your library. Any copy already opened or downloaded remains on that device.','已從紀錄刪除；已在其他裝置開啟或下載的副本不受影響。')}</p>}
  {!busy&&!error&&rows.length===0&&<p>{t('No saved runs yet. Import a workout, then choose Save to my library.','尚無儲存紀錄。匯入運動後，選擇「儲存到我的紀錄」。')}</p>}
  <ul>{rows.map(row=><li key={row.id}><div><strong>{row.name}</strong><span>{new Date(row.started).toLocaleString(language==='en'?'en-US':'zh-TW')} · {(row.distance/1000).toFixed(2)} km · {Math.floor(row.duration/60)}:{String(Math.floor(row.duration%60)).padStart(2,'0')}</span></div><div className="library-actions"><button className="primary" disabled={busy} onClick={()=>void open(row.id)}>{t('Open run','開啟紀錄')}</button>{deleting===row.id?<><span>{t('Delete this saved run?','刪除此儲存紀錄？')}</span><button disabled={busy} onClick={()=>void remove(row.id)}>{t('Delete','確認刪除')}</button><button disabled={busy} onClick={()=>setDeleting(null)}>{t('Cancel','取消')}</button></>:<button className="text-button" disabled={busy} onClick={()=>setDeleting(row.id)}>{t('Delete','刪除')}</button>}</div></li>)}</ul>
 </section>;
}
