import type { AppData } from '../types';
import {
  buildDefaultAppData,
  defaultMoveChecklist,
  defaultProjects,
  defaultSpots,
} from '../data/defaultData';

export const STORAGE_KEYS = {
  tasks: 'lifeclass_tasks',
  projects: 'lifeclass_projects',
  dailyPlans: 'lifeclass_daily_plans',
  checkIns: 'lifeclass_check_ins',
  parking: 'lifeclass_parking_lot',
  moveChecklist: 'lifeclass_move_checklist',
  subscriptions: 'lifeclass_subscriptions',
  reviews: 'lifeclass_reviews',
  spots: 'lifeclass_spots',
  purchases: 'lifeclass_purchases',
  journals: 'lifeclass_journals',
  chatMessages: 'lifeclass_chat',
  aiApiKey: 'lifeclass_ai_key',
  settings: 'lifeclass_settings',
} as const;

type StorageKey = keyof typeof STORAGE_KEYS;

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function getStorageItem<T>(key: StorageKey, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[key]);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('[storage] read failed: ' + key, err);
    return fallback;
  }
}

export function setStorageItem<T>(key: StorageKey, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
  } catch (err) {
    console.warn('[storage] write failed: ' + key, err);
  }
}

export function removeStorageItem(key: StorageKey): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEYS[key]);
}

export function initializeDefaultData(): AppData {
  const base = buildDefaultAppData();
  if (getStorageItem('projects', null) === null) setStorageItem('projects', base.projects);
  if (getStorageItem('moveChecklist', null) === null) setStorageItem('moveChecklist', base.moveChecklist);
  if (getStorageItem('subscriptions', null) === null) setStorageItem('subscriptions', base.subscriptions);
  if (getStorageItem('spots', null) === null) setStorageItem('spots', base.spots);
  if (getStorageItem('purchases', null) === null) setStorageItem('purchases', base.purchases);
  if (getStorageItem('settings', null) === null) setStorageItem('settings', base.settings);
  return loadAllData();
}

export function loadAllData(): AppData {
  const base = buildDefaultAppData();
  return {
    tasks: getStorageItem('tasks', []),
    projects: getStorageItem('projects', base.projects),
    dailyPlans: getStorageItem('dailyPlans', {}),
    checkIns: getStorageItem('checkIns', {}),
    parking: getStorageItem('parking', []),
    moveChecklist: getStorageItem('moveChecklist', base.moveChecklist),
    subscriptions: getStorageItem('subscriptions', base.subscriptions),
    reviews: getStorageItem('reviews', {}),
    spots: getStorageItem('spots', base.spots),
    purchases: getStorageItem('purchases', []),
    journals: getStorageItem('journals', []),
    chatMessages: getStorageItem('chatMessages', []),
    settings: getStorageItem('settings', base.settings),
  };
}

export function saveAllData(data: AppData): void {
  setStorageItem('tasks', data.tasks);
  setStorageItem('projects', data.projects);
  setStorageItem('dailyPlans', data.dailyPlans);
  setStorageItem('checkIns', data.checkIns);
  setStorageItem('parking', data.parking);
  setStorageItem('moveChecklist', data.moveChecklist);
  setStorageItem('subscriptions', data.subscriptions);
  setStorageItem('reviews', data.reviews);
  setStorageItem('spots', data.spots);
  setStorageItem('purchases', data.purchases);
  setStorageItem('journals', data.journals);
  setStorageItem('chatMessages', data.chatMessages);
  setStorageItem('settings', data.settings);
}

export function exportAllData(): string {
  const data = loadAllData();
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'life-class', data }, null, 2);
}

export function importAllData(json: string): AppData {
  const parsed = JSON.parse(json);
  const data: AppData = parsed?.data ?? parsed;
  if (!data || typeof data !== 'object') throw new Error('Invalid JSON');
  saveAllData(data);
  return data;
}

export function clearAllData(): void {
  (Object.keys(STORAGE_KEYS) as StorageKey[]).forEach((k) => removeStorageItem(k));
}

export function restoreDefaultProjects(): void {
  setStorageItem('projects', defaultProjects);
}

export function restoreDefaultMoveChecklist(): void {
  setStorageItem('moveChecklist', defaultMoveChecklist);
}

export function restoreDefaultSpots(): void {
  setStorageItem('spots', defaultSpots);
}
