# Claude 工作坊課前調查：GitHub Pages 部署與線上統計設計

日期：2026-06-10

## 背景與目標

課前調查原為單檔 HTML，依賴 Claude Artifact 的 `window.storage` 提供「共同統計」。現需求改為：

1. 部署到 GitHub Pages，提供乾淨網址供學員填寫。
2. 共同統計改為真實線上版本，任何用網址開啟的學員都能看到匿名彙整。
3. 直接下載 HTML 離線開啟（`file:`）時自動降級，僅保留個人填答與複製/下載。

## 已確認決策

| 項目 | 決策 |
|---|---|
| 規範 | 比照 abtcloser 技術邊界（原生 HTML/CSS/JS、禁框架、禁 icon font、禁外部字型），寫入本 repo `CLAUDE.md` |
| Repo | 新建公開 repo `claude-workshop-survey`，GitHub Pages 由 `main` 分支根目錄發布 |
| 檔名 | 問卷改名 `index.html` 置於根目錄 |
| 統計後端 | Cloudflare Worker + Workers KV（與既有技術棧一致，wrangler 已登入） |

## 架構

```
GitHub Pages (index.html)
   │  fetch
   ▼
Cloudflare Worker (workshop-survey-api)
   │  binding: RESPONSES
   ▼
Workers KV（key 格式 resp:<uid>）
```

### Worker API

- `POST /api/response`：提交匿名彙整。body 為 `{uid, dept, topics, diag, task, ts}`。
  - `uid`：前端以姓名+部門雜湊產生（base36，≤13 字元），同一人重填覆蓋。
  - 驗證：`uid` 格式、`dept` 必填且截斷 50 字、`topics`/`diag` 僅允許 A–H 代號、`task` 截斷 120 字。不合法回 400。
- `GET /api/responses`：回傳全部匿名回覆陣列，由前端彙整繪製統計。
- CORS：允許 `https://linachang.github.io` 與本機預覽；處理 OPTIONS preflight。
- 不儲存姓名或完整作答（隱私邊界見 CLAUDE.md）。

### 前端調整

- 移除 `window.storage` 依賴，`submitShared`/`loadShared` 改為呼叫上述 API，網址寫在 `API_BASE` 常數。
- 模式判斷：`location.protocol === "file:"` 走離線模式（不顯示統計、footer 引導改用線上網址）；其餘嘗試提交＋載入統計，失敗時顯示「稍後再試」提示。
- KV list 有最終一致性延遲：載入統計時若清單尚未包含自己剛送出的回覆，先在前端補入，避免「已完成卻看不到自己」。
- 「複製回覆內容／下載文字檔」流程不變——完整回覆仍由學員自行回傳課程窗口，線上統計只是匿名彙整。

## 錯誤處理

- 提交失敗不阻擋完成頁：學員仍可複製/下載回覆，統計區顯示載入失敗提示。
- Worker 對單筆 KV 解析失敗時跳過該筆，不中斷整體統計。

## 驗證方式

1. `node --check` 驗證前端 script 語法。
2. `curl` 對 Worker 端點做 POST（合法/不合法 payload）與 GET 驗證。
3. 部署後開啟 GitHub Pages 網址走完整流程，確認統計顯示。
