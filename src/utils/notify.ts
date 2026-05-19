import type { Entry } from '../types';
import { todayISO } from './date';

const TG_TOKEN_KEY = 'lifeclass_tg_token';
const TG_CHAT_KEY = 'lifeclass_tg_chat';
const LAST_DIGEST_KEY = 'lifeclass_tg_last_digest';
const SENT_REMINDER_KEY = 'lifeclass_tg_sent_reminders'; // Set 으로 직렬화

// === 설정 저장 ===
export function getTelegramConfig(): { token: string; chat: string } {
  if (typeof window === 'undefined') return { token: '', chat: '' };
  return {
    token: window.localStorage.getItem(TG_TOKEN_KEY) ?? '',
    chat: window.localStorage.getItem(TG_CHAT_KEY) ?? '',
  };
}

export function setTelegramConfig(token: string, chat: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TG_TOKEN_KEY, token);
  window.localStorage.setItem(TG_CHAT_KEY, chat);
}

// === Telegram 전송 ===
export async function sendTelegram(text: string): Promise<void> {
  const { token, chat } = getTelegramConfig();
  if (!token || !chat) throw new Error('텔레그램 설정이 비어있어요');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`텔레그램 실패 (${res.status}): ${t.slice(0, 100)}`);
  }
}

// === 오늘 일정 다이제스트 ===
export function buildDailyDigest(entries: Entry[]): string | null {
  const today = todayISO();
  const todayEntries = entries
    .filter((e) => !e.done && !e.archived && e.date === today)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  const overdue = entries
    .filter((e) => !e.done && !e.archived && e.date && e.date < today);
  if (todayEntries.length === 0 && overdue.length === 0) return null;

  const lines: string[] = ['🗓 Aide — 오늘 일정'];
  if (todayEntries.length > 0) {
    lines.push('');
    todayEntries.forEach((e) => {
      const t = e.time ? e.time + ' ' : '';
      lines.push(`• ${t}${e.title}`);
    });
  }
  if (overdue.length > 0) {
    lines.push('');
    lines.push(`⚠️ 지난 미완료 ${overdue.length}건`);
    overdue.slice(0, 5).forEach((e) => {
      lines.push(`• ${e.date} ${e.title}`);
    });
  }
  lines.push('');
  lines.push('https://songchankeun-ship-it.github.io/life-class/');
  return lines.join('\n');
}

// 아침 다이제스트 자동 발송 (앱 열릴 때 한 번)
export function getLastDigestDate(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(LAST_DIGEST_KEY) ?? '';
}
export function setLastDigestDate(date: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_DIGEST_KEY, date);
}

// === 개별 알림 추적 (한 번만 보내기) ===
function getSentSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SENT_REMINDER_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
function saveSentSet(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  // 오래된 ID (어제 이전 날짜) 청소. ID 포맷: "entryId:YYYY-MM-DD"
  const today = todayISO();
  const trimmed = Array.from(set).filter((id) => {
    const idx = id.lastIndexOf(':');
    if (idx < 0) return false;
    const datePart = id.slice(idx + 1);
    return datePart >= today;
  });
  window.localStorage.setItem(SENT_REMINDER_KEY, JSON.stringify(trimmed));
}

export function hasReminderSent(entryId: string): boolean {
  return getSentSet().has(entryId + ':' + todayISO());
}
export function markReminderSent(entryId: string): void {
  const set = getSentSet();
  set.add(entryId + ':' + todayISO());
  saveSentSet(set);
}

/**
 * 임박한 entry 알림 스케줄링 (앱 열려있을 때만 동작).
 * - 오늘 날짜이고 time 이 있고 needsReminder 인 것 중
 * - 아직 시간이 안 지났고
 * - 오늘 이미 안 보낸 것
 * 을 setTimeout 으로 예약. 반환값은 cleanup 함수.
 */
export function scheduleEntryReminders(entries: Entry[]): () => void {
  const today = todayISO();
  const now = new Date();
  const handles: number[] = [];
  entries.forEach((e) => {
    if (e.done || e.archived) return;
    if (!e.needsReminder) return;
    if (e.date !== today) return;
    if (!e.time) return;
    if (hasReminderSent(e.id)) return;
    // time = "HH:MM"
    const [h, m] = e.time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const ms = target.getTime() - now.getTime();
    if (ms < 0) return; // 이미 지난 시간
    if (ms > 12 * 60 * 60 * 1000) return; // 12시간 이상은 setTimeout 신뢰도 낮음

    const handle = window.setTimeout(() => {
      const msg = `⏰ ${e.time} ${e.title}\n\n${e.summary ?? ''}`;
      sendTelegram(msg.trim())
        .then(() => markReminderSent(e.id))
        .catch((err) => console.warn('reminder fail', err));
    }, ms);
    handles.push(handle);
  });
  return () => {
    handles.forEach((h) => window.clearTimeout(h));
  };
}

/**
 * 앱 열렸을 때 한 번 호출: 오늘 디지스트를 아직 안 보냈으면 보냄.
 */
export async function autoDailyDigest(entries: Entry[]): Promise<boolean> {
  const today = todayISO();
  if (getLastDigestDate() === today) return false;
  const { token, chat } = getTelegramConfig();
  if (!token || !chat) return false;
  const text = buildDailyDigest(entries);
  if (!text) {
    // 보낼 게 없어도 "보낸 것"으로 마킹해서 같은 날 재시도 안 함
    setLastDigestDate(today);
    return false;
  }
  try {
    await sendTelegram(text);
    setLastDigestDate(today);
    return true;
  } catch (err) {
    console.warn('digest send fail', err);
    return false;
  }
}
