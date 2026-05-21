import type { Entry } from '../types';

const ARCHIVE_AFTER_DAYS = 90; // 완료된 지 N일 지난 항목 자동 아카이브

/**
 * 완료된 지 ARCHIVE_AFTER_DAYS 일 이상 지난 entries 를 archived=true 로 마킹.
 * 새 entries 배열을 반환 (변경 있을 때만; 변경 없으면 동일 참조 반환).
 */
export function autoArchiveOldEntries(entries: Entry[]): Entry[] {
  const cutoffMs = Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  let changed = false;
  const next = entries.map((e) => {
    if (e.archived) return e;
    if (!e.done) return e;
    const updated = e.updatedAt ? new Date(e.updatedAt).getTime() : 0;
    if (updated < cutoffMs) {
      changed = true;
      return { ...e, archived: true };
    }
    return e;
  });
  return changed ? next : entries;
}

export function countArchived(entries: Entry[]): number {
  return entries.filter((e) => e.archived).length;
}

/** 사용자가 직접 아카이브 항목 모두 영구 삭제 */
export function purgeArchived(entries: Entry[]): Entry[] {
  return entries.filter((e) => !e.archived);
}

/** 사용자가 직접 아카이브 항목 모두 다시 보이게 (archived=false) */
export function unarchiveAll(entries: Entry[]): Entry[] {
  return entries.map((e) => (e.archived ? { ...e, archived: false } : e));
}
