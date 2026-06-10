# 開發規範

本檔適用於所有 AI agent、開發工具與自動化腳本。修改本專案任何內容前，必須先閱讀本檔、`README.md` 與 `docs/specs/` 內的設計文件。

## 技術與架構邊界

- 前台靜態網站：repo 根目錄（`index.html`），部署至 GitHub Pages。
- 統計後端：`worker/`，部署至 Cloudflare Workers，資料存 Workers KV。
- 前台必須使用原生 HTML、CSS、Vanilla JS，問卷整體維持單一 `index.html`，不得引入建置流程（bundler、framework CLI）。
- 禁止 CSS framework，例如 Tailwind、Bootstrap。
- 禁止 JS framework，例如 React、Vue、Svelte。
- 禁止 icon font，例如 FontAwesome、Material Icons；圖示需使用 SVG 或 CSS。
- 禁止外部字型，一律使用裝置內建字型（PingFang TC、Microsoft JhengHei、Noto Sans TC、system-ui）。
- 視覺設計（色彩、字級、文字顏色規則、幾何背景、毛玻璃元件）必須遵守 `docs/specs/2026-06-10-visual-design-system.md`；其中「除襯底與標籤外，所有文字一律使用同一深色 `--ink`」為強制規則，調整任何頁面前必須先讀該規範。

## 資料與隱私

- 問卷完整回覆不落地：學員的完整作答只存在於瀏覽器畫面，由學員複製或下載後自行回傳課程窗口。
- 後端 KV 只儲存匿名彙整欄位：部門、自選主題代號、診斷標籤代號、實作任務摘要（120 字內）、時間戳。
- 不得在後端儲存姓名或完整作答內容；提交 key 以姓名+部門雜湊產生，同一人重填覆蓋舊資料。
- 統計 API 的 CORS 僅允許 GitHub Pages 網域與本機預覽。

## 存取防護

- 統計 API 的提交與讀取都要求 `X-Class-Code` 標頭等於 Worker secret `CLASS_CODE`；通行碼隨課程公告發布給學員，不得寫進 repo 或前端原始碼。
- Worker 內建每 IP 節流與回覆總量上限，調整數值改 `worker/src/index.js` 的 `RL_MAX_PER_MIN`、`MAX_RESPONSES`。
- 前端頁面必須保留 `noindex,nofollow` meta。

## 部署

- 前台：push 到 `main` 後 GitHub Pages 自動更新（repo：`my-humble-house/workshop`，網址 `https://my-humble-house.github.io/workshop/`）。
- 後端：`cd worker && npx wrangler deploy`；更換通行碼：`cd worker && npx wrangler secret put CLASS_CODE`。
- 後端 API 網址寫在 `index.html` 的 `API_BASE` 常數，變更 Worker 名稱或網域時必須同步更新。
- 前台網域變更時，必須同步更新 `worker/src/index.js` 的 `ALLOWED_ORIGINS` 並重新部署 Worker。
