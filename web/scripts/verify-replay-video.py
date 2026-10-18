"""Inspect a browser-exported artifact; never substitutes a separately rendered video.
Usage: python3 web/scripts/verify-replay-video.py /absolute/path/replay.mp4
Requires ffprobe and ffmpeg on the verification machine, not in the deployed app.
"""
import json
import subprocess
import sys

path = sys.argv[1]
report = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]))
streams = report['streams']
assert len(streams) == 1 and streams[0]['codec_type'] == 'video', 'Expected silent video only'
v = streams[0]
assert v['codec_name'] == 'h264', v['codec_name']
assert (v['width'], v['height']) == (960, 720)
assert v['r_frame_rate'] == '30/1'
assert int(v['nb_frames']) == 150
assert abs(float(report['format']['duration']) - 5) < .002
# Check the map region rather than text/progress, proving the runner actually moves.
hashes = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-vf', 'crop=960:470:0:136', '-f', 'framemd5', '-']).decode()
frames = [row.split(',')[-1].strip() for row in hashes.splitlines() if row and not row.startswith('#')]
assert len(frames) == 150
assert len(set(frames)) > 10, 'Map region does not contain meaningful motion'
assert frames[0] != frames[-1], 'Start/end map frames identical'
print(json.dumps({'codec': v['codec_name'], 'pixel_format': v['pix_fmt'], 'resolution': f"{v['width']}x{v['height']}", 'fps': v['r_frame_rate'], 'frames': v['nb_frames'], 'duration_seconds': report['format']['duration'], 'unique_map_frames': len(set(frames)), 'bytes': report['format']['size']}, indent=2))
