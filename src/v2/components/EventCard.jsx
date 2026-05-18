import './EventCard.css';
import { Tag, Inline, Card } from './primitives.jsx';
import { PlatformThumb } from './PlatformChip.jsx';
import { Highlight } from './Highlight.jsx';
import { computeDeadlineMeta, todayISO } from '../lib/deadline.js';

const cx = (...c) => c.filter(Boolean).join(' ');

function statusTag(event, todayStr) {
  if (event.resultAnnouncementDate === todayStr && event.resultStatus === 'unknown' && event.status === 'done') {
    return <Tag variant="warn">⏰ 오늘 발표!</Tag>;
  }
  if (event.resultStatus === 'won')  return <Tag variant="success">🏆 당첨{event.receiptStatus === 'unclaimed' ? ' · 미수령' : ''}</Tag>;
  if (event.resultStatus === 'lost') return <Tag variant="outline">미당첨</Tag>;
  if (event.status === 'done')       return <Tag>참여완료</Tag>;
  if (event.status === 'later')      return <Tag variant="warn">임시저장</Tag>;
  if (event.status === 'skipped')    return <Tag variant="outline">제외</Tag>;
  return null;
}

export function EventCard({ event, selected, onClick, query, now }) {
  const meta = computeDeadlineMeta(event.deadlineDate, now);
  const deadlineLabel = meta?.label ?? event.deadlineText ?? '';
  const deadlineVariant = meta?.variant === 'past' ? 'outline' : (meta?.variant ?? 'outline');
  const isToday = meta?.daysLeft === 0;
  const todayStr = todayISO(now);

  const variant = selected
    ? 'accent'
    : event.resultStatus === 'won'
      ? 'success'
      : isToday
        ? 'urgent'
        : undefined;

  const sTag = statusTag(event, todayStr);

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
          <Tag variant={deadlineVariant}>{deadlineLabel}</Tag>
          {sTag}
        </div>

        <div className="v2-evcard__title">
          <Highlight text={event.title} query={query} />
        </div>

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
              <span className="v2-evcard__source">
                <Highlight text={event.source} query={query} />
              </span>
            </>
          )}
        </Inline>
      </div>
    </Card>
  );
}
