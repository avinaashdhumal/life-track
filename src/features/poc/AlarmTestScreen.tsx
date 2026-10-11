import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image, Modal } from 'react-native';
import tw from 'twrnc';
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
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  Trash2,
  ShieldCheck,
  Zap,
  Repeat,
  Plus,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Tag
} from 'lucide-react-native';

interface AlarmTestScreenProps {
  onTriggerAlarmDirectly: (alarm: AlarmItem) => void;
  onOpenHealthCheck: () => void;
}

export const AlarmTestScreen: React.FC<AlarmTestScreenProps> = ({
  onTriggerAlarmDirectly,
  onOpenHealthCheck
}) => {
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
  const [justScheduledId, setJustScheduledId] = useState<string | null>(null);
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
        // Trigger alarm
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

    // Check for 5-minute conflict against existing alarms
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
        return `Daily at ${s.timeOfDay}`;
      case 'weekly': {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const formattedDays = (s.weekdays || []).map((d) => days[d]).join(', ');
        return `Weekly (${formattedDays || 'Every day'}) at ${s.timeOfDay}`;
      }
      case 'every_n_days':
        return `Every ${s.intervalDays || 2} Days at ${s.timeOfDay}`;
      case 'custom_dates':
        return `${(s.specificDates || []).length} Selected Dates at ${s.timeOfDay}`;
      case 'monthly':
        return `Monthly on ${s.dayOfMonth || 1}${s.dayOfMonth === 1 ? 'st' : s.dayOfMonth === 2 ? 'nd' : 'th'} at ${s.timeOfDay}`;
      default:
        return `At ${s.timeOfDay}`;
    }
  };



  return (
    <View style={tw`flex flex-col gap-5 pb-12`}>
      {/* Top Banner: Phase 0 Status */}
      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800/80 p-5 shadow-sm`}>
        <View style={tw`flex-row items-center justify-between mb-3 flex-wrap gap-2`}>
          <View style={tw`flex-row items-center gap-2 flex-wrap`}>
            <Text style={tw`px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>
              PHASE 0 READY
            </Text>
            <Text style={tw`text-sm font-medium text-zinc-400`}>Alarm Scheduler</Text>
          </View>
        </View>
        <Text style={tw`text-sm text-zinc-400 leading-relaxed`}>
          Supports <Text style={tw`font-bold text-zinc-200`}>Recurring Alarms</Text> (Daily, Weekly, Every 2 Days, Selected Dates, Monthly) across all channels with native <Text style={tw`text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded-lg font-mono text-xs`}>AlarmManager</Text>.
        </Text>
      </View>

      {/* NEW: Recurring Alarm Scheduler Hub Card */}
      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5 shadow-lg`}>
        <View style={tw`flex-col gap-4 mb-4`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center`}>
              <Repeat size={24} color={tw.color('indigo-400')} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-lg font-bold text-white tracking-tight`}>Recurring Alarms</Text>
              <Text style={tw`text-xs text-zinc-400 mt-0.5`}>Daily, weekly, custom schedules</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowRecurringModal(true)}
            style={tw`w-full py-3.5 px-4 rounded-2xl bg-indigo-600 active:bg-indigo-500 flex-row items-center justify-center gap-2 shadow-lg shadow-indigo-900/40`}
          >
            <Plus size={18} color="#fff" />
            <Text style={tw`text-sm font-bold text-white`}>Add New Schedule</Text>
          </TouchableOpacity>
        </View>

        {/* List of Recurring Schedules */}
        <View style={tw`space-y-2 mt-4`}>
          {recurringSchedules.map((schedule) => {
            const cat = resolveAlarmCategory(schedule);
            return (
              <View
                key={schedule.id}
                style={tw`p-3 rounded-2xl border flex-row items-center justify-between gap-3 ${schedule.isEnabled
                  ? 'bg-zinc-950 border-zinc-800'
                  : 'bg-zinc-950/50 border-zinc-800/40 opacity-60'
                  }`}
              >
                <View style={tw`flex-row items-center gap-2.5 flex-1`}>
                  <TouchableOpacity
                    onPress={() => handleToggleRecurring(schedule.id, schedule.isEnabled)}
                    style={tw`p-1 shrink-0`}
                  >
                    {schedule.isEnabled ? (
                      <ToggleRight size={32} color={tw.color('emerald-400')} />
                    ) : (
                      <ToggleLeft size={32} color={tw.color('zinc-600')} />
                    )}
                  </TouchableOpacity>
                  
                  <View
                    style={[tw`w-10 h-10 rounded-xl flex items-center justify-center shrink-0`, {
                      backgroundColor: `${cat.color}15`,
                      border: `1px solid ${cat.color}30`
                    }]}
                  >
                    <View style={tw`w-5 h-5`}><CategoryIcon category={cat.id} /></View>
                  </View>
                  
                  <View style={tw`flex-1`}>
                    <View style={tw`flex-row items-center gap-1.5 flex-wrap`}>
                      <Text style={tw`text-sm font-bold text-white flex-1 shrink`} numberOfLines={1}>{schedule.title}</Text>
                    </View>
                    <View style={tw`flex-row gap-1 mt-1`}>
                      <Text
                        style={[tw`text-[9px] px-1.5 py-0.5 rounded flex-row items-center font-bold overflow-hidden`, {
                          backgroundColor: `${cat.color}15`,
                          color: cat.color
                        }]}
                      >
                        {cat.label}
                      </Text>
                      <Text style={tw`text-[9px] px-1.5 py-0.5 rounded font-bold overflow-hidden ${schedule.style === 'full_alarm' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                        {schedule.style === 'full_alarm' ? 'Full Alarm' : 'Notif'}
                      </Text>
                    </View>
                    <View style={tw`flex-row items-center gap-1 mt-1`}>
                      <Clock size={10} color={tw.color('indigo-400')} />
                      <Text style={tw`text-[10px] font-medium text-zinc-400 flex-1`} numberOfLines={1}>
                        {getRecurrenceBadge(schedule)}
                        {schedule.message ? ` • ${schedule.message}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteRecurring(schedule.id)}
                  style={tw`p-2.5 rounded-full bg-red-500/10 shrink-0`}
                >
                  <Trash2 size={16} color={tw.color('red-400')} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      {/* Primary 2-Minute Proof of Concept Action Card */}
      <View style={tw`rounded-3xl bg-zinc-900 border border-indigo-500/30 p-5 shadow-xl relative overflow-hidden mt-2`}>
        <View style={tw`absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full`} />
        <View style={tw`flex-col items-start justify-between mb-5 relative z-10 gap-3`}>
          <View style={tw`flex-1 w-full`}>
            <View style={tw`flex-row items-center gap-2.5 mb-1.5`}>
              <View style={tw`w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center`}>
                <Bell size={20} color={tw.color('indigo-400')} />
              </View>
              <Text style={tw`text-xl font-bold text-white tracking-tight`}>
                Quick Alarm Test
              </Text>
            </View>
            <Text style={tw`text-sm text-zinc-400 pr-2 mt-1`}>
              Schedule a one-off alarm directly to verify system functionality.
            </Text>
          </View>
          {nextAlarm && (
            <View style={tw`w-full flex-row items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Clock size={16} color={tw.color('amber-400')} />
                <Text style={tw`text-sm font-medium text-amber-400`}>Next Ring In</Text>
              </View>
              <Text style={tw`text-2xl font-mono font-bold text-white`}>
                {formatCountdown(nextAlarm.triggerTimeMs)}
              </Text>
            </View>
          )}
        </View>

        {/* Category Selector Pills */}
        <View style={tw`mb-5 relative z-10`}>
          <View style={tw`flex-row items-center gap-1.5 mb-3`}>
            <Tag size={16} color={tw.color('indigo-400')} />
            <Text style={tw`text-sm font-bold text-zinc-300`}>Category</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row items-center gap-2 pb-2`}>
            {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
              const catDef = ALARM_CATEGORIES[catId];
              const isSelected = selectedCategory === catId;
              return (
                <TouchableOpacity
                  key={catId}
                  onPress={() => handleSelectTestCategory(catId)}
                  style={tw`px-4 py-3 rounded-2xl flex-row items-center gap-2.5 border ${isSelected
                    ? 'bg-zinc-800 border-zinc-500 shadow-sm'
                    : 'bg-zinc-950 border-zinc-800/80'
                    }`}
                >
                  <View style={tw`w-5 h-5`}><CategoryIcon category={catId} /></View>
                  <Text style={tw`text-sm ${isSelected ? 'text-white font-bold' : 'text-zinc-400 font-medium'}`}>{catDef.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Inputs */}
        <View style={tw`flex-col gap-5 mb-6 relative z-10`}>
          <View>
            <Text style={tw`text-sm font-bold text-zinc-300 mb-2`}>
              Reminder Title
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={tw`w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-base text-white font-medium`}
              placeholder="e.g. Metformin 500mg"
              placeholderTextColor={tw.color('zinc-600')}
            />
          </View>

          <View>
            <Text style={tw`text-sm font-bold text-zinc-300 mb-2`}>
              Notification Channel
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-2`}>
              {['medicines', 'appointments', 'routine', 'exercise', 'water_meals', 'habits', 'summaries'].map((ch) => (
                <TouchableOpacity
                  key={ch}
                  onPress={() => setSelectedChannel(ch as NotificationChannelId)}
                  style={tw`px-5 py-3 rounded-2xl border ${selectedChannel === ch ? 'bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-900/40' : 'bg-zinc-950 border-zinc-800'}`}
                >
                  <Text style={tw`text-sm ${selectedChannel === ch ? 'text-white font-bold' : 'text-zinc-400 font-medium'}`}>{ch}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View>
            <Text style={tw`text-sm font-bold text-zinc-300 mb-2`}>
              Alarm Style
            </Text>
            <TouchableOpacity
              onPress={() => setIsFullAlarm(!isFullAlarm)}
              style={tw`w-full py-4 px-5 rounded-2xl border flex-row items-center justify-center gap-2 transition ${isFullAlarm
                ? 'bg-amber-500/15 border-amber-500/40'
                : 'bg-zinc-800 border-zinc-700'
                }`}
            >
              <Volume2 size={18} color={isFullAlarm ? tw.color('amber-400') : tw.color('zinc-400')} />
              <Text style={tw`text-sm font-bold ${isFullAlarm ? 'text-amber-400' : 'text-zinc-300'}`}>{isFullAlarm ? 'Full Screen Alarm' : 'Standard Notification'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Buttons */}
        <View style={tw`flex-col gap-3 mt-4`}>
          <TouchableOpacity
            onPress={handleScheduleTwoMinutes}
            style={tw`py-4 px-5 rounded-2xl bg-indigo-600 flex-row items-center justify-center gap-2.5 shadow-lg shadow-indigo-900/30`}
          >
            <Clock size={18} color={tw.color('white')} />
            <Text style={tw`text-white font-bold text-base`}>Schedule 2 Minutes Ahead</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleScheduleTenSeconds}
            style={tw`py-4 px-5 rounded-2xl bg-zinc-800 flex-row items-center justify-center gap-2 border border-zinc-700`}
          >
            <Zap size={16} color={tw.color('amber-400')} />
            <Text style={tw`text-zinc-200 font-semibold text-sm`}>Quick 10s Test</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 24-Hour Visual Sequence Timeline using Recharts */}
      <Alarm24hTimelineChart
        alarms={alarms}
        currentTimeMs={now}
        onTriggerAlarmDirectly={handleManualTrigger}
      />

      {/* Currently Scheduled Occurrences in Native AlarmManager */}
      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5 shadow-lg mt-2`}>
        <View style={tw`flex-row items-center justify-between mb-5`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`w-10 h-10 rounded-2xl bg-zinc-800/80 flex items-center justify-center`}>
              <Bell size={20} color={tw.color('zinc-300')} />
            </View>
            <View>
              <Text style={tw`text-lg font-bold text-white`}>Upcoming Alarms</Text>
              <Text style={tw`text-xs text-zinc-400 mt-0.5`}>{alarms.length} scheduled</Text>
            </View>
          </View>
          {alarms.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={tw`px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20`}
            >
              <Text style={tw`text-xs font-bold text-red-400`}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {alarms.length === 0 ? (
          <View style={tw`py-12 bg-zinc-950 rounded-3xl border border-zinc-800/60 flex items-center justify-center`}>
            <View style={tw`w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4`}>
              <Bell size={28} color={tw.color('zinc-700')} />
            </View>
            <Text style={tw`text-base font-bold text-zinc-400 mb-1`}>All clear!</Text>
            <Text style={tw`text-sm font-medium text-zinc-600 text-center px-6`}>
              No upcoming alarms.
            </Text>
          </View>
        ) : (
          <View style={tw`flex-col gap-3`}>
            {alarms.map((alarm) => {
              const cat = resolveAlarmCategory(alarm);
              return (
                <View
                  key={alarm.id}
                  style={tw`p-4 rounded-3xl bg-zinc-950 border border-zinc-800 flex-col gap-4`}
                >
                  <View style={tw`flex-row items-start gap-4`}>
                    <View
                      style={[tw`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0`, {
                        backgroundColor: `${cat.color}15`,
                        border: `1px solid ${cat.color}30`
                      }]}
                    >
                      <View style={tw`w-7 h-7`}><CategoryIcon category={cat.id} /></View>
                    </View>
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center flex-wrap gap-2 mb-1.5`}>
                        <Text style={tw`text-base font-bold text-white shrink`} numberOfLines={1}>{alarm.title}</Text>
                        <View style={tw`flex-row gap-1`}>
                          <Text
                            style={[tw`text-[10px] px-2 py-0.5 rounded-md font-bold overflow-hidden`, {
                              backgroundColor: `${cat.color}15`,
                              color: cat.color
                            }]}
                          >
                            {cat.label}
                          </Text>
                        </View>
                      </View>
                      <View style={tw`flex-row items-center gap-2 flex-wrap`}>
                        <Text style={tw`text-sm text-zinc-400 font-medium`}>
                          {new Date(alarm.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={tw`text-zinc-600`}>•</Text>
                        <Text style={tw`text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md`}>
                          {formatCountdown(alarm.triggerTimeMs)} left
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={tw`flex-row items-center gap-3 pt-3 border-t border-zinc-800/60`}>
                    <TouchableOpacity
                      onPress={() => handleManualTrigger(alarm)}
                      style={tw`flex-1 py-3 rounded-xl bg-zinc-800 active:bg-zinc-700 flex-row items-center justify-center gap-2`}
                    >
                      <Play size={16} color={tw.color('emerald-400')} />
                      <Text style={tw`text-sm font-bold text-emerald-400`}>Test Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCancel(alarm.id)}
                      style={tw`p-3 rounded-xl bg-zinc-900 border border-zinc-800 active:bg-zinc-800`}
                    >
                      <Trash2 size={22} color={tw.color('zinc-500')} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5 mt-2`}>
        <View style={tw`flex-col gap-4 mb-4`}>
          <View style={tw`flex-row items-center gap-4`}>
            <View style={tw`w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center`}>
              <ShieldCheck size={28} color={tw.color('emerald-400')} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-lg font-bold text-white mb-0.5`}>System Health</Text>
              <Text style={tw`text-xs text-zinc-400`}>Permissions & battery optimizations</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onOpenHealthCheck}
            style={tw`w-full py-3.5 rounded-2xl bg-zinc-800 active:bg-zinc-700 flex-row items-center justify-center gap-2`}
          >
            <Text style={tw`text-sm font-bold text-white`}>Run Diagnostics</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5 mt-2`}>
        <View style={tw`flex-row items-center justify-between mb-5`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center`}>
              <RotateCcw size={20} color={tw.color('zinc-400')} />
            </View>
            <View>
              <Text style={tw`text-lg font-bold text-white`}>Event Logs</Text>
              <Text style={tw`text-xs text-zinc-500 font-medium`}>System alarm events</Text>
            </View>
          </View>
        </View>

        {logs.length === 0 ? (
          <Text style={tw`py-6 text-center text-sm text-zinc-500`}>
            No events logged yet. Scheduled alarms and actions will appear here.
          </Text>
        ) : (
          <ScrollView nestedScrollEnabled={true} style={tw`max-h-64`} contentContainerStyle={tw`flex-col gap-2 pr-1`}>
            {logs.map((log) => (
              <View
                key={log.id}
                style={tw`p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex-row items-center justify-between`}
              >
                <View style={tw`flex-row items-center gap-3`}>
                  <Text
                    style={tw`w-2.5 h-2.5 rounded-full ${log.action === 'TAKEN'
                      ? 'bg-emerald-400'
                      : log.action === 'SNOOZED' || log.action.includes('SNOOZE')
                        ? 'bg-amber-400'
                        : log.action === 'FIRED'
                          ? 'bg-red-400'
                          : log.action === 'SCHEDULED'
                            ? 'bg-indigo-400'
                            : 'bg-zinc-400'
                      }`}
                  />
                  <View>
                    <Text style={tw`font-bold text-zinc-200 font-mono text-sm mb-0.5`}>
                      {log.action}
                    </Text>
                    {log.note && <Text style={tw`text-zinc-500 text-xs truncate max-w-[200px]`}>{log.note}</Text>}
                  </View>
                </View>
                <Text style={tw`text-xs text-zinc-500 font-mono`}>
                  {new Date(log.timestampMs).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Recurring Alarm Scheduler Modal */}
      <Modal visible={showRecurringModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRecurringModal(false)}>
        <AlarmFormScreen
          existingAlarms={alarms}
          onClose={() => setShowRecurringModal(false)}
          onSave={handleSaveRecurring}
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

