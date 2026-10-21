import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basemapRecovery, type BasemapStatus } from '../src/basemap-recovery';
function setup() {
  const timers = new Map<number, {run: () => void; ms: number}>();
  const events: {ready: () => void; fail: () => void}[] = [];
  const states: BasemapStatus[] = []; let id = 0, removed = 0;
  const control = basemapRecovery((ready, fail) => {events.push({ready, fail});return () => {removed++;};}, s => states.push(s), (run, ms) => {const key=++id;timers.set(key,{run,ms});return () => {timers.delete(key);};});
  return {control,events,states,timers,removed:()=>removed,tick(ms: number) {const item=[...timers].find(([,t])=>t.ms===ms);assert.ok(item);timers.delete(item[0]);item[1].run();}};
}
test('stalled map times out, retries twice, then exposes a recoverable failure', () => {
 const x=setup();for(let i=0;i<3;i++){x.tick(12000);if(i<2)x.tick(1500);}
 assert.equal(x.events.length,3);assert.equal(x.states.at(-1),'failed');assert.equal(x.timers.size,0);
 x.control.retry();assert.equal(x.events.length,4);x.events[3].ready();assert.equal(x.states.at(-1),'ready');assert.equal(x.timers.size,0);
 x.control.destroy();assert.equal(x.removed(),4);
});
test('ready map clears watchdog; stale callbacks and disposal cannot restart layers', () => {
 const x=setup();x.events[0].fail();x.events[0].fail();assert.equal(x.timers.size,1);x.tick(1500);
 x.events[0].ready();assert.equal(x.states.at(-1),'retrying');x.events[1].ready();assert.equal(x.states.at(-1),'ready');assert.equal(x.timers.size,0);
 x.events[1].fail();x.control.destroy();assert.equal(x.timers.size,0);x.events[1].ready();x.control.retry();assert.equal(x.events.length,2);
});
test('renderer initialization errors are bounded and retryable', () => {
 let callback: (()=>void)|undefined;let attempts=0;const states: BasemapStatus[]=[];
 const c=basemapRecovery(()=>{attempts++;throw new Error('WebGL unavailable');},s=>states.push(s),fn=>{callback=fn;return()=>{callback=undefined;};});
 callback!();callback!();assert.equal(attempts,3);assert.equal(states.at(-1),'failed');c.destroy();
});
