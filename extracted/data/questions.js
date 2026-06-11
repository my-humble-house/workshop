/* 課前調查 — 題目資料與模擬統計（原型用假資料） */

const CATEGORY_NAMES = {
  A:"帳號與初始設定", B:"三種模式選擇", C:"Token 與使用效率", D:"Project 建立與管理",
  E:"報表與數字處理", F:"社群文案與自動化", G:"檔案產出與 Artifacts", H:"跨部門協作",
  I:"分享與資訊安全"
};

const PARTS = [
  { id:"p1", num:"一", title:"使用現況",   blurb:"先了解你現在怎麼用 Claude",       qs:["q1","q2","q3","q4"] },
  { id:"p2", num:"二", title:"使用習慣",   blurb:"沒有標準答案，照實選就好",         qs:["q5","q6","q7","q8","q9","q10"] },
  { id:"p3", num:"三", title:"分享與資安", blurb:"這部分用來安排資安單元的深度",     qs:["q11","q12","q13"] },
  { id:"p4", num:"四", title:"需求與期待", blurb:"挑出你最想加強的主題",             qs:["q14"] },
  { id:"p5", num:"五", title:"課堂實作",   blurb:"描述一個課堂上想完成的真實任務",   qs:["task"] }
];

const QUESTIONS = [
  {id:"q1", part:"p1", type:"single",
   title:"你目前使用 Claude 的頻率？",
   options:["每天多次","每天一次","每週幾次","很少用","還沒用過"], other:true},
  {id:"q2", part:"p1", type:"multi",
   title:"你用過哪些模式？", hint:"可複選",
   options:["Chat 網頁版","手機 App","Cowork","Code","不確定自己用的是哪種"], other:true},
  {id:"q3", part:"p1", type:"multi",
   title:"你的工作固定要產出哪些東西？", hint:"可複選，不限是否用 Claude 做",
   options:["會議記錄","SOP 或流程文件","報表或 Excel","簡報","社群文案","郵件或提案","互動式工具或圖表"], other:true},
  {id:"q4", part:"p1", type:"multi",
   title:"上面這些產出，哪些已經在用 Claude 做？", hint:"可複選",
   options:["會議記錄","SOP 或流程文件","報表或 Excel","簡報","社群文案","郵件或提案","互動式工具或圖表","都還沒用 Claude 做"],
   exclusive:"都還沒用 Claude 做"},
  {id:"q5", part:"p2", type:"single",
   title:"你通常怎麼開對話？",
   options:["一個對話從頭用到尾，什麼事都在裡面問","不同任務會開新對話","看心情，沒特別注意"], other:true},
  {id:"q6", part:"p2", type:"single",
   title:"有固定背景（品牌調性、部門資訊）需要 Claude 知道時，你會怎麼做？",
   options:["每次對話開頭重新貼一次","已經設定在 Project Instructions","不知道可以預先設定","我的工作沒有這種需求"], other:true},
  {id:"q7", part:"p2", type:"single",
   title:"需要 Claude 處理檔案裡的某個數字或段落時，你會？",
   options:["整份檔案直接上傳","只貼需要的那一段或那幾列","先截圖再上傳","沒遇過這種情況"], other:true},
  {id:"q8", part:"p2", type:"multi",
   title:"你給 Claude 的檔案通常是什麼格式？", hint:"可複選",
   options:["Excel 或 CSV","電子版 PDF","掃描檔或紙本拍照","手機截圖","不會上傳檔案"], other:true},
  {id:"q9", part:"p2", type:"single",
   title:"Claude 產出不符合預期時，你通常？",
   options:["來回叫它改好幾次直到滿意","重新下一次更完整的指令","放棄，自己改","直接拿去用，沒特別發現問題"], other:true},
  {id:"q10", part:"p2", type:"multi",
   title:"你是否遇過以下狀況？", hint:"可複選",
   options:["數字加總或計算結果出錯","用到一半被告知額度用完、要等冷卻","產出的格式每次都不一樣","讀取掃描檔或圖片時認錯字","都沒遇過"],
   exclusive:"都沒遇過"},
  {id:"q11", part:"p3", type:"multi",
   title:"你曾經把哪些內容貼給 Claude？", hint:"可複選。這題用來安排資安單元的深度，沒有對錯，據實填寫即可",
   options:["客人個資或訂位資料","內部成本或財務數字","未公開的活動或企劃內容","只有對外公開的資訊","不確定哪些可以貼","沒貼過任何內部內容"]},
  {id:"q12", part:"p3", type:"single",
   title:"Claude 產出的成果，你通常怎麼給同事或主管？",
   options:["傳 Artifacts 分享連結","下載成檔案用 email 或群組傳","截圖貼群組","請對方直接看我的畫面操作","沒分享過"], other:true},
  {id:"q13", part:"p3", type:"single",
   title:"你分得清楚「分享連結」和「離線 HTML 檔」的差別嗎？",
   options:["分得清楚，兩種都用過","聽過但不確定差別在哪","第一次聽到這兩個詞"]},
  {id:"q14", part:"p4", type:"topics", max:3,
   title:"以下主題，選出你最想加強的", hint:"最多選 3 個",
   options:[
     {code:"A", label:"帳號與基本設定還不熟，想從頭學"},
     {code:"B", label:"搞懂 Chat、Cowork、Code 什麼時候用哪個"},
     {code:"C", label:"用得省：不要動不動就額度用完"},
     {code:"D", label:"固定任務設定一次就好，不用每次重新解釋"},
     {code:"E", label:"報表與數字處理：給對檔案、數字不出錯"},
     {code:"F", label:"社群文案半自動化：一次產出整週的量"},
     {code:"G", label:"產出完整檔案：簡報、Word、Excel、互動圖表"},
     {code:"H", label:"跨部門協作時怎麼共用設定與成果"},
     {code:"I", label:"搞懂分享連結與檔案的安全差別，避免內部資料外流"}
   ]}
];

/* 課堂實作：四題合併成一頁（同一個案例的四個面向） */
const TASK_BLOCK = {
  id:"task", part:"p5",
  title:"描述一個你想在課堂上完成的真實任務",
  hint:"工作坊會直接用你的任務帶你做完，寫得越具體，課堂收穫越大",
  fields:[
    {key:"task", label:"這個任務是什麼", ph:"例：每週一要發四間館的 IG 文案，共 8 則", required:true, textarea:true},
    {key:"now",  label:"現在怎麼做、多久做一次", ph:"例：每次自己想文案，大約花兩小時", textarea:true}
  ],
  q16:{key:"succ", label:"這個案例完成到什麼程度算成功？",
    options:["產出可用的初稿","建好之後可以重複用的模板","明顯縮短整理時間","數字不再出錯","產出可以直接分享的檔案"]},
  q17:{key:"mat", label:"現場能帶什麼素材？", multi:true,
    note:"「去識別」＝把認得出特定客人或機密的內容改掉：姓名改成「客人 A」、刪電話與 email、真實營收改成等比例假數字",
    options:["去識別後的 Excel／CSV","去識別後的文件（Word、PDF）","圖片或截圖","只有文字描述就夠","還沒準備好"]},
  q18:{key:"limit", label:"資料有沒有使用限制？",
    options:["我可以自己先把資料去識別再帶來","真實資料完全不能用，請幫我準備虛構範例","不確定怎麼判斷，想請講師協助改寫"]}
};

const DEPTS = ["行銷處","數位處","其他"];
const SENS_OPTIONS = ["客人個資或訂位資料","內部成本或財務數字","不確定哪些可以貼"];

/* 診斷規則：由作答推導建議單元 */
function buildDiagnosis(a){
  const diag = new Set();
  if(a.q1 === "還沒用過") diag.add("A");
  if((a.q2||[]).includes("不確定自己用的是哪種")) diag.add("B");
  if(a.q5 === "一個對話從頭用到尾，什麼事都在裡面問") diag.add("C");
  if((a.q10||[]).includes("用到一半被告知額度用完、要等冷卻")) diag.add("C");
  if(a.q6 === "每次對話開頭重新貼一次" || a.q6 === "不知道可以預先設定"){ diag.add("C"); diag.add("D"); }
  if(a.task && a.task.task) diag.add("D");
  if(a.task && a.task.succ === "建好之後可以重複用的模板") diag.add("D");
  if(a.q7 === "整份檔案直接上傳") diag.add("E");
  if((a.q8||[]).some(o => o==="掃描檔或紙本拍照" || o==="手機截圖")) diag.add("E");
  if((a.q10||[]).some(o => o==="數字加總或計算結果出錯" || o==="讀取掃描檔或圖片時認錯字")) diag.add("E");
  if((a.q3||[]).includes("報表或 Excel")) diag.add("E");
  if(a.task && a.task.succ === "數字不再出錯") diag.add("E");
  if((a.q3||[]).includes("社群文案")) diag.add("F");
  if(a.task && a.task.succ === "產出可用的初稿") diag.add("F");
  if((a.q3||[]).some(o => o==="簡報" || o==="互動式工具或圖表")) diag.add("G");
  if(a.q13 === "第一次聽到這兩個詞") diag.add("G");
  if(a.task && a.task.succ === "產出可以直接分享的檔案") diag.add("G");
  if(SENS_OPTIONS.some(o => (a.q11||[]).includes(o))) diag.add("I");
  if(a.q12 === "傳 Artifacts 分享連結") diag.add("I");
  if(a.q13 === "聽過但不確定差別在哪" || a.q13 === "第一次聽到這兩個詞") diag.add("I");
  return [...diag].sort();
}

/* ===== 模擬統計資料（原型示意，正式版由 Worker API 提供） ===== */
const MOCK_RESPONSES = [
  {dept:"行銷處", topics:["F","G","D"], diag:["C","D","F","I"], task:"每週一要發四間館的 IG 文案，共 8 則", succ:2, mat:[4], limit:1, sens:1, lit:2},
  {dept:"行銷處", topics:["F","E","I"], diag:["E","F","I"],     task:"月底活動成效報表，從各館 Excel 彙整", succ:3, mat:[1], limit:1, sens:1, lit:2},
  {dept:"行銷處", topics:["F","G"],     diag:["C","F","G"],     task:"母親節檔期文案一次出 FB＋IG＋LINE 三版", succ:1, mat:[4], limit:1, sens:0, lit:3},
  {dept:"行銷處", topics:["D","F","H"], diag:["C","D","F"],     task:"品牌調性設定一次，之後文案不用重新解釋", succ:2, mat:[2], limit:1, sens:0, lit:2},
  {dept:"行銷處", topics:["E","G","I"], diag:["E","G","I"],     task:"媒體投放週報自動整理成簡報", succ:5, mat:[1], limit:3, sens:1, lit:1},
  {dept:"數位處", topics:["E","D","C"], diag:["C","D","E"],     task:"訂房資料清整：每天三個系統的報表合併", succ:4, mat:[1], limit:2, sens:1, lit:1},
  {dept:"數位處", topics:["E","G"],     diag:["E","G"],         task:"營收 dashboard 的數據驗證流程", succ:4, mat:[1], limit:1, sens:1, lit:1},
  {dept:"數位處", topics:["H","D","I"], diag:["D","I"],         task:"跨部門共用的 FAQ 知識庫建置", succ:2, mat:[2], limit:1, sens:0, lit:2},
  {dept:"數位處", topics:["C","B"],     diag:["B","C"],         task:"搞懂什麼任務該用 Code、什麼用 Chat", succ:3, mat:[4], limit:1, sens:0, lit:2},
  {dept:"其他",   topics:["A","B","C"], diag:["A","B","C"],     task:"還沒用過，想先建立帳號跟基本流程", succ:1, mat:[5], limit:3, sens:0, lit:3},
  {dept:"其他",   topics:["E","I"],     diag:["E","I"],         task:"每月成本結算表的彙整與檢查", succ:4, mat:[1], limit:2, sens:1, lit:2},
  {dept:"其他",   topics:["G","D"],     diag:["D","G"],         task:"部門 SOP 文件改版成可重複套用的模板", succ:2, mat:[2], limit:1, sens:0, lit:3},
  {dept:"行銷處", topics:["F","I","G"], diag:["F","G","I"],     task:"活動企劃書初稿：從 brief 直接長出大綱", succ:1, mat:[4], limit:1, sens:0, lit:2},
  {dept:"數位處", topics:["E","C","D"], diag:["C","E"],         task:"客服對話紀錄分類與週報摘要", succ:3, mat:[1], limit:2, sens:1, lit:1}
];

const SUCC_LABELS  = ["","產出可用的初稿","可重複用的模板","縮短整理時間","數字不再出錯","可直接分享的檔案"];
const MAT_LABELS   = ["","去識別 Excel／CSV","去識別文件","圖片或截圖","只有文字描述","還沒準備好"];
const LIMIT_LABELS = ["","自備去識別資料","需要虛構範例","需要講師協助"];
const LIT_LABELS   = ["","分得清楚","聽過但不確定差別","第一次聽到"];

/* 彙整 */
function aggregate(list){
  const g = { n:list.length, deptCount:{}, topicSel:{}, topicDiag:{}, deptTopic:{},
    litCount:[0,0,0,0], sensCount:0, matCount:[0,0,0,0,0,0], limitCount:[0,0,0,0],
    succCount:[0,0,0,0,0,0], tasks:[] };
  list.forEach(d => {
    const dept = d.dept || "其他";
    g.deptCount[dept] = (g.deptCount[dept]||0)+1;
    g.deptTopic[dept] = g.deptTopic[dept] || {};
    (d.topics||[]).forEach(c => {
      g.topicSel[c]=(g.topicSel[c]||0)+1;
      const t = g.deptTopic[dept][c] = g.deptTopic[dept][c] || {sel:0,diag:0}; t.sel++;
    });
    (d.diag||[]).forEach(c => {
      g.topicDiag[c]=(g.topicDiag[c]||0)+1;
      const t = g.deptTopic[dept][c] = g.deptTopic[dept][c] || {sel:0,diag:0}; t.diag++;
    });
    if(d.lit>=1 && d.lit<=3) g.litCount[d.lit]++;
    if(d.sens===1) g.sensCount++;
    (d.mat||[]).forEach(m => { if(m>=1&&m<=5) g.matCount[m]++; });
    if(d.limit>=1 && d.limit<=3) g.limitCount[d.limit]++;
    if(d.succ>=1 && d.succ<=5) g.succCount[d.succ]++;
    if(d.task) g.tasks.push({dept, task:d.task});
  });
  return g;
}

/* 示範用預填答案（總覽頁直接跳到後段畫面時使用） */
const DEMO_ANSWERS = {
  name:"林佳穎", dept:"行銷處", job:"負責兩間館的社群與活動文案",
  q1:"每天一次", q2:["Chat 網頁版","手機 App"], q3:["社群文案","簡報","報表或 Excel"],
  q4:["社群文案"], q5:"一個對話從頭用到尾，什麼事都在裡面問", q6:"每次對話開頭重新貼一次",
  q7:"整份檔案直接上傳", q8:["Excel 或 CSV","手機截圖"], q9:"來回叫它改好幾次直到滿意",
  q10:["用到一半被告知額度用完、要等冷卻","產出的格式每次都不一樣"],
  q11:["未公開的活動或企劃內容","不確定哪些可以貼"], q12:"截圖貼群組", q13:"聽過但不確定差別在哪",
  q14:["F","D","I"],
  task:{ task:"每週一要發四間館的 IG 文案，共 8 則", now:"每次自己想文案，大約花兩小時",
         succ:"建好之後可以重複用的模板", mat:["只有文字描述就夠"], limit:"我可以自己先把資料去識別再帶來" }
};

Object.assign(window, { CATEGORY_NAMES, PARTS, QUESTIONS, TASK_BLOCK, DEPTS, SENS_OPTIONS,
  buildDiagnosis, MOCK_RESPONSES, SUCC_LABELS, MAT_LABELS, LIMIT_LABELS, LIT_LABELS,
  aggregate, DEMO_ANSWERS });
