import { useState } from 'react';
import type {
  AppData,
  Condition,
  DailyCheckIn as DailyCheckInType,
  DailyPlan,
  TimeAvailability,
} from '../types';
import { CONDITION_LABEL, TIME_LABEL } from '../types';
import { SectionCard } from './SectionCard';
import { generateDailyPlan } from '../utils/planner';
import { todayISO } from '../utils/date';

interface DailyCheckInProps {
  data: AppData;
  onSave: (checkIn: DailyCheckInType, plan: DailyPlan) => void;
  onDone: () => void;
}

export function DailyCheckIn({ data, onSave, onDone }: DailyCheckInProps) {
  const today = todayISO();
  const existing = data.checkIns[today];

  const [condition, setCondition] = useState<Condition>(existing?.condition ?? 'normal');
  const [timeAvailability, setTimeAvailability] = useState<TimeAvailability>(
    existing?.timeAvailability ?? 'normal',
  );
  const [taskListText, setTaskListText] = useState<string>(
    (existing?.taskList ?? []).join('\n'),
  );
  const [worry, setWorry] = useState<string>(existing?.worry ?? '');
  const [mustDo, setMustDo] = useState<string>(existing?.mustDo ?? '');
  const [oneToFinish, setOneToFinish] = useState<string>(
    existing?.oneToFinish ?? '',
  );
  const [willExercise, setWillExercise] = useState<boolean>(
    existing?.willExercise ?? false,
  );
  const [note, setNote] = useState<string>(existing?.note ?? '');

  const handleGenerate = () => {
    const checkIn: DailyCheckInType = {
      date: today,
      condition,
      timeAvailability,
      taskList: taskListText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      worry: worry.trim(),
      mustDo: mustDo.trim(),
      oneToFinish: oneToFinish.trim(),
      willExercise,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };
    const plan = generateDailyPlan(checkIn, data.projects);
    onSave(checkIn, plan);
    onDone();
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="아침 체크인"
        subtitle="머릿속을 비우는 게 목표예요. 떠오르는 대로 적어주세요."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 컨디션 */}
          <div>
            <div className="lc-section-title mb-2">오늘 컨디션</div>
            <SegBar
              options={(['good', 'normal', 'bad'] as Condition[]).map((c) => ({
                value: c,
                label: CONDITION_LABEL[c],
              }))}
              value={condition}
              onChange={(v) => setCondition(v)}
            />
          </div>

          {/* 시간 여유 */}
          <div>
            <div className="lc-section-title mb-2">오늘 시간 여유</div>
            <SegBar
              options={(['much', 'normal', 'little'] as TimeAvailability[]).map((c) => ({
                value: c,
                label: TIME_LABEL[c],
              }))}
              value={timeAvailability}
              onChange={(v) => setTimeAvailability(v)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="오늘 떠오르는 할 일"
        subtitle="줄바꿈으로 여러 개 입력할 수 있어요. 큰 프로젝트명도 그대로 적어도 좋아요."
      >
        <textarea
          className="lc-input min-h-[140px]"
          placeholder={`예시:\n트레이딩 봇 손실 제한 기준 정하기\n이사업체 견적 비교표 채우기\n구독 정리`}
          value={taskListText}
          onChange={(e) => setTaskListText(e.target.value)}
        />
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard
          title="오늘 꼭 끝내고 싶은 일 1개"
          subtitle="이건 1교시에 우선 배치됩니다."
        >
          <input
            className="lc-input"
            placeholder="예: 이사업체 한 곳 확정 통화"
            value={oneToFinish}
            onChange={(e) => setOneToFinish(e.target.value)}
          />
        </SectionCard>

        <SectionCard
          title="오늘 미루면 안 되는 일"
          subtitle="마감/약속/돈 관련처럼 미루면 문제가 되는 일."
        >
          <input
            className="lc-input"
            placeholder="예: 카드 자동결제 멈춤 신청"
            value={mustDo}
            onChange={(e) => setMustDo(e.target.value)}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SectionCard title="오늘 걱정되는 일" subtitle="여기에 적기만 해도 머리가 가벼워집니다.">
          <textarea
            className="lc-input min-h-[90px]"
            placeholder="예: 보관이사 비용이 너무 클까봐 걱정"
            value={worry}
            onChange={(e) => setWorry(e.target.value)}
          />
        </SectionCard>

        <SectionCard title="기타" subtitle="운동과 한 줄 메모">
          <label className="flex items-center gap-2 text-sm lc-text-deep mb-3">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-blue-mid)]"
              checked={willExercise}
              onChange={(e) => setWillExercise(e.target.checked)}
            />
            오늘 운동할 예정
          </label>
          <input
            className="lc-input"
            placeholder="오늘 한 줄 메모"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </SectionCard>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="lc-btn-ghost" onClick={onDone}>
          나중에
        </button>
        <button type="button" className="lc-btn-primary" onClick={handleGenerate}>
          오늘 시간표 만들기
        </button>
      </div>
    </div>
  );
}

interface SegBarProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}

function SegBar<T extends string>({ options, value, onChange }: SegBarProps<T>) {
  return (
    <div className="inline-flex bg-[var(--color-ivory-100)] rounded-xl p-1 w-full">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={
              'flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
              (active
                ? 'bg-white shadow lc-text-deep'
                : 'lc-text-soft hover:bg-white/60')
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
