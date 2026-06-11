/* 三個方向的外框殼層（prototype.html 依 ?variant= 選用其一） */

/* 強調色 → 衍生色 */
const ACCENT_PAIRS = {
  "#3B5D6B": { deep:"#284450", soft:"rgba(59,93,107,.09)" },
  "#4F7A62": { deep:"#3A5F4A", soft:"rgba(79,122,98,.11)" },
  "#81603F": { deep:"#64492E", soft:"rgba(129,96,63,.10)" }
};
function accentVars(accent){
  const p = ACCENT_PAIRS[accent] || ACCENT_PAIRS["#3B5D6B"];
  return { "--accent": accent, "--accent-deep": p.deep, "--accent-soft": p.soft,
           "--sel-color": accent };
}

/* ===== 方向 A：官網沉穩版（深色表頭 + 襯線標題） ===== */
function VariantA({t}){
  const flow = useSurveyFlow({screen: window.PARAMS.screen});
  return (
    <div className="va" data-kind={flow.step.kind} style={accentVars(t.accent)}>
      <header className="va-mast">
        <img className="va-logo" src="assets/mhh-logo.png" alt="寒舍餐旅管理顧問" />
        <div className="va-brand">
          <span className="va-brand-kicker">MY HUMBLE HOUSE HOSPITALITY GROUP</span>
          <span className="va-brand-title">寒舍集團・內部工作坊</span>
        </div>
        <span className="va-mast-tag">課前調查</span>
      </header>
      <main className="va-main">
        <div className="va-card">
          <SegProgress flow={flow} />
          <StepBody flow={flow} autoAdvance={t.autoAdvance} instructorOpen={t.instructorOpen} />
        </div>
      </main>
    </div>
  );
}

/* ===== 方向 B：輕快內部版（淺色 + 墨色 logo + 圓角） ===== */
function VariantB({t}){
  const flow = useSurveyFlow({screen: window.PARAMS.screen});
  return (
    <div className="vb" data-kind={flow.step.kind} style={accentVars(t.accent)}>
      <header className="vb-head">
        <div className="vb-lockup">
          <img className="vb-logo" src="assets/mhh-logo-ink.png" alt="寒舍餐旅管理顧問" />
          <span className="vb-brand">寒舍集團<i>內部學習</i></span>
        </div>
        <span className="vb-head-tag">Claude 工作坊・課前調查</span>
      </header>
      <main className="vb-main">
        <div className="vb-card">
          <SegProgress flow={flow} />
          <StepBody flow={flow} autoAdvance={t.autoAdvance} instructorOpen={t.instructorOpen} />
        </div>
      </main>
    </div>
  );
}

/* ===== 方向 C：桌面雙欄版（深色側欄導覽） ===== */
function VariantC({t}){
  const flow = useSurveyFlow({screen: window.PARAMS.screen});
  const k = flow.step.kind;
  return (
    <div className="vc" data-kind={k} style={accentVars(t.accent)}>
      <aside className="vc-side">
        <div className="vc-side-brand">
          <img className="vc-logo" src="assets/mhh-logo.png" alt="寒舍餐旅管理顧問" />
          <span className="vc-side-kicker">CLAUDE 工作坊</span>
          <span className="vc-side-title">課前調查</span>
        </div>
        <PartChecklist flow={flow} />
        <div className="vc-side-foot">
          {k === "welcome" || k === "profile"
            ? <span className="vc-side-count">{Q_TOTAL} 題・約 7 分鐘</span>
            : k === "done"
              ? <span className="vc-side-count">已完成，感謝填寫</span>
              : <span className="vc-side-count"><strong>{String(flow.qNumber).padStart(2,"0")}</strong>／{flow.qTotal} 題</span>}
          <div className="vc-side-bar"><i style={{width: flow.pct + "%"}}></i></div>
        </div>
      </aside>
      <main className="vc-main">
        <div className="vc-content">
          <StepBody flow={flow} autoAdvance={t.autoAdvance} instructorOpen={t.instructorOpen} />
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { VariantA, VariantB, VariantC, accentVars });
