export const statusLabels = {
  ready: '대기',
  later: '나중에',
  done: '참여함',
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
  { value: 'done', label: '참여완료' },
  { value: 'skipped', label: '제외' },
];

export const primaryFilters = [
  { value: 'ready', label: '대기', countKey: 'ready' },
  { value: 'todayDeadline', label: '마감순', countKey: 'todayDeadline' },
  { value: 'search', label: '검색', countKey: 'searchable' },
  { value: 'inbox', label: '응모함', countKey: 'inbox' },
];

export const utilityFilters = [
  { value: 'skipped', label: '제외', countKey: 'skipped' },
];

export const manageFilters = new Set(['inbox']);

export const filterTitles = {
  ready: '응모 대기 이벤트',
  todayDeadline: '마감일순 이벤트',
  search: '이벤트 검색',
  inbox: '응모함',
  skipped: '제외한 이벤트',
};

export function getFilterLabel(item) {
  return item.label;
}

export function getFilterTitle(filter) {
  return filterTitles[filter];
}
