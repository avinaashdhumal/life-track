export interface NativeAlarmLabels {
  taken?: string;
  snooze?: string;
  skip?: string;
  badge?: string;
}

export interface NativeAlarmOptions {
  id: string;
  triggerTimeMs: number;
  title: string;
  message: string;
  channelId?: 'medicines' | 'appointments' | 'routine' | 'exercise' | 'water_meals' | 'habits' | 'summaries';
  isFullAlarm?: boolean;
  snoozeIntervalMinutes?: number;
  payload?: Record<string, unknown>;
  /** Native roll-forward: when this fires, schedule `${seriesPrefix}_${yyyyMMdd}_${seriesSuffix}` this many days later. */
  repeatEveryDays?: number;
  repeatUntilMs?: number;
  seriesPrefix?: string;
  seriesSuffix?: string;
  vibrate?: boolean;
  /** Stop ringing after this many minutes without user action (0 = ring until acted on). */
  autoDismissMinutes?: number;
  /** Localized button and badge text for the native notification and lock-screen alarm. */
  labels?: NativeAlarmLabels;
}

export interface NativeAlarmInfo {
  id: string;
  triggerTimeMs: number;
  title: string;
  message: string;
  channelId: string;
  isFullAlarm: boolean;
  snoozeIntervalMinutes: number;
  payloadJson?: string;
  repeatEveryDays?: number;
  firedAtMs?: number;
}

export type NativeAlarmAction = 'TAKEN' | 'SNOOZED' | 'SKIPPED' | 'DISMISSED' | 'MISSED' | 'FIRED';

/** An alarm event that happened natively (possibly while JS was dead), waiting for JS to apply it. */
export interface NativePendingAction {
  alarmId: string;
  action: NativeAlarmAction;
  atMs: number;
  triggerTimeMs: number;
  title: string;
  payloadJson: string;
}

// In Expo Native Environment, this is resolved via requireNativeModule('AlarmEngine')
let NativeAlarmModule: any = null;
try {
  // @ts-ignore
  const { requireNativeModule } = require('expo-modules-core');
  NativeAlarmModule = requireNativeModule('AlarmEngine');
} catch {
  // Web / fallback environment
}

/** True when the Kotlin alarm engine is present (Android dev/preview/production builds). */
export function isAvailable(): boolean {
  return !!NativeAlarmModule?.scheduleAlarm;
}

export async function scheduleAlarm(options: NativeAlarmOptions): Promise<boolean> {
  if (NativeAlarmModule?.scheduleAlarm) {
    const sanitized: Record<string, unknown> = {
      id: String(options.id || `alarm_${Date.now()}`),
      triggerTimeMs: Number(options.triggerTimeMs || Date.now()),
      title: String(options.title || 'Reminder'),
      message: String(options.message || ''),
      channelId: String(options.channelId || 'medicines'),
      isFullAlarm: options.isFullAlarm !== false,
      snoozeIntervalMinutes: Number(options.snoozeIntervalMinutes || 10),
      repeatEveryDays: Math.max(0, Math.floor(Number(options.repeatEveryDays || 0))),
      repeatUntilMs: Number(options.repeatUntilMs || 0),
      seriesPrefix: String(options.seriesPrefix || ''),
      seriesSuffix: String(options.seriesSuffix || ''),
      vibrate: options.vibrate !== false,
      autoDismissMinutes: Math.max(0, Math.floor(Number(options.autoDismissMinutes ?? 5))),
      labels: {
        taken: String(options.labels?.taken || ''),
        snooze: String(options.labels?.snooze || ''),
        skip: String(options.labels?.skip || ''),
        badge: String(options.labels?.badge || '')
      }
    };
    if (options.payload && typeof options.payload === 'object') {
      sanitized.payload = options.payload;
    }
    return NativeAlarmModule.scheduleAlarm(sanitized);
  }
  return false;
}

export async function cancelAlarm(id: string): Promise<boolean> {
  if (NativeAlarmModule?.cancelAlarm) {
    return NativeAlarmModule.cancelAlarm(id);
  }
  return false;
}

export async function cancelAll(): Promise<boolean> {
  if (NativeAlarmModule?.cancelAll) {
    return NativeAlarmModule.cancelAll();
  }
  return false;
}

export async function getScheduledAlarms(): Promise<NativeAlarmInfo[]> {
  if (NativeAlarmModule?.getScheduledAlarms) {
    return NativeAlarmModule.getScheduledAlarms();
  }
  return [];
}

/** Returns and clears the native action queue (notification/lock-screen taps, misses). */
export async function drainPendingActions(): Promise<NativePendingAction[]> {
  if (NativeAlarmModule?.drainPendingActions) {
    return NativeAlarmModule.drainPendingActions();
  }
  return [];
}

/** Android 14+: whether the system lets LifeTrack show full-screen alarms over the lock screen. */
export async function canUseFullScreenIntent(): Promise<boolean> {
  if (NativeAlarmModule?.canUseFullScreenIntent) {
    return NativeAlarmModule.canUseFullScreenIntent();
  }
  return true;
}

export async function openFullScreenIntentSettings(): Promise<boolean> {
  if (NativeAlarmModule?.openFullScreenIntentSettings) {
    return NativeAlarmModule.openFullScreenIntentSettings();
  }
  return false;
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  if (NativeAlarmModule?.canScheduleExactAlarms) {
    return NativeAlarmModule.canScheduleExactAlarms();
  }
  return true;
}

export async function openExactAlarmSettings(): Promise<boolean> {
  if (NativeAlarmModule?.openExactAlarmSettings) {
    return NativeAlarmModule.openExactAlarmSettings();
  }
  return false;
}

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (NativeAlarmModule?.isIgnoringBatteryOptimizations) {
    return NativeAlarmModule.isIgnoringBatteryOptimizations();
  }
  return true;
}

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  if (NativeAlarmModule?.requestIgnoreBatteryOptimizations) {
    return NativeAlarmModule.requestIgnoreBatteryOptimizations();
  }
  return false;
}

export async function getManufacturer(): Promise<string> {
  if (NativeAlarmModule?.getManufacturer) {
    return NativeAlarmModule.getManufacturer();
  }
  return 'generic';
}

export async function openAutostartSettings(): Promise<boolean> {
  if (NativeAlarmModule?.openAutostartSettings) {
    return NativeAlarmModule.openAutostartSettings();
  }
  return false;
}

export interface NativeChannelInfo {
  id: string;
  name: string;
  description: string;
  importance: number;
  soundUri: string;
  hasCustomSound: boolean;
}

export async function openChannelNotificationSettings(channelId: string): Promise<boolean> {
  if (NativeAlarmModule?.openChannelNotificationSettings) {
    return NativeAlarmModule.openChannelNotificationSettings(channelId);
  }
  return false;
}

export async function openAppNotificationSettings(): Promise<boolean> {
  if (NativeAlarmModule?.openAppNotificationSettings) {
    return NativeAlarmModule.openAppNotificationSettings();
  }
  return false;
}

export async function getNotificationChannels(): Promise<NativeChannelInfo[]> {
  if (NativeAlarmModule?.getNotificationChannels) {
    return NativeAlarmModule.getNotificationChannels();
  }
  return [
    {
      id: 'medicines',
      name: 'Medicines & Prescriptions',
      description: 'Critical medicine reminders and dose schedules',
      importance: 4,
      soundUri: 'System Default Alarm',
      hasCustomSound: false
    },
    {
      id: 'appointments',
      name: 'Appointments & Visits',
      description: 'Doctor visits, clinic appointments, and lab tests',
      importance: 4,
      soundUri: 'System Default Alarm',
      hasCustomSound: false
    },
    {
      id: 'routine',
      name: 'Daily Routine',
      description: 'Wake up, sleep, wind-down, and routine milestones',
      importance: 4,
      soundUri: 'System Default Alarm',
      hasCustomSound: false
    },
    {
      id: 'exercise',
      name: 'Exercise & Fitness',
      description: 'Workouts, yoga, meditation, and physical activity',
      importance: 4,
      soundUri: 'System Default Notification',
      hasCustomSound: false
    },
    {
      id: 'water_meals',
      name: 'Water & Meals',
      description: 'Hydration intervals and meal timing',
      importance: 4,
      soundUri: 'System Default Notification',
      hasCustomSound: false
    },
    {
      id: 'habits',
      name: 'Daily Habits',
      description: 'Habit check-ins and streaks',
      importance: 3,
      soundUri: 'System Default Notification',
      hasCustomSound: false
    },
    {
      id: 'summaries',
      name: 'Summaries & Reports',
      description: 'Weekly insights and health summaries',
      importance: 2,
      soundUri: 'Silent / Low',
      hasCustomSound: false
    }
  ];
}

export async function getLastFiredAlarm(): Promise<NativeAlarmInfo | null> {
  if (NativeAlarmModule?.getLastFiredAlarm) {
    return NativeAlarmModule.getLastFiredAlarm();
  }
  return null;
}
