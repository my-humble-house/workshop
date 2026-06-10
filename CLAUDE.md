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

## 資料與隱私

- 問卷完整回覆不落地：學員的完整作答只存在於瀏覽器畫面，由學員複製或下載後自行回傳課程窗口。
- 後端 KV 只儲存匿名彙整欄位：部門、自選主題代號、診斷標籤代號、實作任務摘要（120 字內）、時間戳。
- 不得在後端儲存姓名或完整作答內容；提交 key 以姓名+部門雜湊產生，同一人重填覆蓋舊資料。
- 統計 API 的 CORS 僅允許 GitHub Pages 網域與本機預覽。

## 部署

- 前台：push 到 `main` 後 GitHub Pages 自動更新。
- 後端：`cd worker && npx wrangler deploy`。
- 後端 API 網址寫在 `index.html` 的 `API_BASE` 常數，變更 Worker 名稱或網域時必須同步更新。
