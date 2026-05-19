/**
 * Aide Cloud Notifier — Cloudflare Worker
 *
 * Responsibilities:
 *  1) Accept POST /sync from the Aide app with current entries (JSON).
 *  2) Run a 1-minute cron that scans entries and fires Telegram alerts when
 *     an entry's date/time matches now (in Asia/Seoul = KST = UTC+9).
 *  3) Send a daily morning digest at 09:00 KST.
 *
 * Required bindings (set in Cloudflare dashboard):
 *  - KV namespace: AIDE_KV
 *  - Secret: TG_TOKEN     (Telegram bot token)
 *  - Secret: TG_CHAT      (Telegram chat id)
 *  - Secret: SYNC_KEY     (random shared key for /sync auth, e.g. 32-char hex)
 *
 * Required triggers:
 *  - Cron: "* * * * *"    (every minute)
 *
 * Storage layout in KV:
 *  - "entries"  → JSON string of Entry[]
 *  - "sent"     → JSON array of "entryId:YYYY-MM-DD" strings already alerted
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function nowKST() {
  return new Date(Date.now() + KST_OFFSET_MS);
}

function kstDateString(d = nowKST()) {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function sendTelegram(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return;
  await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TG_CHAT,
      text,
      disable_web_page_preview: true,
    }),
  }).catch(() => {});
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key',
  };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    const url = new URL(req.url);

    // Health check
    if (req.method === 'GET' && url.pathname === '/') {
      return new Response('Aide notifier OK', { headers: corsHeaders() });
    }

    // Sync entries from the app
    if (req.method === 'POST' && url.pathname === '/sync') {
      const key = req.headers.get('X-Sync-Key');
      if (!key || key !== env.SYNC_KEY) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
      }
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response('Bad JSON', { status: 400, headers: corsHeaders() });
      }
      if (!Array.isArray(body?.entries)) {
        return new Response('entries[] required', { status: 400, headers: corsHeaders() });
      }
      await env.AIDE_KV.put('entries', JSON.stringify(body.entries));
      return new Response(
        JSON.stringify({ ok: true, count: body.entries.length, syncedAt: new Date().toISOString() }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
      );
    }

    // Manual digest trigger (for testing)
    if (req.method === 'POST' && url.pathname === '/digest') {
      const key = req.headers.get('X-Sync-Key');
      if (!key || key !== env.SYNC_KEY) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
      }
      const entries = JSON.parse((await env.AIDE_KV.get('entries')) ?? '[]');
      await runDigest(env, entries, /* force */ true);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },

  async scheduled(_event, env, _ctx) {
    const entriesRaw = await env.AIDE_KV.get('entries');
    if (!entriesRaw) return;
    const entries = JSON.parse(entriesRaw);
    if (!Array.isArray(entries)) return;

    const sent = JSON.parse((await env.AIDE_KV.get('sent')) ?? '[]');
    const today = kstDateString();
    const d = nowKST();
    const curHour = d.getUTCHours(); // KST hour (because we shifted)
    const curMin = d.getUTCMinutes();

    // 1) Time-specific reminders
    for (const e of entries) {
      if (!e || e.done || e.archived) continue;
      if (e.date !== today) continue;
      if (!e.time || !/^\d{2}:\d{2}$/.test(e.time)) continue;
      const sentKey = e.id + ':' + today;
      if (sent.includes(sentKey)) continue;

      const [h, m] = e.time.split(':').map(Number);
      // Fire if we're at the target minute or just past it (0..1 min late)
      const targetMinutes = h * 60 + m;
      const nowMinutes = curHour * 60 + curMin;
      const diff = nowMinutes - targetMinutes;
      if (diff < 0 || diff > 1) continue;

      const text = `⏰ ${e.time} ${e.title}` + (e.summary ? `\n\n${e.summary}` : '');
      await sendTelegram(env, text);
      sent.push(sentKey);
    }

    // 2) Daily digest at 09:00 KST
    if (curHour === 9 && curMin < 2) {
      await runDigest(env, entries, false, sent, today);
    }

    // Trim sent entries older than 7 days
    const cutoff = kstDateString(new Date(Date.now() + KST_OFFSET_MS - 7 * 24 * 60 * 60 * 1000));
    const trimmed = sent.filter((s) => {
      const idx = s.lastIndexOf(':');
      if (idx < 0) return false;
      return s.slice(idx + 1) >= cutoff;
    });
    await env.AIDE_KV.put('sent', JSON.stringify(trimmed));
  },
};

async function runDigest(env, entries, force, sentIn, todayIn) {
  const today = todayIn ?? kstDateString();
  const sent = sentIn ?? JSON.parse((await env.AIDE_KV.get('sent')) ?? '[]');
  const digestKey = 'digest:' + today;
  if (!force && sent.includes(digestKey)) return;

  const todayItems = entries
    .filter((e) => e && !e.done && !e.archived && e.date === today)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  const overdue = entries.filter(
    (e) => e && !e.done && !e.archived && e.date && e.date < today,
  );

  if (todayItems.length === 0 && overdue.length === 0 && !force) {
    sent.push(digestKey);
    if (!sentIn) await env.AIDE_KV.put('sent', JSON.stringify(sent));
    return;
  }

  let text = '🗓 Aide — 오늘 일정';
  if (todayItems.length > 0) {
    text += '\n';
    todayItems.forEach((e) => {
      const t = e.time ? e.time + ' ' : '';
      text += `\n• ${t}${e.title}`;
    });
  } else if (force) {
    text += '\n\n오늘 등록된 일정은 없어요.';
  }
  if (overdue.length > 0) {
    text += `\n\n⚠️ 지난 미완료 ${overdue.length}건`;
    overdue.slice(0, 5).forEach((e) => {
      text += `\n• ${e.date} ${e.title}`;
    });
  }
  text += '\n\nhttps://songchankeun-ship-it.github.io/life-class/';

  await sendTelegram(env, text);
  if (!force) {
    sent.push(digestKey);
    if (!sentIn) await env.AIDE_KV.put('sent', JSON.stringify(sent));
  }
}
