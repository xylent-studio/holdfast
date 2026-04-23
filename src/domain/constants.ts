export const SCHEMA_VERSION = 3 as const;

export const LANES = [
  { key: 'work', label: 'Store / Work' },
  { key: 'health', label: 'Body' },
  { key: 'home', label: 'Home / Errands' },
  { key: 'people', label: 'Relationships' },
  { key: 'build', label: 'Build / Future' },
  { key: 'admin', label: 'Money / Admin' },
] as const;

export const NAV_ITEMS = [
  { path: '/now', label: 'Now' },
  { path: '/inbox', label: 'Inbox' },
  { path: '/upcoming', label: 'Upcoming' },
  { path: '/review', label: 'Review' },
] as const;

export const READINESS_CHECKS = [
  { key: 'water', label: 'Water' },
  { key: 'food', label: 'Food' },
  { key: 'supplements', label: 'Supplements' },
  { key: 'hygiene', label: 'Hygiene' },
  { key: 'movement', label: 'Movement' },
  { key: 'sleepSetup', label: 'Sleep setup' },
] as const;

export const ITEM_STATUS_LABELS = {
  inbox: 'Inbox',
  today: 'Now',
  upcoming: 'Upcoming',
  waiting: 'Waiting on',
  done: 'Done',
  archived: 'Archived',
} as const;

export const ITEM_KIND_LABELS = {
  capture: 'Capture',
  task: 'Task',
  note: 'Note',
} as const;

export const LIST_KIND_LABELS = {
  replenishment: 'Replenishment',
  checklist: 'Checklist',
  project: 'Project',
  reference: 'Reference',
} as const;

export const SETTINGS_ROW_ID = 'settings' as const;
export const SYNC_STATE_ROW_ID = 'sync' as const;
export const WORKSPACE_STATE_ROW_ID = 'workspace' as const;
