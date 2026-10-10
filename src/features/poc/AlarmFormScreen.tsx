import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image, KeyboardAvoidingView, Platform } from 'react-native';
import tw from 'twrnc';
import {
  NotificationChannelId,
  AlarmStyle,
  RecurrenceType,
  RecurringSchedule,
  AlarmCategory,
  ALARM_CATEGORIES,
  AlarmItem
} from '../../domain/alarm';
import { CategoryIcon } from './Alarm24hTimelineChart';
import { planOccurrencesForRecurringSchedule } from '../../domain/reminderPlanner';
import { detectAlarmConflict } from '../../domain/alarmConflict';
import {
  X,
  Clock,
  Calendar,
  Repeat,
  Bell,
  Volume2,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  Info,
  Tag,
  AlertTriangle
} from 'lucide-react-native';

interface AlarmFormScreenProps {
  existingAlarms?: AlarmItem[];
  onClose: () => void;
  onSave: (schedule: Omit<RecurringSchedule, 'id' | 'createdAt'>) => void;
}

export const AlarmFormScreen: React.FC<AlarmFormScreenProps> = ({
  existingAlarms = [],
  onClose,
  onSave
}) => {
  const [category, setCategory] = useState<AlarmCategory>('medicine');
  const [title, setTitle] = useState('Daily Insulin Dose');
  const [message, setMessage] = useState('10 units before dinner');
  const [channelId, setChannelId] = useState<NotificationChannelId>('medicines');
  const [style, setStyle] = useState<AlarmStyle>('full_alarm');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [timeOfDay, setTimeOfDay] = useState('19:30');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [intervalDays, setIntervalDays] = useState<number>(2); // e.g. 2 days after
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [customDates, setCustomDates] = useState<string[]>([
    new Date(Date.now() + 86400000).toISOString().split('T')[0],
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  ]);
  const [newCustomDate, setNewCustomDate] = useState<string>('');
  const [snoozeIntervalMinutes, setSnoozeIntervalMinutes] = useState<number>(10);

  // When category changes, auto-select standard defaults
  const handleSelectCategory = (catId: AlarmCategory) => {
    setCategory(catId);
    const catDef = ALARM_CATEGORIES[catId];
    if (catDef) {
      setChannelId(catDef.defaultChannel);
      setStyle(catDef.defaultStyle);
    }
  };

  // Day names for weekly chips
  const weekdayNames = [
    { label: 'Sun', val: 0 },
    { label: 'Mon', val: 1 },
    { label: 'Tue', val: 2 },
    { label: 'Wed', val: 3 },
    { label: 'Thu', val: 4 },
    { label: 'Fri', val: 5 },
    { label: 'Sat', val: 6 }
  ];

  // Month names for monthly selector
  const monthNames = [
    { label: 'Jan', val: 1 },
    { label: 'Feb', val: 2 },
    { label: 'Mar', val: 3 },
    { label: 'Apr', val: 4 },
    { label: 'May', val: 5 },
    { label: 'Jun', val: 6 },
    { label: 'Jul', val: 7 },
    { label: 'Aug', val: 8 },
    { label: 'Sep', val: 9 },
    { label: 'Oct', val: 10 },
    { label: 'Nov', val: 11 },
    { label: 'Dec', val: 12 }
  ];

  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      if (weekdays.length > 1) {
        setWeekdays(weekdays.filter((d) => d !== day));
      }
    } else {
      setWeekdays([...weekdays, day].sort());
    }
  };

  const toggleMonth = (m: number) => {
    if (selectedMonths.includes(m)) {
      if (selectedMonths.length > 1) {
        setSelectedMonths(selectedMonths.filter((item) => item !== m));
      }
    } else {
      setSelectedMonths([...selectedMonths, m].sort((a, b) => a - b));
    }
  };

  const handleAddCustomDate = () => {
    if (newCustomDate && !customDates.includes(newCustomDate)) {
      setCustomDates([...customDates, newCustomDate].sort());
      setNewCustomDate('');
    }
  };

  const handleRemoveCustomDate = (d: string) => {
    setCustomDates(customDates.filter((item) => item !== d));
  };

  // Live preview of next 5 planned occurrences
  const previewOccurrences = useMemo(() => {
    const mockSchedule: RecurringSchedule = {
      id: 'preview_schedule',
      profileId: 'default',
      category,
      title: title || 'Reminder',
      message: message || '',
      channelId,
      style,
      recurrenceType,
      timeOfDay,
      weekdays,
      intervalDays,
      startDate,
      dayOfMonth,
      monthsOfYear: selectedMonths,
      specificDates: customDates,
      snoozeIntervalMinutes,
      isEnabled: true,
      createdAt: Date.now()
    };
    return planOccurrencesForRecurringSchedule(mockSchedule, Date.now(), 5, 90);
  }, [
    category,
    title,
    message,
    channelId,
    style,
    recurrenceType,
    timeOfDay,
    weekdays,
    intervalDays,
    startDate,
    dayOfMonth,
    selectedMonths,
    customDates,
    snoozeIntervalMinutes
  ]);

  // Check if any planned recurrence falls within 5 minutes of existing alarms
  const recurringConflict = useMemo(() => {
    if (!existingAlarms || existingAlarms.length === 0 || previewOccurrences.length === 0) {
      return null;
    }
    for (const occ of previewOccurrences) {
      const res = detectAlarmConflict(occ.triggerTimeMs, existingAlarms, 5);
      if (res.hasConflict) {
        return {
          occurrence: occ,
          conflictResult: res
        };
      }
    }
    return null;
  }, [previewOccurrences, existingAlarms]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      profileId: 'default',
      category,
      title: title.trim() || 'Scheduled Reminder',
      message: message.trim(),
      channelId,
      style,
      recurrenceType,
      timeOfDay,
      weekdays: recurrenceType === 'weekly' ? weekdays : undefined,
      intervalDays: recurrenceType === 'every_n_days' ? intervalDays : undefined,
      startDate: recurrenceType === 'every_n_days' || recurrenceType === 'once' ? startDate : undefined,
      dayOfMonth: recurrenceType === 'monthly' ? dayOfMonth : undefined,
      monthsOfYear: recurrenceType === 'monthly' ? selectedMonths : undefined,
      specificDates: recurrenceType === 'custom_dates' ? customDates : undefined,
      snoozeIntervalMinutes,
      isEnabled: true
    });
  };

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-zinc-950`}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={tw`flex-1 flex flex-col`}>
        {/* Header */}
        <View style={tw`p-5 border-b border-zinc-800 flex-row items-center justify-between bg-zinc-900/95`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400`}>
              <Repeat style={tw`w-5 h-5`} />
            </View>
            <View>
              <Text style={tw`text-lg font-bold text-white tracking-tight`}>Recurring Alarm</Text>
              <Text style={tw`text-xs text-zinc-400`}>Set automated patterns</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={tw`p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700`}
          >
            <X size={20} color={tw.color('zinc-400')} />
          </TouchableOpacity>
        </View>

        {/* Form Body */}
        <ScrollView style={tw`flex-1 p-4`} contentContainerStyle={tw`gap-4 pb-12`}>
          {/* Category Selector */}
          <View>
            <View style={tw`flex-row items-center gap-1.5 mb-2`}>
              <Tag size={14} color={tw.color('indigo-400')} />
              <Text style={tw`text-sm font-semibold text-zinc-400`}>Alarm Category:</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
              {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
                const catDef = ALARM_CATEGORIES[catId];
                const isSelected = category === catId;
                return (
                  <TouchableOpacity
                    key={catId}
                    onPress={() => handleSelectCategory(catId)}
                    style={tw`px-4 py-3 rounded-2xl flex-row items-center gap-2 border ${isSelected
                      ? 'bg-zinc-800 border-zinc-600'
                      : 'bg-zinc-950 border-zinc-800'
                      }`}
                  >
                    <View style={tw`w-4 h-4`}><CategoryIcon category={catId} /></View>
                    <Text style={tw`text-sm font-medium ${isSelected ? 'text-white' : 'text-zinc-400'}`}>{catDef.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Title & Message */}
          <View style={tw`gap-4`}>
            <View>
              <Text style={tw`text-sm font-semibold text-zinc-400 mb-2`}>Alarm / Reminder Title</Text>
              <TextInput value={title} onChangeText={setTitle} placeholderTextColor={tw.color("zinc-600")}
                placeholder="e.g. Blood Pressure Reading"
                style={tw`w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-base text-white`}
              />
            </View>
            <View>
              <Text style={tw`text-sm font-semibold text-zinc-400 mb-2`}>Instructions / Message (Optional)</Text>
              <TextInput value={message} onChangeText={setMessage} placeholderTextColor={tw.color("zinc-600")}
                placeholder="e.g. Take with 1 glass of water"
                style={tw`w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-zinc-300`}
              />
            </View>
          </View>

          {/* Recurrence Mode Selector Pills */}
          <View>
            <Text style={tw`text-sm font-semibold text-zinc-400 mb-2`}>Recurrence Frequency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
              {[
                { type: 'daily', label: 'Daily', icon: '⏰' },
                { type: 'weekly', label: 'Weekly', icon: '📅' },
                { type: 'every_n_days', label: '2 Days / N', icon: '🔄' },
                { type: 'custom_dates', label: 'Dates', icon: '🗓️' },
                { type: 'monthly', label: 'Monthly', icon: '📆' }
              ].map((item) => (
                <TouchableOpacity
                  key={item.type}
                  onPress={() => setRecurrenceType(item.type as RecurrenceType)}
                  style={tw`py-3 px-4 rounded-2xl flex-row items-center justify-center gap-2 border ${recurrenceType === item.type
                    ? 'bg-indigo-600 border-indigo-500'
                    : 'bg-zinc-950 border-zinc-800'
                    }`}
                >
                  <Text style={tw`text-lg`}>{item.icon}</Text>
                  <Text style={tw`text-sm font-medium ${recurrenceType === item.type ? 'text-white' : 'text-zinc-400'}`}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Time Picker */}
          <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-3`}>
              <Clock size={20} color={tw.color('indigo-400')} />
              <View>
                <Text style={tw`text-base font-bold text-white`}>Alarm Time</Text>
                <Text style={tw`text-xs text-zinc-400`}>Clock time to trigger</Text>
              </View>
            </View>
            <TextInput value={timeOfDay} onChangeText={setTimeOfDay} placeholder="HH:MM" placeholderTextColor={tw.color("zinc-600")}
              style={tw`bg-zinc-900 border border-zinc-700 text-white font-mono text-lg font-bold px-4 py-2.5 rounded-xl text-center min-w-[100px]`}
            />
          </View>

          {/* Conditional Recurrence Settings */}
          {/* 1. WEEKLY */}
          {recurrenceType === 'weekly' && (
            <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3`}>
              <Text style={tw`text-sm font-semibold text-zinc-300 block`}>Repeat On Weekdays:</Text>
              <View style={tw`flex-row items-center justify-between gap-2`}>
                {weekdayNames.map((w) => {
                  const isSelected = weekdays.includes(w.val);
                  return (
                    <TouchableOpacity
                      key={w.val}
                      onPress={() => toggleWeekday(w.val)}
                      style={tw`w-11 h-11 rounded-xl text-sm font-bold transition flex items-center justify-center ${isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                        }`}
                    >
                      <Text style={tw`${isSelected ? 'text-white' : 'text-zinc-500'}`}>{w.label[0]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* 2. EVERY N DAYS (e.g. 2 days after) */}
          {recurrenceType === 'every_n_days' && (
            <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4`}>
              <View style={tw`flex-row items-center justify-between`}>
                <View>
                  <Text style={tw`text-sm font-bold text-white block`}>Interval Days</Text>
                  <Text style={tw`text-xs text-zinc-400 mt-0.5`}>e.g. 2 for "every 2 days"</Text>
                </View>
                <View style={tw`flex-row items-center gap-3`}>
                  <TouchableOpacity
                    onPress={() => setIntervalDays(Math.max(1, intervalDays - 1))}
                    style={tw`w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center`}
                  >
                    <Text style={tw`text-white font-bold text-lg`}>-</Text>
                  </TouchableOpacity>
                  <Text style={tw`font-mono text-lg font-bold text-indigo-400 w-10 text-center`}>
                    {intervalDays}d
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIntervalDays(intervalDays + 1)}
                    style={tw`w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center`}
                  >
                    <Text style={tw`text-white font-bold text-lg`}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text style={tw`text-sm text-zinc-400 mb-2 font-medium`}>Anchor Start Date</Text>
                <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={tw.color("zinc-600")}
                  style={tw`w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white`}
                />
              </View>
            </View>
          )}

          {/* 3. CUSTOM DATES */}
          {recurrenceType === 'custom_dates' && (
            <View style={tw`p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5`}>
              <Text style={tw`text-xs font-semibold text-zinc-300 block`}>Selected Specific Dates:</Text>
              <View style={tw`flex gap-2`}>
                <TextInput value={newCustomDate} onChangeText={setNewCustomDate} placeholder="YYYY-MM-DD" placeholderTextColor={tw.color("zinc-600")}
                  style={tw`flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white`}
                />
                <TouchableOpacity onPress={handleAddCustomDate} style={tw`px-3 py-1.5 rounded-xl bg-indigo-600 flex-row items-center gap-1`}>
                  <Plus size={14} color={tw.color('white')} />
                  <Text style={tw`text-xs font-semibold text-white`}>Add Date</Text>
                </TouchableOpacity>
              </View>

              <View style={tw`flex flex-wrap gap-1.5 pt-1`}>
                {customDates.map((d) => (
                  <Text
                    key={d}
                    style={tw`px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-mono flex items-center gap-1.5`}
                  >
                    <Text>{d}</Text>
                    <TouchableOpacity

                      onPress={() => handleRemoveCustomDate(d)}
                      style={tw`text-zinc-500 hover:text-red-400`}
                    >
                      <X style={tw`w-3 h-3`} />
                    </TouchableOpacity>
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* 4. MONTHLY */}
          {recurrenceType === 'monthly' && (
            <View style={tw`p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3`}>
              <View style={tw`flex items-center justify-between`}>
                <View>
                  <Text style={tw`text-xs font-semibold text-white block`}>Day of Month</Text>
                  <Text style={tw`text-[10px] text-zinc-400`}>Triggers on this date every month</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1.5`}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <TouchableOpacity key={d} onPress={() => setDayOfMonth(d)} style={tw`px-3 py-1.5 rounded-xl border ${dayOfMonth === d ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-900 border-zinc-700'}`}>
                      <Text style={tw`text-xs ${dayOfMonth === d ? 'text-white' : 'text-zinc-400'}`}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text style={tw`text-[11px] font-semibold text-zinc-400 block mb-1.5`}>
                  Applies to Months ({selectedMonths.length}/12):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1`}>
                  {monthNames.map((m) => {
                    const isSelected = selectedMonths.includes(m.val);
                    return (
                      <TouchableOpacity
                        key={m.val}

                        onPress={() => toggleMonth(m.val)}
                        style={tw`py-1 px-2 rounded-lg border ${isSelected ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-900 border-zinc-800'}`}>
                        <Text style={tw`text-[11px] ${isSelected ? 'text-white' : 'text-zinc-500'}`}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Channel Selector & Alarm Style */}
          <View style={tw`flex-col gap-4`}>
            <View>
              <Text style={tw`text-sm font-semibold text-zinc-400 mb-2`}>Notification Channel</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
                {['medicines', 'appointments', 'routine', 'exercise', 'water_meals', 'habits', 'summaries'].map((ch) => (
                  <TouchableOpacity key={ch} onPress={() => setChannelId(ch as NotificationChannelId)} style={tw`px-4 py-3 rounded-2xl border ${channelId === ch ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-950 border-zinc-800'}`}>
                    <Text style={tw`text-sm ${channelId === ch ? 'text-white font-medium' : 'text-zinc-400'}`}>{ch}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View>
              <Text style={tw`text-sm font-semibold text-zinc-400 mb-2`}>Alarm Style</Text>
              <View style={tw`flex-row gap-2`}>
                <TouchableOpacity onPress={() => setStyle('full_alarm')} style={tw`flex-1 py-3 px-3 rounded-2xl flex-row items-center justify-center gap-2 border ${style === 'full_alarm' ? 'bg-amber-500/10 border-amber-500/40' : 'bg-zinc-950 border-zinc-800'}`}>
                  <Volume2 size={16} color={tw.color(style === 'full_alarm' ? 'amber-400' : 'zinc-400')} />
                  <Text style={tw`text-sm font-bold ${style === 'full_alarm' ? 'text-amber-400' : 'text-zinc-400'}`}>Full Alarm</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStyle('notification')} style={tw`flex-1 py-3 px-3 rounded-2xl flex-row items-center justify-center gap-2 border ${style === 'notification' ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-zinc-950 border-zinc-800'}`}>
                  <Bell size={16} color={tw.color(style === 'notification' ? 'indigo-400' : 'zinc-400')} />
                  <Text style={tw`text-sm font-bold ${style === 'notification' ? 'text-indigo-300' : 'text-zinc-400'}`}>Notification</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Snooze Setting */}
          <View>
            <Text style={tw`text-sm font-semibold text-zinc-400 mb-2`}>Snooze Duration</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
              {[5, 10, 15, 30].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  onPress={() => setSnoozeIntervalMinutes(mins)}
                  style={tw`px-5 py-3 rounded-2xl border ${snoozeIntervalMinutes === mins ? 'bg-zinc-800 border-indigo-500' : 'bg-zinc-950 border-zinc-800'}`}>
                  <Text style={tw`text-sm font-medium ${snoozeIntervalMinutes === mins ? 'text-white font-bold' : 'text-zinc-400'}`}>{mins} min</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Next 5 Planned Occurrences Preview */}
          <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-row items-center gap-2`}><Sparkles size={16} color={tw.color("emerald-400")} /><Text style={tw`text-sm font-bold text-emerald-400`}>Next 5 Upcoming Triggers Preview</Text></View>
            </View>

            {previewOccurrences.length === 0 ? (
              <View style={tw`text-sm text-zinc-500 italic py-2`}>
                No future triggers match this rule in the next 90 days.
              </View>
            ) : (
              <View style={tw`space-y-2`}>
                {previewOccurrences.map((occ, i) => (
                  <View
                    key={occ.id}
                    style={tw`p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex-row items-center justify-between`}
                  >
                    <Text style={tw`text-sm text-zinc-300 font-medium`}>
                      <Text style={tw`text-zinc-500 font-mono text-xs mr-2`}>#{i + 1} </Text>
                      {new Date(occ.triggerTimeMs).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={tw`font-mono text-indigo-400 font-bold text-sm`}>
                      {new Date(occ.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Conflict Warning Banner if scheduled within 5 minutes of an existing alarm */}
          {recurringConflict && (
            <View style={tw`p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex-row items-start gap-2.5`}>
              <AlertTriangle style={tw`w-4 h-4 shrink-0 text-amber-400 mt-0.5`} />
              <View style={tw`flex-1 space-y-1`}>
                <View style={tw`font-semibold text-white`}>
                  Alarm Conflict Detected (5-Min Window)
                </View>
                <View style={tw`text-[11px] text-zinc-300`}>
                  {recurringConflict.conflictResult.warningSummary}
                </View>
                {recurringConflict.conflictResult.suggestions.length > 0 && (
                  <TouchableOpacity

                    onPress={() => {
                      const sug = recurringConflict.conflictResult.suggestions[0];
                      setTimeOfDay(sug.formattedTime);
                    }}
                    style={tw`flex-row items-center gap-1 mt-1 pt-1 border-t border-amber-500/20`}
                  >
                    <Sparkles style={tw`w-3 h-3`} />
                    <Text style={tw`text-[11px] text-emerald-400 font-semibold`}>One-tap auto-fix: Change alarm time to {recurringConflict.conflictResult.suggestions[0].formattedTime} ({recurringConflict.conflictResult.suggestions[0].label})</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={tw`p-4 border-t border-zinc-800 bg-zinc-950 flex-row items-center justify-between gap-4`}>
          <TouchableOpacity
            onPress={onClose}
            style={tw`py-4 px-6 rounded-2xl bg-zinc-800 active:bg-zinc-700`}
          >
            <Text style={tw`text-sm font-bold text-zinc-300`}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSubmit({ preventDefault: () => { } } as any)}
            style={tw`flex-1 py-4 px-5 rounded-2xl bg-indigo-600 active:bg-indigo-500 flex-row items-center justify-center gap-2 shadow-lg shadow-indigo-900/30`}
          >
            <CheckCircle2 size={18} color={tw.color('white')} />
            <Text style={tw`text-base font-bold text-white`}>Save & Schedule</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
