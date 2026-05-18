import './NewEventDialog.css';
import { useState } from 'react';
import { Button, IconButton, Input } from './primitives.jsx';

const PLATFORMS = ['인스타그램', '유튜브', '카카오톡', '기타'];

const cx = (...c) => c.filter(Boolean).join(' ');

export function NewEventDialog({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('인스타그램');
  const [deadlineDate, setDeadlineDate] = useState(defaultDeadline());
  const [prizeText, setPrizeText] = useState('');
  const [prizeAmount, setPrizeAmount] = useState('');
  const [totalWinnerCount, setTotalWinnerCount] = useState('');
  const [applyUrl, setApplyUrl] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const reset = () => {
    setTitle(''); setPlatform('인스타그램'); setDeadlineDate(defaultDeadline());
    setPrizeText(''); setPrizeAmount(''); setTotalWinnerCount(''); setApplyUrl('');
    setBody(''); setError('');
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!title.trim()) { setError('제목을 입력해 주세요'); return; }
    const winners = Number(String(totalWinnerCount).replace(/[^\d]/g, '')) || null;
    const event = {
      id: `user-${Date.now().toString(36)}`,
      title: title.trim(),
      platform,
      status: 'ready',
      resultStatus: 'unknown',
      receiptStatus: 'unclaimed',
      deadlineDate: deadlineDate || null,
      prizeText: prizeText.trim() || null,
      prizeAmount: prizeAmount.trim() || null,
      prizeAmountValue: parsePrizeValue(prizeAmount),
      totalWinnerCount: winners,
      source: '직접 추가',
      applyUrl: applyUrl.trim() || null,
      originalUrl: applyUrl.trim() || null,
      originalLines: body ? body.split(/\n/).map((l) => l.trimEnd()) : [],
      createdAt: new Date().toISOString(),
    };
    onSubmit?.(event);
    reset();
  };

  return (
    <div className="v2-ned-overlay" onClick={onClose}>
      <form className="v2-ned" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="v2-ned__head">
          <h2>＋ 새 이벤트 추가</h2>
          <IconButton type="button" onClick={onClose} aria-label="닫기">✕</IconButton>
        </div>

        <div className="v2-ned__field">
          <label className="v2-ned__lbl">제목<span className="req">*</span></label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 신라면 블랙 출시 기념 댓글 이벤트"
          />
        </div>

        <div className="v2-ned__field">
          <label className="v2-ned__lbl">플랫폼</label>
          <div className="v2-ned__seg">
            {PLATFORMS.map((p) => (
              <button
                key={p} type="button"
                className={cx(platform === p && 'on')}
                onClick={() => setPlatform(p)}
              >{p}</button>
            ))}
          </div>
        </div>

        <div className="v2-ned__field-row">
          <div className="v2-ned__field">
            <label className="v2-ned__lbl">마감일</label>
            <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          </div>
          <div className="v2-ned__field">
            <label className="v2-ned__lbl">당첨자 수</label>
            <Input value={totalWinnerCount} onChange={(e) => setTotalWinnerCount(e.target.value)} placeholder="100" />
          </div>
        </div>

        <div className="v2-ned__field-row">
          <div className="v2-ned__field">
            <label className="v2-ned__lbl">경품</label>
            <Input value={prizeText} onChange={(e) => setPrizeText(e.target.value)} placeholder="스타벅스 e-기프트카드" />
          </div>
          <div className="v2-ned__field">
            <label className="v2-ned__lbl">금액</label>
            <Input value={prizeAmount} onChange={(e) => setPrizeAmount(e.target.value)} placeholder="3만원" />
          </div>
        </div>

        <div className="v2-ned__field">
          <label className="v2-ned__lbl">응모 링크</label>
          <Input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="v2-ned__field">
          <label className="v2-ned__lbl">본문 (선택)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="이벤트 본문, 참여 방법, 주의사항 등"
          />
        </div>

        {error && <p style={{ color: 'var(--c-danger)', fontSize: 'var(--fs-sm)', margin: '0 0 var(--sp-2)' }}>{error}</p>}

        <div className="v2-ned__actions">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary">추가</Button>
        </div>
      </form>
    </div>
  );
}

function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function parsePrizeValue(text) {
  if (!text) return null;
  const s = String(text).replace(/\s|,/g, '');
  let total = 0; let matched = false;
  const eok = s.match(/(\d+(?:\.\d+)?)억/); if (eok) { total += Number(eok[1]) * 1e8; matched = true; }
  const man = s.match(/(\d+(?:\.\d+)?)만/); if (man) { total += Number(man[1]) * 1e4; matched = true; }
  const chen = s.match(/(\d+(?:\.\d+)?)천/); if (chen) { total += Number(chen[1]) * 1e3; matched = true; }
  const rest = s.replace(/(\d+(?:\.\d+)?)(억|만|천)/g, '').match(/\d+/);
  if (rest && matched) total += Number(rest[0]);
  if (!matched) {
    const n = s.match(/^\d+$/);
    return n ? Number(n[0]) : null;
  }
  return Math.round(total);
}
