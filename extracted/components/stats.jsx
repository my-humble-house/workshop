/* 完成頁 + 統計模組（學員層 / 講師層） */

const { useState: useStateS, useEffect: useEffectS, useMemo: useMemoS } = React;

/* 選項文字 → 統計代號（與資料檔的 *_LABELS 對齊） */
const SUCC_CODE  = Object.fromEntries(TASK_BLOCK.q16.options.map((o,i) => [o, i+1]));
const MAT_CODE   = Object.fromEntries(TASK_BLOCK.q17.options.map((o,i) => [o, i+1]));
const LIMIT_CODE = Object.fromEntries(TASK_BLOCK.q18.options.map((o,i) => [o, i+1]));
const LIT_CODE   = Object.fromEntries(QUESTIONS.find(q => q.id === "q13").options.map((o,i) => [o, i+1]));

function buildMine(a){
  return {
    dept: a.dept || "其他",
    topics: a.q14 || [],
    diag: buildDiagnosis(a),
    task: (a.task.task || "").slice(0, 120),
    succ: SUCC_CODE[a.task.succ] || 0,
    mat: (a.task.mat || []).map(o => MAT_CODE[o]).filter(Boolean),
    limit: LIMIT_CODE[a.task.limit] || 0,
    sens: SENS_OPTIONS.some(o => (a.q11||[]).includes(o)) ? 1 : 0,
    lit: LIT_CODE[a.q13] || 0,
    mine: true
  };
}

/* ===== 小元件 ===== */
function CodeChip({code, kind}){
  return (
    <span className={"st-chip " + (kind||"")}>
      <span className="st-chip-code">{code}</span>{CATEGORY_NAMES[code]}
    </span>
  );
}

function Bar({label, value, max, rank, accent}){
  return (
    <div className={"st-bar" + (accent ? " accent" : "")}>
      {rank != null && <span className="st-bar-rank">{rank}</span>}
      <span className="st-bar-label">{label}</span>
      <span className="st-bar-track">
        <span className="st-bar-fill" style={{width: Math.round(value / max * 100) + "%"}}></span>
      </span>
      <span className="st-bar-num">{value}</span>
    </div>
  );
}

/* 自選 vs 診斷：啞鈴圖（單一刻度上兩個點，差距一眼可見） */
function Dumbbell({rows, max}){
  return (
    <div className="st-dumbbell">
      <p className="st-legend">
        <span className="st-dot sel"></span>學員自選
        <span className="st-dot diag"></span>系統診斷
        <span className="st-dot both"></span>兩者相同
        <span className="st-legend-note">診斷＝由作答習慣推導的建議單元</span>
      </p>
      {rows.map(r => {
        const a = r.sel / max * 100, b = r.diag / max * 100;
        return (
          <div className="st-db-row" key={r.code}>
            <span className="st-db-label"><strong>{r.code}</strong> {CATEGORY_NAMES[r.code]}</span>
            <span className="st-db-track">
              {r.sel === r.diag
                ? <span className="st-dot both" style={{left: a + "%"}} title={"自選與診斷各 " + r.sel}></span>
                : <React.Fragment>
                    <span className="st-db-line" style={{left: Math.min(a,b) + "%", width: Math.abs(a-b) + "%"}}></span>
                    <span className="st-dot sel"  style={{left: a + "%"}} title={"自選 " + r.sel}></span>
                    <span className="st-dot diag" style={{left: b + "%"}} title={"診斷 " + r.diag}></span>
                  </React.Fragment>}
            </span>
            <span className="st-db-nums">{r.sel}<i>／</i>{r.diag}</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniDist({title, labels, counts}){
  const max = Math.max(1, ...counts.slice(1));
  return (
    <div className="st-mini">
      <h4>{title}</h4>
      {labels.map((l, i) => i === 0 ? null : (
        <div className="st-bar small" key={i}>
          <span className="st-bar-label">{l}</span>
          <span className="st-bar-track"><span className="st-bar-fill" style={{width: Math.round(counts[i] / max * 100) + "%"}}></span></span>
          <span className="st-bar-num">{counts[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ===== 學員層：大數字 + Top 3 + 任務牆 ===== */
function StudentStats({g}){
  const ranked = Object.keys(CATEGORY_NAMES)
    .filter(c => (g.topicSel[c]||0) > 0)
    .sort((a,b) => (g.topicSel[b]||0) - (g.topicSel[a]||0));
  const max = Math.max(1, ...ranked.map(c => g.topicSel[c]||0));
  const deptLine = Object.entries(g.deptCount).map(([d,v]) => d + " " + v).join("・");
  return (
    <div className="st-student">
      <div className="st-headline">
        <span className="st-big">{g.n}</span>
        <span className="st-big-caption">位同仁已完成<em>{deptLine}</em></span>
      </div>
      <h3 className="st-h">大家最想加強的主題</h3>
      <div className="st-rank">
        {ranked.map((c, i) => (
          <Bar key={c} rank={i + 1} accent={i < 3}
            label={CATEGORY_NAMES[c]} value={g.topicSel[c]||0} max={max} />
        ))}
      </div>
      <h3 className="st-h">大家帶來的實作任務</h3>
      <p className="st-sub">匿名顯示，看看其他同仁打算怎麼用</p>
      <div className="st-tasks">
        {g.tasks.map((t, i) => (
          <div className="st-task" key={i}>
            <span className="st-task-dept">{t.dept}</span>
            <span className="st-task-text">{t.task}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== 講師層：自選vs診斷 + 部門 Top3 + 資安 + 備課 ===== */
function InstructorStats({g}){
  const rows = Object.keys(CATEGORY_NAMES)
    .map(c => ({code:c, sel:g.topicSel[c]||0, diag:g.topicDiag[c]||0}))
    .filter(r => r.sel + r.diag > 0)
    .sort((a,b) => (b.sel + b.diag) - (a.sel + a.diag));
  const max = Math.max(1, ...rows.map(r => Math.max(r.sel, r.diag)));
  const deptCols = Object.entries(g.deptTopic).map(([dept, m]) => {
    const top = Object.entries(m).sort((a,b) => (b[1].sel + b[1].diag) - (a[1].sel + a[1].diag)).slice(0,3);
    return { dept, n: g.deptCount[dept]||0, top };
  });
  return (
    <div className="st-instructor">
      <h3 className="st-h">自選 vs 診斷</h3>
      <p className="st-sub">兩者落差大的主題（如低自選、高診斷）值得在課堂上特別點出</p>
      <Dumbbell rows={rows} max={max} />
      <h3 className="st-h">各部門最需要的主題</h3>
      <div className="st-dept-cols">
        {deptCols.map(d => (
          <div className="st-dept-col" key={d.dept}>
            <h4>{d.dept}<span>{d.n} 位</span></h4>
            <ol>
              {d.top.map(([c, v]) => (
                <li key={c}><strong>{c}</strong> {CATEGORY_NAMES[c]}<i>自選 {v.sel}・診斷 {v.diag}</i></li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <h3 className="st-h">資安準備度</h3>
      <div className="st-sec-row">
        <div className="st-callout">
          <span className="st-big">{g.sensCount}</span>
          <span>位貼過敏感資料<br/>或不確定界線</span>
        </div>
        <MiniDist title="「分享連結 vs 離線檔」認知" labels={LIT_LABELS} counts={g.litCount} />
      </div>
      <h3 className="st-h">備課資訊</h3>
      <div className="st-prep-grid">
        <MiniDist title="現場素材" labels={MAT_LABELS} counts={g.matCount} />
        <MiniDist title="資料限制" labels={LIMIT_LABELS} counts={g.limitCount} />
        <MiniDist title="成功標準" labels={SUCC_LABELS} counts={g.succCount} />
      </div>
    </div>
  );
}

/* ===== 填答摘要（預設收合） ===== */
function SummaryAccordion({answers, otherTexts}){
  const [open, setOpen] = useStateS(false);
  function fmt(q){
    const a = answers[q.id];
    const f = o => o === "其他" ? "其他（" + (otherTexts[q.id] || "未說明") + "）" : o;
    if(q.type === "topics") return a.length ? a.map(c => c + " " + CATEGORY_NAMES[c]).join("、") : "（未填）";
    return Array.isArray(a) ? (a.length ? a.map(f).join("、") : "（未填）") : (a ? f(a) : "（未填）");
  }
  const t = answers.task;
  return (
    <div className={"st-summary" + (open ? " open" : "")}>
      <button type="button" className="st-summary-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? "收合填答摘要" : "查看完整填答摘要"}<span className="st-caret"></span>
      </button>
      {open && (
        <div className="st-summary-body">
          <div className="st-summary-head">
            <span><strong>姓名</strong>{answers.name || "（未填）"}</span>
            <span><strong>部門</strong>{answers.dept || "（未填）"}</span>
            <span><strong>工作內容</strong>{answers.job || "（未填）"}</span>
          </div>
          <ul>
            {QUESTIONS.map(q => (
              <li key={q.id}><strong>{q.title}</strong><span>{fmt(q)}</span></li>
            ))}
            <li><strong>課堂實作任務</strong><span>{t.task || "（未填）"}</span></li>
            <li><strong>現在的做法</strong><span>{t.now || "（未填）"}</span></li>
            <li><strong>成功標準</strong><span>{t.succ || "（未填）"}</span></li>
            <li><strong>現場素材</strong><span>{t.mat.length ? t.mat.join("、") : "（未填）"}</span></li>
            <li><strong>資料限制</strong><span>{t.limit || "（未填）"}</span></li>
          </ul>
        </div>
      )}
    </div>
  );
}

/* ===== 完成頁 ===== */
function DoneScreen({flow, instructorOpen}){
  const [phase, setPhase] = useStateS("sending");
  const [iview, setIview] = useStateS(!!instructorOpen);
  useEffectS(() => {
    const t = setTimeout(() => setPhase("sent"), 900);
    return () => clearTimeout(t);
  }, []);
  const a = flow.answers;
  const mine = useMemoS(() => buildMine(a), []);
  const g = useMemoS(() => aggregate(MOCK_RESPONSES.concat(mine)), []);
  const diag = mine.diag.filter(c => !mine.topics.includes(c));

  if(phase === "sending"){
    return (
      <div className="st-sending">
        <span className="st-spinner" aria-hidden="true"></span>
        <p>正在送出你的回覆…</p>
      </div>
    );
  }
  return (
    <div className="st-done">
      <div className="st-confirm">
        <span className="st-check" aria-hidden="true"></span>
        <div>
          <h2 className="sv-title">已送出，{a.name ? a.name + "，" : ""}課堂見</h2>
          <p className="st-sub">講師已收到你的案例，工作坊會直接帶你把它做完</p>
        </div>
      </div>
      <div className="st-plan">
        <h3 className="st-h">為你規劃的單元</h3>
        <div className="st-chips">
          {mine.topics.map(c => <CodeChip key={c} code={c} kind="sel" />)}
          {diag.map(c => <CodeChip key={c} code={c} kind="diag" />)}
        </div>
        <p className="st-sub">實心＝你自選的主題；外框＝根據你的作答習慣，建議加聽的單元</p>
      </div>
      <SummaryAccordion answers={a} otherTexts={flow.otherTexts} />
      <div className="st-stats">
        <div className="st-stats-head">
          <h3 className="st-h" style={{margin:0}}>大家提出的方向</h3>
          <label className="st-switch">
            <input type="checkbox" checked={iview} onChange={e => setIview(e.target.checked)} />
            <span className="st-switch-track"></span>講師檢視
          </label>
        </div>
        <StudentStats g={g} />
        {iview && <InstructorStats g={g} />}
      </div>
      <div className="sv-nav">
        <button type="button" className="sv-btn ghost" onClick={flow.back}>回上一步修改</button>
        <span></span>
      </div>
    </div>
  );
}

Object.assign(window, { DoneScreen, StudentStats, InstructorStats, SummaryAccordion, buildMine });
