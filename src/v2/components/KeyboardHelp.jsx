import './KeyboardHelp.css';
import { IconButton } from './primitives.jsx';

const SECTIONS = [
  {
    title: '카드 액션',
    rows: [
      { keys: ['E'],              desc: '참여완료로 표시' },
      { keys: ['L'],              desc: '임시저장' },
      { keys: ['⌫', 'Del'],       desc: '제외' },
      { keys: ['U'],              desc: '직전 액션 실행 취소' },
    ],
  },
  {
    title: '탐색',
    rows: [
      { keys: ['J', '↓'],         desc: '다음 카드' },
      { keys: ['K', '↑'],         desc: '이전 카드' },
    ],
  },
  {
    title: '기타',
    rows: [
      { keys: ['?'],              desc: '이 도움말 토글' },
      { keys: ['Esc'],            desc: '바텀시트 / 모달 닫기' },
    ],
  },
];

export function KeyboardHelp({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="v2-help-overlay" onClick={onClose}>
      <div className="v2-help" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="키보드 단축키">
        <div className="v2-help__head">
          <div>
            <h2>⌨ 키보드 단축키</h2>
            <p className="v2-muted" style={{ margin: '4px 0 0' }}>입력 필드에 포커스 있을 땐 비활성</p>
          </div>
          <IconButton onClick={onClose} aria-label="닫기">✕</IconButton>
        </div>
        {SECTIONS.map((s) => (
          <div key={s.title} className="v2-help__section">
            <div className="v2-help__section-title">{s.title}</div>
            {s.rows.map((r, i) => (
              <div key={i} className="v2-help__row">
                <span className="v2-help__keys">
                  {r.keys.map((k, j) => (
                    <span key={j} className="v2-help__kbd">{k}</span>
                  ))}
                </span>
                <span className="v2-help__desc">{r.desc}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="v2-help__hint">
          입력 중에는 글자가 그대로 입력됩니다. 카드 디테일에 포커스를 두고 단축키를 쓰세요.
        </div>
      </div>
    </div>
  );
}
