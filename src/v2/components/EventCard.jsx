import './EventCard.css';
import { Tag, Inline, Card } from './primitives.jsx';
import { PlatformThumb } from './PlatformChip.jsx';

const cx = (...c) => c.filter(Boolean).join(' ');

function pickDeadlineVariant(event) {
  const t = (event.deadlineText || '').toLowerCase();
  if (t.includes('오늘')) return 'danger';
  if (t.includes('내일')) return 'warn';
  return 'outline';
}

function statusTag(event) {
  if (event.resultStatus === 'won')  return <Tag variant="success">🏆 당첨{event.receiptStatus === 'unclaimed' ? ' · 미수령' : ''}</Tag>;
  if (event.resultStatus === 'lost') return <Tag variant="outline">미당첨</Tag>;
  if (event.status === 'done')       return <Tag>참여완료</Tag>;
  if (event.status === 'later')      return <Tag variant="warn">임시저장</Tag>;
  if (event.status === 'skipped')    return <Tag variant="outline">제외</Tag>;
  return null;
}

export function EventCard({ event, selected, onClick }) {
  const variant = selected
    ? 'accent'
    : event.resultStatus === 'won'
      ? 'success'
      : (event.deadlineText || '').includes('오늘')
        ? 'urgent'
        : undefined;

  const sTag = statusTag(event);

  return (
    <Card
      interactive
      variant={variant}
      onClick={onClick}
      className={cx('v2-evcard', selected && 'v2-evcard--selected')}
    >
      <PlatformThumb platform={event.platform} />

      <div className="v2-evcard__main">
        <div className="v2-evcard__head">
          <Tag variant={pickDeadlineVariant(event)}>{event.deadlineText}</Tag>
          {sTag}
        </div>

        <div className="v2-evcard__title">{event.title}</div>

        <Inline className="v2-evcard__meta">
          {event.prizeAmount && <span className="v2-evcard__amt">{event.prizeAmount}</span>}
          {event.totalWinnerCount != null && (
            <>
              <span>·</span>
              <span>{event.totalWinnerCount.toLocaleString('ko-KR')}명</span>
            </>
          )}
          {event.source && (
            <>
              <span>·</span>
              <span className="v2-evcard__source">{event.source}</span>
            </>
          )}
        </Inline>
      </div>
    </Card>
  );
}
