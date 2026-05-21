export const statusLabels = {
  ready: '대기',
  later: '임시저장',
  done: '응모완료',
  skipped: '제외',
};

export const resultLabels = {
  unknown: '결과 미확인',
  won: '당첨',
  lost: '미당첨',
};

export const receiptLabels = {
  unclaimed: '미수령',
  requested: '수령요청',
  received: '수령완료',
};

export const statusActions = [
  { value: 'done', label: '응모완료' },
  { value: 'later', label: '임시저장' },
  { value: 'skipped', label: '제외' },
];

export const primaryFilters = [
  { value: 'ready', label: '응모대기', countKey: 'ready' },
  { value: 'todayDeadline', label: '오늘마감', countKey: 'todayDeadline' },
  { value: 'inbox', label: '응모함', countKey: 'inbox' },
  { value: 'todayAnnouncement', label: '오늘발표', countKey: 'todayAnnouncement' },
  { value: 'gifticon', label: '기프티콘', countKey: 'gifticon' },
];

export const utilityFilters = [
  { value: 'later', label: '임시저장', countKey: 'later' },
  { value: 'search', label: '검색', countKey: 'searchable' },
  { value: 'skipped', label: '제외', countKey: 'skipped' },
];

export const manageFilters = new Set(['inbox', 'gifticon']);

export const filterTitles = {
  ready: '응모 대기 이벤트',
  todayDeadline: '오늘 마감 이벤트',
  todayAnnouncement: '오늘 발표',
  gifticon: '기프티콘',
  later: '임시저장 이벤트',
  search: '이벤트 검색',
  inbox: '응모함',
  admin: '관리자',
  skipped: '제외한 이벤트',
};

export function getFilterLabel(item) {
  return item.label;
}

export function getFilterTitle(filter) {
  return filterTitles[filter];
}
