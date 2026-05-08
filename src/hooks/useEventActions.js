import { useCallback, useEffect } from 'react';
import {
  saveEventAnnouncement,
  saveEventResult,
  saveEventStatus,
  saveWinningMeta,
  removeEventState,
} from '../storage/eventStatusStorage.js';
import { saveExcludedEvent } from '../storage/excludedEventStorage.js';
import { updateSupabaseEventState } from '../storage/supabaseEventStorage.js';
import {
  enqueueSyncPatch,
  getSyncQueueSummary,
  markSyncAttempt,
  readSyncQueue,
  writeSyncQueue,
} from '../storage/syncQueueStorage.js';
import {
  applyStatusChange,
  buildStatusPatch,
  getPrizeDisplay,
} from '../utils/eventModel.js';
import { normalizePrizeAmountInput } from '../utils/format.js';

const SYNC_FAILED_MESSAGE = 'DB 저장 실패. 로컬에 보관했고 자동 재시도합니다.';
const SYNC_RECOVERED_MESSAGE = '밀린 저장을 DB에 반영했습니다.';

function persistRemote(eventId, patch, setSyncNotice) {
  setSyncNotice(null);
  updateSupabaseEventState(eventId, patch)
    .then(() => setSyncNotice(null))
    .catch((error) => {
      enqueueSyncPatch(eventId, patch);
      setSyncNotice({
        type: 'warning',
        message: `${SYNC_FAILED_MESSAGE} (${error.message})`,
      });
    });
}

export function useEventActions({ events, setEvents, setSyncNotice }) {
  useEffect(() => {
    let isRetrying = false;

    async function flushQueue() {
      if (isRetrying) return;
      const queue = readSyncQueue();
      if (queue.length === 0) return;

      isRetrying = true;
      setSyncNotice({
        type: 'info',
        message: `저장 재시도 중입니다. 남은 작업 ${queue.length}개`,
      });

      const failedItems = [];
      let successCount = 0;

      for (const item of queue) {
        try {
          await updateSupabaseEventState(item.eventId, item.patch);
          successCount += 1;
        } catch (error) {
          failedItems.push(markSyncAttempt(item, error.message));
        }
      }

      writeSyncQueue(failedItems);

      if (failedItems.length > 0) {
        setSyncNotice({
          type: 'warning',
          message: `저장 재시도 실패 ${failedItems.length}개. 네트워크가 돌아오면 다시 시도합니다.`,
        });
      } else if (successCount > 0) {
        setSyncNotice({ type: 'success', message: SYNC_RECOVERED_MESSAGE });
        window.setTimeout(() => setSyncNotice(null), 2500);
      }

      isRetrying = false;
    }

    const summary = getSyncQueueSummary();
    if (summary.pendingCount > 0) {
      setSyncNotice({
        type: summary.failedCount > 0 ? 'warning' : 'info',
        message: `DB 반영 대기 ${summary.pendingCount}개. 자동 재시도합니다.`,
      });
    }

    flushQueue();
    window.addEventListener('online', flushQueue);
    const intervalId = window.setInterval(flushQueue, 10000);

    return () => {
      window.removeEventListener('online', flushQueue);
      window.clearInterval(intervalId);
    };
  }, [setSyncNotice]);

  const updateStatus = useCallback(
    (eventId, status) => {
      const changedAt = new Date().toISOString();
      const currentEvent = events.find((event) => event.id === eventId);
      saveEventStatus(eventId, status);
      if (status === 'skipped') {
        saveExcludedEvent(currentEvent);
      }
      persistRemote(eventId, buildStatusPatch(currentEvent, status, changedAt), setSyncNotice);
      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.id === eventId ? applyStatusChange(event, status, changedAt) : event,
        ),
      );
    },
    [events, setEvents, setSyncNotice],
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
        setSyncNotice,
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
    [events, setEvents, setSyncNotice],
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
        setSyncNotice,
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
    [events, setEvents, setSyncNotice],
  );

  const updateWinningMeta = useCallback(
    (eventId, meta) => {
      saveWinningMeta(eventId, meta);
      persistRemote(eventId, { status: 'done', resultStatus: 'won', ...meta }, setSyncNotice);
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
                    ? normalizePrizeAmountInput(meta.prizeAmount)
                    : event.prizeAmount,
                winningMemo:
                  typeof meta.winningMemo === 'string' ? meta.winningMemo : event.winningMemo,
              }
            : event,
        ),
      );
    },
    [setEvents, setSyncNotice],
  );

  const deleteInboxEvent = useCallback(
    (eventId) => {
      const patch = {
        status: 'ready',
        resultStatus: 'unknown',
        participatedAt: null,
        resultCheckedAt: null,
        resultAnnouncementDate: null,
        resultAnnouncementText: '',
        prizeTitle: '',
        prizeAmount: '',
        receiptStatus: 'unclaimed',
        winningMemo: '',
      };

      removeEventState(eventId);
      persistRemote(eventId, patch, setSyncNotice);
      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.id === eventId
            ? {
                ...event,
                status: 'ready',
                resultStatus: 'unknown',
                participatedAt: null,
                resultCheckedAt: null,
                resultAnnouncementDate: '',
                resultAnnouncementText: '',
                prizeTitle: '',
                prizeAmount: '',
                receiptStatus: 'unclaimed',
                winningMemo: '',
              }
            : event,
        ),
      );
    },
    [setEvents, setSyncNotice],
  );

  return {
    updateStatus,
    updateResult,
    updateAnnouncement,
    updateWinningMeta,
    deleteInboxEvent,
  };
}
