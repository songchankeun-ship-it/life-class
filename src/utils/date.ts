// =============================================================
// 날짜 유틸
// =============================================================

export const todayISO = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatKoreanDate = (iso?: string): string => {
  const d = iso ? new Date(iso) : new Date();
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`;
};

export const daysBetween = (fromISO: string, toISO: string): number => {
  const a = new Date(fromISO);
  const b = new Date(toISO);
  const diff = b.getTime() - a.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export const dDayLabel = (targetISO: string, todayStr = todayISO()): string => {
  const diff = daysBetween(todayStr, targetISO);
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
};
