import { useEffect, useMemo, useState } from 'react';
import { loadHotdeals } from '../../../storage/hotdealStorage.js';
import { Badge, Btn, Chip, Empty, Switch } from '../../components/primitives.jsx';
import { Icon } from '../../lib/icons.jsx';

const SOURCES = [
  { key: '', label: '전체' },
  { key: 'ppomppu', label: '뽐뿌' },
  { key: 'fmkorea', label: '에펨' },
  { key: 'clien', label: '클리앙' },
];

const RECOMMEND_FILTERS = [
  { key: 0, label: '전체' },
  { key: 5, label: '추천 5+' },
  { key: 20, label: '추천 20+' },
];

export function HotdealScreen() {
  const [source, setSource] = useState('');
  const [minRecommend, setMinRecommend] = useState(0);
  const [hideSoldOut, setHideSoldOut] = useState(true);
  const [deals, setDeals] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setStatus('loading');
    setError('');
    loadHotdeals({ source, minRecommend, hideSoldOut, limit: 160 })
      .then((rows) => {
        if (!mounted) return;
        setDeals(rows);
        setStatus('done');
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || '핫딜을 불러오지 못했습니다.');
        setStatus('failed');
      });
    return () => {
      mounted = false;
    };
  }, [source, minRecommend, hideSoldOut]);

  const summary = useMemo(() => ({
    soldOut: deals.filter((deal) => deal.isSoldOut || deal.isExpired).length,
    popular: deals.filter((deal) => deal.recommendCount >= 20).length,
  }), [deals]);

  return (
    <div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <div className="chip-row" style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
          {SOURCES.map((item) => (
            <Chip key={item.key || 'all'} active={source === item.key} onClick={() => setSource(item.key)}>
              {item.label}
            </Chip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {RECOMMEND_FILTERS.map((item) => (
            <Chip key={item.key} active={minRecommend === item.key} tone={item.key >= 20 ? 'warn' : undefined} onClick={() => setMinRecommend(item.key)}>
              {item.label}
            </Chip>
          ))}
          <Switch on={hideSoldOut} onChange={setHideSoldOut} label="품절 숨김" />
        </div>
      </div>

      {status === 'loading' ? <Empty icon="refresh" title="핫딜을 불러오는 중…" /> : null}
      {status === 'failed' ? <Empty icon="alert" title="핫딜을 불러오지 못했어요" sub={error} /> : null}
      {status === 'done' && deals.length === 0 ? <Empty icon="gift" title="조건에 맞는 핫딜이 없어요" sub="필터를 낮추거나 다음 수집을 기다려 주세요." /> : null}

      {status === 'done' && deals.length > 0 ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
            <Badge tone="info">총 {deals.length.toLocaleString('ko-KR')}건</Badge>
            {summary.popular > 0 ? <Badge tone="warn">인기 {summary.popular.toLocaleString('ko-KR')}건</Badge> : null}
            {summary.soldOut > 0 ? <Badge tone="lose">품절/종료 {summary.soldOut.toLocaleString('ko-KR')}건</Badge> : null}
          </div>
          {deals.map((deal) => <HotdealCard key={`${deal.source}:${deal.sourcePostId}`} deal={deal} />)}
        </div>
      ) : null}
    </div>
  );
}

function HotdealCard({ deal }) {
  const statusTone = deal.isExpired ? 'urgent' : deal.isSoldOut ? 'lose' : deal.recommendCount >= 20 ? 'warn' : 'muted';
  const statusLabel = deal.isExpired ? '종료' : deal.isSoldOut ? '품절' : deal.recommendCount >= 20 ? '인기' : sourceLabel(deal.source);
  const targetUrl = deal.dealUrl || deal.url;

  return (
    <article style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${deal.isExpired ? 'var(--urgent)' : deal.isSoldOut ? 'var(--lose)' : deal.recommendCount >= 20 ? 'var(--warn)' : 'transparent'}`,
      borderRadius: 'var(--r-md)',
      padding: 15,
      boxShadow: 'var(--shadow-1)',
      display: 'grid',
      gap: 11,
      minWidth: 0,
      overflowWrap: 'anywhere',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {deal.thumbnail ? (
          <img
            src={deal.thumbnail}
            alt=""
            loading="lazy"
            style={{ width: 58, height: 58, borderRadius: 'var(--r-sm)', objectFit: 'cover', background: 'var(--surface-2)', flex: 'none' }}
          />
        ) : (
          <div style={{ width: 58, height: 58, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-3)', flex: 'none' }}>
            <Icon name="gift" size={22} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {deal.shop ? <Badge tone="accent">{deal.shop}</Badge> : null}
            {deal.category ? <Badge>{deal.category}</Badge> : null}
          </div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 730, lineHeight: 1.42, color: 'var(--text)', wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
            {deal.title}
          </h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-2)' }}>
            <strong className="tnum" style={{ color: 'var(--urgent-text)', fontSize: 14 }}>
              {formatPrice(deal)}
            </strong>
            <span className="tnum">추천 {deal.recommendCount.toLocaleString('ko-KR')}</span>
            <span className="tnum">댓글 {deal.commentCount.toLocaleString('ko-KR')}</span>
            {deal.postedAt ? <span>{formatDate(deal.postedAt)}</span> : null}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn size="sm" variant="outline" icon="ext" onClick={() => window.open(targetUrl, '_blank', 'noopener')}>
          바로가기
        </Btn>
      </div>
    </article>
  );
}

function sourceLabel(source) {
  if (source === 'ppomppu') return '뽐뿌';
  if (source === 'fmkorea') return '에펨';
  if (source === 'clien') return '클리앙';
  return source || '핫딜';
}

function formatPrice(deal) {
  if (Number.isFinite(deal.priceAmount)) {
    return deal.priceAmount === 0 ? '무료' : `${deal.priceAmount.toLocaleString('ko-KR')}원`;
  }
  return deal.priceText || '가격 확인';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
