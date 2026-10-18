import { BufferTarget, CanvasSource, canEncodeVideo, Mp4OutputFormat, Output } from 'mediabunny';
import { createReplayPainter, VIDEO, videoFrame } from './replay-render';
import { exportBasemap } from './export-basemap';
import type { Workout } from './workout';
import type { Language } from './i18n';

export const supportsMP4 = () => canEncodeVideo('avc', { width: VIDEO.width, height: VIDEO.height, bitrate: 3_000_000 });
export async function exportReplay(workout: Workout, language: Language, includeMap: boolean, signal: AbortSignal, progress: (value: number) => void) {
  signal.throwIfAborted();
  if (!await supportsMP4()) throw new Error('unsupported');
  const map = await exportBasemap(workout, language, includeMap, signal);
  signal.throwIfAborted();
  const canvas = document.createElement('canvas'); canvas.width = VIDEO.width; canvas.height = VIDEO.height;
  const paint = createReplayPainter(workout, language, map);
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: 3_000_000 });
  output.addVideoTrack(source, { frameRate: VIDEO.fps });
  const cancel = () => { void output.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    await output.start();
    for (let i = 0; i < VIDEO.frames; i++) {
      signal.throwIfAborted();
      const frame = videoFrame(i, workout.duration); paint(canvas, frame.elapsed);
      await source.add(frame.timestamp, frame.duration);
      progress(Math.round((i + 1) / VIDEO.frames * 95));
      // Yield to UI input even when a software encoder resolves synchronously.
      if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    signal.throwIfAborted(); await output.finalize(); signal.throwIfAborted();
    progress(100);
    return { blob: new Blob([output.target.buffer!], { type: 'video/mp4' }), mapIncluded: map.attributed };
  } catch (error) { await output.cancel().catch(() => {}); throw error; }
  finally { signal.removeEventListener('abort', cancel); canvas.width = canvas.height = 0; }
}
