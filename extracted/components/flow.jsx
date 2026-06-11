/* 共用流程：狀態機 + 題目畫面元件（三個方向共用，外觀由各方向 CSS 決定） */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ===== 步驟表 ===== */
const STEPS = (() => {
  const s = [{kind:"welcome"}, {kind:"profile"}];
  PARTS.forEach(p => {
    p.qs.forEach(qid => s.push(qid === "task"
      ? {kind:"task", part:p, block:TASK_BLOCK}
      : {kind:"question", part:p, q:QUESTIONS.find(q => q.id === qid)}));
  });
  s.push({kind:"done"});
  return s;
})();
const Q_TOTAL = STEPS.filter(s => s.kind === "question" || s.kind === "task").length;
function qNumberAt(idx){
  let n = 0;
  for(let i = 0; i <= idx; i++) if(STEPS[i].kind === "question" || STEPS[i].kind === "task") n++;
  return n;
}

function emptyAnswers(){
  const a = { name:"", dept:"", job:"" };
  QUESTIONS.forEach(q => { a[q.id] = (q.type === "multi" || q.type === "topics") ? [] : ""; });
  a.task = { task:"", now:"", succ:"", mat:[], limit:"" };
  return a;
}

/* URL ?screen= → 起始步驟（總覽頁示意用） */
function initialStepFromParam(screen){
  const find = pred => STEPS.findIndex(pred);
  switch(screen){
    case "profile": return 1;
    case "section": return find(s => s.kind === "section" && s.part.id === "p2");
    case "q":       return find(s => s.kind === "question" && s.q && s.q.id === "q6");
    case "topics":  return find(s => s.kind === "question" && s.q && s.q.id === "q14");
    case "task":    return find(s => s.kind === "task");
    case "done":    return STEPS.length - 1;
    default:        return 0;
  }
}

/* ===== 流程狀態 ===== */
function useSurveyFlow(opts){
  const screen = opts.screen || "welcome";
  const prefill = screen !== "welcome" && screen !== "profile";
  const [idx, setIdx] = useState(() => initialStepFromParam(screen));
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState(() => prefill
    ? Object.assign(emptyAnswers(), JSON.parse(JSON.stringify(DEMO_ANSWERS)))
    : emptyAnswers());
  const [otherTexts, setOtherTexts] = useState({});
  const [err, setErr] = useState("");

  const step = STEPS[idx];
  const setAnswer = useCallback((key, val) => {
    setAnswers(a => ({...a, [key]: val})); setErr("");
  }, []);
  const setOther = useCallback((qid, val) => {
    setOtherTexts(t => ({...t, [qid]: val})); setErr("");
  }, []);

  const goTo = useCallback((i, d) => { setDir(d); setErr(""); setIdx(i); }, []);

  const validate = useCallback(() => {
    const s = STEPS[idx];
    if(s.kind === "profile"){
      if(!answers.name.trim() || !answers.dept) return "請填寫姓名並選擇所屬部門";
    }
    if(s.kind === "question"){
      const q = s.q, v = answers[q.id];
      if(q.type === "single" && !v) return "請選擇一個選項";
      if((q.type === "multi" || q.type === "topics") && v.length === 0) return "請至少選擇一個選項";
      const hasOther = q.type === "single" ? v === "其他" : Array.isArray(v) && v.includes("其他");
      if(q.other && hasOther && !(otherTexts[q.id]||"").trim()) return "你選了「其他」，請補充說明";
    }
    if(s.kind === "task"){
      if(!answers.task.task.trim()) return "「這個任務是什麼」是必填，至少寫一句";
    }
    return "";
  }, [idx, answers, otherTexts]);

  const next = useCallback(() => {
    const msg = validate();
    if(msg){ setErr(msg); return false; }
    goTo(Math.min(idx + 1, STEPS.length - 1), 1);
    return true;
  }, [idx, validate, goTo]);

  const back = useCallback(() => {
    let i = idx - 1;
    while(i > 0 && STEPS[i].kind === "section") i--;   // 回上一步時略過過場頁
    goTo(Math.max(i, 0), -1);
  }, [idx, goTo]);

  const partIndex = step.part ? PARTS.findIndex(p => p.id === step.part.id) : (step.kind === "done" ? PARTS.length : -1);
  const partStatus = PARTS.map((p, i) => ({
    part: p,
    status: step.kind === "done" ? "done" : (i < partIndex ? "done" : i === partIndex ? "current" : "todo")
  }));

  return {
    idx, dir, step, answers, otherTexts, err,
    setAnswer, setOther, setErr, next, back, goTo,
    qNumber: qNumberAt(idx), qTotal: Q_TOTAL,
    partIndex, partStatus,
    pct: step.kind === "done" ? 100 : Math.round(qNumberAt(idx) / Q_TOTAL * 100)
  };
}

/* ===== 共用小元件 ===== */
function OptionMark({kind, selected}){
  return <span className={"sv-mark " + kind + (selected ? " on" : "")} aria-hidden="true"></span>;
}

/* 選項清單：單選 / 複選 / 互斥 / 其他 */
function OptionList({q, flow, autoAdvance}){
  const v = flow.answers[q.id];
  const isMulti = q.type === "multi";
  const opts = q.other ? q.options.concat("其他") : q.options;
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function pick(o){
    if(isMulti){
      let arr = v.includes(o) ? v.filter(x => x !== o) : v.concat(o);
      if(q.exclusive){
        if(o === q.exclusive && arr.includes(o)) arr = [q.exclusive];
        else arr = arr.filter(x => x !== q.exclusive);
      }
      flow.setAnswer(q.id, arr);
    } else {
      flow.setAnswer(q.id, o);
      if(o !== "其他" && autoAdvance){
        clearTimeout(timer.current);
        timer.current = setTimeout(() => flow.next(), 340);
      }
    }
  }
  const showOther = q.other && (isMulti ? v.includes("其他") : v === "其他");
  return (
    <div className="sv-options" role={isMulti ? "group" : "radiogroup"}>
      {opts.map(o => {
        const sel = isMulti ? v.includes(o) : v === o;
        return (
          <button type="button" key={o}
            className={"sv-opt" + (sel ? " selected" : "")}
            aria-pressed={sel} onClick={() => pick(o)}>
            <OptionMark kind={isMulti ? "check" : "radio"} selected={sel} />
            <span className="sv-opt-text">{o}</span>
          </button>
        );
      })}
      {showOther && (
        <div className="sv-other">
          <input type="text" value={flow.otherTexts[q.id] || ""} autoFocus
            placeholder="請補充說明"
            onChange={e => flow.setOther(q.id, e.target.value)}
            onKeyDown={e => { if(e.key === "Enter") flow.next(); }} />
        </div>
      )}
    </div>
  );
}

/* 主題卡（Q14）：兩欄格狀 + 已選計數 */
function TopicGrid({q, flow}){
  const v = flow.answers[q.id];
  function pick(code){
    if(v.includes(code)) flow.setAnswer(q.id, v.filter(c => c !== code));
    else if(v.length >= q.max) flow.setErr("最多選 " + q.max + " 個，先取消一個再選");
    else flow.setAnswer(q.id, v.concat(code));
  }
  return (
    <div>
      <div className="sv-topic-count">已選 <strong>{v.length}</strong>／{q.max}</div>
      <div className="sv-topic-grid">
        {q.options.map(o => {
          const sel = v.includes(o.code);
          return (
            <button type="button" key={o.code}
              className={"sv-topic" + (sel ? " selected" : "")}
              aria-pressed={sel} onClick={() => pick(o.code)}>
              <span className="sv-topic-code">{o.code}</span>
              <span className="sv-topic-label">{o.label}</span>
              <OptionMark kind="check" selected={sel} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 晶片選擇（實作頁子題用，較緊湊） */
function ChipSelect({options, value, multi, onChange}){
  function pick(o){
    if(multi){
      onChange(value.includes(o) ? value.filter(x => x !== o) : value.concat(o));
    } else onChange(value === o ? "" : o);
  }
  return (
    <div className="sv-chips">
      {options.map(o => {
        const sel = multi ? value.includes(o) : value === o;
        return (
          <button type="button" key={o} className={"sv-chip" + (sel ? " selected" : "")}
            aria-pressed={sel} onClick={() => pick(o)}>{o}</button>
        );
      })}
    </div>
  );
}

/* ===== 各步驟畫面 ===== */
function WelcomeScreen({flow}){
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");
  function start(){
    if(!code.trim()){ setLocalErr("請輸入課程公告裡的通行碼"); return; }
    setLocalErr(""); setBusy(true);
    setTimeout(() => { setBusy(false); flow.next(); }, 700);   // 原型：模擬 Worker 驗證
  }
  return (
    <div className="sv-welcome">
      <p className="sv-kicker">CLAUDE 工作坊</p>
      <h1 className="sv-display">課前調查</h1>
      <p className="sv-lede">{Q_TOTAL} 題，約 7 分鐘。你的回答會直接決定課程怎麼安排、實作帶你做什麼——沒有對錯，照實填就好。</p>
      <ol className="sv-parts-preview">
        {PARTS.map(p => (
          <li key={p.id}>
            <span className="sv-pp-num">{p.num}</span>
            <span className="sv-pp-title">{p.title}</span>
            <span className="sv-pp-count">{p.qs.length === 1 && p.qs[0] === "task" ? "1 頁" : p.qs.length + " 題"}</span>
          </li>
        ))}
      </ol>
      <div className="sv-gate">
        <label className="sv-label" htmlFor="svCode">課程通行碼<span className="sv-label-note">寫在課程公告裡</span></label>
        <div className="sv-gate-row">
          <input id="svCode" type="text" value={code} autoComplete="off"
            onChange={e => { setCode(e.target.value); setLocalErr(""); }}
            onKeyDown={e => { if(e.key === "Enter") start(); }} />
          <button type="button" className="sv-btn primary" disabled={busy} onClick={start}>
            {busy ? "驗證中…" : "開始填寫"}
          </button>
        </div>
        {localErr && <p className="sv-error">{localErr}</p>}
        <p className="sv-demo-note">原型示範：輸入任意文字即可進入</p>
      </div>
    </div>
  );
}

function ProfileScreen({flow}){
  const a = flow.answers;
  return (
    <div>
      <h2 className="sv-title">先認識你一下</h2>
      <div className="sv-fields">
        <div className="sv-field">
          <label className="sv-label" htmlFor="svName">姓名</label>
          <input id="svName" type="text" value={a.name} autoComplete="name"
            onChange={e => flow.setAnswer("name", e.target.value)} />
        </div>
        <div className="sv-field">
          <span className="sv-label">所屬部門</span>
          <ChipSelect options={DEPTS} value={a.dept} onChange={v => flow.setAnswer("dept", v)} />
        </div>
        <div className="sv-field">
          <label className="sv-label" htmlFor="svJob">主要工作內容<span className="sv-label-note">一句話即可</span></label>
          <input id="svJob" type="text" value={a.job} placeholder="例：負責兩間館的社群與活動文案"
            onChange={e => flow.setAnswer("job", e.target.value)}
            onKeyDown={e => { if(e.key === "Enter") flow.next(); }} />
        </div>
      </div>
      {flow.err && <p className="sv-error">{flow.err}</p>}
      <div className="sv-nav">
        <span></span>
        <button type="button" className="sv-btn primary" onClick={flow.next}>開始作答</button>
      </div>
    </div>
  );
}

/* 部分過場頁：定位現在到哪了，1.8 秒後自動續行，點任意處可跳過 */
function SectionScreen({flow}){
  const p = flow.step.part;
  const i = PARTS.findIndex(x => x.id === p.id);
  useEffect(() => {
    const t = setTimeout(() => flow.next(), 1800);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" className="sv-section" onClick={flow.next}>
      <span className="sv-section-num">{p.num}</span>
      <span className="sv-section-meta">第{p.num}部分・{i + 1}／{PARTS.length}</span>
      <span className="sv-section-title sv-display">{p.title}</span>
      <span className="sv-section-blurb">{p.blurb}</span>
      <span className="sv-section-skip">點一下繼續</span>
    </button>
  );
}

function QuestionScreen({flow, autoAdvance}){
  const q = flow.step.q;
  return (
    <div>
      <h2 className="sv-title">{q.title}</h2>
      {q.hint && <p className="sv-hint">{q.hint}</p>}
      {q.type === "topics"
        ? <TopicGrid q={q} flow={flow} />
        : <OptionList q={q} flow={flow} autoAdvance={autoAdvance} />}
      {flow.err && <p className="sv-error">{flow.err}</p>}
      <div className="sv-nav">
        <button type="button" className="sv-btn ghost" onClick={flow.back}>上一步</button>
        <button type="button" className="sv-btn primary" onClick={flow.next}>
          {flow.qNumber === flow.qTotal ? "完成" : "下一題"}
        </button>
      </div>
    </div>
  );
}

/* 課堂實作：一頁完成同一個案例的四個面向 */
function TaskScreen({flow}){
  const t = flow.answers.task;
  const set = (k, v) => flow.setAnswer("task", {...t, [k]: v});
  const B = TASK_BLOCK;
  const [showNote, setShowNote] = useState(false);
  return (
    <div className="sv-task">
      <h2 className="sv-title">{B.title}</h2>
      <p className="sv-hint">{B.hint}</p>
      <div className="sv-fields">
        {B.fields.map(f => (
          <div className="sv-field" key={f.key}>
            <label className="sv-label" htmlFor={"tf_" + f.key}>
              {f.label}{f.required && <em className="sv-req">必填</em>}
            </label>
            <textarea id={"tf_" + f.key} value={t[f.key]} placeholder={f.ph}
              onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="sv-subq">
        <span className="sv-label">{B.q16.label}</span>
        <ChipSelect options={B.q16.options} value={t.succ} onChange={v => set("succ", v)} />
      </div>
      <div className="sv-subq">
        <span className="sv-label">{B.q17.label}
          <button type="button" className="sv-note-toggle" onClick={() => setShowNote(s => !s)}>
            什麼是「去識別」？
          </button>
        </span>
        {showNote && <p className="sv-note">{B.q17.note}</p>}
        <ChipSelect multi options={B.q17.options} value={t.mat} onChange={v => set("mat", v)} />
      </div>
      <div className="sv-subq">
        <span className="sv-label">{B.q18.label}</span>
        <ChipSelect options={B.q18.options} value={t.limit} onChange={v => set("limit", v)} />
      </div>
      {flow.err && <p className="sv-error">{flow.err}</p>}
      <div className="sv-nav">
        <button type="button" className="sv-btn ghost" onClick={flow.back}>上一步</button>
        <button type="button" className="sv-btn primary" onClick={flow.next}>送出問卷</button>
      </div>
    </div>
  );
}

/* 步驟切換動畫容器 */
function StepTransition({id, dir, children}){
  return (
    <div key={id} className={"sv-step " + (dir >= 0 ? "from-right" : "from-left")}>
      {children}
    </div>
  );
}

Object.assign(window, {
  STEPS, Q_TOTAL, useSurveyFlow,
  OptionList, TopicGrid, ChipSelect,
  WelcomeScreen, ProfileScreen, SectionScreen, QuestionScreen, TaskScreen, StepTransition
});
