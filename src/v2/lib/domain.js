/* ============================================================
   당첨노트 v2 — UI 도메인 헬퍼 (라벨/tone/표시 포맷)
   계산·정렬은 현재 앱 모델(eventModel/deadlineModel/format)을 재사용하고,
   여기서는 UI가 기대하는 {label, tone, priority} 표시 형태만 만든다.
   ※ deadlineMeta/announceMeta/inboxSortKey 등은 단계 3에서 추가.
   ============================================================ */

// 플랫폼 배지 메타 (자기완결, 현재 앱에 대응물 없어 프로토타입 util.js에서 이식)
// 입력은 'youtube' | 'naver' | 'home' (어댑터 toEv가 정규화), 그 외는 fallback
export function platformMeta(p) {
  return (
    {
      youtube: { label: 'YouTube', short: 'YT', c: 'var(--yt)', weak: 'var(--yt-weak)' },
      naver: { label: '네이버', short: 'N', c: 'var(--naver)', weak: 'var(--naver-weak)' },
      home: { label: '슈퍼투데이', short: '슈', c: 'var(--home)', weak: 'var(--home-weak)' },
    }[p] || { label: p || '기타', short: '?', c: 'var(--text-3)', weak: 'var(--surface-3)' }
  );
}
