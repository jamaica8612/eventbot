import { getAnnouncementStatus } from '../utils/eventModel.js';

export function ApplyLink({ className, url, label = '참여하기' }) {
  function handleApplyClick(clickEvent) {
    clickEvent.stopPropagation();
    if (!url) {
      clickEvent.preventDefault();
      return;
    }
  }

  return (
    <a
      className={className}
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleApplyClick}
    >
      {label}
    </a>
  );
}

export function AnnouncementPanel({ event, onAnnouncementChange }) {
  const announcement = getAnnouncementStatus(event);
  return (
    <section className={`announcement-panel announcement-${announcement.state}`}>
      <div>
        <span>발표관리</span>
        <strong>{announcement.label}</strong>
      </div>
      <label>
        <span>발표일</span>
        <input
          type="date"
          value={event.resultAnnouncementDate ?? ''}
          onChange={(changeEvent) =>
            onAnnouncementChange(event.id, {
              resultAnnouncementDate: changeEvent.target.value,
            })
          }
        />
      </label>
      <label>
        <span>메모</span>
        <input
          placeholder="예: 공지사항 확인, 문자 발표"
          value={event.resultAnnouncementText ?? ''}
          onChange={(changeEvent) =>
            onAnnouncementChange(event.id, {
              resultAnnouncementText: changeEvent.target.value,
            })
          }
        />
      </label>
    </section>
  );
}
