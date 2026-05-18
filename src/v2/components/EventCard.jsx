import './EventCard.css';
import { Tag, Inline, Card } from './primitives.jsx';

const cx = (...c) => c.filter(Boolean).join(' ');

function pickDeadlineVariant(event) {
  const t = (event.deadlineText || '').toLowerCase();
  if (t.includes('오늘')) return 'danger';
  if (t.includes('내일')) return 'warn';
  return 'outline';
}

export function EventCard({ event, selected, onClick }) {
  const variant = selected
    ? 'accent'
    : (event.deadlineText || '').includes('오늘')
      ? 'urgent'
      : undefined;

  return (
    <Card
      interactive
      variant={variant}
      onClick={onClick}
      className={cx('v2-evcard', selected && 'v2-evcard--selected')}
    >
      <Inline style={{ justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
        <span className="v2-evcard__pf">{event.platform}</span>
        <Tag variant={pickDeadlineVariant(event)}>{event.deadlineText}</Tag>
      </Inline>

      <div className="v2-evcard__title">{event.title}</div>

      <Inline className="v2-evcard__meta">
        {event.prizeAmount && (
          <span className="v2-evcard__amt">{event.prizeAmount}</span>
        )}
        {event.totalWinnerCount != null && (
          <>
            <span className="v2-muted">·</span>
            <span className="v2-muted">{event.totalWinnerCount.toLocaleString('ko-KR')}명</span>
          </>
        )}
        {event.source && (
          <>
            <span className="v2-muted">·</span>
            <span className="v2-muted v2-evcard__source">{event.source}</span>
          </>
        )}
      </Inline>
    </Card>
  );
}
