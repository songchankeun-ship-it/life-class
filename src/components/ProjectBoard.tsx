import { useState } from 'react';
import type {
  AppData,
  Importance,
  Project,
  ProjectStatus,
  TaskCategory,
  Urgency,
} from '../types';
import {
  CATEGORY_LABEL,
  IMPORTANCE_LABEL,
  PROJECT_STATUS_LABEL,
  URGENCY_LABEL,
} from '../types';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';

interface ProjectBoardProps {
  data: AppData;
  onUpdateProjects: (projects: Project[]) => void;
}

const blankProject = (): Project => ({
  id: `proj-${Math.random().toString(36).slice(2, 10)}`,
  name: '',
  category: 'project',
  status: 'active',
  importance: 'mid',
  urgency: 'mid',
  description: '',
  nextAction: '',
  memo: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function ProjectBoard({ data, onUpdateProjects }: ProjectBoardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Project | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const projects = data.projects;
  const filtered = projects.filter((p) =>
    showCompleted ? true : !p.completed && p.status !== 'done',
  );

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setDraft({ ...p });
  };

  const startNew = () => {
    const p = blankProject();
    setEditingId(p.id);
    setDraft(p);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      cancelEdit();
      return;
    }
    const existing = projects.find((p) => p.id === draft.id);
    const stamp = new Date().toISOString();
    const next: Project[] = existing
      ? projects.map((p) =>
          p.id === draft.id ? { ...draft, updatedAt: stamp } : p,
        )
      : [...projects, { ...draft, updatedAt: stamp }];
    onUpdateProjects(next);
    cancelEdit();
  };

  const toggleComplete = (id: string) => {
    onUpdateProjects(
      projects.map((p) =>
        p.id === id
          ? {
              ...p,
              completed: !p.completed,
              status: !p.completed ? 'done' : 'active',
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  };

  const togglePause = (id: string) => {
    onUpdateProjects(
      projects.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === 'paused' ? 'active' : 'paused',
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
  };

  const deleteProject = (id: string) => {
    if (!confirm('이 프로젝트를 삭제할까요?')) return;
    onUpdateProjects(projects.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="프로젝트"
        subtitle="다음 행동 1개를 정확히 적어두는 게 핵심입니다."
        right={
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-1.5 text-xs lc-text-soft">
              <input
                type="checkbox"
                className="size-3.5 accent-[var(--color-blue-mid)]"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              완료 포함
            </label>
            <button type="button" className="lc-btn-primary" onClick={startNew}>
              프로젝트 추가
            </button>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState title="아직 프로젝트가 없어요" />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((p) => (
              <li
                key={p.id}
                className={
                  'lc-card p-4 sm:p-5 flex flex-col gap-3 transition-opacity ' +
                  (p.completed ? 'opacity-60' : '')
                }
              >
                {editingId === p.id && draft ? (
                  <ProjectEditor
                    draft={draft}
                    setDraft={setDraft}
                    onSave={saveDraft}
                    onCancel={cancelEdit}
                  />
                ) : (
                  <ProjectView
                    project={p}
                    onEdit={() => startEdit(p)}
                    onToggleComplete={() => toggleComplete(p.id)}
                    onTogglePause={() => togglePause(p.id)}
                    onDelete={() => deleteProject(p.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {editingId &&
          draft &&
          !projects.find((p) => p.id === editingId) && (
            <div className="mt-4 lc-card p-4 sm:p-5">
              <ProjectEditor
                draft={draft}
                setDraft={setDraft}
                onSave={saveDraft}
                onCancel={cancelEdit}
              />
            </div>
          )}
      </SectionCard>
    </div>
  );
}

interface ProjectViewProps {
  project: Project;
  onEdit: () => void;
  onToggleComplete: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
}

function ProjectView({
  project,
  onEdit,
  onToggleComplete,
  onTogglePause,
  onDelete,
}: ProjectViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3
            className={
              'text-base font-semibold ' +
              (project.completed ? 'line-through lc-text-soft' : 'lc-text-deep')
            }
          >
            {project.name}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="lc-chip bg-[var(--color-ivory-100)] lc-text-soft">
              {CATEGORY_LABEL[project.category]}
            </span>
            <span className="lc-chip bg-[#e9f0f8] lc-text-blue">
              {PROJECT_STATUS_LABEL[project.status]}
            </span>
            <span className="lc-chip bg-[#f5ece0] text-[var(--color-accent-warm)]">
              중요 {IMPORTANCE_LABEL[project.importance]}
            </span>
            <span className="lc-chip bg-[#f1e8e8] text-[var(--color-danger)]">
              긴급 {URGENCY_LABEL[project.urgency]}
            </span>
          </div>
        </div>
      </header>

      {project.description && (
        <p className="text-sm lc-text-soft whitespace-pre-line">
          {project.description}
        </p>
      )}

      <div className="rounded-xl bg-[var(--color-ivory-50)] p-3 text-sm lc-text-deep">
        <span className="lc-text-soft text-xs mr-2">다음 행동</span>
        {project.nextAction || (
          <span className="lc-text-soft">아직 정해지지 않음</span>
        )}
      </div>

      {project.memo && (
        <p className="text-xs lc-text-soft whitespace-pre-line">
          📝 {project.memo}
        </p>
      )}

      <footer className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="lc-btn-ghost" onClick={onEdit}>
          수정
        </button>
        <button
          type="button"
          className="lc-btn-ghost"
          onClick={onToggleComplete}
        >
          {project.completed ? '완료 해제' : '완료'}
        </button>
        <button type="button" className="lc-btn-ghost" onClick={onTogglePause}>
          {project.status === 'paused' ? '보류 해제' : '보류'}
        </button>
        <button type="button" className="lc-btn-danger" onClick={onDelete}>
          삭제
        </button>
      </footer>
    </div>
  );
}

interface ProjectEditorProps {
  draft: Project;
  setDraft: (p: Project) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ProjectEditor({ draft, setDraft, onSave, onCancel }: ProjectEditorProps) {
  const set = <K extends keyof Project>(key: K, v: Project[K]) =>
    setDraft({ ...draft, [key]: v });

  return (
    <div className="space-y-3">
      <input
        className="lc-input"
        placeholder="프로젝트명"
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        autoFocus
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          className="lc-input"
          value={draft.category}
          onChange={(e) => set('category', e.target.value as TaskCategory)}
        >
          {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          className="lc-input"
          value={draft.status}
          onChange={(e) => set('status', e.target.value as ProjectStatus)}
        >
          {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          className="lc-input"
          value={draft.importance}
          onChange={(e) => set('importance', e.target.value as Importance)}
        >
          {(Object.keys(IMPORTANCE_LABEL) as Importance[]).map((i) => (
            <option key={i} value={i}>
              중요도: {IMPORTANCE_LABEL[i]}
            </option>
          ))}
        </select>
        <select
          className="lc-input"
          value={draft.urgency}
          onChange={(e) => set('urgency', e.target.value as Urgency)}
        >
          {(Object.keys(URGENCY_LABEL) as Urgency[]).map((u) => (
            <option key={u} value={u}>
              긴급도: {URGENCY_LABEL[u]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className="lc-input min-h-[80px]"
        placeholder="설명"
        value={draft.description}
        onChange={(e) => set('description', e.target.value)}
      />
      <input
        className="lc-input"
        placeholder="다음 행동 1개 (예: 손실 제한 기준 3개 적기)"
        value={draft.nextAction}
        onChange={(e) => set('nextAction', e.target.value)}
      />
      <textarea
        className="lc-input min-h-[60px]"
        placeholder="메모"
        value={draft.memo}
        onChange={(e) => set('memo', e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <button type="button" className="lc-btn-ghost" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="lc-btn-primary" onClick={onSave}>
          저장
        </button>
      </div>
    </div>
  );
}
