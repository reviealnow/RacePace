# Taipei Marathon 21K — Apple Watch route training analysis

## Install and run

Requires Python 3.10+.

```bash
pip install -r requirements.txt
streamlit run app.py
```

Launches a local web dashboard. The included KML is the user's provided route, not a certified course.

## Workflow

1. The KML defines course geometry, markers, and three closure checkpoints. Upload an updated KML to refresh.
2. Select target pace (seconds per km), a possible start delay, and use the finish cut-off of 10:00 confirmed by the user (enabled by default; editable).
3. Export Apple Watch outdoor run as FIT/TCX (recommended for richer recorded metrics), or time-stamped GPX, using an export tool, and upload it.
4. GPS samples are snapped to the KML polyline and checkpoint crossing time is interpolated from successive valid GPS trackpoints.
5. Download the time-aligned data for future analysis.

## Interpretation and important limits

- The provided KML polyline measures ~21.719 km, while the race distance is 21.0975 km. They are **not interchangeable**. Checkpoint predictions use the distance explicitly entered in each checkpoint's description; GPS snaps use the geometry.
- The KML contains gate closure descriptions for 7.1 km (08:00), 11.1 km (08:30), and 17.9 km (09:30), and start description 07:00. It **does not** contain a finish cutoff; the user subsequently confirmed 10:00 as the finish cutoff, now enabled by default in the dashboard.
- Waypoint labels 'Point 1', 'Point 2', 'Point 3' remain as supplied; no claim that this is an official verified timetable.
- Model assumes constant pace on official annotated distance and allows a manual starting delay; excludes water stops, hills, congestion and tiredness unless incorporated into pace.
- GPS alignment requires location data (TCX/GPX/FIT), timestamp, and proximity to course (70 m). This is a prototype; loops/nearby parallel streets, noisy traces and tunnel gaps can cause ambiguous projections. Always verify detected crossings against route plot.
- The route is a user-provided track; its map line is not GPS accuracy ground truth. GPX alone may not contain HR or running power; depending on exporter, those fields might be omitted. Running power not yet plotted in this MVP.
- Workout timestamps are UTC standardized. The UI displays ISO timestamps with timezone `+00:00` rather than local time; Taiwan local time is UTC+08:00.
- Local Streamlit app processes user uploads locally. No health information is transferred unless the user deploys it remotely.

### Actual splits to race clock

If the recorded workout begins within 100 m of KML start and passes gate points in sequence, the dashboard also calculates segment pace from actual passing timestamps, projects those elapsed durations onto a 07:00 race-day start, and compares against user-defined closing times. If training starts mid-course or checkpoints have not been reached, it does not manufacture a finish-time prediction.
