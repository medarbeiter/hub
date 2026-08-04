'use client';

import {Button, useToast} from '@astryxdesign/core';
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {stampAction, undoStampAction} from '@/app/actions';
import {daySummary, fmtTime, nowMinutes, type DaySummary} from '@/lib/format';
import {checkDay, feierabendPrognose, type DayCompliance, type Prognose} from '@/lib/arbzg';
import type {ClockStatus} from '@/lib/time';
import type {TimelineSegment} from './day-timeline';

export type StampAction = 'einstempeln' | 'pause' | 'fortsetzen' | 'ausstempeln';

/** After this time, a still-running day earns a reminder (in-app + notification). */
export const REMINDER_MIN = 19 * 60;

export interface ClockValue {
  today: string;
  nowMin: number;
  /** Today's segments — optimistically updated the instant a stamp is pressed. */
  segments: TimelineSegment[];
  status: ClockStatus;
  since: number | null;
  sinceYesterday: boolean;
  summary: DaySummary;
  sollMin: number;
  /** Live "when can I go home?" — remaining Soll plus any break still owed. */
  prognose: Prognose | null;
  /** Today's ArbZG picture, provisional while the day runs. */
  compliance: DayCompliance;
  stamp: (action: StampAction) => Promise<{error: string | null}>;
}

const ClockContext = createContext<ClockValue | null>(null);

export function useClock(): ClockValue {
  const value = useContext(ClockContext);
  if (!value) throw new Error('useClock benötigt einen ClockProvider.');
  return value;
}

function deriveState(segments: TimelineSegment[]): {status: ClockStatus; since: number | null} {
  const open = segments.find((s) => s.end_min === null);
  if (!open) return {status: 'aus', since: null};
  return {status: open.kind, since: open.start_min};
}

interface ClockProviderProps {
  today: string;
  initialNowMin: number;
  segments: TimelineSegment[];
  status: ClockStatus;
  since: number | null;
  sinceYesterday: boolean;
  sollMin: number;
  children: ReactNode;
}

/**
 * The single source of truth for the clock: live tick, today's segments with
 * optimistic stamping, and the undo toast after Ausstempeln. Mounted once in
 * the authenticated layout so every route shares one state.
 */
export function ClockProvider(props: ClockProviderProps) {
  const [nowMin, setNowMin] = useState(props.initialNowMin);
  const [optimistic, setOptimistic] = useState<TimelineSegment[] | null>(null);
  const notifiedRef = useRef(false);
  const router = useRouter();
  const showToast = useToast();

  // Fresh server data supersedes the optimistic overlay.
  useEffect(() => {
    setOptimistic(null);
  }, [props.segments]);

  // Live tick + midnight rollover.
  useEffect(() => {
    setNowMin(nowMinutes());
    const interval = setInterval(() => {
      setNowMin((prev) => {
        const next = nowMinutes();
        if (next < prev) router.refresh();
        return next;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  const segments = optimistic ?? props.segments;
  const {status, since, sinceYesterday} = optimistic
    ? {...deriveState(optimistic), sinceYesterday: false}
    : {status: props.status, since: props.since, sinceYesterday: props.sinceYesterday};
  const summary = daySummary(segments, props.today, nowMin, props.today);
  const compliance = checkDay(segments, props.today, nowMin, props.today);
  const prognose = feierabendPrognose({
    segments,
    workedMin: summary.workedMin,
    sollMin: props.sollMin,
    nowMin,
    isRunning: status !== 'aus',
  });

  // Browser notification once past the reminder hour while still clocked in.
  useEffect(() => {
    if (status === 'aus' || nowMin < REMINDER_MIN) return;
    if (!notifiedRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      notifiedRef.current = true;
      new Notification('MedArbeiter – noch eingestempelt?', {
        body: `Sie sind seit ${since !== null ? fmtTime(since) : 'heute'} ${status === 'pause' ? 'in der Pause' : 'eingestempelt'}. Ausstempeln nicht vergessen.`,
        icon: '/logo-mark.png',
      });
    }
  }, [nowMin, status, since]);

  const stamp = useCallback(
    async (action: StampAction): Promise<{error: string | null}> => {
      // Ask for notification permission on the first Einstempeln (user gesture).
      if (action === 'einstempeln' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      const now = nowMinutes();
      const closeOpen = (list: TimelineSegment[]) =>
        list
          .map((s) => (s.end_min === null ? {...s, end_min: Math.max(now, s.start_min + 1)} : s))
          .filter((s) => s.end_min === null || s.end_min > s.start_min);
      const openSegment = (kind: 'arbeit' | 'pause'): TimelineSegment => ({
        id: -Date.now(),
        date: props.today,
        kind,
        start_min: now,
        end_min: null,
      });
      const base = props.segments;
      let next: TimelineSegment[] = base;
      if (action === 'einstempeln') next = [...base, openSegment('arbeit')];
      if (action === 'pause') next = [...closeOpen(base), openSegment('pause')];
      if (action === 'fortsetzen') next = [...closeOpen(base), openSegment('arbeit')];
      if (action === 'ausstempeln') next = closeOpen(base);
      setOptimistic(next);
      const result = await stampAction(action);
      if (result.error) {
        setOptimistic(null);
        return result;
      }
      if (action === 'ausstempeln') {
        const dismiss = showToast({
          body: `Ausgestempelt um ${fmtTime(now)}`,
          type: 'info',
          isAutoHide: true,
          autoHideDuration: 30_000,
          uniqueID: 'ausstempeln-undo',
          endContent: (
            <Button
              label="Rückgängig"
              variant="secondary"
              size="sm"
              onClick={() => {
                dismiss();
                void undoStampAction().then(() => router.refresh());
              }}
            />
          ),
        });
      }
      router.refresh();
      return {error: null};
    },
    [props.segments, props.today, router, showToast],
  );

  const value = useMemo<ClockValue>(
    () => ({
      today: props.today,
      nowMin,
      segments,
      status,
      since,
      sinceYesterday,
      summary,
      sollMin: props.sollMin,
      prognose,
      compliance,
      stamp,
    }),
    [props.today, nowMin, segments, status, since, sinceYesterday, summary, props.sollMin, prognose, compliance, stamp],
  );

  return <ClockContext.Provider value={value}>{props.children}</ClockContext.Provider>;
}
