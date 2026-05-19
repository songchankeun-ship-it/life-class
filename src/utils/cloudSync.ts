/**
 * Cloud notifier (Cloudflare Worker) 연동.
 * - URL + sync key 가 설정되어 있을 때만 동작
 * - entries 가 변할 때마다 디바운스해서 POST
 * - 실패해도 silent (앱 사용에 지장 없게)
 */
import type { Entry } from '../types';

const URL_KEY = 'lifeclass_cloud_url';
const KEY_KEY = 'lifeclass_cloud_key';
const LAST_HASH_KEY = 'lifeclass_cloud_last_hash';

export function getCloudConfig(): { url: string; key: string } {
  if (typeof window === 'undefined') return { url: '', key: '' };
  return {
    url: window.localStorage.getItem(URL_KEY) ?? '',
    key: window.localStorage.getItem(KEY_KEY) ?? '',
  };
}

export function setCloudConfig(url: string, key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(URL_KEY, url);
  window.localStorage.setItem(KEY_KEY, key);
}

function stableHash(entries: Entry[]): string {
  // 가벼운 해시 — 매번 같은 데이터면 sync 생략
  const compact = entries.map((e) => [
    e.id,
    e.title,
    e.category,
    e.date ?? '',
    e.time ?? '',
    e.done ? 1 : 0,
    e.archived ? 1 : 0,
    e.needsReminder ? 1 : 0,
  ]);
  return JSON.stringify(compact);
}

let syncTimer: number | null = null;

export function scheduleSync(entries: Entry[]): void {
  if (typeof window === 'undefined') return;
  const { url, key } = getCloudConfig();
  if (!url || !key) return;
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = null;
  }
  // 1.5초 debounce — 사용자가 빠르게 여러 번 수정해도 한 번에
  syncTimer = window.setTimeout(() => {
    void syncNow(entries);
  }, 1500);
}

export async function syncNow(entries: Entry[]): Promise<{ ok: boolean; message: string }> {
  const { url, key } = getCloudConfig();
  if (!url || !key) return { ok: false, message: '설정 안 됨' };
  try {
    const hash = stableHash(entries);
    const lastHash = window.localStorage.getItem(LAST_HASH_KEY);
    if (hash === lastHash) return { ok: true, message: '변경 없음' };

    const endpoint = url.replace(/\/+$/, '') + '/sync';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': key,
      },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, message: `${res.status}: ${t.slice(0, 100)}` };
    }
    window.localStorage.setItem(LAST_HASH_KEY, hash);
    const j = await res.json().catch(() => ({}));
    return { ok: true, message: `Synced ${(j as { count?: number }).count ?? entries.length}건` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function pingCloud(): Promise<{ ok: boolean; message: string }> {
  const { url } = getCloudConfig();
  if (!url) return { ok: false, message: 'URL 없음' };
  try {
    const endpoint = url.replace(/\/+$/, '') + '/';
    const res = await fetch(endpoint);
    const t = await res.text();
    return { ok: res.ok, message: `${res.status}: ${t.slice(0, 80)}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function triggerDigest(): Promise<{ ok: boolean; message: string }> {
  const { url, key } = getCloudConfig();
  if (!url || !key) return { ok: false, message: '설정 안 됨' };
  try {
    const endpoint = url.replace(/\/+$/, '') + '/digest';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'X-Sync-Key': key },
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, message: `${res.status}: ${t.slice(0, 80)}` };
    }
    return { ok: true, message: '디지스트 요청 보냄' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
