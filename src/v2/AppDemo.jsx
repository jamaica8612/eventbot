import { useState } from 'react';
import './tokens.css';
import {
  AppShell, SideNav, TopBar, ListPanel, DetailPanel, BottomNav, useEscape,
} from './shell/AppShell.jsx';
import {
  Button, IconButton, Tag, Pill, Inline, Stack, Divider,
} from './components/primitives.jsx';
import { EventCard } from './components/EventCard.jsx';
import { EventDetailContent } from './components/EventDetailContent.jsx';

const MOCK_EVENTS = [
  {
    id: 'e1',
    title: '신라면 블랙 출시 기념 댓글 이벤트 — 1000명 추첨',
    platform: '인스타그램',
    deadlineText: '오늘마감',
    deadlineDate: '2026-05-18',
    prizeText: '신라면 블랙 1박스 + 컵라면 세트',
    prizeAmount: '2만원',
    totalWinnerCount: 1000,
    source: '@nongshim_kr',
    applyUrl: 'https://instagram.com/p/example1',
    originalUrl: 'https://instagram.com/p/example1',
    originalLines: [
      '신라면 블랙 신제품 출시 기념! 1,000분께 1박스 + 컵라면 세트 증정 🍜',
      '',
      '◆ 참여 방법',
      '1) @nongshim_kr 팔로우',
      '2) 게시물 좋아요 + 댓글로 친구 2명 태그',
      '3) 스토리에 공유하면 당첨 확률 2배 ✨',
      '',
      '◆ 응모 기간: 5/13 ~ 5/18 23:59',
      '◆ 결과 발표: 5/25 인스타그램 DM',
      '',
      '※ 비공개 계정은 자동 제외',
      '※ 국내 거주자만 응모 가능',
      '※ 동일인 중복 응모는 1회만 인정',
    ],
  },
  {
    id: 'e8',
    title: '편의점 도시락 신메뉴 댓글 이벤트',
    platform: '유튜브',
    deadlineText: '오늘마감',
    deadlineDate: '2026-05-18',
    prizeText: 'CU 모바일 상품권 5천원권',
    prizeAmount: '5천원',
    totalWinnerCount: 2000,
    source: 'CU공식',
    applyUrl: 'https://www.youtube.com/watch?v=gdZLi9oWNZg',
    originalUrl: 'https://www.youtube.com/watch?v=gdZLi9oWNZg',
    originalLines: [
      'CU 신메뉴 도시락 광고 영상을 보고 댓글 남기면 추첨으로 2,000명께 모바일 상품권 5천원권 증정!',
      '',
      '◆ 참여 방법',
      '1) 영상 좋아요 + 채널 구독',
      '2) 댓글로 가장 먹어보고 싶은 신메뉴 1개 + 이유',
      '',
      '◆ 응모: 5/14 ~ 5/18',
      '◆ 발표: 5/24 댓글 고정',
      '',
      '※ 최소 한 줄 이상 정성스러운 댓글만 추첨 대상',
    ],
  },
  {
    id: 'e2',
    title: '갤럭시 S26 사전예약 응모 — 100명 추첨',
    platform: '카카오톡',
    deadlineText: '내일마감',
    deadlineDate: '2026-05-19',
    prizeText: '갤럭시 S26 Ultra 256GB',
    prizeAmount: '180만원',
    totalWinnerCount: 100,
    source: '삼성전자',
    applyUrl: 'https://example.com/galaxy',
    originalUrl: 'https://example.com/galaxy',
    originalLines: [
      '갤럭시 S26 Ultra 사전예약 응모. 100분께 단말기 증정.',
      '카카오톡 채널 추가 후 응모 폼 작성.',
    ],
  },
  {
    id: 'e3',
    title: '스타벅스 신메뉴 시음 이벤트',
    platform: '유튜브',
    deadlineText: '5/22 마감',
    deadlineDate: '2026-05-22',
    prizeText: '스타벅스 e-기프트카드 3만원권',
    prizeAmount: '3만원',
    totalWinnerCount: 500,
    source: '스타벅스코리아',
    applyUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    originalUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    originalLines: [
      '스타벅스 신메뉴 시음권 추첨!',
      '',
      '◆ 영상 시청 후 댓글로 가장 마셔보고 싶은 메뉴 + 한 줄 응원 댓글',
      '◆ 구독 + 좋아요 필수',
      '◆ 발표: 5/25 스타벅스코리아 공식 채널',
    ],
  },
  {
    id: 'e4',
    title: '여름맞이 다이슨 에어랩 증정 이벤트',
    platform: '인스타그램',
    deadlineText: '5/31 마감',
    deadlineDate: '2026-05-31',
    prizeText: '다이슨 에어랩 컴플리트',
    prizeAmount: '69만원',
    totalWinnerCount: 3,
    source: '@beauty_kr',
    applyUrl: 'https://instagram.com/p/example4',
    originalUrl: 'https://instagram.com/p/example4',
    originalLines: [
      '다이슨 에어랩 컴플리트 3명 추첨.',
      '@beauty_kr 팔로우 + 게시물 좋아요 + 친구 1명 태그.',
      '발표 6/3',
    ],
  },
];

const NAV_SECTIONS = [
  { title: '응모', items: [
    { id: 'inbox', icon: '📥', label: '받은함', count: 42 },
    { id: 'today', icon: '🔥', label: '오늘마감', count: 5, active: true },
    { id: 'ready', icon: '⏰', label: '응모대기', count: 23 },
    { id: 'later', icon: '🔖', label: '임시저장', count: 12 },
  ] },
  { title: '결과', items: [
    { id: 'received', icon: '📬', label: '수령함', count: 8 },
    { id: 'won', icon: '🏆', label: '당첨', count: 14 },
    { id: 'lost', icon: '❌', label: '미당첨', count: 31 },
  ] },
  { title: '플랫폼', items: [
    { id: 'ig', icon: '📷', label: '인스타그램', count: 18 },
    { id: 'yt', icon: '▶️', label: '유튜브', count: 9 },
    { id: 'kk', icon: '💬', label: '카카오톡', count: 7 },
  ] },
];

const BNAV_ITEMS = [
  { id: 'home', icon: '🏠', label: '홈', active: true },
  { id: 'search', icon: '🔍', label: '검색' },
  null,
  { id: 'inbox', icon: '📬', label: '수령함', dot: true },
  { id: 'me', icon: '👤', label: '나' },
];

export default function AppDemo() {
  const [selectedId, setSelectedId] = useState('e1');
  const [sheetOpen, setSheetOpen] = useState(false);
  const selected = MOCK_EVENTS.find((e) => e.id === selectedId) || MOCK_EVENTS[0];
  useEscape(() => setSheetOpen(false));

  const handleItemClick = (id) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 959px)').matches) setSheetOpen(true);
  };

  const nav = (
    <SideNav
      brand={{ name: 'EventBot', mark: 'v2' }}
      sections={NAV_SECTIONS}
      user={{ initial: 'J', name: '정민', meta: '관리자' }}
    />
  );

  const list = (
    <ListPanel topBar={
      <TopBar title="🔥 오늘마감" sub="5건 · 12분 전 동기화" actions={
        <>
          <IconButton aria-label="새로고침">↻</IconButton>
          <IconButton aria-label="필터">⚙</IconButton>
        </>
      }/>
    }>
      <div style={{ padding: 'var(--sp-3)' }}>
        <Inline style={{ flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
          <Pill on>전체</Pill>
          <Pill>미응모</Pill>
          <Pill>고액 ↑</Pill>
          <Pill>유튜브만</Pill>
        </Inline>
        <Stack size="sm">
          {MOCK_EVENTS.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              selected={event.id === selectedId}
              onClick={() => handleItemClick(event.id)}
            />
          ))}
        </Stack>
      </div>
    </ListPanel>
  );

  const detail = (
    <DetailPanel topBar={
      <TopBar>
        <Inline>
          <Button variant="primary">참여하기 ↗</Button>
          <Button kbd="E">참여완료</Button>
          <Button kbd="L">임시저장</Button>
          <Button variant="ghost" kbd="⌫">제외</Button>
        </Inline>
      </TopBar>
    }>
      <Stack size="lg">
        <Inline style={{ flexWrap: 'wrap' }}>
          <Tag variant="danger">{selected.deadlineText}</Tag>
          <Tag variant="info">{selected.platform}</Tag>
          {selected.totalWinnerCount != null && <Tag>{selected.totalWinnerCount.toLocaleString('ko-KR')}명</Tag>}
          <span className="v2-muted" style={{ fontSize: 'var(--fs-xs)' }}>· {selected.source}</span>
        </Inline>
        <h1 className="v2-h1">{selected.title}</h1>
        <Divider />
        <EventDetailContent event={selected} />
      </Stack>
    </DetailPanel>
  );

  const bottomNav = (
    <BottomNav items={BNAV_ITEMS} fab={{ icon: '＋', label: '새 이벤트', onClick: () => {} }}/>
  );

  const sheet = sheetOpen && (
    <>
      <Inline style={{ fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-3)' }}>
        <span className="v2-muted">{selected.platform}</span>
        <span className="v2-muted">·</span>
        <span style={{ color: 'var(--c-danger)' }}>{selected.deadlineText}</span>
      </Inline>
      <h2 className="v2-h2" style={{ marginBottom: 'var(--sp-3)' }}>{selected.title}</h2>
      <Inline style={{ flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
        <Tag variant="brand">{selected.prizeAmount}</Tag>
        {selected.totalWinnerCount != null && <Tag>{selected.totalWinnerCount.toLocaleString('ko-KR')}명</Tag>}
        <Tag variant="info">{selected.platform}</Tag>
      </Inline>
      <EventDetailContent event={selected} />
      <Stack style={{ marginTop: 'var(--sp-5)' }}>
        <Button variant="primary" size="lg" block>응모하러 가기 ↗</Button>
        <Button size="lg" block>✔ 참여완료</Button>
        <Button variant="ghost" size="lg" block onClick={() => setSheetOpen(false)}>닫기</Button>
      </Stack>
    </>
  );

  return (
    <>
      <ViewSwitcher />
      <AppShell
        nav={nav}
        list={list}
        detail={detail}
        bottomNav={bottomNav}
        sheet={sheet}
        onSheetClose={() => setSheetOpen(false)}
      />
    </>
  );
}

function ViewSwitcher() {
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 100,
      display: 'flex', gap: 4, padding: 4,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      border: '1px solid var(--c-line)', borderRadius: 'var(--r-md)',
    }}>
      <a href="/v2-shell.html" className="v2-pill v2-pill--on" style={{ textDecoration: 'none' }}>App</a>
      <a href="/v2.html" className="v2-pill" style={{ textDecoration: 'none' }}>Tokens</a>
    </div>
  );
}
