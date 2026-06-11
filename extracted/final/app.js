/* ============================================================
   課前調查 app.js（vanilla，無框架）
   - 線上：Cloudflare Worker 驗證通行碼 + 匿名統計（與舊版 API 相容）
   - ?demo=1 或 file: 開啟：跳過驗證、統計用 MOCK_RESPONSES 模擬
   ============================================================ */

const API_BASE = "https://workshop-survey-api.ciracloser.workers.dev";
const DEMO = new URLSearchParams(location.search).has("demo") || location.protocol === "file:";
const AUTO_ADVANCE = true;          // 單選後自動前進
const OTHER = "其他";

/* 選項文字 → 統計代號（與 data.js 的 *_LABELS 對齊） */
const SUCC_CODE  = Object.fromEntries(TASK_BLOCK.q16.options.map((o,i) => [o, i+1]));
const MAT_CODE   = Object.fromEntries(TASK_BLOCK.q17.options.map((o,i) => [o, i+1]));
const LIMIT_CODE = Object.fromEntries(TASK_BLOCK.q18.options.map((o,i) => [o, i+1]));
const LIT_CODE   = Object.fromEntries(QUESTIONS.find(q => q.id === "q13").options.map((o,i) => [o, i+1]));

/* ===== 步驟表 ===== */
const STEPS = (() => {
  const s = [{kind:"welcome"}, {kind:"profile"}];
  PARTS.forEach(p => {
    p.qs.forEach(qid => s.push(qid === "task"
      ? {kind:"task", part:p}
      : {kind:"question", part:p, q:QUESTIONS.find(q => q.id === qid)}));
  });
  s.push({kind:"done"});
  return s;
})();
const Q_TOTAL = STEPS.filter(s => s.kind === "question" || s.kind === "task").length;
function qNumberAt(i){
  let n = 0;
  for(let k = 0; k <= i; k++) if(STEPS[k].kind === "question" || STEPS[k].kind === "task") n++;
  return n;
}

/* ===== 狀態 ===== */
let stepIdx = 0, dirn = 1, sectionTimer = null;
const answers = (() => {
  const a = { name:"", dept:"", job:"" };
  QUESTIONS.forEach(q => { a[q.id] = (q.type === "multi" || q.type === "topics") ? [] : ""; });
  a.task = { task:"", now:"", succ:"", mat:[], limit:"" };
  return a;
})();
const otherTexts = {};
let classCode = "";
try{ classCode = sessionStorage.getItem("classCode") || ""; }catch(e){}
let gateOk = DEMO;

const $app = document.getElementById("app");
const $screen = document.getElementById("screen");

function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ===== 導覽 ===== */
function go(i, d){
  clearTimeout(sectionTimer);
  dirn = d; stepIdx = Math.max(0, Math.min(i, STEPS.length - 1));
  render();
}
function next(){ go(stepIdx + 1, 1); }
function back(){
  let i = stepIdx - 1;
  while(i > 0 && STEPS[i].kind === "section") i--;   // 回上一步略過過場頁
  go(i, -1);
}

/* ===== 渲染 ===== */
function render(){
  const step = STEPS[stepIdx];
  $app.dataset.kind = step.kind;
  renderSidebar(step);
  const wrap = document.createElement("div");
  wrap.className = "sv-step " + (dirn >= 0 ? "from-right" : "from-left");
  wrap.innerHTML = ({
    welcome: htmlWelcome, profile: htmlProfile, section: htmlSection,
    question: htmlQuestion, task: htmlTask, done: htmlDone
  })[step.kind](step);
  $screen.replaceChildren(wrap);
  ({ welcome: bindWelcome, profile: bindProfile, section: bindSection,
     question: bindQuestion, task: bindTask, done: bindDone })[step.kind](step);
  window.scrollTo(0, 0);
}

function renderSidebar(step){
  const partIdx = step.part ? PARTS.findIndex(p => p.id === step.part.id)
                : (step.kind === "done" ? PARTS.length : -1);
  document.getElementById("checklist").innerHTML = PARTS.map((p, i) => {
    const status = step.kind === "done" ? "done" : (i < partIdx ? "done" : i === partIdx ? "current" : "todo");
    const count = p.qs.length === 1 && p.qs[0] === "task" ? "1 頁" : p.qs.length + " 題";
    return '<li class="' + status + '"><span class="cl-mark"></span>' +
      '<span class="cl-title">' + p.title + '</span><span class="cl-count">' + count + '</span></li>';
  }).join("");
  const qn = qNumberAt(stepIdx);
  const $count = document.getElementById("sideCount");
  if(step.kind === "welcome" || step.kind === "profile") $count.innerHTML = Q_TOTAL + " 題・約 7 分鐘";
  else if(step.kind === "done") $count.innerHTML = "已完成，感謝填寫";
  else $count.innerHTML = "<strong>" + String(qn).padStart(2,"0") + "</strong>／" + Q_TOTAL + " 題";
  document.getElementById("sideBarFill").style.width =
    (step.kind === "done" ? 100 : Math.round(qn / Q_TOTAL * 100)) + "%";
}

/* ===== 共用片段 ===== */
function htmlOptions(q){
  const v = answers[q.id];
  const isMulti = q.type === "multi";
  const opts = q.other ? q.options.concat(OTHER) : q.options;
  const showOther = q.other && (isMulti ? v.includes(OTHER) : v === OTHER);
  return '<div class="sv-options" id="opts">' +
    opts.map(o => {
      const sel = isMulti ? v.includes(o) : v === o;
      return '<button type="button" class="sv-opt' + (sel ? " selected" : "") + '" data-val="' + esc(o) + '" aria-pressed="' + sel + '">' +
        '<span class="sv-mark ' + (isMulti ? "check" : "radio") + (sel ? " on" : "") + '"></span>' +
        '<span class="sv-opt-text">' + esc(o) + '</span></button>';
    }).join("") +
    '<div class="sv-other" id="otherWrap" style="' + (showOther ? "" : "display:none") + '">' +
      '<input type="text" id="otherInput" placeholder="請補充說明" value="' + esc(otherTexts[q.id] || "") + '"></div>' +
  '</div>';
}

function htmlChips(id, options, value, multi){
  return '<div class="sv-chips" data-chips="' + id + '">' +
    options.map(o => {
      const sel = multi ? value.includes(o) : value === o;
      return '<button type="button" class="sv-chip' + (sel ? " selected" : "") + '" data-val="' + esc(o) + '" aria-pressed="' + sel + '">' + esc(o) + '</button>';
    }).join("") + '</div>';
}

function htmlError(){ return '<p class="sv-error" id="err" style="display:none"></p>'; }
function showErr(msg){
  const $e = document.getElementById("err");
  if(!$e) return;
  $e.textContent = msg; $e.style.display = "block";
}
function hideErr(){
  const $e = document.getElementById("err");
  if($e) $e.style.display = "none";
}

/* ===== 歡迎頁（通行碼合併） ===== */
function htmlWelcome(){
  return '<div class="sv-welcome">' +
    '<p class="sv-kicker">CLAUDE 工作坊</p>' +
    '<h1 class="sv-display">課前調查</h1>' +
    '<p class="sv-lede">' + Q_TOTAL + ' 題，約 7 分鐘。你的回答會直接決定課程怎麼安排、實作帶你做什麼——沒有對錯，照實填就好。</p>' +
    '<div class="sv-gate">' +
      (gateOk
        ? '<div class="sv-nav"><span></span><button class="sv-btn primary" id="startBtn">開始填寫</button></div>' +
          (DEMO ? '<p class="sv-demo-note">示範模式：統計為模擬資料</p>' : "")
        : '<label class="sv-label" for="gCode">課程通行碼<span class="sv-label-note">寫在課程公告裡</span></label>' +
          '<div class="sv-gate-row">' +
            '<input type="text" id="gCode" autocomplete="off" value="' + esc(classCode) + '">' +
            '<button class="sv-btn primary" id="startBtn">開始填寫</button>' +
          '</div><p class="sv-error" id="err" style="display:none"></p>') +
    '</div></div>';
}
function bindWelcome(){
  const $btn = document.getElementById("startBtn");
  const $input = document.getElementById("gCode");
  async function start(){
    if(gateOk){ next(); return; }
    const code = $input.value.trim();
    if(!code){ showErr("請輸入課程公告裡的通行碼"); $input.focus(); return; }
    $btn.disabled = true; $btn.textContent = "驗證中…"; hideErr();
    try{
      const r = await fetch(API_BASE + "/api/verify", { headers: {"X-Class-Code": code} });
      if(r.ok){
        classCode = code;
        try{ sessionStorage.setItem("classCode", code); }catch(e){}
        gateOk = true; next(); return;
      }
      showErr(r.status === 403 ? "通行碼不正確，請確認課程公告" : "驗證服務暫時無法使用，請稍後再試");
    }catch(e){
      showErr("連線失敗，請確認網路後再試");
    }
    $btn.disabled = false; $btn.textContent = "開始填寫";
    $input.focus();
  }
  $btn.addEventListener("click", start);
  if($input){
    $input.addEventListener("keydown", e => { if(e.key === "Enter") start(); });
    $input.focus();
  }
}

/* ===== 基本資料 ===== */
function htmlProfile(){
  return '<div>' +
    '<h2 class="sv-title">先認識你一下</h2>' +
    '<div class="sv-fields">' +
      '<div class="sv-field"><label class="sv-label" for="fName">姓名</label>' +
        '<input type="text" id="fName" autocomplete="name" value="' + esc(answers.name) + '"></div>' +
      '<div class="sv-field"><span class="sv-label">所屬部門</span>' + htmlChips("dept", DEPTS, answers.dept, false) + '</div>' +
      '<div class="sv-field"><label class="sv-label" for="fJob">主要工作內容<span class="sv-label-note">一句話即可</span></label>' +
        '<input type="text" id="fJob" placeholder="例：負責兩間館的社群與活動文案" value="' + esc(answers.job) + '"></div>' +
    '</div>' + htmlError() +
    '<div class="sv-nav"><span></span><button class="sv-btn primary" id="nextBtn">開始作答</button></div></div>';
}
function bindProfile(){
  bindChips("dept", v => { answers.dept = v; hideErr(); });
  function goNext(){
    answers.name = document.getElementById("fName").value.trim();
    answers.job  = document.getElementById("fJob").value.trim();
    if(!answers.name || !answers.dept){ showErr("請填寫姓名並選擇所屬部門"); return; }
    next();
  }
  document.getElementById("nextBtn").addEventListener("click", goNext);
  document.getElementById("fJob").addEventListener("keydown", e => { if(e.key === "Enter") goNext(); });
}
function bindChips(id, onPick, multi, getValue){
  document.querySelectorAll('[data-chips="' + id + '"] .sv-chip').forEach(b => {
    b.addEventListener("click", () => {
      if(multi){
        const arr = getValue();
        const i = arr.indexOf(b.dataset.val);
        if(i >= 0) arr.splice(i, 1); else arr.push(b.dataset.val);
        b.classList.toggle("selected");
        onPick(arr);
      } else {
        document.querySelectorAll('[data-chips="' + id + '"] .sv-chip').forEach(x => x.classList.remove("selected"));
        b.classList.add("selected");
        onPick(b.dataset.val);
      }
    });
  });
}

/* ===== 部分過場頁 ===== */
function htmlSection(step){
  const p = step.part;
  const i = PARTS.findIndex(x => x.id === p.id);
  return '<button type="button" class="sv-section" id="secBtn">' +
    '<span class="sv-section-num">' + p.num + '</span>' +
    '<span class="sv-section-meta">第' + p.num + '部分・' + (i+1) + '／' + PARTS.length + '</span>' +
    '<span class="sv-section-title sv-display">' + p.title + '</span>' +
    '<span class="sv-section-blurb">' + p.blurb + '</span>' +
    '<span class="sv-section-skip">點一下繼續</span></button>';
}
function bindSection(){
  document.getElementById("secBtn").addEventListener("click", next);
  sectionTimer = setTimeout(next, 1800);
}

/* ===== 題目頁 ===== */
function htmlQuestion(step){
  const q = step.q;
  const qn = qNumberAt(stepIdx);
  const body = q.type === "topics" ? htmlTopics(q) : htmlOptions(q);
  return '<div><h2 class="sv-title">' + esc(q.title) + '</h2>' +
    (q.hint ? '<p class="sv-hint">' + esc(q.hint) + '</p>' : "") +
    body + htmlError() +
    '<div class="sv-nav"><button class="sv-btn ghost" id="backBtn">上一步</button>' +
    '<button class="sv-btn primary" id="nextBtn">' + (qn === Q_TOTAL ? "完成" : "下一題") + '</button></div></div>';
}
function htmlTopics(q){
  const v = answers[q.id];
  return '<div class="sv-topic-count">已選 <strong id="topicCount">' + v.length + '</strong>／' + q.max + '</div>' +
    '<div class="sv-topic-grid" id="topicGrid">' +
    q.options.map(o => {
      const sel = v.includes(o.code);
      return '<button type="button" class="sv-topic' + (sel ? " selected" : "") + '" data-code="' + o.code + '" aria-pressed="' + sel + '">' +
        '<span class="sv-topic-code">' + o.code + '</span>' +
        '<span class="sv-topic-label">' + esc(o.label) + '</span>' +
        '<span class="sv-mark check on"></span></button>';
    }).join("") + '</div>';
}
function bindQuestion(step){
  const q = step.q;
  document.getElementById("backBtn").addEventListener("click", () => { saveOther(q); back(); });
  document.getElementById("nextBtn").addEventListener("click", () => {
    saveOther(q);
    const v = answers[q.id];
    if(q.type === "single" && !v) return showErr("請選擇一個選項");
    if((q.type === "multi" || q.type === "topics") && v.length === 0) return showErr("請至少選擇一個選項");
    const hasOther = q.type === "single" ? v === OTHER : Array.isArray(v) && v.includes(OTHER);
    if(q.other && hasOther && !(otherTexts[q.id]||"").trim()){
      showErr("你選了「其他」，請補充說明");
      const $o = document.getElementById("otherInput"); if($o) $o.focus();
      return;
    }
    next();
  });
  if(q.type === "topics"){
    document.querySelectorAll("#topicGrid .sv-topic").forEach(b => {
      b.addEventListener("click", () => {
        const code = b.dataset.code, arr = answers[q.id];
        const i = arr.indexOf(code);
        if(i >= 0){ arr.splice(i,1); b.classList.remove("selected"); }
        else if(arr.length >= q.max){ showErr("最多選 " + q.max + " 個，先取消一個再選"); return; }
        else { arr.push(code); b.classList.add("selected"); }
        hideErr();
        document.getElementById("topicCount").textContent = arr.length;
      });
    });
    return;
  }
  const $otherWrap = document.getElementById("otherWrap");
  const $otherInput = document.getElementById("otherInput");
  if($otherInput){
    $otherInput.addEventListener("input", () => { otherTexts[q.id] = $otherInput.value.trim(); hideErr(); });
    $otherInput.addEventListener("keydown", e => { if(e.key === "Enter") document.getElementById("nextBtn").click(); });
  }
  document.querySelectorAll("#opts .sv-opt").forEach(b => {
    b.addEventListener("click", () => {
      const o = b.dataset.val;
      hideErr();
      if(q.type === "multi"){
        let arr = answers[q.id];
        if(arr.includes(o)) arr.splice(arr.indexOf(o), 1); else arr.push(o);
        if(q.exclusive){
          if(o === q.exclusive && arr.includes(o)){ arr.length = 0; arr.push(q.exclusive); }
          else { const x = arr.indexOf(q.exclusive); if(x >= 0) arr.splice(x, 1); }
        }
        document.querySelectorAll("#opts .sv-opt").forEach(x => {
          const sel = arr.includes(x.dataset.val);
          x.classList.toggle("selected", sel);
          x.querySelector(".sv-mark").classList.toggle("on", sel);
        });
        $otherWrap.style.display = arr.includes(OTHER) ? "" : "none";
        if(o === OTHER && arr.includes(OTHER)) $otherInput.focus();
      } else {
        answers[q.id] = o;
        document.querySelectorAll("#opts .sv-opt").forEach(x => {
          const sel = x.dataset.val === o;
          x.classList.toggle("selected", sel);
          x.querySelector(".sv-mark").classList.toggle("on", sel);
        });
        if(o === OTHER){ $otherWrap.style.display = ""; $otherInput.focus(); }
        else {
          $otherWrap.style.display = "none";
          if(AUTO_ADVANCE) sectionTimer = setTimeout(next, 340);
        }
      }
    });
  });
  function saveOther(qq){
    const $o = document.getElementById("otherInput");
    if($o) otherTexts[qq.id] = $o.value.trim();
  }
}
function saveOther(){} /* 佔位：實際邏輯在 bindQuestion 閉包內 */

/* ===== 課堂實作（整頁） ===== */
function htmlTask(){
  const t = answers.task, B = TASK_BLOCK;
  return '<div class="sv-task"><h2 class="sv-title">' + esc(B.title) + '</h2>' +
    '<p class="sv-hint">' + esc(B.hint) + '</p>' +
    '<div class="sv-fields">' +
      B.fields.map(f =>
        '<div class="sv-field"><label class="sv-label" for="tf_' + f.key + '">' + esc(f.label) +
        (f.required ? '<em class="sv-req">必填</em>' : "") + '</label>' +
        '<textarea id="tf_' + f.key + '" placeholder="' + esc(f.ph || "") + '">' + esc(t[f.key]) + '</textarea></div>'
      ).join("") +
    '</div>' +
    '<div class="sv-subq"><span class="sv-label">' + esc(B.q16.label) + '</span>' + htmlChips("succ", B.q16.options, t.succ, false) + '</div>' +
    '<div class="sv-subq"><span class="sv-label">' + esc(B.q17.label) +
      '<button type="button" class="sv-note-toggle" id="noteBtn">什麼是「去識別」？</button></span>' +
      '<p class="sv-note" id="noteBox" style="display:none">' + esc(B.q17.note) + '</p>' +
      htmlChips("mat", B.q17.options, t.mat, true) + '</div>' +
    '<div class="sv-subq"><span class="sv-label">' + esc(B.q18.label) + '</span>' + htmlChips("limit", B.q18.options, t.limit, false) + '</div>' +
    htmlError() +
    '<div class="sv-nav"><button class="sv-btn ghost" id="backBtn">上一步</button>' +
    '<button class="sv-btn primary" id="nextBtn">送出問卷</button></div></div>';
}
function bindTask(){
  const t = answers.task;
  bindChips("succ", v => { t.succ = v; });
  bindChips("limit", v => { t.limit = v; });
  bindChips("mat", () => {}, true, () => t.mat);
  document.getElementById("noteBtn").addEventListener("click", () => {
    const $n = document.getElementById("noteBox");
    $n.style.display = $n.style.display === "none" ? "" : "none";
  });
  function save(){
    TASK_BLOCK.fields.forEach(f => { t[f.key] = document.getElementById("tf_" + f.key).value.trim(); });
  }
  document.getElementById("backBtn").addEventListener("click", () => { save(); back(); });
  document.getElementById("nextBtn").addEventListener("click", () => {
    save();
    if(!t.task){ showErr("「這個任務是什麼」是必填，至少寫一句"); return; }
    next();
  });
}

/* ===== 完成頁 ===== */
function buildPayload(){
  const a = answers;
  return {
    uid: uidFrom(a.name, a.dept),
    dept: a.dept || "其他",
    topics: a.q14 || [],
    diag: buildDiagnosis(a),
    task: (a.task.task || "").slice(0, 120),
    succ: SUCC_CODE[a.task.succ] || 0,
    mat: (a.task.mat || []).map(o => MAT_CODE[o]).filter(Boolean),
    limit: LIMIT_CODE[a.task.limit] || 0,
    sens: SENS_OPTIONS.some(o => (a.q11||[]).includes(o)) ? 1 : 0,
    lit: LIT_CODE[a.q13] || 0,
    ts: Date.now()
  };
}
function uidFrom(name, dept){
  let h = 0; const str = name + "|" + dept;
  for(let i = 0; i < str.length; i++){ h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h.toString(36);
}

function htmlDone(){
  return '<div class="st-sending"><span class="st-spinner"></span><p>正在送出你的回覆…</p></div>';
}
function bindDone(){
  const mine = buildPayload();
  if(DEMO){
    setTimeout(() => renderDoneBody(mine, MOCK_RESPONSES.concat(mine)), 800);
    return;
  }
  (async () => {
    let list = null;
    try{
      await fetch(API_BASE + "/api/response", {
        method:"POST",
        headers:{"Content-Type":"application/json","X-Class-Code":classCode},
        body: JSON.stringify(mine)
      });
    }catch(e){ console.log("[survey] submit failed", e); }
    try{
      const r = await fetch(API_BASE + "/api/responses", { headers:{"X-Class-Code":classCode} });
      if(r.ok){
        list = await r.json();
        if(!list.some(d => d.uid === mine.uid)) list = list.concat(mine);
      }
    }catch(e){ console.log("[survey] stats load failed", e); }
    renderDoneBody(mine, list);
  })();
}

function renderDoneBody(mine, list){
  const a = answers;
  const diagOnly = mine.diag.filter(c => !mine.topics.includes(c));
  const chip = (c, kind) =>
    '<span class="st-chip ' + kind + '"><span class="st-chip-code">' + c + '</span>' + CATEGORY_NAMES[c] + '</span>';
  const statsHtml = list && list.length
    ? '<div class="st-stats-head"><h3 class="st-h" style="margin:0">大家提出的方向</h3>' +
      '<label class="st-switch"><input type="checkbox" id="iviewToggle"><span class="st-switch-track"></span>講師檢視</label></div>' +
      '<div id="studentStats">' + htmlStudentStats(aggregate(list)) + '</div>' +
      '<div id="instructorStats" style="display:none">' + htmlInstructorStats(aggregate(list)) + '</div>'
    : '<h3 class="st-h">大家提出的方向</h3><p class="st-sub">目前讀不到統計資料，稍後重新整理即可，你的回覆已送出。</p>';
  $screen.querySelector(".sv-step").innerHTML =
    '<div class="st-done">' +
      '<div class="st-confirm"><span class="st-check"></span><div>' +
        '<h2 class="sv-title">已送出，' + (a.name ? esc(a.name) + "，" : "") + '課堂見</h2>' +
        '<p class="st-sub">講師已收到你的案例，工作坊會直接帶你把它做完</p></div></div>' +
      '<div class="st-plan"><h3 class="st-h">為你規劃的單元</h3>' +
        '<div class="st-chips">' + mine.topics.map(c => chip(c,"sel")).join("") + diagOnly.map(c => chip(c,"diag")).join("") + '</div>' +
        '<p class="st-sub">實心＝你自選的主題；外框＝根據你的作答習慣，建議加聽的單元</p></div>' +
      htmlSummary() +
      '<div class="st-stats">' + statsHtml + '</div>' +
      '<div class="sv-nav"><button class="sv-btn ghost" id="editBtn">回上一步修改</button><span></span></div>' +
    '</div>';
  document.getElementById("editBtn").addEventListener("click", back);
  const $sum = document.getElementById("sumToggle");
  if($sum) $sum.addEventListener("click", () => {
    const $s = document.getElementById("summaryBox");
    const open = $s.style.display === "none";
    $s.style.display = open ? "" : "none";
    $sum.parentElement.classList.toggle("open", open);
    $sum.childNodes[0].textContent = open ? "收合填答摘要" : "查看完整填答摘要";
  });
  const $iv = document.getElementById("iviewToggle");
  if($iv) $iv.addEventListener("change", () => {
    document.getElementById("instructorStats").style.display = $iv.checked ? "" : "none";
  });
}

function htmlSummary(){
  const a = answers, t = a.task;
  const fmt = q => {
    const v = a[q.id];
    const f = o => o === OTHER ? "其他（" + (otherTexts[q.id] || "未說明") + "）" : o;
    if(q.type === "topics") return v.length ? v.map(c => c + " " + CATEGORY_NAMES[c]).join("、") : "（未填）";
    return Array.isArray(v) ? (v.length ? v.map(f).join("、") : "（未填）") : (v ? f(v) : "（未填）");
  };
  const rows = QUESTIONS.map(q =>
    '<li><strong>' + esc(q.title) + '</strong><span>' + esc(fmt(q)) + '</span></li>').join("") +
    '<li><strong>課堂實作任務</strong><span>' + esc(t.task || "（未填）") + '</span></li>' +
    '<li><strong>現在的做法</strong><span>' + esc(t.now || "（未填）") + '</span></li>' +
    '<li><strong>成功標準</strong><span>' + esc(t.succ || "（未填）") + '</span></li>' +
    '<li><strong>現場素材</strong><span>' + esc(t.mat.length ? t.mat.join("、") : "（未填）") + '</span></li>' +
    '<li><strong>資料限制</strong><span>' + esc(t.limit || "（未填）") + '</span></li>';
  return '<div class="st-summary">' +
    '<button type="button" class="st-summary-toggle" id="sumToggle">查看完整填答摘要<span class="st-caret"></span></button>' +
    '<div class="st-summary-body" id="summaryBox" style="display:none">' +
      '<div class="st-summary-head">' +
        '<span><strong>姓名</strong>' + esc(a.name || "（未填）") + '</span>' +
        '<span><strong>部門</strong>' + esc(a.dept || "（未填）") + '</span>' +
        '<span><strong>工作內容</strong>' + esc(a.job || "（未填）") + '</span></div>' +
      '<ul>' + rows + '</ul></div></div>';
}

/* ===== 統計（學員層） ===== */
function htmlStudentStats(g){
  const ranked = Object.keys(CATEGORY_NAMES)
    .filter(c => (g.topicSel[c]||0) > 0)
    .sort((a,b) => (g.topicSel[b]||0) - (g.topicSel[a]||0));
  const max = Math.max(1, ...ranked.map(c => g.topicSel[c]||0));
  const deptLine = Object.entries(g.deptCount).map(([d,v]) => d + " " + v).join("・");
  const bars = ranked.map((c, i) =>
    '<div class="st-bar' + (i < 3 ? " accent" : "") + '">' +
      '<span class="st-bar-rank">' + (i+1) + '</span>' +
      '<span class="st-bar-label">' + CATEGORY_NAMES[c] + '</span>' +
      '<span class="st-bar-track"><span class="st-bar-fill" style="width:' + Math.round((g.topicSel[c]||0)/max*100) + '%"></span></span>' +
      '<span class="st-bar-num">' + (g.topicSel[c]||0) + '</span></div>').join("");
  const tasks = g.tasks.map(t =>
    '<div class="st-task"><span class="st-task-dept">' + esc(t.dept) + '</span>' +
    '<span class="st-task-text">' + esc(t.task) + '</span></div>').join("");
  return '<div class="st-student">' +
    '<div class="st-headline"><span class="st-big">' + g.n + '</span>' +
      '<span class="st-big-caption">位同仁已完成<em>' + deptLine + '</em></span></div>' +
    '<h3 class="st-h">大家最想加強的主題</h3><div class="st-rank">' + bars + '</div>' +
    '<h3 class="st-h">大家帶來的實作任務</h3>' +
    '<p class="st-sub">匿名顯示，看看其他同仁打算怎麼用</p>' +
    '<div class="st-tasks">' + tasks + '</div></div>';
}

/* ===== 統計（講師層） ===== */
function htmlMiniDist(title, labels, counts){
  const max = Math.max(1, ...counts.slice(1));
  return '<div class="st-mini"><h4>' + title + '</h4>' +
    labels.map((l, i) => i === 0 ? "" :
      '<div class="st-bar small"><span class="st-bar-label">' + l + '</span>' +
      '<span class="st-bar-track"><span class="st-bar-fill" style="width:' + Math.round(counts[i]/max*100) + '%"></span></span>' +
      '<span class="st-bar-num">' + counts[i] + '</span></div>').join("") + '</div>';
}
function htmlInstructorStats(g){
  const rows = Object.keys(CATEGORY_NAMES)
    .map(c => ({code:c, sel:g.topicSel[c]||0, diag:g.topicDiag[c]||0}))
    .filter(r => r.sel + r.diag > 0)
    .sort((a,b) => (b.sel+b.diag) - (a.sel+a.diag));
  const max = Math.max(1, ...rows.map(r => Math.max(r.sel, r.diag)));
  const db = rows.map(r => {
    const a = r.sel/max*100, b = r.diag/max*100;
    const dots = r.sel === r.diag
      ? '<span class="st-dot both" style="left:' + a + '%"></span>'
      : '<span class="st-db-line" style="left:' + Math.min(a,b) + '%;width:' + Math.abs(a-b) + '%"></span>' +
        '<span class="st-dot sel" style="left:' + a + '%"></span>' +
        '<span class="st-dot diag" style="left:' + b + '%"></span>';
    return '<div class="st-db-row">' +
      '<span class="st-db-label"><strong>' + r.code + '</strong> ' + CATEGORY_NAMES[r.code] + '</span>' +
      '<span class="st-db-track">' + dots + '</span>' +
      '<span class="st-db-nums">' + r.sel + '<i>／</i>' + r.diag + '</span></div>';
  }).join("");
  const deptCols = Object.entries(g.deptTopic).map(([dept, m]) => {
    const top = Object.entries(m).sort((a,b) => (b[1].sel+b[1].diag) - (a[1].sel+a[1].diag)).slice(0,3);
    return '<div class="st-dept-col"><h4>' + esc(dept) + '<span>' + (g.deptCount[dept]||0) + ' 位</span></h4><ol>' +
      top.map(([c,v]) => '<li><strong>' + c + '</strong> ' + CATEGORY_NAMES[c] +
        '<i>自選 ' + v.sel + '・診斷 ' + v.diag + '</i></li>').join("") + '</ol></div>';
  }).join("");
  return '<div class="st-instructor">' +
    '<h3 class="st-h">自選 vs 診斷</h3>' +
    '<p class="st-sub">兩者落差大的主題（如低自選、高診斷）值得在課堂上特別點出</p>' +
    '<div class="st-dumbbell"><p class="st-legend">' +
      '<span class="st-dot sel"></span>學員自選 <span class="st-dot diag"></span>系統診斷 ' +
      '<span class="st-dot both"></span>兩者相同' +
      '<span class="st-legend-note">診斷＝由作答習慣推導的建議單元</span></p>' + db + '</div>' +
    '<h3 class="st-h">各部門最需要的主題</h3><div class="st-dept-cols">' + deptCols + '</div>' +
    '<h3 class="st-h">資安準備度</h3><div class="st-sec-row">' +
      '<div class="st-callout"><span class="st-big">' + g.sensCount + '</span><span>位貼過敏感資料<br>或不確定界線</span></div>' +
      htmlMiniDist("「分享連結 vs 離線檔」認知", LIT_LABELS, g.litCount) + '</div>' +
    '<h3 class="st-h">備課資訊</h3><div class="st-prep-grid">' +
      htmlMiniDist("現場素材", MAT_LABELS, g.matCount) +
      htmlMiniDist("資料限制", LIMIT_LABELS, g.limitCount) +
      htmlMiniDist("成功標準", SUCC_LABELS, g.succCount) + '</div></div>';
}

render();
