import { useRef, useState } from 'react';
import type { AppData } from '../types';
import { SectionCard } from './SectionCard';
import { APP_NAME, APP_VERSION } from '../data/defaultData';
import {
  clearAllData,
  exportAllData,
  importAllData,
  restoreDefaultMoveChecklist,
  restoreDefaultProjects,
} from '../utils/storage';
import {
  buildDailyDigest,
  getTelegramConfig,
  sendTelegram,
  setTelegramConfig,
  setLastDigestDate,
} from '../utils/notify';
import { todayISO } from '../utils/date';

interface SettingsProps {
  data: AppData;
  onReload: () => void;
}

export function Settings({ data, onReload }: SettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const flash = (s: string) => {
    setMessage(s);
    setTimeout(() => setMessage(null), 2200);
  };

  const exportJson = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `life-class-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('JSON 백업 파일을 내보냈어요.');
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      importAllData(text);
      flash('가져오기 완료. 데이터가 복원됐어요.');
      onReload();
    } catch (err) {
      console.warn(err);
      alert('JSON 가져오기 실패: 파일 형식을 확인해주세요.');
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) importJson(f);
    if (fileRef.current) fileRef.current.value = '';
  };

  const reset = () => {
    if (!confirm('localStorage의 모든 데이터를 정말 초기화할까요?')) return;
    clearAllData();
    flash('데이터를 모두 초기화했어요.');
    onReload();
  };

  const reloadProjects = () => {
    if (!confirm('기본 프로젝트 데이터로 다시 불러올까요? 기존 프로젝트는 덮어써집니다.')) return;
    restoreDefaultProjects();
    flash('기본 프로젝트를 다시 불러왔어요.');
    onReload();
  };

  const reloadMove = () => {
    if (!confirm('기본 이사 체크리스트를 다시 불러올까요? 기존 항목은 덮어써집니다.')) return;
    restoreDefaultMoveChecklist();
    flash('기본 이사 체크리스트를 다시 불러왔어요.');
    onReload();
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="앱 정보"
        subtitle="현재 사용 중인 앱과 데이터 상태"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Info label="앱 이름" value={APP_NAME} />
          <Info label="버전" value={APP_VERSION} />
          <Info label="저장된 프로젝트" value={`${data.projects.length}개`} />
          <Info label="저장된 구독" value={`${data.subscriptions.length}개`} />
        </div>
      </SectionCard>

      <TelegramSection data={data} onFlash={flash} />

      <LegacyDataPreview data={data} />

      <SectionCard
        title="데이터 백업"
        subtitle="JSON으로 내보내고 다시 불러올 수 있어요. 이사처럼 큰 변화 전에는 꼭 백업해두세요."
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" className="lc-btn-primary" onClick={exportJson}>
            JSON 내보내기
          </button>
          <button
            type="button"
            className="lc-btn-ghost"
            onClick={() => fileRef.current?.click()}
          >
            JSON 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={onPickFile}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="복원 / 초기화"
        subtitle="기본 데이터로 되돌리거나 전체를 초기화합니다."
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" className="lc-btn-ghost" onClick={reloadProjects}>
            기본 프로젝트 다시 불러오기
          </button>
          <button type="button" className="lc-btn-ghost" onClick={reloadMove}>
            기본 이사 체크리스트 다시 불러오기
          </button>
          <button type="button" className="lc-btn-danger" onClick={reset}>
            전체 데이터 초기화
          </button>
        </div>
      </SectionCard>

      {message && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 lc-card px-4 py-2 text-sm lc-text-deep shadow-lg z-50">
          {message}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="lc-card p-3 flex flex-col gap-1">
      <div className="text-[11px] lc-text-soft">{label}</div>
      <div className="text-sm font-semibold lc-text-deep">{value}</div>
    </div>
  );
}

function LegacyDataPreview({ data }: { data: AppData }) {
  const [open, setOpen] = useState(false);

  const moveDone = data.moveChecklist.filter((m) => m.done).length;
  const movePct = data.moveChecklist.length
    ? Math.round((moveDone / data.moveChecklist.length) * 100)
    : 0;
  const activeSubs = data.subscriptions.filter((s) => s.usage !== 'cancelled');
  const subsTotal = activeSubs.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const now = new Date();
  const thisMonth = data.purchases.filter((p) => {
    if (p.status === 'returned') return false;
    const d = new Date(p.orderDate);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthTotal = thisMonth.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const purchaseTotalAll = data.purchases
    .filter((p) => p.status !== 'returned')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const importantSpots = data.spots.filter((s) => s.important);

  return (
    <SectionCard
      title="기존 데이터 한눈에 보기"
      subtitle="이전에 정리해둔 이사·구독·지정석·구매 기록을 여기서 확인하세요."
      right={
        <button type="button" className="lc-btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '펼치기'}
        </button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Info label="이사 진행률" value={`${movePct}%`} />
        <Info label="월 구독비" value={`${subsTotal.toLocaleString()}원`} />
        <Info label="이번달 구매" value={`${monthTotal.toLocaleString()}원`} />
        <Info label="누적 구매" value={`${purchaseTotalAll.toLocaleString()}원`} />
      </div>

      {open && (
        <div className="space-y-4 mt-4">
          <div>
            <div className="lc-section-title mb-2">
              이사 체크리스트 ({moveDone}/{data.moveChecklist.length})
            </div>
            <div className="text-[12px] lc-text-soft space-y-1 max-h-40 overflow-y-auto">
              {data.moveChecklist.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm border flex items-center justify-center text-[8px]"
                    style={{
                      borderColor: m.done ? 'var(--color-accent)' : 'var(--color-border)',
                      background: m.done ? 'var(--color-accent)' : 'transparent',
                      color: '#fff',
                    }}
                  >
                    {m.done ? '✓' : ''}
                  </span>
                  <span
                    className="flex-1 min-w-0 truncate"
                    style={{ textDecoration: m.done ? 'line-through' : 'none' }}
                  >
                    {m.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="lc-section-title mb-2">구독 ({activeSubs.length})</div>
            <div className="text-[12px] lc-text-soft space-y-1 max-h-40 overflow-y-auto">
              {activeSubs.map((s) => (
                <div key={s.id} className="flex justify-between gap-2">
                  <span className="truncate">{s.name}</span>
                  <span className="flex-shrink-0">{Number(s.amount).toLocaleString()}원</span>
                </div>
              ))}
              {activeSubs.length === 0 && <div className="lc-text-mute">활성 구독 없음</div>}
            </div>
          </div>

          <div>
            <div className="lc-section-title mb-2">지정석 ({data.spots.length})</div>
            <div className="text-[12px] lc-text-soft space-y-1.5 max-h-40 overflow-y-auto">
              {(importantSpots.length > 0 ? importantSpots : data.spots).map((s) => (
                <div key={s.id}>
                  <div className="lc-text-deep font-medium">{s.name}</div>
                  <div className="text-[11px] lc-text-mute">
                    {s.homeSpot && `집: ${s.homeSpot}`}
                    {s.homeSpot && s.carSpot && ' · '}
                    {s.carSpot && `차: ${s.carSpot}`}
                  </div>
                </div>
              ))}
              {data.spots.length === 0 && <div className="lc-text-mute">없음</div>}
            </div>
          </div>

          <div>
            <div className="lc-section-title mb-2">
              최근 구매 ({thisMonth.length}건 / 이번달)
            </div>
            <div className="text-[12px] lc-text-soft space-y-1 max-h-40 overflow-y-auto">
              {thisMonth.slice(0, 10).map((p) => (
                <div key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="flex-shrink-0">{Number(p.amount).toLocaleString()}원</span>
                </div>
              ))}
              {thisMonth.length === 0 && (
                <div className="lc-text-mute">이번달 구매 기록 없음</div>
              )}
            </div>
          </div>

          <div className="text-[11px] lc-text-mute pt-1 border-t border-[var(--color-border-soft)] mt-2">
            이 데이터는 그대로 저장되어 있어요. Aide 에게 "이번달 구매 얼마야?",
            "차키 어디 뒀더라?" 같이 물어보면 답해줍니다.
          </div>
        </div>
      )}
    </SectionCard>
  );
}

interface TelegramSectionProps {
  data: AppData;
  onFlash: (s: string) => void;
}

function TelegramSection({ data, onFlash }: TelegramSectionProps) {
  const initial = getTelegramConfig();
  const [token, setToken] = useState(initial.token);
  const [chat, setChat] = useState(initial.chat);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(!initial.token || !initial.chat);

  const save = () => {
    setTelegramConfig(token.trim(), chat.trim());
    onFlash('텔레그램 설정 저장됨');
    setOpen(false);
  };

  const test = async () => {
    setSending(true);
    try {
      setTelegramConfig(token.trim(), chat.trim());
      await sendTelegram('✅ Aide 텔레그램 연결 테스트입니다.');
      onFlash('테스트 메시지 전송됨');
    } catch (err) {
      alert('전송 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSending(false);
    }
  };

  const sendToday = async () => {
    setSending(true);
    try {
      const text = buildDailyDigest(data.entries);
      if (!text) {
        onFlash('오늘 보낼 일정이 없어요');
        return;
      }
      await sendTelegram(text);
      setLastDigestDate(todayISO());
      onFlash('오늘 일정 발송됨');
    } catch (err) {
      alert('전송 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSending(false);
    }
  };

  const configured = initial.token && initial.chat;

  return (
    <SectionCard
      title="텔레그램 알림"
      subtitle={
        configured
          ? '연결됨 — 앱을 열면 오늘 일정이 자동으로 텔레그램에 도착해요.'
          : '봇 토큰과 채팅 ID 를 등록하면 일정 알림이 텔레그램으로 와요.'
      }
      right={
        <button
          type="button"
          className="lc-btn-ghost"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '접기' : '설정'}
        </button>
      }
    >
      {open && (
        <div className="space-y-3">
          <label className="block">
            <span className="lc-section-title">Bot Token</span>
            <input
              className="lc-input mt-1"
              type="password"
              placeholder="123456789:AAGxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="lc-section-title">Chat ID</span>
            <input
              className="lc-input mt-1"
              placeholder="숫자 ID — @userinfobot 에게 /start 보내면 알려줘요"
              value={chat}
              onChange={(e) => setChat(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="lc-btn-primary"
              onClick={save}
              disabled={!token.trim() || !chat.trim()}
            >
              저장
            </button>
            <button
              type="button"
              className="lc-btn-ghost"
              onClick={test}
              disabled={!token.trim() || !chat.trim() || sending}
            >
              테스트 메시지
            </button>
          </div>
          <p className="text-[11px] lc-text-mute leading-relaxed">
            토큰은 이 폰의 브라우저에만 저장되고 어디로도 전송되지 않습니다.
            @BotFather 에서 봇 만들면 토큰을 줘요. 챗 ID 는 @userinfobot 에게
            /start 를 보내면 알려줍니다.
          </p>
        </div>
      )}
      {configured && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border-soft)] mt-3">
          <button
            type="button"
            className="lc-btn-ghost"
            onClick={sendToday}
            disabled={sending}
          >
            지금 오늘 일정 보내기
          </button>
        </div>
      )}
    </SectionCard>
  );
}
