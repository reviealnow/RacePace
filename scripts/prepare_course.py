"""Reproduce sanitized route assets and golden fixtures from the supplied archive."""
import argparse
import csv
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true', help='Check generated assets without changing them')
args = parser.parse_args()
with ZipFile(ROOT / 'half_marathon_watch_system.zip') as archive:
    def read(name):
        return archive.read('half_marathon_watch_system/' + name).decode('utf-8-sig')
    root = ET.fromstring(read('2026 Taipei Marathon 21k.kml'))
    ns = {'k': 'http://www.opengis.net/kml/2.2'}
    coordinates = max(([list(map(float, p.split(',')[:2])) for p in el.text.split()]
                       for el in root.findall('.//k:LineString/k:coordinates', ns)), key=len)
    checkpoints = [dict(id=str(i + 1), name=r['name'], declaredKm=float(r['declared_km']),
                        geometryKm=float(r['route_km']), lat=float(r['lat']), lon=float(r['lon']),
                        closeTime=r['close_time'], source='使用者確認' if i == 3 else 'KML 標記')
                   for i, r in enumerate(csv.DictReader(io.StringIO(read('checkpoints.csv'))))]
    golden = list(csv.DictReader(io.StringIO(read('pace_comparison.csv'))))
course = dict(name='2026 台北馬拉松 · 半程馬拉松', timezone='Asia/Taipei', startTime='07:00',
              declaredKm=21.0975, geometryKm=checkpoints[-1]['geometryKm'],
              coordinates=coordinates, checkpoints=checkpoints)
geojson = dict(type='Feature', properties={'source': 'User-provided KML; not certified'},
               geometry=dict(type='LineString', coordinates=coordinates))
outputs = {
    'web/src/data/course.json': json.dumps(course, ensure_ascii=False, separators=(',', ':')) + '\n',
    'web/public/course/route.geojson': json.dumps(geojson, separators=(',', ':')) + '\n',
    'web/tests/golden.json': json.dumps(golden, ensure_ascii=False, indent=2) + '\n',
}
for name, content in outputs.items():
    dest = ROOT / name
    if args.check:
        if not dest.exists() or dest.read_text() != content:
            raise SystemExit(f'Generated asset differs: {name}. Run python3 scripts/prepare_course.py.')
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content)
print(f'{"Verified" if args.check else "Generated"} {len(coordinates)} route points, {len(checkpoints)} checkpoints, {len(golden)} golden predictions.')
