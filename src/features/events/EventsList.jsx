import { useState } from 'react';
import { deadlineMeta, deadlineFilterMatch } from '../../lib/domain.js';
import { Chip, Empty } from '../../components/index.jsx';
import { EventCard } from './EventCard.jsx';

const SORTS = [
  { key: 'default',  label: '기본순' },
  { key: 'popular',  label: '인기순' },
  { key: 'winners',  label: '당첨자 많은순' },
  { key: 'deadline', label: '마감임박순' },
  { key: 'recent',   label: '최신수집순' },
];

function sortEvents(list, key) {
  const arr = [...list];
  const FAR = 9e15;
  if (key === 'popular') {
    arr.sort((a, b) => (b.bookmarkCount || 0) - (a.bookmarkCount || 0));
  } else if (key === 'winners') {
    arr.sort((a, b) => (b.winnerCount || 0) - (a.winnerCount || 0));
  } else if (key === 'deadline') {
    arr.sort((a, b) =>
      (a.deadlineDate ? new Date(a.deadlineDate) : FAR) -
      (b.deadlineDate ? new Date(b.deadlineDate) : FAR)
    );
  } else if (key === 'recent') {
    arr.sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
  }
  return arr;
}

export function EventsList({ events, onAction, onUpdate, query }) {
  const [sort, setSort] = useState('default');
  const list = sortEvents(events, sort);

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {SORTS.map(s => (
          <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>
            {s.label}
          </Chip>
        ))}
      </div>
      {list.length === 0
        ? <Empty icon="hourglass" title="이벤트가 없어요" sub="크롤러가 새 이벤트를 수집하면 여기에 표시됩니다." />
        : (
          <div style={{ display: 'grid', gap: 12 }}>
            {list.map(ev => (
              <EventCard key={ev.id} event={ev} onAction={onAction} onUpdate={onUpdate} query={query} />
            ))}
          </div>
        )
      }
    </div>
  );
}

const DL_CHIPS = [
  { key: 'all',     label: '전체' },
  { key: 'today',   label: '오늘',      tone: 'urgent' },
  { key: 'tomorrow',label: '내일',      tone: 'warn' },
  { key: 'week',    label: '7일 이내' },
  { key: 'unknown', label: '마감일 미확인' },
];

export function DeadlineScreen({ events, onAction, onUpdate }) {
  const [chip, setChip] = useState('all');

  const filtered = events
    .filter(ev => {
      if (chip === 'all') return deadlineMeta(ev.deadlineDate).key !== 'passed';
      return deadlineFilterMatch(ev, chip);
    })
    .sort((a, b) =>
      (a.deadlineDate ? new Date(a.deadlineDate) : 9e15) -
      (b.deadlineDate ? new Date(b.deadlineDate) : 9e15)
    );

  const counts = {
    today:    events.filter(e => deadlineMeta(e.deadlineDate).key === 'today').length,
    tomorrow: events.filter(e => deadlineMeta(e.deadlineDate).key === 'tomorrow').length,
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {DL_CHIPS.map(c => (
          <Chip
            key={c.key}
            active={chip === c.key}
            count={counts[c.key]}
            tone={c.tone}
            onClick={() => setChip(c.key)}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      {filtered.length === 0
        ? <Empty icon="clock" title="해당하는 이벤트가 없어요" />
        : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.map(ev => (
              <EventCard key={ev.id} event={ev} onAction={onAction} onUpdate={onUpdate} />
            ))}
          </div>
        )
      }
    </div>
  );
}
