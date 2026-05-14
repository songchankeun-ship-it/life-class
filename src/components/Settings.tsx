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
