/**
 * 課前調查共同統計 API
 * POST /api/response  提交匿名彙整（同一 uid 重填覆蓋）
 * GET  /api/responses 回傳全部匿名回覆陣列
 * GET  /api/verify    驗證通行碼（前端進站鎖定頁使用）
 *
 * KV 只存匿名欄位（dept/topics/diag/task/ts），不存姓名與完整作答。
 *
 * 防護層：
 * - 通行碼：兩個端點都要求 X-Class-Code 標頭等於 CLASS_CODE secret，
 *   外人即使知道網址也無法提交或讀取統計。secret 未設定時一律拒絕。
 * - 節流：每 IP 每分鐘最多 RL_MAX_PER_MIN 次 POST。
 * - 總量上限：新回覆超過 MAX_RESPONSES 筆即拒收（同 uid 覆蓋不受限），
 *   作為 KV 被灌爆的保險絲。
 */
const PREFIX = "resp:";
const RL_PREFIX = "rl:";
const RL_MAX_PER_MIN = 5;
const MAX_RESPONSES = 300;

const ALLOWED_ORIGINS = [
  "https://my-humble-house.github.io",
  "https://linachang.github.io",
  "http://localhost:8000",
];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Class-Code",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

function authorized(request, env) {
  if (!env.CLASS_CODE) return false;
  return (request.headers.get("X-Class-Code") || "") === env.CLASS_CODE;
}

/* KV 計數節流:同一 IP 在同一分鐘桶內的 POST 次數 */
async function rateLimited(env, ip) {
  const bucket = Math.floor(Date.now() / 60000);
  const key = RL_PREFIX + ip + ":" + bucket;
  const n = Number(await env.RESPONSES.get(key)) || 0;
  if (n >= RL_MAX_PER_MIN) return true;
  await env.RESPONSES.put(key, String(n + 1), { expirationTtl: 120 });
  return false;
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
      const isSubmit = url.pathname === "/api/response" && request.method === "POST";
      const isList = url.pathname === "/api/responses" && request.method === "GET";
      const isVerify = url.pathname === "/api/verify" && request.method === "GET";

      if ((isSubmit || isList || isVerify) && !authorized(request, env)) {
        return json({ ok: false, error: "forbidden" }, 403, headers);
      }

      if (isVerify) {
        return json({ ok: true }, 200, headers);
      }

      if (isSubmit) {
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        if (await rateLimited(env, ip)) {
          return json({ ok: false, error: "too many requests" }, 429, headers);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: "invalid json" }, 400, headers);
        }
        const record = validate(body);
        if (!record) return json({ ok: false, error: "invalid payload" }, 400, headers);
        const existing = await env.RESPONSES.get(PREFIX + record.uid);
        if (!existing) {
          const page = await env.RESPONSES.list({ prefix: PREFIX, limit: 1000 });
          if (page.keys.length >= MAX_RESPONSES) {
            return json({ ok: false, error: "full" }, 503, headers);
          }
        }
        await env.RESPONSES.put(PREFIX + record.uid, JSON.stringify(record));
        return json({ ok: true }, 200, headers);
      }

      if (isList) {
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
