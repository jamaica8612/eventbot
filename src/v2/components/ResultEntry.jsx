import './ResultEntry.css';
import { Input } from './primitives.jsx';

const cx = (...c) => c.filter(Boolean).join(' ');

/* 한국식 표기("10만원", "1만 5000")를 숫자로. 실패 시 null */
function parseKoreanAmount(text) {
  if (typeof text !== 'string') return null;
  const s = text.replace(/\s|,/g, '');
  let total = 0; let matched = false;
  const eok = s.match(/(\d+(?:\.\d+)?)억/); if (eok) { total += Number(eok[1]) * 1e8; matched = true; }
  const man = s.match(/(\d+(?:\.\d+)?)만/); if (man) { total += Number(man[1]) * 1e4; matched = true; }
  const chen = s.match(/(\d+(?:\.\d+)?)천/); if (chen) { total += Number(chen[1]) * 1e3; matched = true; }
  // 끝에 붙은 원 숫자 (e.g. "10만원 5000" → 5000)
  const remainder = s.replace(/(\d+(?:\.\d+)?)(억|만|천)/g, '').match(/\d+/);
  if (remainder && (matched || /원/.test(s))) { total += Number(remainder[0]); matched = true; }
  if (!matched) {
    const n = s.match(/^\d+$/);
    if (n) return Number(n[0]);
    return null;
  }
  return Math.round(total);
}

/* ============================================================
   ResultEntry — 결과/수령/금액/메모 입력
   - status === 'done' 일 때만 보임 (참여완료 이후)
   - resultStatus 'won' 이면 수령 상태 + 경품/금액/메모 필드 노출
   ============================================================ */
export function ResultEntry({ event, onChange }) {
  if (event.status !== 'done') return null;

  const result = event.resultStatus || 'unknown';
  const receipt = event.receiptStatus || 'unclaimed';

  const update = (patch) => onChange?.(event.id, patch);
  const updatePrizeAmount = (text) => {
    const v = parseKoreanAmount(text);
    update({ prizeAmount: text, prizeAmountValue: v ?? event.prizeAmountValue });
  };

  return (
    <div className="v2-result">
      <div className="v2-eyebrow">📋 결과 / 수령 입력</div>

      <div className="v2-result__row">
        <span className="v2-result__label">결과</span>
        <div className="v2-result__seg">
          <button
            className={cx(result === 'unknown' && 'on')}
            onClick={() => update({ resultStatus: 'unknown', receiptStatus: 'unclaimed' })}
          >대기</button>
          <button
            className={cx('win', result === 'won' && 'on')}
            onClick={() => update({ resultStatus: 'won' })}
          >🏆 당첨</button>
          <button
            className={cx('lost', result === 'lost' && 'on')}
            onClick={() => update({ resultStatus: 'lost', receiptStatus: 'unclaimed' })}
          >미당첨</button>
        </div>
      </div>

      {result === 'won' && (
        <>
          <div className="v2-result__row">
            <span className="v2-result__label">수령</span>
            <div className="v2-result__seg">
              <button
                className={cx(receipt === 'unclaimed' && 'on')}
                onClick={() => update({ receiptStatus: 'unclaimed' })}
              >미수령</button>
              <button
                className={cx('win', receipt === 'received' && 'on')}
                onClick={() => update({ receiptStatus: 'received', receivedAt: event.receivedAt || todayISO() })}
              >📦 수령완료</button>
            </div>
            {receipt === 'received' && event.receivedAt && (
              <span className="v2-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                {event.receivedAt}
              </span>
            )}
          </div>

          <div className="v2-result__row">
            <div className="v2-result__field">
              <span className="v2-result__field-lbl">경품명</span>
              <Input
                defaultValue={event.prizeTitle || event.prizeText || ''}
                placeholder="실제 받은 경품"
                onBlur={(e) => update({ prizeTitle: e.target.value })}
              />
            </div>
            <div className="v2-result__field">
              <span className="v2-result__field-lbl">금액</span>
              <Input
                defaultValue={event.prizeAmount || ''}
                placeholder="10만원 / 100000"
                onBlur={(e) => updatePrizeAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="v2-result__field">
            <span className="v2-result__field-lbl">메모</span>
            <textarea
              className="v2-result__memo"
              defaultValue={event.winningMemo || ''}
              placeholder="수령 방법, 시리얼, 발송 상태 등"
              onBlur={(e) => update({ winningMemo: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
