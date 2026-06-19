import { describe, it, expect } from 'vitest';
import { getUpcomingDeadlineMatch, getTodayDeadlineMatch } from './deadlineModel.js';
import { getLocalToday } from './format.js';

// 오늘 기준 offset일 만큼 이동한 로컬 YYYY-MM-DD 문자열을 만든다.
function ymdFromToday(offsetDays) {
  const base = getLocalToday();
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('getUpcomingDeadlineMatch', () => {
  it('오늘 마감이면 bucket=today, diffDays=0', () => {
    const m = getUpcomingDeadlineMatch({ status: 'ready', deadlineDate: ymdFromToday(0) });
    expect(m.bucket).toBe('today');
    expect(m.diffDays).toBe(0);
    expect(m.label).toBe('오늘 마감');
  });

  it('내일 마감이면 bucket=tomorrow, diffDays=1', () => {
    const m = getUpcomingDeadlineMatch({ status: 'ready', deadlineDate: ymdFromToday(1) });
    expect(m.bucket).toBe('tomorrow');
    expect(m.diffDays).toBe(1);
  });

  it('일주일 이내면 bucket=week', () => {
    const m = getUpcomingDeadlineMatch({ status: 'ready', deadlineDate: ymdFromToday(5) });
    expect(m.bucket).toBe('week');
    expect(m.diffDays).toBe(5);
  });

  it('일주일을 넘으면 bucket=later', () => {
    const m = getUpcomingDeadlineMatch({ status: 'ready', deadlineDate: ymdFromToday(20) });
    expect(m.bucket).toBe('later');
    expect(m.diffDays).toBe(20);
  });

  it('지난 마감은 diffDays가 음수다', () => {
    const m = getUpcomingDeadlineMatch({ status: 'ready', deadlineDate: ymdFromToday(-3) });
    expect(m.diffDays).toBe(-3);
    expect(m.label).toBe('3일 지남');
  });

  it('완료/제외 이벤트는 매칭하지 않고 bucket=unknown', () => {
    expect(getUpcomingDeadlineMatch({ status: 'done', deadlineDate: ymdFromToday(0) }).bucket).toBe('unknown');
    expect(getUpcomingDeadlineMatch({ status: 'skipped', deadlineDate: ymdFromToday(0) }).bucket).toBe('unknown');
  });

  it('마감일이 없고 "내일 마감" 텍스트가 있으면 tomorrow로 추론한다', () => {
    const m = getUpcomingDeadlineMatch({ status: 'ready', deadlineText: '내일 마감입니다' });
    expect(m.bucket).toBe('tomorrow');
    expect(m.diffDays).toBe(1);
  });
});

describe('getTodayDeadlineMatch', () => {
  it('오늘 날짜면 정확 매칭(isExact)이다', () => {
    const m = getTodayDeadlineMatch({ status: 'ready', deadlineDate: ymdFromToday(0) });
    expect(m.isMatch).toBe(true);
    expect(m.isExact).toBe(true);
  });

  it('"오늘 마감" 텍스트는 비정확 매칭이다', () => {
    const m = getTodayDeadlineMatch({ status: 'ready', deadlineText: '오늘 마감' });
    expect(m.isMatch).toBe(true);
    expect(m.isExact).toBe(false);
  });

  it('완료 이벤트는 매칭하지 않는다', () => {
    expect(getTodayDeadlineMatch({ status: 'done', deadlineDate: ymdFromToday(0) }).isMatch).toBe(false);
  });
});
