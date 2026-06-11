# 課前調查題目改版與結果頁通盤分析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依 `docs/specs/2026-06-11-survey-question-revision-design.md` 將課前調查改為 18 題（新增分享與資安章節、課堂實作四題組、部門固定選項），並把結果頁改為六區塊通盤分析。

**Architecture:** 前台為單一 `index.html`（原生 HTML/CSS/Vanilla JS，無建置流程），題目以 `QUESTIONS` 陣列資料驅動；後端為 Cloudflare Worker（`worker/src/index.js`）存 Workers KV，payload 走白名單驗證。改版順序：先改 Worker schema → 改前端資料與邏輯 → 改結果頁 → 部署 Worker → 清 KV → 推前端。

**Tech Stack:** Vanilla JS、Cloudflare Workers、Workers KV、wrangler、GitHub Pages。

**強制規範（執行前必讀）：** `CLAUDE.md`、`docs/specs/2026-06-10-visual-design-system.md`。重點：禁框架、禁 SVG、禁外部資源；所有內容文字一律 `--ink`；統計區文字一律 16px；新視覺元素只能用 CSS 與既有 MHH 色票變數（`--bar-1` 深藍、`--bar-2` 灰綠、`--bar-3` 銅褐）。本專案無自動測試框架，驗證方式為 `node --check`、`wrangler dev`＋`curl`、瀏覽器走流程。

---

### Task 1: Worker payload schema 擴充（A–I 代號、dept 白名單、備課欄位）

**Files:**
- Modify: `worker/src/index.js`（檔頭註解與 `validate()`，約 1–15 行與 58–75 行）

- [ ] **Step 1: 改寫 `validate()` 與檔頭註解**

檔頭第 7 行註解改為：

```js
 * KV 只存匿名欄位（dept/topics/diag/task/succ/mat/limit/sens/lit/ts），不存姓名與完整作答。
```

`validate()` 整段（含上方註解）替換為：

```js
/* 部門白名單：與前端基本資料的固定選項一致 */
const DEPTS = ["行銷處", "數位處", "其他"];

/* 僅接受預期形狀與長度的欄位，其餘一律拒絕、歸零或過濾 */
function validate(d) {
  if (typeof d !== "object" || d === null) return null;
  const uid = String(d.uid || "");
  if (!/^[0-9a-z]{1,13}$/.test(uid)) return null;
  const dept = String(d.dept || "").trim();
  if (!DEPTS.includes(dept)) return null;
  const codes = (x) =>
    Array.isArray(x) ? x.filter((v) => typeof v === "string" && /^[A-I]$/.test(v)).slice(0, 9) : [];
  const intIn = (v, max) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
  };
  const mat = Array.isArray(d.mat)
    ? d.mat.filter((v) => Number.isInteger(v) && v >= 1 && v <= 5).slice(0, 5)
    : [];
  return {
    uid,
    dept,
    topics: codes(d.topics),
    diag: codes(d.diag),
    task: String(d.task || "").slice(0, 120),
    succ: intIn(d.succ, 5),    // Q16 成功標準 1–5，0=未填/其他
    mat,                        // Q17 素材代號 1–5
    limit: intIn(d.limit, 3),  // Q18 資料限制 1–3
    sens: intIn(d.sens, 1),    // Q11 是否貼過敏感內容或不確定界線
    lit: intIn(d.lit, 3),      // Q13 分享連結認知 1–3
    ts: Number(d.ts) || Date.now(),
  };
}
```

- [ ] **Step 2: 本機啟動 Worker**

```bash
cd worker && npx wrangler dev --local --var CLASS_CODE:localtest
```

Expected: `Ready on http://localhost:8787`（通行碼僅本機測試用，不寫入任何檔案）。

- [ ] **Step 3: curl 驗證新 schema（另開終端）**

```bash
# 1) 合法 payload（含 I 代號與新欄位）→ {"ok":true}
curl -s -X POST http://localhost:8787/api/response \
  -H "Content-Type: application/json" -H "X-Class-Code: localtest" \
  -d '{"uid":"t1","dept":"行銷處","topics":["C","I"],"diag":["E","I"],"task":"測試","succ":2,"mat":[1,4],"limit":3,"sens":1,"lit":2,"ts":1}'

# 2) dept 不在白名單 → 400 {"ok":false,"error":"invalid payload"}
curl -s -X POST http://localhost:8787/api/response \
  -H "Content-Type: application/json" -H "X-Class-Code: localtest" \
  -d '{"uid":"t2","dept":"行銷","topics":[],"diag":[],"task":"","ts":1}'

# 3) 越界值被淨化：J 代號被過濾、succ=99→0、mat 含 9 被過濾
curl -s -X POST http://localhost:8787/api/response \
  -H "Content-Type: application/json" -H "X-Class-Code: localtest" \
  -d '{"uid":"t3","dept":"其他","topics":["J","A"],"diag":[],"task":"","succ":99,"mat":[9,2],"limit":0,"sens":5,"lit":1,"ts":1}'

# 4) 讀回確認：t1 含全部新欄位；t3 的 topics=["A"]、succ=0、mat=[2]、sens=0
curl -s http://localhost:8787/api/responses -H "X-Class-Code: localtest" | python3 -m json.tool
```

Expected: 如各行註解。驗證完 `Ctrl+C` 關掉 dev（本機 KV 是暫存的，不留資料）。

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.js
git commit -m "feat(worker): payload schema 擴充 A–I 代號、部門白名單與備課欄位"
```

---

### Task 2: 前端題目資料、教材類別 I、診斷規則與 payload

**Files:**
- Modify: `index.html`（`CATEGORY_NAMES`／`QUESTIONS`／`TOPIC_MAP`，約 208–281 行；`buildCategoryTags`，約 525–547 行；`buildPayload`，約 559–570 行）

- [ ] **Step 1: `CATEGORY_NAMES` 加入類別 I**

```js
const CATEGORY_NAMES = {
  A:"帳號與初始設定", B:"三種模式選擇", C:"Token 與使用效率", D:"Project 建立與管理",
  E:"報表與數字處理", F:"社群文案與自動化", G:"檔案產出與 Artifacts", H:"跨部門協作",
  I:"分享與資訊安全"
};
```

- [ ] **Step 2: 整段替換 `QUESTIONS` 陣列（18 題）**

```js
const QUESTIONS = [
  {id:"q1", section:"第一部分・使用現況", type:"single",
   title:"Q1. 你目前使用 Claude 的頻率？",
   options:["每天多次","每天一次","每週幾次","很少用","還沒用過"], other:true},
  {id:"q2", section:"第一部分・使用現況", type:"multi",
   title:"Q2. 你用過哪些模式？", hint:"可複選",
   options:["Chat 網頁版","手機 App","Cowork","Code","不確定自己用的是哪種"], other:true},
  {id:"q3", section:"第一部分・使用現況", type:"multi",
   title:"Q3. 你的工作固定要產出哪些東西？", hint:"可複選，不限是否用 Claude 做",
   options:["會議記錄","SOP 或流程文件","報表或 Excel","簡報","社群文案","郵件或提案","互動式工具或圖表"], other:true},
  {id:"q4", section:"第一部分・使用現況", type:"multi",
   title:"Q4. 上面這些產出，哪些已經在用 Claude 做？", hint:"可複選",
   options:["會議記錄","SOP 或流程文件","報表或 Excel","簡報","社群文案","郵件或提案","互動式工具或圖表","都還沒用 Claude 做"],
   exclusive:"都還沒用 Claude 做"},
  {id:"q5", section:"第二部分・使用習慣", type:"single",
   title:"Q5. 你通常怎麼開對話？",
   options:["一個對話從頭用到尾，什麼事都在裡面問","不同任務會開新對話","看心情，沒特別注意"], other:true},
  {id:"q6", section:"第二部分・使用習慣", type:"single",
   title:"Q6. 有固定背景（品牌調性、部門資訊）需要 Claude 知道時，你會怎麼做？",
   options:["每次對話開頭重新貼一次","已經設定在 Project Instructions","不知道可以預先設定","我的工作沒有這種需求"], other:true},
  {id:"q7", section:"第二部分・使用習慣", type:"single",
   title:"Q7. 需要 Claude 處理檔案裡的某個數字或段落時，你會？",
   options:["整份檔案直接上傳","只貼需要的那一段或那幾列","先截圖再上傳","沒遇過這種情況"], other:true},
  {id:"q8", section:"第二部分・使用習慣", type:"multi",
   title:"Q8. 你給 Claude 的檔案通常是什麼格式？", hint:"可複選",
   options:["Excel 或 CSV","電子版 PDF","掃描檔或紙本拍照","手機截圖","不會上傳檔案"], other:true},
  {id:"q9", section:"第二部分・使用習慣", type:"single",
   title:"Q9. Claude 產出不符合預期時，你通常？",
   options:["來回叫它改好幾次直到滿意","重新下一次更完整的指令","放棄，自己改","直接拿去用，沒特別發現問題"], other:true},
  {id:"q10", section:"第二部分・使用習慣", type:"multi",
   title:"Q10. 你是否遇過以下狀況？", hint:"可複選",
   options:["數字加總或計算結果出錯","用到一半被告知額度用完、要等冷卻","產出的格式每次都不一樣","讀取掃描檔或圖片時認錯字","都沒遇過"], other:true},
  {id:"q11", section:"第三部分・分享與資安", type:"multi",
   title:"Q11. 你曾經把哪些內容貼給 Claude？", hint:"可複選，據實填寫即可，這題用來安排資安單元的深度，沒有對錯。",
   options:["客人個資或訂位資料","內部成本或財務數字","未公開的活動或企劃內容","只有對外公開的資訊","不確定哪些可以貼","沒貼過任何內部內容"]},
  {id:"q12", section:"第三部分・分享與資安", type:"single",
   title:"Q12. Claude 產出的成果，你通常怎麼給同事或主管？",
   options:["傳 Artifacts 分享連結","下載成檔案用 email 或群組傳","截圖貼群組","請對方直接看我的畫面操作","沒分享過"], other:true},
  {id:"q13", section:"第三部分・分享與資安", type:"single",
   title:"Q13. 你分得清楚「分享連結」和「離線 HTML 檔」的差別嗎？",
   options:["分得清楚，兩種都用過","聽過但不確定差別在哪","第一次聽到這兩個詞"], other:true},
  {id:"q14", section:"第四部分・需求與期待", type:"multi", max:3,
   title:"Q14. 以下主題，選出你最想加強的", hint:"最多選三個",
   options:[
     "帳號與基本設定還不熟，想從頭學",
     "搞懂 Chat、Cowork、Code 什麼時候用哪個",
     "用得省：不要動不動就額度用完",
     "固定任務設定一次就好，不用每次重新解釋",
     "報表與數字處理：給對檔案、數字不出錯",
     "社群文案半自動化：一次產出整週的量",
     "產出完整檔案：簡報、Word、Excel、互動圖表",
     "跨部門協作時怎麼共用設定與成果",
     "搞懂分享連結與檔案的安全差別，避免內部資料外流"
   ]},
  {id:"q15", section:"第五部分・課堂實作", type:"multitext",
   title:"Q15. 課堂實作題：描述一個你想在課堂上完成的真實任務",
   hint:"工作坊會直接用你的任務帶你做完，寫得越具體，課堂收穫越大。",
   fields:[
     {key:"task", label:"這個任務是什麼", ph:"例：每週一要發四間館的 IG 文案，共 8 則", required:true},
     {key:"now",  label:"現在怎麼做、多久做一次", ph:"例：每次自己想文案，大約花兩小時"}
   ]},
  {id:"q16", section:"第五部分・課堂實作", type:"single",
   title:"Q16. 這個案例完成到什麼程度算成功？",
   options:["產出可用的初稿","建好之後可以重複用的模板","明顯縮短整理時間","數字不再出錯","產出可以直接分享的檔案"], other:true},
  {id:"q17", section:"第五部分・課堂實作", type:"multi",
   title:"Q17. 這個案例你現場能帶什麼素材？",
   hint:"可複選。「去識別」＝把資料裡認得出特定客人或公司機密的內容拿掉或改掉：客人姓名改成「王◯◯」或「客人 A」、電話和 email 刪除、真實營收改成比例相同的假數字。判斷方法：這份檔案如果外流，會不會認出某位客人、或洩漏內部數字？會，就要先處理。",
   options:["去識別後的 Excel／CSV","去識別後的文件（Word、PDF）","圖片或截圖","只有文字描述就夠","還沒準備好"]},
  {id:"q18", section:"第五部分・課堂實作", type:"single",
   title:"Q18. 這個案例的資料有沒有使用限制？",
   options:["我可以自己先把資料去識別再帶來","真實資料完全不能用，請幫我準備虛構範例","不確定怎麼判斷，想請講師協助改寫"]}
];
```

- [ ] **Step 3: `TOPIC_MAP` 加入第 9 項，並新增四個代號表**

`TOPIC_MAP` 物件最後加一行：

```js
  "搞懂分享連結與檔案的安全差別，避免內部資料外流":"I"
```

`TOPIC_MAP` 宣告之後新增（給 `buildPayload` 與結果頁共用；`*_LABELS` 索引 0 保留為未填）：

```js
/* Q16/Q17/Q18/Q13 選項文字 → 匿名統計代號（與 worker validate() 的範圍一致） */
const SUCC_CODES = {"產出可用的初稿":1,"建好之後可以重複用的模板":2,"明顯縮短整理時間":3,"數字不再出錯":4,"產出可以直接分享的檔案":5};
const MAT_CODES  = {"去識別後的 Excel／CSV":1,"去識別後的文件（Word、PDF）":2,"圖片或截圖":3,"只有文字描述就夠":4,"還沒準備好":5};
const LIMIT_CODES= {"我可以自己先把資料去識別再帶來":1,"真實資料完全不能用，請幫我準備虛構範例":2,"不確定怎麼判斷，想請講師協助改寫":3};
const LIT_CODES  = {"分得清楚，兩種都用過":1,"聽過但不確定差別在哪":2,"第一次聽到這兩個詞":3};
const SUCC_LABELS = ["（未填）","產出可用的初稿","可重複用的模板","縮短整理時間","數字不再出錯","可直接分享的檔案"];
const MAT_LABELS  = ["","去識別 Excel／CSV","去識別文件","圖片或截圖","只有文字描述","還沒準備好"];
const LIMIT_LABELS= ["","自備去識別資料","需要虛構範例","需要講師協助"];
const LIT_LABELS  = ["","分得清楚","聽過但不確定","第一次聽到"];
/* Q11 中視為「敏感暴露」的選項 */
const SENS_OPTIONS = ["客人個資或訂位資料","內部成本或財務數字","不確定哪些可以貼"];
```

- [ ] **Step 4: 整段替換 `buildCategoryTags()`**

```js
/* --- 教材分類自動標籤（規則表見 docs/specs/2026-06-11-survey-question-revision-design.md） --- */
function buildCategoryTags(){
  const diag = new Set();
  const a = answers;
  if(a.q1 === "還沒用過") diag.add("A");
  if(a.q2.includes("不確定自己用的是哪種")) diag.add("B");
  if(a.q5 === "一個對話從頭用到尾，什麼事都在裡面問") diag.add("C");
  if(a.q10.includes("用到一半被告知額度用完、要等冷卻")) diag.add("C");
  if(a.q6 === "每次對話開頭重新貼一次" || a.q6 === "不知道可以預先設定") diag.add("C").add("D");
  if(a.q15.task) diag.add("D");                                  // 有固定實作任務，需要 Project
  if(a.q16 === "建好之後可以重複用的模板") diag.add("D");
  if(a.q7 === "整份檔案直接上傳") diag.add("E");
  if(a.q8.includes("掃描檔或紙本拍照") || a.q8.includes("手機截圖")) diag.add("E");
  if(a.q10.includes("數字加總或計算結果出錯") || a.q10.includes("讀取掃描檔或圖片時認錯字")) diag.add("E");
  if(a.q3.includes("報表或 Excel")) diag.add("E");
  if(a.q16 === "數字不再出錯") diag.add("E");
  if(a.q3.includes("社群文案")) diag.add("F");
  if(a.q16 === "產出可用的初稿") diag.add("F");
  if(a.q3.includes("簡報") || a.q3.includes("互動式工具或圖表")) diag.add("G");
  if(a.q13 === "第一次聽到這兩個詞") diag.add("G");
  if(a.q16 === "產出可以直接分享的檔案") diag.add("G");
  if(SENS_OPTIONS.some(o => a.q11.includes(o))) diag.add("I");
  if(a.q12 === "傳 Artifacts 分享連結") diag.add("I");
  if(a.q13 === "聽過但不確定差別在哪" || a.q13 === "第一次聽到這兩個詞") diag.add("I");
  const chosen = a.q14.map(o => TOPIC_MAP[o]).filter(Boolean);
  const fmt = arr => arr.length ? arr.map(c => c + " " + CATEGORY_NAMES[c]).join("、") : "（無）";
  const diagArr = [...diag].sort();
  return { diag: fmt(diagArr), chosen: fmt(chosen), diagRaw: diagArr, chosenRaw: chosen };
}
```

- [ ] **Step 5: 整段替換 `buildPayload()`**

```js
/* 組出匿名化回覆：只含部門、主題、診斷、任務摘要與備課代號，不含姓名與完整作答 */
function buildPayload(){
  const tags = buildCategoryTags();
  return {
    uid: uidFrom(answers.name, answers.dept),
    dept: answers.dept,
    topics: tags.chosenRaw,
    diag: tags.diagRaw,
    task: (answers.q15.task || "").slice(0, 120),
    succ: SUCC_CODES[answers.q16] || 0,
    mat: answers.q17.map(o => MAT_CODES[o]).filter(Boolean),
    limit: LIMIT_CODES[answers.q18] || 0,
    sens: SENS_OPTIONS.some(o => answers.q11.includes(o)) ? 1 : 0,
    lit: LIT_CODES[answers.q13] || 0,
    ts: Date.now()
  };
}
```

- [ ] **Step 6: 語法驗證**

```bash
python3 - <<'EOF'
import re
html = open("index.html", encoding="utf-8").read()
open("/tmp/survey.js", "w", encoding="utf-8").write(re.search(r"<script>(.*)</script>", html, re.S).group(1))
EOF
node --check /tmp/survey.js && echo OK
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: 題目改版為 18 題，新增分享與資安章節、類別 I 與備課代號"
```

---

### Task 3: 基本資料部門改固定單選

**Files:**
- Modify: `index.html`（`renderIntro()`，約 369–401 行）

- [ ] **Step 1: 整段替換 `renderIntro()`**

部門由文字輸入改為三鈕單選（沿用 `.options`/`.opt` 樣式），hint 改為約 7 分鐘：

```js
/* --- 基本資料頁 --- */
const DEPTS = ["行銷處","數位處","其他"];

function renderIntro(){
  $screen.innerHTML = `
    <h1>開始之前，先認識你一下</h1>
    <p class="hint">共 ${TOTAL} 題，約 7 分鐘。你的回答會用來安排課程內容和你的個人實作案例，沒有對錯，請依實際情況填寫。</p>
    <div class="field">
      <label for="fName">姓名</label>
      <input type="text" id="fName" value="${esc(answers.name)}" autocomplete="name">
    </div>
    <div class="field">
      <label>所屬部門</label>
      <div class="options" id="deptOpts" style="margin-bottom:0">
        ${DEPTS.map(d=>`<button type="button" class="opt ${answers.dept===d?"selected":""}" data-val="${esc(d)}">${d}</button>`).join("")}
      </div>
    </div>
    <div class="field">
      <label for="fJob">主要工作內容（一句話即可）</label>
      <input type="text" id="fJob" value="${esc(answers.job)}" placeholder="例：負責兩間館的社群與活動文案">
    </div>
    <p class="error" id="err">請填寫姓名並選擇所屬部門。</p>
    <div class="nav">
      <span></span>
      <button class="btn btn-primary" id="nextBtn">開始作答</button>
    </div>`;
  document.querySelectorAll("#deptOpts .opt").forEach(b=>{
    b.addEventListener("click", ()=>{
      answers.dept = b.dataset.val;
      document.querySelectorAll("#deptOpts .opt").forEach(x=>x.classList.remove("selected"));
      b.classList.add("selected");
      document.getElementById("err").style.display = "none";
    });
  });
  document.getElementById("nextBtn").addEventListener("click", ()=>{
    answers.name = document.getElementById("fName").value.trim();
    answers.job  = document.getElementById("fJob").value.trim();
    if(!answers.name || !answers.dept){
      document.getElementById("err").style.display = "block"; return;
    }
    step = 1; render();
  });
}
```

- [ ] **Step 2: 語法驗證**

```bash
python3 - <<'EOF2'
import re
html = open("index.html", encoding="utf-8").read()
open("/tmp/survey.js", "w", encoding="utf-8").write(re.search(r"<script>(.*)</script>", html, re.S).group(1))
EOF2
node --check /tmp/survey.js && echo OK
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: 基本資料部門改為行銷處／數位處／其他固定單選"
```

---

### Task 4: Q4「都還沒用 Claude 做」互斥選項

**Files:**
- Modify: `index.html`（`renderQuestion()` 的 multi 點擊處理，約 476–496 行）

- [ ] **Step 1: 在 multi 點擊處理中加入互斥邏輯**

`else if(q.type === "multi")` 分支內，`b.classList.toggle("selected");` 之後、`if(v === OTHER ...)` 之前插入：

```js
        /* 互斥選項（如 Q4「都還沒用 Claude 做」）：選它清空其餘，選其餘取消它 */
        if(q.exclusive && arr.includes(v)){
          if(v === q.exclusive){
            arr.length = 0; arr.push(q.exclusive);
          } else {
            const ex = arr.indexOf(q.exclusive);
            if(ex >= 0) arr.splice(ex, 1);
          }
          document.querySelectorAll("#opts .opt").forEach(x =>
            x.classList.toggle("selected", arr.includes(x.dataset.val)));
        }
```

- [ ] **Step 2: 語法驗證**

```bash
python3 - <<'EOF2'
import re
html = open("index.html", encoding="utf-8").read()
open("/tmp/survey.js", "w", encoding="utf-8").write(re.search(r"<script>(.*)</script>", html, re.S).group(1))
EOF2
node --check /tmp/survey.js && echo OK
```

Expected: `OK`

- [ ] **Step 3: 離線煙霧測試**

直接用瀏覽器開啟本機 `index.html`（`file:` 協議會跳過通行碼門禁），走完 18 題確認：Q4 互斥行為、Q14 最多三個、Q15 兩欄、Q16–Q18 出現、完成頁摘要 18 題齊全且「離線檔不顯示統計」文案如舊。

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 複選題支援互斥選項，Q4 都還沒用 Claude 做"
```

---

### Task 5: 結果頁六區塊統計改版

**Files:**
- Modify: `index.html`（CSS `.stats` 區段，約 164–176 行；`loadShared()`，約 588–617 行；`BAR_SHADES`＋`renderStats()`，約 620–641 行）

- [ ] **Step 1: CSS 新增結果頁元件樣式**

`.task-list .dept-tag{...}` 規則之後插入（全部 16px、單一 `--ink`、僅用既有色票變數）：

```css
  /* ===== 結果頁:自選/診斷雙列長條、部門欄、圖例 ===== */
  .legend{font-size:16px;margin-bottom:12px}
  .dot{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}
  .duo-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:16px}
  .duo-row .bar-label{flex:0 0 11em}
  .duo-tracks{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
  .duo-tracks .bar-track{height:10px}
  .duo-nums{flex:0 0 4em;text-align:right;font-weight:600;font-size:16px}
  .dept-cols{display:flex;gap:18px}
  .dept-col{flex:1;min-width:0}
  .dept-col h4{font-size:16px;font-weight:700;margin-bottom:6px}
  .dept-col ol{padding-left:1.3em}
  .dept-col li{font-size:16px;margin-bottom:6px}
  .mini-num{display:block;font-size:16px}
  .stats h3{margin-top:24px}
  @media (max-width:560px){
    .dept-cols{flex-direction:column;gap:10px}
    .duo-row .bar-label{flex-basis:8em}
  }
```

並把既有 `@media (max-width:480px){.bar-label{flex-basis:8em}}` 保留不動。

- [ ] **Step 2: 整段替換 `loadShared()` 的彙整部分**

`if(list.length <= 1){...return;}` 之後到 `renderStats(...)` 為止替換為：

```js
    console.log("[survey] shared stats loaded", {count:list.length});
    renderStats($box, aggregate(list));
```

並在 `loadShared` 函式之後新增 `aggregate`（缺新欄位的舊回覆視為未知，不計入該分布、不中斷）：

```js
/* 彙整全部匿名回覆;對缺欄位的舊 schema 回覆容錯 */
function aggregate(list){
  const g = {
    n: list.length, deptCount: {}, topicSel: {}, topicDiag: {}, deptTopic: {},
    litCount: [0,0,0,0], sensCount: 0,
    matCount: [0,0,0,0,0,0], limitCount: [0,0,0,0], succCount: [0,0,0,0,0,0],
    tasksByDept: {}
  };
  list.forEach(d => {
    const dept = d.dept || "其他";
    g.deptCount[dept] = (g.deptCount[dept]||0) + 1;
    g.deptTopic[dept] = g.deptTopic[dept] || {};
    const bump = (c, key) => {
      g[key][c] = (g[key][c]||0) + 1;
      const t = g.deptTopic[dept][c] = g.deptTopic[dept][c] || {sel:0, diag:0};
      t[key === "topicSel" ? "sel" : "diag"]++;
    };
    (Array.isArray(d.topics) ? d.topics : []).forEach(c => bump(c, "topicSel"));
    (Array.isArray(d.diag)   ? d.diag   : []).forEach(c => bump(c, "topicDiag"));
    if(d.lit >= 1 && d.lit <= 3) g.litCount[d.lit]++;
    if(d.sens === 1) g.sensCount++;
    (Array.isArray(d.mat) ? d.mat : []).forEach(m => { if(m >= 1 && m <= 5) g.matCount[m]++; });
    if(d.limit >= 1 && d.limit <= 3) g.limitCount[d.limit]++;
    if(d.succ >= 1 && d.succ <= 5) g.succCount[d.succ]++;
    if(d.task){ (g.tasksByDept[dept] = g.tasksByDept[dept]||[]).push({task:d.task, ts:d.ts||0}); }
  });
  return g;
}
```

- [ ] **Step 3: 整段替換 `BAR_SHADES` 與 `renderStats()`**

刪除 `const BAR_SHADES = [...]` 行，`renderStats` 改為：

```js
/* 繪製統計畫面:完成人數→自選/診斷雙列→部門 Top3→資安準備度→備課資訊→任務分組 */
function barRow(label, v, maxV, color){
  return `<div class="bar-row">
    <span class="bar-label">${esc(label)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${Math.round(v / maxV * 100)}%;background:${color}"></span></span>
    <span class="bar-num">${v}</span>
  </div>`;
}

function renderStats($box, g){
  const deptLine = Object.entries(g.deptCount).map(([d, v]) => d + " " + v + " 位").join("、");
  /* 各主題需求度:自選與診斷分列,不加總 */
  const codes = Object.keys(CATEGORY_NAMES)
    .filter(c => (g.topicSel[c]||0) + (g.topicDiag[c]||0) > 0)
    .sort((a,b) => ((g.topicSel[b]||0)+(g.topicDiag[b]||0)) - ((g.topicSel[a]||0)+(g.topicDiag[a]||0)));
  const maxTopic = Math.max(1, ...codes.map(c => Math.max(g.topicSel[c]||0, g.topicDiag[c]||0)));
  const duoRows = codes.map(c => `
    <div class="duo-row">
      <span class="bar-label">${c} ${CATEGORY_NAMES[c]}</span>
      <span class="duo-tracks">
        <span class="bar-track"><span class="bar-fill" style="width:${Math.round((g.topicSel[c]||0)/maxTopic*100)}%;background:var(--bar-1)"></span></span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.round((g.topicDiag[c]||0)/maxTopic*100)}%;background:var(--bar-2)"></span></span>
      </span>
      <span class="duo-nums">${g.topicSel[c]||0}／${g.topicDiag[c]||0}</span>
    </div>`).join("");
  /* 各部門 Top3:自選+診斷合計排序,顯示時仍分列 */
  const deptCols = Object.entries(g.deptTopic).map(([dept, m]) => {
    const top = Object.entries(m).sort((a,b) => (b[1].sel+b[1].diag) - (a[1].sel+a[1].diag)).slice(0,3);
    if(!top.length) return "";
    return `<div class="dept-col"><h4>${esc(dept)}（${g.deptCount[dept]||0} 位）</h4>
      <ol>${top.map(([c,v]) => `<li>${c} ${CATEGORY_NAMES[c]}<span class="mini-num">自選 ${v.sel}／診斷 ${v.diag}</span></li>`).join("")}</ol></div>`;
  }).join("");
  /* 資安準備度 */
  const maxLit = Math.max(1, ...g.litCount);
  const litRows = [1,2,3].map(i => barRow(LIT_LABELS[i], g.litCount[i], maxLit, "var(--bar-3)")).join("");
  /* 講師備課資訊 */
  const maxMat = Math.max(1, ...g.matCount);
  const matRows = [1,2,3,4,5].map(i => barRow(MAT_LABELS[i], g.matCount[i], maxMat, "var(--bar-1)")).join("");
  const maxLimit = Math.max(1, ...g.limitCount);
  const limitRows = [1,2,3].map(i => barRow(LIMIT_LABELS[i], g.limitCount[i], maxLimit, "var(--bar-2)")).join("");
  const maxSucc = Math.max(1, ...g.succCount);
  const succRows = [1,2,3,4,5].map(i => barRow(SUCC_LABELS[i], g.succCount[i], maxSucc, "var(--bar-3)")).join("");
  /* 實作任務依部門分組,每部門最新 5 筆 */
  const taskGroups = Object.entries(g.tasksByDept).map(([dept, arr]) =>
    `<ul class="task-list">${arr.sort((a,b) => b.ts - a.ts).slice(0,5)
      .map(t => `<li><span class="dept-tag">${esc(dept)}</span>${esc(t.task)}</li>`).join("")}</ul>`).join("");
  $box.innerHTML = `
    <h2>大家提出的方向</h2>
    <p class="hint">已有 ${g.n} 位同仁完成（${deptLine}）。統計為匿名彙整，不顯示姓名，僅列人數。</p>
    <h3>各主題需求度</h3>
    <p class="legend"><span class="dot" style="background:var(--bar-1)"></span>學員自選　<span class="dot" style="background:var(--bar-2)"></span>系統診斷</p>
    ${duoRows}
    ${deptCols ? `<h3>各部門最需要的主題</h3><div class="dept-cols">${deptCols}</div>` : ""}
    <h3>資安準備度</h3>
    <p class="hint">「分享連結 vs 離線檔案」認知分布；貼過敏感資料或不確定界線：${g.sensCount} 位。</p>
    ${litRows}
    <h3>講師備課資訊</h3>
    <p class="hint">現場素材</p>${matRows}
    <p class="hint" style="margin-top:12px">資料限制</p>${limitRows}
    <p class="hint" style="margin-top:12px">成功標準</p>${succRows}
    ${taskGroups ? `<h3>大家帶來的實作任務</h3>
    <p class="hint">依部門分組，每部門最多顯示最新 5 筆，看看別人打算怎麼用。</p>${taskGroups}` : ""}`;
}
```

- [ ] **Step 4: 語法驗證**

```bash
python3 - <<'EOF2'
import re
html = open("index.html", encoding="utf-8").read()
open("/tmp/survey.js", "w", encoding="utf-8").write(re.search(r"<script>(.*)</script>", html, re.S).group(1))
EOF2
node --check /tmp/survey.js && echo OK
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 結果頁改為六區塊通盤分析（自選/診斷分列、部門維度、資安準備度、備課資訊）"
```

---

### Task 6: 部署 Worker 並驗證正式環境

前端尚未 push，正式問卷此時仍是舊版；新 Worker 向下相容舊 payload，先部署無風險。

- [ ] **Step 1: 部署**

```bash
cd worker && npx wrangler deploy
```

Expected: `Deployed workshop-survey-api`。

- [ ] **Step 2: curl 驗證正式端點**

通行碼向使用者取得後放進環境變數（不落檔、不進 repo）：

```bash
read -s CODE   # 貼上課程通行碼
curl -s -X POST https://workshop-survey-api.ciracloser.workers.dev/api/response \
  -H "Content-Type: application/json" -H "X-Class-Code: $CODE" \
  -d '{"uid":"zztest1","dept":"數位處","topics":["I"],"diag":["C","I"],"task":"部署驗證用","succ":1,"mat":[5],"limit":2,"sens":1,"lit":3,"ts":1}'
# 期望 {"ok":true}
curl -s https://workshop-survey-api.ciracloser.workers.dev/api/responses \
  -H "X-Class-Code: $CODE" | python3 -m json.tool | grep -A2 zztest1
# 期望看到 succ/mat/limit/sens/lit 完整保留
```

- [ ] **Step 3: Commit（如有 wrangler 設定異動才需要；無異動則略過）**

---

### Task 7: 清空 KV 既有測試回覆

改版前的舊 schema 資料與 Task 6 的驗證資料都要清掉，避免混入課程統計。

- [ ] **Step 1: 列出並確認要刪的 key**

```bash
cd worker
npx wrangler kv key list --binding RESPONSES --remote --prefix resp: \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s).map(k=>k.name);console.log(a.join("\n"));require("fs").writeFileSync("/tmp/respkeys.json",JSON.stringify(a))})'
```

Expected: 印出全部 `resp:` 開頭的 key，同時寫入 `/tmp/respkeys.json`。**人工確認清單只含測試資料**（此刻問卷尚未對學員公布，理應全是測試）。

- [ ] **Step 2: 批次刪除**

```bash
npx wrangler kv bulk delete --binding RESPONSES --remote /tmp/respkeys.json --force
npx wrangler kv key list --binding RESPONSES --remote --prefix resp:
```

Expected: 第二個指令回傳 `[]`。

---

### Task 8: 推送前端、線上端對端驗證、文件同步

**Files:**
- Modify: `CLAUDE.md`（資料與隱私一節）
- Modify: `PROJECT_SPEC.md`（追加一行變更紀錄）
- Modify: `AGENTS.md`（若其中也描述 KV 欄位清單，同步改寫）

- [ ] **Step 1: 更新 CLAUDE.md 隱私欄位清單**

「後端 KV 只儲存匿名彙整欄位」一條改為：

```markdown
- 後端 KV 只儲存匿名彙整欄位：部門（固定選項）、自選主題代號、診斷標籤代號、實作任務摘要（120 字內）、成功標準／素材／資料限制／資安準備度代號、時間戳。
```

檢查 `AGENTS.md` 是否有同樣的欄位清單描述，有則同步改寫。

- [ ] **Step 2: PROJECT_SPEC.md 追加變更紀錄**（沿用既有「日期 | 標題 | 說明 | secrets」格式）

```
2026-06-11 | 題目改版與結果頁通盤分析 | 題目改為 18 題:Q3/Q4 合併重排、新增第三部分分享與資安(Q11-Q13)與教材類別 I、第五部分課堂實作四題組(Q15-Q18 含去識別說明)、部門改行銷處/數位處/其他固定單選;Worker payload 擴充 succ/mat/limit/sens/lit 並改 dept 白名單與 A-I 代號;結果頁改六區塊(自選/診斷分列、部門 Top3、資安準備度、講師備課資訊、任務依部門分組) | none
```

- [ ] **Step 3: Commit 與 push（push 即觸發 GitHub Pages 部署，執行前向使用者確認）**

```bash
git add CLAUDE.md AGENTS.md PROJECT_SPEC.md
git commit -m "docs: 同步隱私欄位清單與變更紀錄"
git push origin main
```

- [ ] **Step 4: 線上端對端驗證**

開 `https://my-humble-house.github.io/workshop/`（Pages 部署完成後）：

1. 輸入通行碼進站，三個部門各填一份完整問卷，刻意覆蓋邊界選項：Q4 選「都還沒用 Claude 做」再選其他項（確認互斥）、Q11 選「不確定哪些可以貼」、Q14 選滿三個含資安主題、Q17 選「還沒準備好」、Q18 選「需要講師協助」。
2. 完成頁確認：摘要含 18 題與診斷標籤（含 I）；統計六區塊齊全；「各主題需求度」自選與診斷數字分列；三部門欄各自顯示 Top 3；資安準備度與備課資訊數字與填答相符；任務依部門分組。
3. 直接下載 `index.html` 以 `file:` 開啟，確認跳過門禁、無統計、摘要正常。
4. 驗證完，依 Task 7 的指令刪除這三筆驗證用 key（或保留至課前再清，由使用者決定）。

- [ ] **Step 5: 回報結果**

向使用者回報部署完成、驗證截圖／結果，以及「課前最後一步：清掉驗證資料」的提醒。
