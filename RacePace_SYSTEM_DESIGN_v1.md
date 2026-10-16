# RacePace — Half Marathon Training Analytics

**System Design & Migration Plan v1.0**  
Date: 2026-10-16 | Language: 繁體中文 (zh-TW)  
Target: ChatGPT Sites hosting + GitHub source management  
Status: Architecture proposal, **not yet deployed**.

## 1. 專案目標與原始資料

將既有的 `half_marathon_watch_system`（Python/Streamlit）移植成可託管於 ChatGPT Sites 的響應式網站，且以 GitHub 作為開發時程、程式碼、測試、發行版本的唯一版本來源（source of truth）。

目標使用者：第一階段為單一跑者；系統邏輯保留未來多使用者擴充能力。

主要場景：跑者輸入配速與通過起跑線延遲，查看 KML 路線、關門點與到達時間；訓練後上傳 Apple Watch 的 FIT/TCX/GPX，從 GPS 與時間戳匹配賽道位置，取得分段表現及關門風險；保留跨次訓練的趨勢。

賽事設定（以使用者資料為準，非宣稱大會正式數據）：

| 節點 | 原始標註距離 | KML 對齊累積距離 | 關門時間 | 來源 |
|---|---:|---:|---|---|
| 起點 | 0 km | 0 km | 07:00 起跑 | KML |
| Point 1 | 7.1 km | 約 7.430 km | 08:00 | KML |
| Point 2 | 11.1 km | 約 11.377 km | 08:30 | KML |
| Point 3 | 17.9 km | 約 18.671 km | 09:30 | KML |
| 終點 | 21.0975 km | 約 21.719 km | 10:00 | 使用者確認 |

KML 全長約 21.719 km。**絕對不可把 KML 幾何里程直接視為官方 21.0975 km**。保留原始標記里程 `declaredKm` 與 KML 投影位置 `geometryKm` 各自的語意；賽事平均配速預測使用 `declaredKm`；GPS 通過點判定使用 `geometryKm` 與地理座標。

使用者指定比較配速：5:30、6:30、7:00 min/km。時區：Asia/Taipei；資料庫時間戳以 UTC 儲存，顯示轉為台北時間。

## 2. 平台事實與部署限制

- ChatGPT Sites 可建立、儲存、預覽、發布互動式網站；可使用站點提供的 D1（結構化資料）、R2（檔案）與 Sign in with ChatGPT（視帳號／站點可用功能）。
- 目前 Python + Streamlit 的相容性不可直接假設；先以 React + TypeScript 的相容網站為目標。若 Sites 建置環境不支援某依賴套件，應選替代方案並先測試。
- GitHub 維護程式碼。**不要宣稱 GitHub push 就能自動部署 Sites**。建議透過 Git 分支、PR、測試、保存 Site 版本、人工確認並發布；若後續官方推出可驗證的 CI/CD 接口，再導入自動發布。
- 對於本機原始碼專案，Sites 可讓建置版本對應 Git commit；發布前採用 Saved Version -> Deploy Version 階段。
- Sites 的儲存資料與部署版本分離；回滾程式版本不會自動回滾資料庫／檔案；schema migration 需獨立管理。
- 個人跑步 GPS、心率等屬敏感程度較高的個人資料；先以私人站點／單人帳號啟動，不可公開訓練檔案、API 金鑰或私人 GPS 路徑。平台禁止 Protected Health Information (PHI) 處理；在正式上線前確認資料類型及適用規範，不可將臨床病歷或其他受保護醫療資訊導入。

參考：
- https://chatgpt.com/zh-Hant/features/sites/
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
- https://learn.chatgpt.com/docs/sites/data-and-connections
- https://learn.chatgpt.com/docs/sites/managing-a-site
- https://help.openai.com/zh-hant/articles/11145903-connecting-github-to-chatgpt

## 3. 架構設計

```
Apple Watch outdoor run -> FIT/TCX/GPX --\
                                         --> [ChatGPT Sites Web App]
Google My Maps -> KML ------------------/     |-- RouteParser
                                               |-- WorkoutParser
                                               |-- GPSMapMatcher
                                               |-- Pace & Cutoff Engine
                                               |-- Analytics & Charts
                                               |-- Private auth / data access
                                               |-- D1 (users, races, sessions, splits)
                                               `-- R2 (uploaded workouts; optional)
                                                          ^
                                                          |
GitHub <-> Codex/local development -> test -> saved Site version -> reviewed deploy
```

- 前端：React + TypeScript、具備行動版的版面、互動表單。
- 地圖：Leaflet + OSM（或環境內相容之替代套件），逐點繪製 KML 路線，標記起跑、各關門點、終點；疊加訓練 GPS。
- 圖表：Recharts（或同等相容套件），顯示配速／心率／步頻／功率（若來源提供）。
- 邏輯：純函式化 TypeScript 分析模組，單元測試對照 Python legacy engine。
- 儲存：D1 存結構化訓練摘要與設定，R2 在明確啟用時保存原始檔案；MVP 可優先僅在瀏覽器處理資料且只儲存非原始的訓練摘要，降低隱私與儲存成本。
- 使用者身份：第一階段可設為只有作者能存取，正式多使用者再做 Sign in with ChatGPT 與 server-side ownership rules。

## 4. 功能模組及範圍

| 模組 | P0 MVP | P1 後續 | 詳細需求 |
|---|---|---|---|
| Race Config | Yes | | 可編輯 07:00、08:00、08:30、09:30、10:00；提供變更歷史及來源 |
| Route Viewer | Yes | | KML 路線、關門位置、官方標記 km/KML km 並列 |
| Pace Simulator | Yes | | 5:30、6:30、7:00 與自訂配速、起跑延遲、關門餘裕與風險 |
| Workout Upload | Yes | | FIT/TCX/GPX，檔案讀取結果與缺少欄位提示 |
| GPS Matching | Yes | | 單調前進檢查、容差、道路交錯防誤判、時間序列插值 |
| Segment Analysis | Yes | | 分段耗時、累積耗時、elapsed / moving time、平均配速、心率（若有） |
| Workout History | | Yes | 自有訓練記錄、訓練前後表現比較、日期篩選 |
| Trends | | Yes | 心率漂移、疲勞掉速、特定分段的歷次進步 |
| Share/Export | Yes | | CSV/JSON 匯出；公開分享只限無個資的摘要 |
| User accounts | | Yes | Sign in with ChatGPT、依 user ID 區隔資料 |

### 4.1 GPS 路線匹配

1. 解析 KML `LineString` 為 ordered geometry polyline，使用適合台灣的投影或等價 geodesic 計算。
2. 各 checkpoint 原始座標映射至 polyline 的累積距離 `geometryKm`。
3. 運動軌跡依 timestamp 由小到大排序；拒絕缺少時間／座標的紀錄與無效樣本。
4. 近點匹配須驗證偏離距離、連續樣本時間差、單調方向、最大合理速度、前後點位區段一致性；對自交路線不能只取最近點。
5. 找到有效穿越關門線的前後 GPS samples 後用線性插值估計通過時間，並回報 confidence / 無法判定，而非捏造通過時間。
6. 跑者未從正式起點出發、只跑部分賽道、或不具備關門點定位信心時，禁止自動宣稱整場完賽時間。
7. 訓練時鐘 timestamp 顯示 Asia/Taipei，賽事模擬時間另依 07:00 賽日時間重建；不能將當天運動的絕對時間當成賽日抵達時刻。

### 4.2 關門演算法

- `arrival = raceStart + startDelay + elapsedOrPredictedSeconds`
- `remainingSeconds = closeTime - arrival`
- 完整賽事固定配速：`elapsed = declaredKm * paceSecondsPerKm`
- 實測完整前段：使用該次訓練的 GPS 跨關門時間相減得到分段耗時；投影至 07:00 賽日起跑時刻。
- 尚未跑完的里程可顯示**情境推估**（維持目前最近 3/5km 配速、目標配速、後段衰退 5%-10%），但不能標成「已實測」。
- 風險等級為產品策略，建議 margin >=10min 為低風險、5–10min 為注意、0–5min 為高風險、<0 為逾時；門檻可配置而非大會規定。

## 5. D1 資料模型（草案）

```
users(id, auth_subject, created_at)
race_versions(id, name, race_date, timezone, start_time, official_distance_m, route_version, source_note)
checkpoints(id, race_version_id, name, declared_distance_m, geometry_distance_m, latitude, longitude, cutoff_local_time, source_note, sort_order)
workouts(id, user_id, source_format, source_hash, started_at_utc, total_elapsed_seconds, moving_seconds, total_distance_m, original_file_key nullable, created_at)
workout_samples(id, workout_id, timestamp_utc, latitude, longitude, heart_rate nullable, cadence nullable, power_w nullable, route_progress_m nullable, off_route_m nullable)
workout_splits(id, workout_id, checkpoint_id, crossing_time_utc, segment_elapsed_sec, effective_declared_pace_sec_km, mean_hr nullable, quality_status)
prediction_runs(id, user_id, race_version_id, workout_id nullable, mode, settings_json, result_json, created_at)
```

MVP 不一定將每個 GPS sample 寫入 D1；可選擇：原始軌跡檔僅由瀏覽器處理，摘要寫 D1；或使用 R2 存帶有權限的原始檔、D1 存 metadata。保留資料刪除與匯出機制；路線版本應隨訓練結果紀錄，避免日後更新 KML 造成歷史數據錯配。

## 6. 預計網站資訊架構

1. **Dashboard**：下一次比賽倒數、預估完賽時間、最緊迫關門點、安全餘裕、最後一次訓練。
2. **Race Map**：原始 KML 路線、關門點、點選查看正式/幾何里程與關門時間。
3. **Pace Simulator**：三種目標配速、任意配速、起跑延遲、情境模擬。
4. **Import Workout**：Apple Watch 檔案匯入、讀取內容預覽、錯誤回報、路線比對。
5. **Workout Detail**：GPS/心率/分段配速、實測 vs 預測、資料品質及不確定性。
6. **Training History**（P1）：所有訓練日期、相同路段比較、趨勢。
7. **Settings**：路線版本、賽事日期、關門時間、資料保存與刪除。

## 7. GitHub Repository 建議

建議 repository 名稱：`racepace-half-marathon`，初期使用 Private Repo。

```
racepace-half-marathon/
├── README.md
├── docs/
│   ├── SYSTEM_DESIGN.md
│   ├── DATA_DICTIONARY.md
│   ├── ACCEPTANCE_TESTS.md
│   └── CHANGELOG.md
├── legacy-python/
│   ├── app.py
│   ├── core.py
│   └── requirements.txt
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/kml/
│   │   ├── lib/workout/
│   │   ├── lib/gps/
│   │   ├── lib/prediction/
│   │   └── types/
│   ├── public/course/  # 自有 KML 與 sanitized sample data
│   ├── tests/
│   └── package.json
├── data/
│   └── fixtures/  # 無可識別個人路徑/心率的測試資料
├── .github/
│   └── workflows/ci.yml
├── .gitignore
└── LICENSE  # 再決定是否公開、採用何種授權
```

`.gitignore` 至少排除個人訓練 FIT/TCX/GPX、`.env*`（保留 `.env.example`）、資料庫 dump、R2 keys、token、`node_modules`、local cache。任何公開 repo 都需清查原始 KML 描述資訊及位置資料。

### 版本管理及發布 SOP

`feature/*` -> PR -> GitHub Actions (`lint`, `typecheck`, `unit tests`, `build`) -> merge `main` -> Sites build and **Save Version** -> Verify -> **Deploy Version** -> tag/release (`v0.1.0`).

現有官方文件沒有保證 push 至 GitHub 就能直接觸發 Sites 自動發布；先採人工 release gate，並以 Git commit SHA 在 Release note 註明程式版本。日後如有明確支援的自動化介面再評估。

## 8. 分階段建置

### Milestone 0 — Repository 和參考資料（0.5–1 天）
- GitHub private repository 建立、上傳 legacy 程式與這份規格。
- 將 KML 賽道、關門點轉換為可測試 JSON／GeoJSON。
- 以 Python 版的配速與關門計算結果建立 golden fixtures。

### Milestone 1 — Sites 相容的 MVP（3–6 天）
- ChatGPT Sites 建立相容前端；Dashboard、Race Map、Pace Simulator。
- 賽事資料固定載入，支援編輯已確認的終點 10:00。
- Golden fixtures 比對 TypeScript 與 Python 演算法，未通過不發佈。
- 在 Sites 預覽測試並儲存未公開版本。

### Milestone 2 — Apple Watch 匯入（3–6 天）
- GPX/TCX/FIT 格式匯入與錯誤回報。
- 時間戳、GPS matcher、checkpoint passage、資料品質。
- 同路線測試、局部賽道測試、跑離路線／跨越自交點測試。
- 支援本地下載分析 CSV，不上傳不必要的個資。

### Milestone 3 — 長期訓練資料庫（2–5 天）
- D1 + 選用 R2、驗證存取權與永久保存。
- 訓練歷史、心率／配速趨勢、檔案管理與刪除。
- UI RWD，iPhone/Safari 檢查；先私人發布。

以上天數為粗略開發估算，非保證交付日程，需視 Sites 套件相容性與 FIT 檔案樣本複雜度調整。

## 9. 必要驗收測試

1. 所有關門點資料正確：7.1/08:00；11.1/08:30；17.9/09:30；21.0975/10:00。
2. 07:00、5:30/km、0 延遲，終點 08:56:02；6:30/km，09:17:08；7:00/km，09:27:41（允許顯示格式取整差異）。
3. Point 3 的 declared distance 17.9km 與 KML 18.671km 必須在頁面分開顯示；不可由 KML 18.671 直接推計官方配速到達。
4. 同一錄入檔案重複上傳，不應意外建立重複訓練（以雜湊或同等識別機制去重）。
5. 沒有時間戳的 GPX、沒有 GPS 的健身紀錄，須提示分析能力不足。
6. 部分路段、起點不吻合、穿越其他道路、GPS 逆向走動，不能生成假的全程通過時間。
7. 斷線／重新整理後，已儲存的訓練仍可查詢；登入使用者不能讀到其他人的檔案。
8. 時區正確：UTC+08:00 顯示；賽事抵達時間以當地 07:00 開始。
9. 不可把未實測區間、沒有心率／功率的欄位做成看似真實的數據。
10. 程式版本 rollback 不得意外清除 D1/R2，資料遷移要可追蹤。

## 10. 建置初始 @Sites Prompt

> 使用 @Sites 建立一個名為 RacePace 的繁體中文、手機與桌面皆適用的半馬訓練分析網站。請先審核我上傳的 legacy Python/Streamlit 程式、KML 路線及 SYSTEM_DESIGN.md，然後將相容功能移植到 React/TypeScript。請以 KML 標記之起跑 07:00、7.1km/08:00、11.1km/08:30、17.9km/09:30 為準，另外加入使用者確認的終點 21.0975km/10:00。KML 幾何路線約 21.719km，官方標示里程與幾何投影距離要分別儲存和顯示。第一版先實作 Route Map、Pace Simulator 及資料匯入空白狀態，支援 5:30、6:30、7:00 min/km、自訂配速、起跑延遲、安全餘裕。請驗證計算結果與既有 Python fixtures 一致。不要臆造 Apple Watch 訓練資料，不要將示範圖表當成實測結果。GitHub 是程式碼的 source of truth，請先儲存可預覽的版本，不要直接公開發布；列出尚未相容或需要我授權的項目。

## 11. 下個明確決策

預設首發為「個人私有版」，先不啟用多使用者資料共享。下一步建立 GitHub 私有 Repository，將 legacy 版本與規格放入，然後在 ChatGPT Work 以 @Sites 執行上述 Prompt，先取得相容性測試與未公開預覽。
