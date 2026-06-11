/* 共用殼層：進度元件 + 步驟路由（各方向的外框自行組裝） */

/* 每部分的題數區間（分段進度條用） */
const PART_RANGES = (() => {
  let acc = 0;
  return PARTS.map(p => {
    const count = p.qs.length;
    const r = { id:p.id, title:p.title, num:p.num, start:acc, count };
    acc += count;
    return r;
  });
})();

function SegProgress({flow}){
  const k = flow.step.kind;
  if(k === "welcome") return null;
  const label =
    k === "profile" ? "基本資料" :
    k === "done" ? "完成" :
    "第" + flow.step.part.num + "部分・" + flow.step.part.title;
  const filled = k === "done" ? Q_TOTAL : flow.qNumber;
  return (
    <div className="sv-progress">
      <div className="sv-prog-top">
        <span className="sv-prog-section">{label}</span>
        <span className="sv-prog-count">
          {(k === "question" || k === "task") && <><strong>{String(flow.qNumber).padStart(2,"0")}</strong>／{flow.qTotal}</>}
        </span>
      </div>
      <div className="sv-prog-segs">
        {PART_RANGES.map(r => {
          const f = Math.max(0, Math.min(1, (filled - r.start) / r.count));
          return <span className="sv-prog-seg" key={r.id}><i style={{width: f * 100 + "%"}}></i></span>;
        })}
      </div>
    </div>
  );
}

/* 側欄部分清單（方向 C 用，也可放歡迎頁） */
function PartChecklist({flow}){
  return (
    <ol className="sv-checklist">
      {flow.partStatus.map((s, i) => (
        <li key={s.part.id} className={s.status}>
          <span className="sv-cl-mark"></span>
          <span className="sv-cl-title">{s.part.title}</span>
          <span className="sv-cl-count">{PART_RANGES[i].count} 題</span>
        </li>
      ))}
    </ol>
  );
}

function StepBody({flow, autoAdvance, instructorOpen}){
  const s = flow.step;
  return (
    <StepTransition id={flow.idx} dir={flow.dir}>
      {s.kind === "welcome"  && <WelcomeScreen flow={flow} />}
      {s.kind === "profile"  && <ProfileScreen flow={flow} />}
      {s.kind === "section"  && <SectionScreen flow={flow} />}
      {s.kind === "question" && <QuestionScreen flow={flow} autoAdvance={autoAdvance} />}
      {s.kind === "task"     && <TaskScreen flow={flow} />}
      {s.kind === "done"     && <DoneScreen flow={flow} instructorOpen={instructorOpen} />}
    </StepTransition>
  );
}

Object.assign(window, { SegProgress, PartChecklist, StepBody, PART_RANGES });
