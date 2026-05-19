import './OnboardingTour.css';
import { useEffect, useState } from 'react';
import { Button } from './primitives.jsx';

const STORAGE_KEY = 'eventbot.v2.onboarded.v1';

const STEPS = [
  {
    icon: '✨',
    title: 'EventBot v2에 오신 걸 환영합니다',
    body: (
      <>
        이벤트 응모부터 결과 확인, 수령까지 한 화면에서 처리하세요.
        잠깐 둘러보고 시작할까요?
      </>
    ),
  },
  {
    icon: '🗂',
    title: '사이드 네비로 한눈에',
    body: (
      <>
        <b>응모 대기</b> · <b>임시저장</b> · <b>발표 임박</b> · <b>수령함</b> 등 7가지 뷰로
        지금 처리해야 할 이벤트만 골라봅니다. 좌측 메뉴(모바일은 햄버거 ☰)에서 전환하세요.
      </>
    ),
  },
  {
    icon: '🔎',
    title: '검색 · 필터 · 정렬',
    body: (
      <>
        제목/본문/경품/출처를 한 번에 검색. 최근 검색어는 자동으로 기억됩니다.
        플랫폼 칩과 정렬 메뉴로 더 좁힐 수 있어요.
      </>
    ),
  },
  {
    icon: '⌨',
    title: '키보드로 빠르게',
    body: (
      <>
        <code>E</code> 참여완료 · <code>L</code> 임시저장 · <code>⌫</code> 제외 · <code>U</code> 실행 취소.
        <br />
        <code>J/K</code>로 다음/이전, <code>?</code>로 전체 단축키를 봅니다.
      </>
    ),
  },
  {
    icon: '🎯',
    title: '준비 완료',
    body: (
      <>
        마감 24시간 전엔 알림(권한 허용 시), 카드마다 <b>응모 → 완료 → 발표 → 결과</b> 단계가
        한눈에. <code>＋</code> 버튼으로 새 이벤트도 추가할 수 있어요. 시작해 봅시다.
      </>
    ),
  },
];

export function hasSeenOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {}
}

export function OnboardingTour({ open, onClose }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = () => {
    if (isLast) {
      markSeen();
      onClose?.();
    } else {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }
  };

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = () => {
    markSeen();
    onClose?.();
  };

  return (
    <div className="v2-tour-overlay v2" onClick={handleSkip}>
      <div className="v2-tour" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="환영 가이드">
        <div className="v2-tour__step">{step + 1} / {STEPS.length}</div>
        <div className="v2-tour__icon" aria-hidden>{current.icon}</div>
        <h2 className="v2-tour__title">{current.title}</h2>
        <p className="v2-tour__body">{current.body}</p>
        <div className="v2-tour__actions">
          <button type="button" className="v2-tour__skip" onClick={handleSkip}>
            건너뛰기
          </button>
          <div className="v2-tour__dots" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={'v2-tour__dot' + (i === step ? ' v2-tour__dot--current' : '')} />
            ))}
          </div>
          <div className="v2-tour__nav">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePrev}>이전</Button>
            )}
            <Button variant="primary" size="sm" onClick={handleNext}>
              {isLast ? '시작' : '다음'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
