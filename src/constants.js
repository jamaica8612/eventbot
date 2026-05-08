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
  { value: 'later', label: '나중에' },
  { value: 'done', label: '참여완료' },
  { value: 'skipped', label: '제외' },
];

export const primaryFilters = [
  { value: 'now', label: '지금', countKey: 'now' },
  { value: 'home', label: '집에서', countKey: 'home' },
  { value: 'todayDeadline', label: '오늘마감', countKey: 'todayDeadline' },
  { value: 'inbox', label: '응모함', countKey: 'inbox' },
];

export const manageFilters = new Set(['inbox']);

export const filterTitles = {
  now: '지금 바로 딸깍',
  home: '집에서 처리할 이벤트',
  todayDeadline: '오늘 마감 이벤트',
  inbox: '응모함',
};

export function getFilterLabel(item) {
  return item.label;
}

export function getFilterTitle(filter) {
  return filterTitles[filter];
}
