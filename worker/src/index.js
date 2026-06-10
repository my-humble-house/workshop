/**
 * 課前調查共同統計 API
 * POST /api/response  提交匿名彙整（同一 uid 重填覆蓋）
 * GET  /api/responses 回傳全部匿名回覆陣列
 *
 * KV 只存匿名欄位（dept/topics/diag/task/ts），不存姓名與完整作答。
 */
const PREFIX = "resp:";

const ALLOWED_ORIGINS = [
  "https://linachang.github.io",
  "http://localhost:8000",
];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

/* 僅接受預期形狀與長度的欄位，其餘一律拒絕或截斷 */
function validate(d) {
  if (typeof d !== "object" || d === null) return null;
  const uid = String(d.uid || "");
  if (!/^[0-9a-z]{1,13}$/.test(uid)) return null;
  const dept = String(d.dept || "").trim().slice(0, 50);
  if (!dept) return null;
  const codes = (x) =>
    Array.isArray(x) ? x.filter((v) => typeof v === "string" && /^[A-H]$/.test(v)).slice(0, 8) : [];
  return {
    uid,
    dept,
    topics: codes(d.topics),
    diag: codes(d.diag),
    task: String(d.task || "").slice(0, 120),
    ts: Number(d.ts) || Date.now(),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request.headers.get("Origin") || "");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      if (url.pathname === "/api/response" && request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "invalid json" }, 400, headers);
        }
        const record = validate(body);
        if (!record) return json({ ok: false, error: "invalid payload" }, 400, headers);
        await env.RESPONSES.put(PREFIX + record.uid, JSON.stringify(record));
        return json({ ok: true }, 200, headers);
      }

      if (url.pathname === "/api/responses" && request.method === "GET") {
        const out = [];
        let cursor;
        do {
          const page = await env.RESPONSES.list({ prefix: PREFIX, cursor });
          const values = await Promise.all(page.keys.map((k) => env.RESPONSES.get(k.name)));
          for (const v of values) {
            if (!v) continue;
            try {
              out.push(JSON.parse(v));
            } catch {
              /* 單筆毀損時跳過，不中斷整體統計 */
            }
          }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
        return json(out, 200, headers);
      }

      return json({ ok: false, error: "not found" }, 404, headers);
    } catch (e) {
      console.log(JSON.stringify({ level: "error", message: String(e && e.message) }));
      return json({ ok: false, error: "internal error" }, 500, headers);
    }
  },
};
