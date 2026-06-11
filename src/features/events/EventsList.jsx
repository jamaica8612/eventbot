import { useState, useMemo } from 'react';
import { Chip } from '../../components/Chip.jsx';
import { Empty } from '../../components/Empty.jsx';
import { EventCard } from './EventCard.jsx';
import { deadlineMeta } from '../../lib/domain.js';

const SORTS = [
  { key: 'default', label: '기본순' },
  { key: 'popular', label: '인기순' },
  { key: 'winners', label: '당첨자 많은순' },
  { key: 'deadline', label: '마감임박순' },
  { key: 'newest', label: '최신수집순' },
];

const FAR = 9e15;

function sortEvents(list, key) {
  const arr = [...list];
  if (key === 'popular') arr.sort((a, b) => (b.bookmarkCount || 0) - (a.bookmarkCount || 0));
  else if (key === 'winners') arr.sort((a, b) => (b.totalWinnerCount || 0) - (a.totalWinnerCount || 0));
  else if (key === 'deadline') arr.sort((a, b) => (a.deadlineDate ? new Date(a.deadlineDate) : FAR) - (b.deadlineDate ? new Date(b.deadlineDate) : FAR));
  else if (key === 'newest') arr.sort((a, b) => new Date(b.lastSeenAt || b.createdAt || 0) - new Date(a.lastSeenAt || a.createdAt || 0));
  return arr;
}

export function EventsList({ events, filter, isLoading, onStatusChange, onDeadlineChange, onResultChange, onAnnouncementChange, query }) {
  const [sort, setSort] = useState('default');
  const list = useMemo(() => sortEvents(events, sort), [events, sort]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
        {SORTS.map(s => (
          <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>{s.label}</Chip>
        ))}
      </div>
      {isLoading ? (
        <Empty icon="refresh" title="이벤트를 불러오는 중입니다." />
      ) : list.length === 0 ? (
        <Empty icon="hourglass" title="이벤트가 없어요" sub="크롤러가 새 이벤트를 수집하면 여기에 표시됩니다." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {list.map(ev => (
            <EventCard
              key={ev.id}
              event={ev}
              filter={filter}
              onStatusChange={onStatusChange}
              onDeadlineChange={onDeadlineChange}
              onResultChange={onResultChange}
              onAnnouncementChange={onAnnouncementChange}
              query={query}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const DL_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'today', label: '오늘', tone: 'urgent' },
  { key: 'tomorrow', label: '내일', tone: 'warn' },
  { key: 'week', label: '7일 이내' },
  { key: 'unknown', label: '마감일 미확인' },
];

export function DeadlineScreen({ events, isLoading, onStatusChange, onDeadlineChange }) {
  const [chip, setChip] = useState('all');

  const filtered = useMemo(() => {
    return events.filter(ev => {
      const m = deadlineMeta(ev.deadlineDate);
      if (chip === 'all') return m.key !== 'passed';
      if (chip === 'today') return m.key === 'today';
      if (chip === 'tomorrow') return m.key === 'tomorrow';
      if (chip === 'week') return ['today', 'tomorrow', 'soon'].includes(m.key);
      if (chip === 'unknown') return m.key === 'unknown';
      return true;
    }).sort((a, b) =>
      (a.deadlineDate ? new Date(a.deadlineDate) : FAR) - (b.deadlineDate ? new Date(b.deadlineDate) : FAR)
    );
  }, [events, chip]);

  const counts = useMemo(() => ({
    today: events.filter(e => deadlineMeta(e.deadlineDate).key === 'today').length,
    tomorrow: events.filter(e => deadlineMeta(e.deadlineDate).key === 'tomorrow').length,
  }), [events]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
        {DL_CHIPS.map(c => (
          <Chip key={c.key} active={chip === c.key} count={counts[c.key]} tone={c.tone} onClick={() => setChip(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {isLoading ? (
        <Empty icon="refresh" title="이벤트를 불러오는 중입니다." />
      ) : filtered.length === 0 ? (
        <Empty icon="clock" title="해당하는 이벤트가 없어요" />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(ev => (
            <EventCard key={ev.id} event={ev} onStatusChange={onStatusChange} onDeadlineChange={onDeadlineChange} />
          ))}
        </div>
      )}
    </div>
  );
}
