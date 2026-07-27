import { describe, expect, it } from 'vitest';
import { analyzeAnnouncementByRules, getFallbackDecision } from '../src/utils/eventFallbacks.js';

describe('public event fallbacks', () => {
  it('keeps a usable event shape when optional fields are absent', () => {
    expect(getFallbackDecision({ effort: 'home', due: '2026-08-01' })).toMatchObject({
      actionType: 'home',
      deadlineDate: '',
      deadlineText: '2026-08-01',
      estimatedSeconds: 180,
    });
  });

  it('extracts an announcement date without a crawler runtime', () => {
    expect(analyzeAnnouncementByRules({
      originalText: '당첨자 발표 2026.08.12',
    })).toMatchObject({
      resultAnnouncementDate: '2026-08-12',
    });
  });
});
