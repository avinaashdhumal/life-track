export interface NativeAlarmOptions {
  id: string;
  triggerTimeMs: number;
  title: string;
  message: string;
  channelId?: 'medicines' | 'appointments' | 'routine' | 'exercise' | 'water_meals' | 'habits' | 'summaries';
  isFullAlarm?: boolean;
  snoozeIntervalMinutes?: number;
  payload?: Record<string, unknown>;
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
  firedAtMs?: number;
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

export async function scheduleAlarm(options: NativeAlarmOptions): Promise<boolean> {
  if (NativeAlarmModule?.scheduleAlarm) {
    return NativeAlarmModule.scheduleAlarm(options);
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

export async function getLastFiredAlarm(): Promise<NativeAlarmInfo | null> {
  if (NativeAlarmModule?.getLastFiredAlarm) {
    return NativeAlarmModule.getLastFiredAlarm();
  }
  return null;
}
