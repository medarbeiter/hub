'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createSession, destroySession, requireUser, requireVerwaltung, verifyLogin} from '@/lib/auth';
import {
  activeUsers,
  createSegment,
  deleteSegment,
  getUser,
  isMonthLocked,
  lockMonth,
  monthRecord,
  segmentsForDay,
  stamp,
  unlockMonth,
  updateSegment,
  validateSegment,
  type SegmentInput,
} from '@/lib/time';
import {monthOf, todayISO} from '@/lib/format';
import {createUser, resetPassword, setUserActive, updateUser, type UserInput} from '@/lib/users';
import {getDb} from '@/lib/db';

export interface ActionState {
  error: string | null;
}

const OK: ActionState = {error: null};

function parseTime(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const min = Number(match[1]) * 60 + Number(match[2]);
  return min >= 0 && min <= 1440 ? min : null;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return {error: 'Bitte E-Mail und Passwort eingeben.'};
  const user = await verifyLogin(email, password);
  if (!user) return {error: 'E-Mail oder Passwort ist falsch.'};
  await createSession(user.id);
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}

// ---------------------------------------------------------------------------
// Stamping
// ---------------------------------------------------------------------------

export async function stampAction(
  action: 'einstempeln' | 'pause' | 'fortsetzen' | 'ausstempeln',
): Promise<ActionState> {
  const user = await requireUser();
  const error = stamp(user.id, action);
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// Segment corrections
// ---------------------------------------------------------------------------

function segmentInputFromForm(formData: FormData): SegmentInput | string {
  const date = String(formData.get('date') ?? '');
  const kind = String(formData.get('kind') ?? 'arbeit');
  const startMin = parseTime(formData.get('start'));
  const endMin = parseTime(formData.get('end'));
  if (startMin === null || endMin === null) return 'Bitte Beginn und Ende im Format HH:MM angeben.';
  if (kind !== 'arbeit' && kind !== 'pause') return 'Ungültige Art.';
  const note = String(formData.get('note') ?? '').trim();
  return {date, kind, startMin, endMin, note: note || undefined};
}

export async function segmentSaveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const input = segmentInputFromForm(formData);
  if (typeof input === 'string') return {error: input};
  const segmentId = Number(formData.get('segmentId') ?? 0);
  const userId = Number(formData.get('userId') ?? actor.id);
  const error = segmentId
    ? updateSegment(actor, segmentId, input)
    : createSegment(actor, userId, input);
  if (error) return {error};
  revalidatePath('/', 'layout');
  return OK;
}

export async function segmentDeleteAction(segmentId: number): Promise<ActionState> {
  const actor = await requireUser();
  const error = deleteSegment(actor, segmentId);
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// Monatsabschluss
// ---------------------------------------------------------------------------

export async function lockMonthAction(userId: number, month: string): Promise<ActionState> {
  const actor = await requireVerwaltung();
  const error = lockMonth(actor, userId, month);
  revalidatePath('/', 'layout');
  return {error};
}

/** Lock the month for every employee without open entries; returns counts. */
export async function lockAllAction(month: string): Promise<{locked: number; skipped: number; error: string | null}> {
  const actor = await requireVerwaltung();
  if (month >= monthOf(todayISO())) {
    return {locked: 0, skipped: 0, error: 'Der laufende Monat kann noch nicht abgeschlossen werden.'};
  }
  let locked = 0;
  let skipped = 0;
  for (const user of activeUsers()) {
    if (isMonthLocked(user.id, month)) continue;
    const record = monthRecord(user, month);
    if (record.openSegments > 0) {
      skipped += 1;
      continue;
    }
    const error = lockMonth(actor, user.id, month);
    if (error === null) locked += 1;
    else skipped += 1;
  }
  revalidatePath('/', 'layout');
  return {locked, skipped, error: null};
}

// ---------------------------------------------------------------------------
// Drag-to-correct (programmatic segment resize from the timeline)
// ---------------------------------------------------------------------------

export async function segmentResizeAction(segmentId: number, startMin: number, endMin: number): Promise<ActionState> {
  const actor = await requireUser();
  const segment = getDb()
    .query<{user_id: number; date: string; kind: 'arbeit' | 'pause'; note: string | null}, [number]>(
      'SELECT user_id, date, kind, note FROM segments WHERE id = ?',
    )
    .get(segmentId);
  if (!segment) return {error: 'Eintrag nicht gefunden.'};
  const error = updateSegment(actor, segmentId, {
    date: segment.date,
    kind: segment.kind,
    startMin,
    endMin,
    note: segment.note ?? undefined,
  });
  revalidatePath('/', 'layout');
  return {error};
}

// ---------------------------------------------------------------------------
// User management (Verwaltung)
// ---------------------------------------------------------------------------

export interface UserActionState {
  error: string | null;
  /** One-time password to hand to the employee; shown exactly once. */
  password?: string;
}

function userInputFromForm(formData: FormData): UserInput {
  return {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    role: (String(formData.get('role') ?? 'mitarbeiter') as UserInput['role']),
    weeklyMinutes: Math.round(Number(formData.get('weeklyHours') ?? 0) * 60),
  };
}

export async function userCreateAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const actor = await requireVerwaltung();
  const result = await createUser(actor, userInputFromForm(formData));
  revalidatePath('/', 'layout');
  return 'error' in result ? {error: result.error} : {error: null, password: result.password};
}

export async function userUpdateAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const actor = await requireVerwaltung();
  const userId = Number(formData.get('userId') ?? 0);
  const error = updateUser(actor, userId, userInputFromForm(formData));
  revalidatePath('/', 'layout');
  return {error};
}

export async function userResetPasswordAction(userId: number): Promise<UserActionState> {
  const actor = await requireVerwaltung();
  const result = await resetPassword(actor, userId);
  return 'error' in result ? {error: result.error} : {error: null, password: result.password};
}

export async function userSetActiveAction(userId: number, active: boolean): Promise<ActionState> {
  const actor = await requireVerwaltung();
  const error = setUserActive(actor, userId, active);
  revalidatePath('/', 'layout');
  return {error};
}

export async function unlockMonthAction(userId: number, month: string): Promise<ActionState> {
  const actor = await requireVerwaltung();
  const error = unlockMonth(actor, userId, month);
  revalidatePath('/', 'layout');
  return {error};
}
