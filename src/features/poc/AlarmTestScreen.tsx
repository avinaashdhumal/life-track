import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { reminderService } from '../../services/AlarmEngineService';
import {
  AlarmItem,
  NotificationChannelId,
  RecurringSchedule,
  ReminderLogEntry,
  AlarmCategory,
  ALARM_CATEGORIES,
  resolveAlarmCategory
} from '../../domain/alarm';
import { detectAlarmConflict, AlarmConflictResult } from '../../domain/alarmConflict';
import { AlarmFormScreen } from './AlarmFormScreen';
import { AlarmConflictModal } from './AlarmConflictModal';
import { Alarm24hTimelineChart, CategoryIcon } from './Alarm24hTimelineChart';
import {
  Bell,
  Clock,
  Play,
  RotateCcw,
  Volume2,
  Trash2,
  ShieldCheck,
  Zap,
  Repeat,
  Plus,
  ToggleLeft,
  ToggleRight,
  Tag,
  Pencil,
  RefreshCw
} from 'lucide-react-native';

interface AlarmTestScreenProps {
  onTriggerAlarmDirectly: (alarm: AlarmItem) => void;
  onOpenHealthCheck: () => void;
}

export const AlarmTestScreen: React.FC<AlarmTestScreenProps> = ({
  onTriggerAlarmDirectly,
  onOpenHealthCheck
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [logs, setLogs] = useState<ReminderLogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AlarmCategory>('medicine');
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannelId>('medicines');
  const [isFullAlarm, setIsFullAlarm] = useState(true);
  const [title, setTitle] = useState('Metformin 500mg');
  const [message, setMessage] = useState('Take 1 tablet with warm water');
  const [now, setNow] = useState(Date.now());
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringSchedule | null>(null);
  const [, setJustScheduledId] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{
    candidate: {
      id: string;
      category: AlarmCategory;
      triggerTimeMs: number;
      title: string;
      message: string;
      channelId: NotificationChannelId;
      isFullAlarm: boolean;
      snoozeIntervalMinutes: number;
    };
    conflictResult: AlarmConflictResult;
  } | null>(null);

  const getCategoryLabel = (catId: AlarmCategory): string => {
    return t(`categories.${catId}`) || ALARM_CATEGORIES[catId]?.label || catId;
  };

  const handleSelectTestCategory = (catId: AlarmCategory) => {
    setSelectedCategory(catId);
    const catDef = ALARM_CATEGORIES[catId];
    setSelectedChannel(catDef.defaultChannel);
    setIsFullAlarm(catDef.defaultStyle === 'full_alarm');
    if (catId === 'medicine') {
      setTitle('Metformin 500mg');
      setMessage('Take 1 tablet with breakfast');
    } else if (catId === 'exercise') {
      setTitle('Morning Yoga & Cardio');
      setMessage('30-minute session');
    } else if (catId === 'reminder') {
      setTitle('Inspect Wound Dressing');
      setMessage('Check clean dressing');
    } else if (catId === 'appointment') {
      setTitle('Doctor Clinic Visit');
      setMessage('Bring recent blood tests report');
    } else if (catId === 'hydration') {
      setTitle('Drink 500ml Water');
      setMessage('Hydration milestone');
    } else if (catId === 'habit') {
      setTitle('Evening Meditation');
      setMessage('10 min breath awareness');
    } else if (catId === 'vitals') {
      setTitle('Check Blood Pressure');
      setMessage('Log systolic and diastolic values');
    }
  };

  // Refresh clock every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll service alarms, recurring schedules and logs
  const refreshData = async () => {
    const list = await reminderService.getScheduledAlarms();
    const schedules = await reminderService.getRecurringSchedules();
    const eventLogs = await reminderService.getLogs();
    setAlarms(list);
    setRecurringSchedules(schedules);
    setLogs(eventLogs);

    // Check if any alarm reached its trigger time
    const currentTime = Date.now();
    for (const item of list) {
      if (item.triggerTimeMs <= currentTime) {
        await reminderService.cancelAlarm(item.id);
        await reminderService.logAction({
          profileId: 'default',
          alarmId: item.id,
          action: 'FIRED',
          timestampMs: currentTime,
          scheduledTimeMs: item.triggerTimeMs,
          note: 'Alarm trigger time reached'
        });
        onTriggerAlarmDirectly(item);
        break;
      }
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 1000);
    return () => clearInterval(interval);
  }, []);

  const executeSchedule = async (candidate: {
    id: string;
    category: AlarmCategory;
    triggerTimeMs: number;
    title: string;
    message: string;
    channelId: NotificationChannelId;
    isFullAlarm: boolean;
    snoozeIntervalMinutes: number;
  }) => {
    await reminderService.scheduleAlarm({
      id: candidate.id,
      category: candidate.category,
      triggerTimeMs: candidate.triggerTimeMs,
      title: candidate.title,
      message: candidate.message,
      channelId: candidate.channelId,
      isFullAlarm: candidate.isFullAlarm,
      snoozeIntervalMinutes: candidate.snoozeIntervalMinutes
    });
    setJustScheduledId(candidate.id);
    await refreshData();
  };

  const handleScheduleTwoMinutes = async () => {
    const targetMs = Date.now() + 2 * 60 * 1000; // Exact 2 minutes ahead
    const candidate = {
      id: `alarm_2min_${Date.now()}`,
      category: selectedCategory,
      triggerTimeMs: targetMs,
      title: title || 'Scheduled Medicine Dose',
      message: message || '2-Minute Proof of Concept Alarm',
      channelId: selectedChannel,
      isFullAlarm,
      snoozeIntervalMinutes: 10
    };

    const conflictResult = detectAlarmConflict(targetMs, alarms, 5);
    if (conflictResult.hasConflict) {
      setPendingConflict({ candidate, conflictResult });
      return;
    }

    await executeSchedule(candidate);
  };

  const handleScheduleTenSeconds = async () => {
    const targetMs = Date.now() + 10 * 1000; // 10 seconds ahead
    const candidate = {
      id: `alarm_10s_${Date.now()}`,
      category: selectedCategory,
      triggerTimeMs: targetMs,
      title: `${title || 'Quick Test'} (10s)`,
      message: message || 'Quick testing alarm',
      channelId: selectedChannel,
      isFullAlarm,
      snoozeIntervalMinutes: 5
    };

    const conflictResult = detectAlarmConflict(targetMs, alarms, 5);
    if (conflictResult.hasConflict) {
      setPendingConflict({ candidate, conflictResult });
      return;
    }

    await executeSchedule(candidate);
  };

  const handleSaveRecurring = async (newSchedule: Omit<RecurringSchedule, 'id' | 'createdAt'>) => {
    await reminderService.createRecurringSchedule(newSchedule);
    setShowRecurringModal(false);
    setEditingSchedule(null);
    await refreshData();
  };

  const handleOpenEditRecurring = (schedule: RecurringSchedule) => {
    setEditingSchedule(schedule);
    setShowRecurringModal(true);
  };

  const handleUpdateRecurring = async (
    id: string,
    updates: Partial<Omit<RecurringSchedule, 'id' | 'createdAt'>>
  ) => {
    await reminderService.updateRecurringSchedule(id, updates);
    setShowRecurringModal(false);
    setEditingSchedule(null);
    await refreshData();
  };

  const handleToggleRecurring = async (id: string, currentEnabled: boolean) => {
    await reminderService.toggleRecurringSchedule(id, !currentEnabled);
    await refreshData();
  };

  const handleDeleteRecurring = async (id: string) => {
    await reminderService.deleteRecurringSchedule(id);
    await refreshData();
  };

  const handleCancel = async (id: string) => {
    await reminderService.cancelAlarm(id);
    await refreshData();
  };

  const handleClearAll = async () => {
    await reminderService.cancelAll();
    await refreshData();
  };

  const handleManualTrigger = (alarm: AlarmItem) => {
    handleCancel(alarm.id);
    onTriggerAlarmDirectly(alarm);
  };

  const formatCountdown = (targetMs: number) => {
    const diff = Math.max(0, Math.floor((targetMs - now) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const nextAlarm = alarms[0];

  const getRecurrenceBadge = (s: RecurringSchedule) => {
    switch (s.recurrenceType) {
      case 'daily':
        return t('recurrenceBadge.dailyAt', { time: s.timeOfDay });
      case 'weekly': {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const formattedDays = (s.weekdays || []).map((d) => days[d]).join(', ');
        return t('recurrenceBadge.weeklyAt', { days: formattedDays || t('recurrenceBadge.everyDay'), time: s.timeOfDay });
      }
      case 'every_n_days':
        return t('recurrenceBadge.everyNDaysAt', { n: s.intervalDays || 2, time: s.timeOfDay });
      case 'custom_dates':
        return t('recurrenceBadge.selectedDatesAt', { count: (s.specificDates || []).length, time: s.timeOfDay });
      case 'monthly': {
        const day = s.dayOfMonth || 1;
        return t('recurrenceBadge.monthlyOn', { day, time: s.timeOfDay });
      }
      default:
        return t('recurrenceBadge.at', { time: s.timeOfDay });
    }
  };

  return (
    <View style={tw`flex flex-col gap-5 pb-12`}>
      {/* Top Banner: Phase 0 Status */}
      <View
        style={[
          tw`rounded-3xl p-5 shadow-sm border`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-3 flex-wrap gap-2`}>
          <View style={tw`flex-row items-center gap-2 flex-wrap`}>
            <Text style={tw`px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30`}>
              {t('alarm.phaseReady')}
            </Text>
            <Text style={[tw`text-sm font-semibold`, { color: colors.textMuted }]}>
              {t('alarm.scheduler')}
            </Text>
          </View>
        </View>
        <Text style={[tw`text-sm leading-relaxed`, { color: colors.textSecondary }]}>
          {t('alarm.supportsRecurring')}
        </Text>
      </View>

      {/* Recurring Alarm Scheduler Hub Card */}
      <View
        style={[
          tw`rounded-3xl p-5 shadow-lg border`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-col gap-4 mb-4`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View
              style={[
                tw`w-12 h-12 rounded-2xl border flex items-center justify-center`,
                {
                  backgroundColor: colors.primaryBg,
                  borderColor: colors.primaryBorder
                }
              ]}
            >
              <Repeat size={24} color={colors.primary} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-lg font-bold tracking-tight`, { color: colors.text }]}>
                {t('alarm.recurringAlarms')}
              </Text>
              <Text style={[tw`text-xs mt-0.5`, { color: colors.textMuted }]}>
                {t('alarm.recurringDescription')}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowRecurringModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alarm.addNewSchedule')}
            style={[
              tw`w-full py-3.5 px-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-md min-h-12`,
              { backgroundColor: colors.primary }
            ]}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={tw`text-sm font-bold text-white`}>
              {t('alarm.addNewSchedule')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* List of Recurring Schedules */}
        <View style={tw`gap-2.5 mt-2`}>
          {recurringSchedules.map((schedule) => {
            const cat = resolveAlarmCategory(schedule);
            const catLabel = getCategoryLabel(cat.id);
            return (
              <View
                key={schedule.id}
                style={[
                  tw`p-3.5 rounded-2xl border flex-row items-center justify-between gap-3`,
                  {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.border
                  },
                  !schedule.isEnabled ? { opacity: 0.6 } : {}
                ]}
              >
                <View style={tw`flex-row items-center gap-2.5 flex-1`}>
                  <TouchableOpacity
                    onPress={() => handleToggleRecurring(schedule.id, schedule.isEnabled)}
                    accessible={true}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: schedule.isEnabled }}
                    accessibilityLabel={t('accessibility.toggleSchedule')}
                    style={tw`p-1 shrink-0 min-w-10 min-h-10 items-center justify-center`}
                  >
                    {schedule.isEnabled ? (
                      <ToggleRight size={32} color="#10b981" />
                    ) : (
                      <ToggleLeft size={32} color={colors.textSubtle} />
                    )}
                  </TouchableOpacity>

                  <View
                    style={[
                      tw`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border`,
                      {
                        backgroundColor: `${cat.color}15`,
                        borderColor: `${cat.color}30`
                      }
                    ]}
                  >
                    <View style={tw`w-5 h-5`}>
                      <CategoryIcon category={cat.id} color={cat.color} />
                    </View>
                  </View>

                  <View style={tw`flex-1`}>
                    <View style={tw`flex-row items-center gap-1.5 flex-wrap`}>
                      <Text style={[tw`text-sm font-bold flex-1 shrink`, { color: colors.text }]} numberOfLines={1}>
                        {schedule.title}
                      </Text>
                    </View>
                    <View style={tw`flex-row gap-1 mt-1`}>
                      <Text
                        style={[
                          tw`text-[10px] px-1.5 py-0.5 rounded font-bold overflow-hidden`,
                          {
                            backgroundColor: `${cat.color}15`,
                            color: cat.color
                          }
                        ]}
                      >
                        {catLabel}
                      </Text>
                      <Text
                        style={[
                          tw`text-[10px] px-1.5 py-0.5 rounded font-bold overflow-hidden`,
                          schedule.style === 'full_alarm'
                            ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }
                            : { backgroundColor: colors.border, color: colors.textMuted }
                        ]}
                      >
                        {schedule.style === 'full_alarm' ? t('alarm.fullAlarm') : t('alarm.notification')}
                      </Text>
                    </View>
                    <View style={tw`flex-row items-center gap-1 mt-1`}>
                      <Clock size={10} color={colors.primary} />
                      <Text style={[tw`text-[10px] font-medium flex-1`, { color: colors.textMuted }]} numberOfLines={1}>
                        {getRecurrenceBadge(schedule)}
                        {schedule.message ? ` • ${schedule.message}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={tw`flex-row items-center gap-1.5 shrink-0`}>
                  <TouchableOpacity
                    onPress={() => handleOpenEditRecurring(schedule)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('accessibility.editSchedule')}
                    style={tw`p-2 rounded-full bg-blue-500/10 min-w-10 min-h-10 items-center justify-center`}
                  >
                    <Pencil size={15} color="#3b82f6" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteRecurring(schedule.id)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('accessibility.deleteSchedule')}
                    style={tw`p-2 rounded-full bg-red-500/10 min-w-10 min-h-10 items-center justify-center`}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Primary 2-Minute Proof of Concept Action Card */}
      <View
        style={[
          tw`rounded-3xl p-5 shadow-xl relative overflow-hidden mt-1 border`,
          {
            backgroundColor: colors.card,
            borderColor: colors.primaryBorder
          }
        ]}
      >
        <View
          style={[
            tw`absolute top-0 right-0 w-32 h-32 rounded-bl-full`,
            { backgroundColor: colors.primaryBg }
          ]}
        />
        <View style={tw`flex-col items-start justify-between mb-5 relative z-10 gap-3`}>
          <View style={tw`flex-1 w-full`}>
            <View style={tw`flex-row items-center gap-2.5 mb-1.5`}>
              <View
                style={[
                  tw`w-10 h-10 rounded-2xl border flex items-center justify-center`,
                  {
                    backgroundColor: colors.primaryBg,
                    borderColor: colors.primaryBorder
                  }
                ]}
              >
                <Bell size={20} color={colors.primary} />
              </View>
              <Text style={[tw`text-xl font-bold tracking-tight`, { color: colors.text }]}>
                {t('alarm.quickAlarmTest')}
              </Text>
            </View>
            <Text style={[tw`text-sm pr-2 mt-1`, { color: colors.textMuted }]}>
              {t('alarm.quickAlarmDescription')}
            </Text>
          </View>
          {nextAlarm && (
            <View
              style={[
                tw`w-full flex-row items-center justify-between p-4 rounded-2xl border`,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border
                }
              ]}
            >
              <View style={tw`flex-row items-center gap-2`}>
                <Clock size={16} color="#f59e0b" />
                <Text style={tw`text-sm font-semibold text-amber-500`}>
                  {t('alarm.nextRingIn')}
                </Text>
              </View>
              <Text style={[tw`text-2xl font-mono font-bold`, { color: colors.text }]}>
                {formatCountdown(nextAlarm.triggerTimeMs)}
              </Text>
            </View>
          )}
        </View>

        {/* Category Selector Pills */}
        <View style={tw`mb-5 relative z-10`}>
          <View style={tw`flex-row items-center gap-1.5 mb-3`}>
            <Tag size={16} color={colors.primary} />
            <Text style={[tw`text-sm font-bold`, { color: colors.textSecondary }]}>
              {t('alarm.category')}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row items-center gap-2 pb-2`}>
            {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
              const catDef = ALARM_CATEGORIES[catId];
              const isSelected = selectedCategory === catId;
              const catLabel = getCategoryLabel(catId);
              return (
                <TouchableOpacity
                  key={catId}
                  onPress={() => handleSelectTestCategory(catId)}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={catLabel}
                  style={[
                    tw`px-4 py-3 rounded-2xl flex-row items-center gap-2.5 border min-h-11`,
                    isSelected
                      ? {
                          backgroundColor: colors.cardHover,
                          borderColor: catDef.color
                        }
                      : {
                          backgroundColor: colors.cardSecondary,
                          borderColor: colors.border
                        }
                  ]}
                >
                  <View style={tw`w-4 h-4`}>
                    <CategoryIcon category={catId} color={catDef.color} />
                  </View>
                  <Text
                    style={[
                      tw`text-sm font-semibold`,
                      { color: isSelected ? colors.text : colors.textMuted }
                    ]}
                  >
                    {catLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Inputs */}
        <View style={tw`flex-col gap-4 mb-6 relative z-10`}>
          <View>
            <Text style={[tw`text-sm font-bold mb-2`, { color: colors.textSecondary }]}>
              {t('alarm.reminderTitle')}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('alarm.titlePlaceholder')}
              placeholderTextColor={colors.textSubtle}
              accessible={true}
              accessibilityLabel={t('alarm.reminderTitle')}
              style={[
                tw`w-full border rounded-2xl px-5 py-4 text-base font-medium`,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text
                }
              ]}
            />
          </View>

          <View>
            <Text style={[tw`text-sm font-bold mb-2`, { color: colors.textSecondary }]}>
              {t('alarm.notificationChannel')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-2`}>
              {['medicines', 'appointments', 'routine', 'exercise', 'water_meals', 'habits', 'summaries'].map((ch) => {
                const isSelected = selectedChannel === ch;
                return (
                  <TouchableOpacity
                    key={ch}
                    onPress={() => setSelectedChannel(ch as NotificationChannelId)}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={ch}
                    style={[
                      tw`px-5 py-3 rounded-2xl border min-h-11 justify-center`,
                      isSelected
                        ? {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary
                          }
                        : {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.border
                          }
                    ]}
                  >
                    <Text
                      style={[
                        tw`text-sm font-medium`,
                        { color: isSelected ? '#ffffff' : colors.textMuted }
                      ]}
                    >
                      {ch}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View>
            <Text style={[tw`text-sm font-bold mb-2`, { color: colors.textSecondary }]}>
              {t('alarm.alarmStyle')}
            </Text>
            <TouchableOpacity
              onPress={() => setIsFullAlarm(!isFullAlarm)}
              accessible={true}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isFullAlarm }}
              accessibilityLabel={isFullAlarm ? t('alarm.fullScreenAlarm') : t('alarm.standardNotification')}
              style={[
                tw`w-full py-4 px-5 rounded-2xl border flex-row items-center justify-center gap-2 min-h-12`,
                isFullAlarm
                  ? {
                      backgroundColor: 'rgba(245, 158, 11, 0.15)',
                      borderColor: '#f59e0b'
                    }
                  : {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.border
                    }
              ]}
            >
              <Volume2 size={18} color={isFullAlarm ? '#d97706' : colors.textMuted} />
              <Text
                style={[
                  tw`text-sm font-bold`,
                  { color: isFullAlarm ? '#d97706' : colors.textSecondary }
                ]}
              >
                {isFullAlarm ? t('alarm.fullScreenAlarm') : t('alarm.standardNotification')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Buttons */}
        <View style={tw`flex-col gap-3 mt-2`}>
          <TouchableOpacity
            onPress={handleScheduleTwoMinutes}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alarm.schedule2Min')}
            style={[
              tw`py-4 px-5 rounded-2xl flex-row items-center justify-center gap-2.5 shadow-md min-h-12`,
              { backgroundColor: colors.primary }
            ]}
          >
            <Clock size={18} color="#ffffff" />
            <Text style={tw`text-white font-bold text-base`}>
              {t('alarm.schedule2Min')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleScheduleTenSeconds}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alarm.quick10sTest')}
            style={[
              tw`py-3.5 px-5 rounded-2xl border flex-row items-center justify-center gap-2 min-h-12`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <Zap size={16} color="#f59e0b" />
            <Text style={[tw`font-semibold text-sm`, { color: colors.text }]}>
              {t('alarm.quick10sTest')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 24-Hour Visual Sequence Timeline */}
      <Alarm24hTimelineChart
        alarms={alarms}
        currentTimeMs={now}
        onTriggerAlarmDirectly={handleManualTrigger}
      />

      {/* Currently Scheduled Occurrences in Native AlarmManager */}
      <View
        style={[
          tw`rounded-3xl p-5 shadow-lg border mt-1`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-5`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View
              style={[
                tw`w-10 h-10 rounded-2xl border flex items-center justify-center`,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border
                }
              ]}
            >
              <Bell size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[tw`text-lg font-bold`, { color: colors.text }]}>
                {t('alarm.upcomingAlarms')}
              </Text>
              <Text style={[tw`text-xs mt-0.5`, { color: colors.textMuted }]}>
                {t('alarm.scheduled', { count: alarms.length })}
              </Text>
            </View>
          </View>
          {alarms.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('alarm.clearAll')}
              style={tw`px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20`}
            >
              <Text style={tw`text-xs font-bold text-red-500`}>
                {t('alarm.clearAll')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {alarms.length === 0 ? (
          <View
            style={[
              tw`py-12 rounded-3xl border flex items-center justify-center`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <View
              style={[
                tw`w-16 h-16 rounded-full flex items-center justify-center mb-4`,
                { backgroundColor: colors.card }
              ]}
            >
              <Bell size={28} color={colors.textSubtle} />
            </View>
            <Text style={[tw`text-base font-bold mb-1`, { color: colors.textSecondary }]}>
              {t('alarm.allClear')}
            </Text>
            <Text style={[tw`text-sm font-medium text-center px-6`, { color: colors.textMuted }]}>
              {t('alarm.noUpcoming')}
            </Text>
          </View>
        ) : (
          <View style={tw`flex-col gap-3`}>
            {alarms.map((alarm) => {
              const cat = resolveAlarmCategory(alarm);
              const catLabel = getCategoryLabel(cat.id);
              const countdown = formatCountdown(alarm.triggerTimeMs);
              return (
                <View
                  key={alarm.id}
                  style={[
                    tw`p-4 rounded-3xl border flex-col gap-3.5`,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.border
                    }
                  ]}
                  accessible={true}
                  accessibilityLabel={t('accessibility.alarmItem', {
                    title: alarm.title,
                    time: new Date(alarm.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    countdown
                  })}
                >
                  <View style={tw`flex-row items-start gap-4`}>
                    <View
                      style={[
                        tw`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border`,
                        {
                          backgroundColor: `${cat.color}15`,
                          borderColor: `${cat.color}30`
                        }
                      ]}
                    >
                      <View style={tw`w-7 h-7`}>
                        <CategoryIcon category={cat.id} color={cat.color} />
                      </View>
                    </View>
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center flex-wrap gap-2 mb-1.5`}>
                        <Text style={[tw`text-base font-bold shrink`, { color: colors.text }]} numberOfLines={1}>
                          {alarm.title}
                        </Text>
                        <View style={tw`flex-row gap-1`}>
                          <Text
                            style={[
                              tw`text-[10px] px-2 py-0.5 rounded-md font-bold overflow-hidden`,
                              {
                                backgroundColor: `${cat.color}15`,
                                color: cat.color
                              }
                            ]}
                          >
                            {catLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={tw`flex-row items-center gap-2 flex-wrap`}>
                        <Text style={[tw`text-sm font-medium`, { color: colors.textSecondary }]}>
                          {new Date(alarm.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={{ color: colors.borderStrong }}>•</Text>
                        <Text style={tw`text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md`}>
                          {countdown} {t('alarm.left')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[tw`flex-row items-center gap-3 pt-3 border-t`, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      onPress={() => handleManualTrigger(alarm)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('alarm.testNow')}: ${alarm.title}`}
                      style={[
                        tw`flex-1 py-3 rounded-xl border flex-row items-center justify-center gap-2 min-h-11`,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border
                        }
                      ]}
                    >
                      <Play size={16} color="#10b981" />
                      <Text style={tw`text-sm font-bold text-emerald-500`}>
                        {t('alarm.testNow')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCancel(alarm.id)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={t('accessibility.cancelAlarm')}
                      style={[
                        tw`p-3 rounded-xl border min-w-11 min-h-11 items-center justify-center`,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border
                        }
                      ]}
                    >
                      <Trash2 size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* System Health Card */}
      <View
        style={[
          tw`rounded-3xl p-5 border mt-1`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-col gap-4 mb-2`}>
          <View style={tw`flex-row items-center gap-4`}>
            <View style={tw`w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center`}>
              <ShieldCheck size={28} color="#10b981" />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-lg font-bold mb-0.5`, { color: colors.text }]}>
                {t('healthCheck.systemHealth')}
              </Text>
              <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                {t('healthCheck.systemHealthDescription')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onOpenHealthCheck}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('healthCheck.runDiagnostics')}
            style={[
              tw`w-full py-3.5 rounded-2xl flex-row items-center justify-center gap-2 min-h-12 border`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
              {t('healthCheck.runDiagnostics')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recurring Alarm Scheduler Modal */}
      <Modal
        visible={showRecurringModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowRecurringModal(false);
          setEditingSchedule(null);
        }}
      >
        <AlarmFormScreen
          existingAlarms={alarms}
          initialSchedule={editingSchedule}
          onClose={() => {
            setShowRecurringModal(false);
            setEditingSchedule(null);
          }}
          onSave={handleSaveRecurring}
          onUpdate={handleUpdateRecurring}
        />
      </Modal>

      {/* Alarm Conflict Detection Modal (5-Minute Window) */}
      {pendingConflict && (
        <AlarmConflictModal
          conflictResult={pendingConflict.conflictResult}
          candidateTitle={pendingConflict.candidate.title}
          candidateTimeMs={pendingConflict.candidate.triggerTimeMs}
          onProceedAnyway={() => {
            executeSchedule(pendingConflict.candidate);
            setPendingConflict(null);
          }}
          onApplySuggestion={(suggestedTimeMs) => {
            executeSchedule({
              ...pendingConflict.candidate,
              triggerTimeMs: suggestedTimeMs
            });
            setPendingConflict(null);
          }}
          onCancel={() => setPendingConflict(null)}
        />
      )}
    </View>
  );
};
