/* ============================================================
   당첨노트 v2 — 목록 화면 (대기/임시저장 · 마감순 · 검색)
   Source: prototype screens-events(ListScreen) + app-parts(DeadlineScreen/SearchScreen)
   검색은 현재 matchesSearchQuery(ev._event) 재사용으로 raw까지 매칭.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../lib/icons.jsx';
import { Btn, Chip, Empty } from '../../components/primitives.jsx';
import { deadlineMeta } from '../../lib/domain.js';
import { matchesSearchQuery } from '../../../utils/eventModel.js';
import { EventCard } from './EventCard.jsx';

/* ---------------- 대기/임시저장 ---------------- */
const PAGE_SIZE = 10;

const SORTS = [
  { key: 'default', label: '기본순' },
  { key: 'popular', label: '인기순' },
  { key: 'winners', label: '당첨자 많은순' },
  { key: 'deadline', label: '마감임박순' },
  { key: 'recent', label: '최신수집순' },
];

function sortEvents(list, key) {
  const arr = [...list];
  const far = 9e15;
  if (key === 'popular') arr.sort((a, b) => b.savedCount - a.savedCount);
  else if (key === 'winners') arr.sort((a, b) => b.winners - a.winners);
  else if (key === 'deadline') arr.sort((a, b) => (a.deadline ? new Date(a.deadline) : far) - (b.deadline ? new Date(b.deadline) : far));
  else if (key === 'recent') arr.sort((a, b) => new Date(b.collectedAt || 0) - new Date(a.collectedAt || 0));
  return arr;
}

export function ListScreen({ events, onAction, onUpdate, emptyTitle, emptySub }) {
  const [sort, setSort] = useState('default');
  const list = sortEvents(events, sort);
  return (
    <div>
      <div className="chip-row" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {SORTS.map((s) => <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>{s.label}</Chip>)}
      </div>
      {list.length === 0
        ? <Empty icon="hourglass" title={emptyTitle || '이벤트가 없어요'} sub={emptySub || '크롤러가 새 이벤트를 수집하면 여기에 표시됩니다.'} />
        : <PaginatedEventGrid events={list} onAction={onAction} onUpdate={onUpdate} resetKey={sort} />}
    </div>
  );
}

/* ---------------- 마감순 ---------------- */
const DL_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'today', label: '오늘' },
  { key: 'tomorrow', label: '내일' },
  { key: 'week', label: '7일 이내' },
  { key: 'unknown', label: '마감일 미확인' },
];

export function DeadlineScreen({ events, onAction, onUpdate }) {
  const [chip, setChip] = useState('all');
  const metaOf = (ev) => deadlineMeta(ev).key;
  const filtered = events
    .filter((ev) => {
      const k = metaOf(ev);
      if (chip === 'all') return k !== 'passed';
      if (chip === 'today') return k === 'today';
      if (chip === 'tomorrow') return k === 'tomorrow';
      if (chip === 'week') return ['today', 'tomorrow', 'week'].includes(k);
      if (chip === 'unknown') return k === 'unknown';
      return true;
    })
    .sort((a, b) => (a.deadline ? new Date(a.deadline) : 9e15) - (b.deadline ? new Date(b.deadline) : 9e15));
  const counts = {
    today: events.filter((e) => metaOf(e) === 'today').length,
    tomorrow: events.filter((e) => metaOf(e) === 'tomorrow').length,
  };
  return (
    <div>
      <div className="chip-row" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {DL_CHIPS.map((c) => <Chip key={c.key} active={chip === c.key} count={counts[c.key]} tone={c.key === 'today' ? 'urgent' : c.key === 'tomorrow' ? 'warn' : undefined} onClick={() => setChip(c.key)}>{c.label}</Chip>)}
      </div>
      {filtered.length === 0
        ? <Empty icon="clock" title="해당하는 이벤트가 없어요" />
        : <PaginatedEventGrid events={filtered} onAction={onAction} onUpdate={onUpdate} resetKey={chip} />}
    </div>
  );
}

/* ---------------- 검색 ---------------- */
const SEARCH_SCOPES = [
  { key: 'all', label: '전체' },
  { key: 'waiting', label: '대기' },
  { key: 'entered', label: '응모함' },
  { key: 'win', label: '당첨' },
];

export function SearchScreen({ events, onAction, onUpdate }) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('all');
  const hasQuery = q.trim().length > 0;
  const results = useMemo(() => {
    if (!hasQuery) return [];
    return events.filter((ev) => {
      if (scope === 'waiting' && !['waiting', 'draft'].includes(ev.status)) return false;
      if (scope === 'entered' && ev.status !== 'entered') return false;
      if (scope === 'win' && ev.result !== 'win') return false;
      return matchesSearchQuery(ev._event, q);
    });
  }, [q, scope, events, hasQuery]);

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-3)' }} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="여러 단어로 검색 (AND)…" style={{
          width: '100%', padding: '12px 14px 12px 42px', fontSize: 14.5, borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', outline: 'none',
        }} />
      </div>
      <div className="chip-row" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {SEARCH_SCOPES.map((s) => <Chip key={s.key} active={scope === s.key} onClick={() => setScope(s.key)}>{s.label}</Chip>)}
      </div>
      {!hasQuery
        ? <Empty icon="search" title="검색어를 입력하세요" sub="제목·본문·경품명에서 모든 단어를 포함한 이벤트를 찾아요." />
        : results.length === 0
          ? <Empty icon="search" title="결과가 없어요" sub={`"${q}"와 일치하는 이벤트가 없습니다.`} />
          : <PaginatedEventGrid events={results} onAction={onAction} onUpdate={onUpdate} query={q} resetKey={`${scope}:${q}`} />}
    </div>
  );
}

function PaginatedEventGrid({ events, onAction, onUpdate, query, resetKey }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageEvents = events.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [resetKey, events.length]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <PaginationBar
        page={safePage}
        pageCount={pageCount}
        total={events.length}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
      />
      {pageEvents.map((ev) => <EventCard key={ev.id} ev={ev} onAction={onAction} onUpdate={onUpdate} query={query} />)}
      {pageCount > 1 ? (
        <PaginationBar
          page={safePage}
          pageCount={pageCount}
          total={events.length}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
          compact
        />
      ) : null}
    </div>
  );
}

function PaginationBar({ page, pageCount, total, onPrev, onNext, compact }) {
  if (total <= PAGE_SIZE && compact) return null;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      color: 'var(--text-3)',
      fontSize: 12.5,
      padding: compact ? '2px 0 0' : '0 0 2px',
    }}>
      <span className="tnum">{from}-{to} / {total.toLocaleString('ko-KR')}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Btn size="sm" variant="outline" icon="chevLeft" disabled={page <= 1} onClick={onPrev} title="이전 페이지">
          이전
        </Btn>
        <span className="tnum" style={{ minWidth: 54, textAlign: 'center', color: 'var(--text-2)', fontWeight: 650 }}>
          {page}/{pageCount}
        </span>
        <Btn size="sm" variant="outline" iconRight="chevRight" disabled={page >= pageCount} onClick={onNext} title="다음 페이지">
          다음
        </Btn>
      </div>
    </div>
  );
}
