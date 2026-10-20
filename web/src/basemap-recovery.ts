export type BasemapStatus = 'loading' | 'retrying' | 'ready' | 'failed';

// Bounded retries; each attempt owns its callbacks and cleanup. Late events from
// a removed renderer cannot change the state of the replacement renderer.
export function basemapRecovery(
  mount: (ready: () => void, failed: () => void) => () => void,
  report: (status: BasemapStatus) => void,
  schedule: (callback: () => void, ms: number) => () => void = (callback, ms) => {
    const id = setTimeout(callback, ms); return () => clearTimeout(id);
  },
) {
  let disposed = false, generation = 0, attempts = 0;
  let cleanup = () => {}, cancel = () => {};
  function start() {
    if (disposed) return;
    const current = ++generation;
    cancel(); cleanup(); cleanup = () => {};
    attempts++;
    report(attempts === 1 ? 'loading' : 'retrying');
    let waiting = false;
    const fail = () => {
      if (disposed || current !== generation || waiting) return;
      waiting = true; cancel();
      if (attempts >= 3) { report('failed'); return; }
      report('retrying'); cancel = schedule(start, 1500);
    };
    cancel = schedule(fail, 12000);
    try {
      cleanup = mount(() => {
        if (disposed || current !== generation || waiting) return;
        cancel(); report('ready');
      }, fail);
    } catch { fail(); }
  }
  start();
  return {
    retry() { if (!disposed) { attempts = 0; start(); } },
    destroy() { disposed = true; generation++; cancel(); cleanup(); },
  };
}
