"""Half-marathon route and Apple Watch workout analysis. KML is the authoritative course source."""
from __future__ import annotations
import math
from pathlib import Path
from datetime import datetime, time, timedelta, timezone
import xml.etree.ElementTree as ET
import pandas as pd
from shapely.geometry import LineString, Point
from pyproj import Transformer

WGS84_TO_METERS = Transformer.from_crs('EPSG:4326', 'EPSG:32651', always_xy=True)
METERS_TO_WGS84 = Transformer.from_crs('EPSG:32651', 'EPSG:4326', always_xy=True)
PACE_SECONDS = [330,390,420]
RACE_START = '07:00'
# User confirmed finish cut-off 10:00; this is not embedded in original KML.

def hhmm(s):
    return datetime.strptime(s.strip().replace('am','').replace('AM','').strip(), '%H:%M').time()

def parse_kml(path):
    ns={'k':'http://www.opengis.net/kml/2.2'}
    root=ET.parse(path).getroot()
    places=[]; route=[]
    for pm in root.findall('.//k:Placemark',ns):
        name=pm.findtext('k:name',default='',namespaces=ns).strip()
        desc=pm.findtext('k:description',default='',namespaces=ns).strip()
        line=pm.find('.//k:LineString/k:coordinates',ns)
        point=pm.find('.//k:Point/k:coordinates',ns)
        if line is not None and line.text:
            parts=line.text.strip().split()
            points=[tuple(map(float,p.split(',')[:2])) for p in parts]
            if len(points)>len(route):route=points
        if point is not None and point.text:
            lon,lat=map(float,point.text.strip().split(',')[:2])
            places.append(dict(name=name,description=desc,lon=lon,lat=lat))
    if not route:raise ValueError('KML does not contain a LineString route')
    line_m=LineString([WGS84_TO_METERS.transform(lon,lat) for lon,lat in route])
    for p in places:
        pt=Point(*WGS84_TO_METERS.transform(p['lon'],p['lat']))
        p['route_km']=line_m.project(pt)/1000
        p['offset_m']=line_m.distance(pt)
    # Gate distances and times are explicitly encoded in KML placemark descriptions.
    import re
    gates=[]
    for p in places:
        m=re.search(r'(\d+(?:\.\d+)?)\s*km\s*;\s*(\d{1,2}:\d{2})\s*(am|pm)?',p['description'],re.I)
        if m:
            h,mn=map(int,m.group(2).split(':'));ap=(m.group(3) or '').lower()
            if ap=='pm' and h<12:h+=12
            if ap=='am' and h==12:h=0
            gates.append({**p,'declared_km':float(m.group(1)),'close_time':f'{h:02d}:{mn:02d}'})
    gates.sort(key=lambda g:g['declared_km'])
    return route, places, gates, line_m

def predicted_gates(gates, pace_s=390, start='07:00', start_delay_min=0, finish_close=None):
    out=[]
    base=datetime.combine(datetime(2026,12,20).date(),hhmm(start))+timedelta(minutes=start_delay_min)
    all_gates=list(gates)
    if finish_close:
        all_gates.append({'name':'終點','declared_km':21.0975,'route_km':None,'close_time':finish_close})
    for g in all_gates:
        actual=base+timedelta(seconds=g['declared_km']*pace_s)
        deadline=datetime.combine(base.date(),hhmm(g['close_time']))
        margin=(deadline-actual).total_seconds()/60
        out.append({'關門點':g['name'],'標記里程 km':g['declared_km'],'KML 里程 km':round(g['route_km'],3) if g.get('route_km') is not None else None,'關門時間':g['close_time'],'預估抵達':actual.strftime('%H:%M:%S'),'餘裕 分鐘':round(margin,1),'判定':'通過' if margin>=0 else '逾時'})
    return pd.DataFrame(out)

def parse_training(path):
    """Read original time-stamped GPS samples; supported file types GPX/TCX/FIT."""
    p=Path(path);suffix=p.suffix.lower(); rows=[]
    if suffix=='.gpx':
        root=ET.parse(p).getroot()
        for trk in root.iter():
            if trk.tag.split('}')[-1]!='trkpt':continue
            lat=trk.attrib.get('lat');lon=trk.attrib.get('lon')
            dt=next((c.text for c in trk if c.tag.split('}')[-1]=='time'),None)
            if dt and lat and lon:rows.append((dt,float(lat),float(lon),None,None))
    elif suffix=='.tcx':
        root=ET.parse(p).getroot()
        for el in root.iter():
            if el.tag.split('}')[-1]!='Trackpoint':continue
            v={};
            for e in el.iter():
                tag=e.tag.split('}')[-1]
                if tag in ('Time','LatitudeDegrees','LongitudeDegrees','Value','Cadence','Watts') and e.text:
                    v[tag]=e.text
            if {'Time','LatitudeDegrees','LongitudeDegrees'}<=v.keys():
                rows.append((v['Time'],float(v['LatitudeDegrees']),float(v['LongitudeDegrees']),float(v['Value']) if 'Value' in v else None,float(v['Cadence']) if 'Cadence' in v else None))
    elif suffix=='.fit':
        try:from fitparse import FitFile
        except ImportError as exc:raise ImportError('Install fitparse for FIT files: pip install fitparse') from exc
        for msg in FitFile(str(p)).get_messages('record'):
            v={f.name:f.value for f in msg}
            if v.get('timestamp') and v.get('position_lat') is not None and v.get('position_long') is not None:
                scale=180/2**31
                lat=v['position_lat']*scale;lon=v['position_long']*scale
                rows.append((v['timestamp'],lat,lon,v.get('heart_rate'),v.get('cadence')))
    else:raise ValueError('Supported workout formats: .gpx, .tcx, .fit')
    if not rows:raise ValueError('No time-stamped GPS trackpoints detected')
    df=pd.DataFrame(rows,columns=['timestamp','lat','lon','heart_rate','cadence'])
    df['timestamp']=pd.to_datetime(df['timestamp'],utc=True)
    df=df.dropna(subset=['timestamp','lat','lon']).sort_values('timestamp').drop_duplicates('timestamp').reset_index(drop=True)
    return df

def project_workout(df,line_m):
    """Snap to course geometry; off-course samples excluded from checkpoint interpolations."""
    df=df.copy();xy=[Point(*WGS84_TO_METERS.transform(x,y)) for x,y in zip(df.lon,df.lat)]
    df['route_km']=[line_m.project(p)/1000 for p in xy]
    df['off_route_m']=[line_m.distance(p) for p in xy]
    df['on_route']=df.off_route_m<=70
    # Diagnostics: GPS snaps may be non-monotonic at crossings / parallel streets.
    return df

def checkpoint_passages(df,gates):
    """First forward crossing, interpolated between nearby valid samples, no fake passage outside tracked portion."""
    d=df[df.on_route].sort_values('timestamp').reset_index(drop=True)
    out=[]
    for gate in gates:
        target=gate['route_km'];passage=None
        for i in range(1,len(d)):
            a,b=d.iloc[i-1],d.iloc[i]
            dt=(b.timestamp-a.timestamp).total_seconds()
            if 0<dt<=120 and a.route_km<=target<=b.route_km and b.route_km-a.route_km<=0.3 and b.route_km>a.route_km:
                fraction=(target-a.route_km)/(b.route_km-a.route_km)
                passage=a.timestamp+pd.to_timedelta(dt*fraction,unit='s');break
        out.append({'關門點':gate['name'],'標記里程 km':gate['declared_km'],'KML 里程 km':round(target,3),'訓練通過時間':passage.isoformat() if passage is not None else '未經過 / 無法判定'})
    return pd.DataFrame(out)

def workout_checkpoint_splits(df, gates, race_start='07:00', start_delay_min=0):
    """Race-clock checkpoint projection only when GPS trace starts within 100m of course start."""
    d=df[df.on_route].sort_values('timestamp').reset_index(drop=True)
    if len(d)<2 or d.iloc[0].route_km>0.10:
        return pd.DataFrame(), '訓練並非從賽道起點出發；不進行全路線關門預測。'
    start_ts=d.iloc[0].timestamp
    observed=checkpoint_passages(df,gates)
    entries=[];previous_km=0;previous_time=start_ts
    for _,row in observed.iterrows():
        if row['訓練通過時間']=='未經過 / 無法判定':break
        reached=pd.Timestamp(row['訓練通過時間'])
        secs=(reached-start_ts).total_seconds()
        seg_secs=(reached-previous_time).total_seconds()
        km=row['標記里程 km']
        if secs<0 or km<=previous_km:continue
        projection=datetime.combine(datetime(2026,12,20).date(),hhmm(race_start))+timedelta(minutes=start_delay_min,seconds=secs)
        closing=next(v['close_time'] for v in gates if v['name']==row['關門點'])
        deadline=datetime.combine(projection.date(),hhmm(closing))
        entries.append({'關門點':row['關門點'],'距離 km':km,'該段平均配速 秒/km':round(seg_secs/(km-previous_km),1),'累計耗時 分鐘':round(secs/60,1),'若賽事起跑預計抵達':projection.strftime('%H:%M:%S'),'關門餘裕 分鐘':round((deadline-projection).total_seconds()/60,1)})
        previous_km=km;previous_time=reached
    return pd.DataFrame(entries), None
