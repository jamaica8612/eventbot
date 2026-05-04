import { useCallback } from 'react';
import {
  saveEventAnnouncement,
  saveEventResult,
  saveEventStatus,
  saveWinningMeta,
} from '../storage/eventStatusStorage.js';
import { updateSupabaseEventState } from '../storage/supabaseEventStorage.js';
import {
  applyStatusChange,
  buildStatusPatch,
  getPrizeDisplay,
} from '../utils/eventModel.js';

const SYNC_ERROR_MESSAGE = '저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 눌러주세요.';

function persistRemote(eventId, patch, onError) {
  onError('');
  updateSupabaseEventState(eventId, patch)
    .then(() => onError(''))
    .catch(() => onError(SYNC_ERROR_MESSAGE));
}

export function useEventActions({ events, setEvents, setSyncError }) {
  const updateStatus = useCallback(
    (eventId, status) => {
      const changedAt = new Date().toISOString();
      const currentEvent = events.find((event) => event.id === eventId);
      saveEventStatus(eventId, status);
      persistRemote(eventId, buildStatusPatch(currentEvent, status, changedAt), setSyncError);
      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.id === eventId ? applyStatusChange(event, status, changedAt) : event,
        ),
      );
    },
    [events, setEvents, setSyncError],
  );

  const updateResult = useCallback(
    (eventId, resultStatus) => {
      const changedAt = new Date().toISOString();
      const currentEvent = events.find((event) => event.id === eventId);
      const participatedAt = currentEvent?.participatedAt ?? changedAt;
      const prizeTitle =
        resultStatus === 'won'
          ? currentEvent?.prizeTitle || getPrizeDisplay(currentEvent)
          : undefined;

      saveEventResult(eventId, resultStatus, { prizeTitle });
      persistRemote(
        eventId,
        {
          status: 'done',
          resultStatus,
          participatedAt,
          resultCheckedAt: changedAt,
          receiptStatus: currentEvent?.receiptStatus ?? 'unclaimed',
          ...(prizeTitle ? { prizeTitle } : {}),
        },
        setSyncError,
      );

      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                status: 'done',
                resultStatus,
                participatedAt: event.participatedAt ?? participatedAt,
                resultCheckedAt: changedAt,
                receiptStatus: event.receiptStatus ?? 'unclaimed',
                prizeTitle: prizeTitle ?? event.prizeTitle,
              }
            : event,
        ),
      );
    },
    [events, setEvents, setSyncError],
  );

  const updateAnnouncement = useCallback(
    (eventId, meta) => {
      const currentEvent = events.find((event) => event.id === eventId);
      const participatedAt = currentEvent?.participatedAt ?? new Date().toISOString();
      saveEventAnnouncement(eventId, meta);
      persistRemote(
        eventId,
        {
          status: 'done',
          resultStatus: currentEvent?.resultStatus ?? 'unknown',
          participatedAt,
          ...meta,
        },
        setSyncError,
      );
      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                status: 'done',
                resultStatus: event.resultStatus ?? 'unknown',
                participatedAt: event.participatedAt ?? participatedAt,
                ...meta,
              }
            : event,
        ),
      );
    },
    [events, setEvents, setSyncError],
  );

  const updateWinningMeta = useCallback(
    (eventId, meta) => {
      saveWinningMeta(eventId, meta);
      persistRemote(eventId, { status: 'done', resultStatus: 'won', ...meta }, setSyncError);
      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                status: 'done',
                resultStatus: 'won',
                ...meta,
                prizeTitle:
                  typeof meta.prizeTitle === 'string' ? meta.prizeTitle : event.prizeTitle,
                prizeAmount:
                  typeof meta.prizeAmount === 'string'
                    ? meta.prizeAmount.replace(/[^\d]/g, '')
                    : event.prizeAmount,
                winningMemo:
                  typeof meta.winningMemo === 'string' ? meta.winningMemo : event.winningMemo,
              }
            : event,
        ),
      );
    },
    [setEvents, setSyncError],
  );

  return { updateStatus, updateResult, updateAnnouncement, updateWinningMeta };
}
