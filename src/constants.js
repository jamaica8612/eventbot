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
  { value: 'done', label: '완료', countKey: 'done' },
  { value: 'todayAnnouncement', label: '오늘발표', countKey: 'todayAnnouncement' },
  { value: 'won', label: '당첨', countKey: 'won' },
];

export const manageFilters = new Set(['done', 'todayAnnouncement', 'won']);

export const filterTitles = {
  now: '지금 바로 딸깍',
  home: '집에서 처리할 이벤트',
  done: '참여완료한 이벤트',
  todayAnnouncement: '오늘 당첨자 발표',
  won: '당첨 관리',
};

export function getFilterLabel(item) {
  if (item.value === 'todayAnnouncement') return '결과';
  return item.label;
}

export function getFilterTitle(filter) {
  if (filter === 'todayAnnouncement') return '결과 확인';
  if (filter === 'done') return '참여완료 관리';
  if (filter === 'won') return '당첨 장부';
  return filterTitles[filter];
}
