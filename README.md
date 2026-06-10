# Claude 工作坊 課前調查

工作坊課前調查問卷：單檔互動式 HTML，部署於 GitHub Pages，並以 Cloudflare Worker + KV 提供匿名共同統計。

## 線上網址

- 問卷：https://my-humble-house.github.io/workshop/
- 統計 API：見 `index.html` 內 `API_BASE` 常數

## 存取防護

- **課程通行碼**：開啟網址後第一個畫面是通行碼鎖定頁，輸入後即向 `GET /api/verify` 驗證，通過才能看到問卷；提交回覆與讀取統計同樣要求 `X-Class-Code` 標頭等於 Worker secret `CLASS_CODE`（`cd worker && npx wrangler secret put CLASS_CODE` 設定／更換）。通行碼隨課程公告發布、不進 repo。
- **節流**：每 IP 每分鐘最多 5 次提交；回覆總量上限 300 筆（同人重填覆蓋不受限）。
- **noindex**：頁面標示 `noindex,nofollow`，降低被搜尋引擎收錄的機率。

## 結構

```
index.html                 問卷本體（原生 HTML/CSS/JS 單檔）
worker/                    統計後端（Cloudflare Worker + KV）
  ├─ wrangler.jsonc
  └─ src/index.js
docs/specs/                設計文件
CLAUDE.md                  開發規範（技術邊界、資料與隱私、部署）
```

## 運作方式

- 學員作答後，完成頁顯示完整填答摘要；完整回覆不會上傳。
- 同時前端會將匿名彙整（部門、主題代號、診斷標籤、任務摘要）送至統計 API，完成頁顯示全體統計。
- 直接下載 `index.html` 離線開啟（`file:`）時自動降級為純離線模式，不顯示統計。

## 本地預覽

```bash
python3 -m http.server 8000
# 開 http://localhost:8000
```

## 部署

- **前台**：push 到 `main`，GitHub Pages 自動更新。
- **後端**：
  ```bash
  cd worker
  npx wrangler deploy
  ```

詳細規範見 [CLAUDE.md](CLAUDE.md)，設計脈絡見 [docs/specs/](docs/specs/)。
