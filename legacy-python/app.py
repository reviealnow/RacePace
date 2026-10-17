"""Start: streamlit run app.py"""
import tempfile
from pathlib import Path
import streamlit as st
import pandas as pd
import plotly.express as px
from core import parse_kml,predicted_gates,parse_training,project_workout,checkpoint_passages,workout_checkpoint_splits

st.set_page_config(page_title='Taipei Half Marathon | Watch Analysis',layout='wide')
st.title('2026 Taipei Marathon 21K｜Apple Watch 訓練分析')
st.caption('以 Google My Maps KML 標記位置與時間為基準；KML 幾何距離不等同官方丈量距離')
kml_upload=st.file_uploader('匯入／更新賽道 KML',type=['kml'])
kml_path=Path(__file__).parent/'2026 Taipei Marathon 21k.kml'
if kml_upload:
    with tempfile.NamedTemporaryFile(suffix='.kml',delete=False) as f:f.write(kml_upload.getvalue());kml_path=Path(f.name)
route,places,gates,line_m=parse_kml(kml_path)
col1,col2,col3=st.columns(3)
col1.metric('KML 幾何總長',f'{line_m.length/1000:.3f} km')
col2.metric('KML 自訂關門點',len(gates))
col3.metric('官方半馬距離','21.0975 km')
start=st.text_input('起跑時間（HH:MM）','07:00')
pace=st.slider('目標平均配速（秒/km）',300,540,390,5,format='%d 秒/km')
delay=st.slider('通過起跑線延遲（分鐘）',0,30,0)
finish_on=st.checkbox('啟用終點關門時間（使用者已確認：10:00）',value=True)
finish_time=st.text_input('終點關門（HH:MM）','10:00') if finish_on else None
st.subheader('關門點與動態預測')
try:st.dataframe(predicted_gates(gates,pace,start,delay,finish_time),hide_index=True,use_container_width=True)
except ValueError as e:st.error(f'起跑或關門時間格式有誤：{e}')
points=pd.DataFrame([{'lat':lat,'lon':lon} for lon,lat in route])
st.subheader('KML 賽道')
st.map(points)
st.dataframe(pd.DataFrame([{'標記':p['name'],'KML 累計 km':round(p['route_km'],3),'偏離賽道 m':round(p['offset_m'],1),'備註':p['description']} for p in places]),hide_index=True,use_container_width=True)
st.subheader('匯入 Apple Watch 訓練記錄')
st.write('支援經 HealthFit 或其他工具匯出的 FIT / TCX / GPX。GPX 常沒有心率或步頻；有時間戳與 GPS 才能分析通過時間。')
up=st.file_uploader('選擇訓練檔案',type=['fit','tcx','gpx'])
if up:
    with tempfile.NamedTemporaryFile(suffix='.'+up.name.rsplit('.',1)[-1],delete=False) as f:f.write(up.getvalue());fn=f.name
    try:
        df=project_workout(parse_training(fn),line_m)
        st.metric('GPS 點數',len(df));st.metric('符合賽道 70m 範圍樣本比例',f'{df.on_route.mean()*100:.1f}%')
        st.dataframe(checkpoint_passages(df,gates),hide_index=True,use_container_width=True)
        splits,notice=workout_checkpoint_splits(df,gates,start,delay)
        if notice: st.warning(notice)
        elif not splits.empty:
            st.subheader('以實際分段時間模擬賽日通過關門點')
            st.dataframe(splits,hide_index=True,use_container_width=True)
            st.download_button('下載訓練分段 CSV',splits.to_csv(index=False).encode('utf-8-sig'),'watch_splits.csv','text/csv')
        st.download_button('下載 GPS 分析 CSV',df.to_csv(index=False).encode('utf-8-sig'),'watch_route_analysis.csv','text/csv')
        st.line_chart(df.set_index('timestamp')[['route_km','off_route_m']])
        if df.heart_rate.notna().any():st.line_chart(df.set_index('timestamp')['heart_rate'])
        st.info('通過時間是該次訓練的絕對時間；若要預測比賽關門，需依當次相對耗時換算成賽事 07:00 起跑。此版未將部分路段訓練推估成全馬距離。')
    except Exception as e:st.error(f'讀取失敗：{e}')
