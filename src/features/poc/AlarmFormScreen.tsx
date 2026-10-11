import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
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
  Repeat,
  Bell,
  Volume2,
  CheckCircle2,
  Plus,
  Sparkles,
  Tag,
  AlertTriangle
} from 'lucide-react-native';

interface AlarmFormScreenProps {
  existingAlarms?: AlarmItem[];
  initialSchedule?: RecurringSchedule | null;
  onClose: () => void;
  onSave: (schedule: Omit<RecurringSchedule, 'id' | 'createdAt'>) => void;
  onUpdate?: (id: string, schedule: Partial<Omit<RecurringSchedule, 'id' | 'createdAt'>>) => void;
}

export const AlarmFormScreen: React.FC<AlarmFormScreenProps> = ({
  existingAlarms = [],
  initialSchedule = null,
  onClose,
  onSave,
  onUpdate
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const isEditing = Boolean(initialSchedule);

  const [category, setCategory] = useState<AlarmCategory>(initialSchedule?.category || 'medicine');
  const [title, setTitle] = useState(initialSchedule?.title || 'Daily Insulin Dose');
  const [message, setMessage] = useState(initialSchedule?.message || '10 units before dinner');
  const [channelId, setChannelId] = useState<NotificationChannelId>(initialSchedule?.channelId || 'medicines');
  const [style, setStyle] = useState<AlarmStyle>(initialSchedule?.style || 'full_alarm');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(initialSchedule?.recurrenceType || 'daily');
  const [timeOfDay, setTimeOfDay] = useState(initialSchedule?.timeOfDay || '19:30');
  const [weekdays, setWeekdays] = useState<number[]>(initialSchedule?.weekdays || [1, 2, 3, 4, 5]); // Mon-Fri
  const [intervalDays, setIntervalDays] = useState<number>(initialSchedule?.intervalDays || 2); // e.g. 2 days after
  const [startDate, setStartDate] = useState<string>(() => initialSchedule?.startDate || new Date().toISOString().split('T')[0]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(initialSchedule?.dayOfMonth || 1);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(initialSchedule?.monthsOfYear || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [customDates, setCustomDates] = useState<string[]>(
    initialSchedule?.specificDates || [
      new Date(Date.now() + 86400000).toISOString().split('T')[0],
      new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
    ]
  );
  const [newCustomDate, setNewCustomDate] = useState<string>('');
  const [snoozeIntervalMinutes, setSnoozeIntervalMinutes] = useState<number>(initialSchedule?.snoozeIntervalMinutes || 10);

  const getCategoryLabel = (catId: AlarmCategory): string => {
    return t(`categories.${catId}`) || ALARM_CATEGORIES[catId]?.label || catId;
  };

  // When category changes, auto-select standard defaults
  const handleSelectCategory = (catId: AlarmCategory) => {
    setCategory(catId);
    const catDef = ALARM_CATEGORIES[catId];
    if (catDef) {
      setChannelId(catDef.defaultChannel);
      setStyle(catDef.defaultStyle);
    }
  };

  const weekdayNames = [
    { label: 'Sun', val: 0 },
    { label: 'Mon', val: 1 },
    { label: 'Tue', val: 2 },
    { label: 'Wed', val: 3 },
    { label: 'Thu', val: 4 },
    { label: 'Fri', val: 5 },
    { label: 'Sat', val: 6 }
  ];

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
    const previewSchedule: RecurringSchedule = {
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
    return planOccurrencesForRecurringSchedule(previewSchedule, Date.now(), 5, 90);
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

  const handleSubmit = () => {
    const payload = {
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
      isEnabled: initialSchedule ? initialSchedule.isEnabled : true
    };

    if (isEditing && initialSchedule && onUpdate) {
      onUpdate(initialSchedule.id, payload);
    } else {
      onSave(payload);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[tw`flex-1 flex flex-col`, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View
          style={[
            tw`p-4 border-b flex-row items-center justify-between z-10`,
            {
              backgroundColor: colors.bgHeader,
              borderBottomColor: colors.border
            }
          ]}
        >
          <View style={tw`flex-row items-center gap-3`}>
            <View
              style={[
                tw`w-10 h-10 rounded-xl border flex items-center justify-center`,
                {
                  backgroundColor: colors.primaryBg,
                  borderColor: colors.primaryBorder
                }
              ]}
            >
              <Repeat size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[tw`text-lg font-bold tracking-tight`, { color: colors.text }]}>
                {isEditing ? t('alarmForm.editSchedule') : t('alarmForm.newSchedule')}
              </Text>
              <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                {t('alarm.recurringDescription')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alarmForm.cancel')}
            style={[
              tw`p-2.5 rounded-full min-w-11 min-h-11 items-center justify-center`,
              { backgroundColor: colors.cardSecondary }
            ]}
          >
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Form Body */}
        <ScrollView
          style={[tw`flex-1 p-4`, { backgroundColor: colors.bg }]}
          contentContainerStyle={tw`gap-4 pb-12`}
          showsVerticalScrollIndicator={false}
        >
          {/* Category Selector */}
          <View>
            <View style={tw`flex-row items-center gap-1.5 mb-2`}>
              <Tag size={14} color={colors.primary} />
              <Text style={[tw`text-sm font-semibold`, { color: colors.textMuted }]}>
                {t('alarmForm.category')}:
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
              {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
                const catDef = ALARM_CATEGORIES[catId];
                const isSelected = category === catId;
                const catLabel = getCategoryLabel(catId);
                return (
                  <TouchableOpacity
                    key={catId}
                    onPress={() => handleSelectCategory(catId)}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={catLabel}
                    style={[
                      tw`px-4 py-3 rounded-2xl flex-row items-center gap-2 border min-h-11`,
                      isSelected
                        ? {
                            backgroundColor: colors.cardHover,
                            borderColor: catDef.color
                          }
                        : {
                            backgroundColor: colors.card,
                            borderColor: colors.border
                          }
                    ]}
                  >
                    <View style={tw`w-4 h-4`}>
                      <CategoryIcon category={catId} color={catDef.color} />
                    </View>
                    <Text
                      style={[
                        tw`text-sm font-medium`,
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

          {/* Title & Message */}
          <View style={tw`gap-4`}>
            <View>
              <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>
                {t('alarmForm.reminderTitle')}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('alarmForm.titlePlaceholder')}
                placeholderTextColor={colors.textSubtle}
                accessible={true}
                accessibilityLabel={t('alarmForm.reminderTitle')}
                style={[
                  tw`w-full border rounded-2xl px-4 py-3.5 text-base font-medium`,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text
                  }
                ]}
              />
            </View>
            <View>
              <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>
                {t('alarmForm.message')}
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t('alarmForm.messagePlaceholder')}
                placeholderTextColor={colors.textSubtle}
                accessible={true}
                accessibilityLabel={t('alarmForm.message')}
                style={[
                  tw`w-full border rounded-2xl px-4 py-3.5 text-sm`,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text
                  }
                ]}
              />
            </View>
          </View>

          {/* Recurrence Mode Selector Pills */}
          <View>
            <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>
              {t('alarmForm.recurrenceType')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
              {[
                { type: 'daily', label: t('alarmForm.daily'), icon: '⏰' },
                { type: 'weekly', label: t('alarmForm.weekly'), icon: '📅' },
                { type: 'every_n_days', label: t('alarmForm.everyNDays'), icon: '🔄' },
                { type: 'custom_dates', label: t('alarmForm.customDates'), icon: '🗓️' },
                { type: 'monthly', label: t('alarmForm.monthly'), icon: '📆' }
              ].map((item) => {
                const isSelected = recurrenceType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    onPress={() => setRecurrenceType(item.type as RecurrenceType)}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.label}
                    style={[
                      tw`py-3 px-4 rounded-2xl flex-row items-center justify-center gap-2 border min-h-11`,
                      isSelected
                        ? {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary
                          }
                        : {
                            backgroundColor: colors.card,
                            borderColor: colors.border
                          }
                    ]}
                  >
                    <Text style={tw`text-base`}>{item.icon}</Text>
                    <Text
                      style={[
                        tw`text-sm font-medium`,
                        { color: isSelected ? '#ffffff' : colors.textMuted }
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Time Picker */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex-row items-center justify-between`,
              {
                backgroundColor: colors.card,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center gap-3`}>
              <Clock size={20} color={colors.primary} />
              <View>
                <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                  {t('alarmForm.timeOfDay')}
                </Text>
                <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                  {t('alarmForm.timeFormat')}
                </Text>
              </View>
            </View>
            <TextInput
              value={timeOfDay}
              onChangeText={setTimeOfDay}
              placeholder="HH:mm"
              placeholderTextColor={colors.textSubtle}
              accessible={true}
              accessibilityLabel={t('alarmForm.timeOfDay')}
              style={[
                tw`border font-mono text-lg font-bold px-4 py-2.5 rounded-xl text-center min-w-[100px]`,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.primaryText
                }
              ]}
            />
          </View>

          {/* Conditional Recurrence Settings */}
          {/* 1. WEEKLY */}
          {recurrenceType === 'weekly' && (
            <View
              style={[
                tw`p-4 rounded-2xl border space-y-3`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>
                {t('alarmForm.selectWeekdays')}:
              </Text>
              <View style={tw`flex-row items-center justify-between gap-1`}>
                {weekdayNames.map((w) => {
                  const isSelected = weekdays.includes(w.val);
                  return (
                    <TouchableOpacity
                      key={w.val}
                      onPress={() => toggleWeekday(w.val)}
                      accessible={true}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={w.label}
                      style={[
                        tw`w-11 h-11 rounded-xl items-center justify-center border`,
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
                          tw`text-xs font-bold`,
                          { color: isSelected ? '#ffffff' : colors.textSubtle }
                        ]}
                      >
                        {w.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* 2. EVERY N DAYS */}
          {recurrenceType === 'every_n_days' && (
            <View
              style={[
                tw`p-4 rounded-2xl border gap-4`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <View>
                  <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                    {t('alarmForm.interval')}
                  </Text>
                  <Text style={[tw`text-xs mt-0.5`, { color: colors.textMuted }]}>
                    e.g. 2 for "every 2 days"
                  </Text>
                </View>
                <View style={tw`flex-row items-center gap-3`}>
                  <TouchableOpacity
                    onPress={() => setIntervalDays(Math.max(1, intervalDays - 1))}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease interval"
                    style={[
                      tw`w-10 h-10 rounded-xl items-center justify-center border`,
                      { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[tw`font-bold text-lg`, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <Text style={[tw`font-mono text-lg font-bold w-10 text-center`, { color: colors.primaryText }]}>
                    {intervalDays}d
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIntervalDays(intervalDays + 1)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel="Increase interval"
                    style={[
                      tw`w-10 h-10 rounded-xl items-center justify-center border`,
                      { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[tw`font-bold text-lg`, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text style={[tw`text-sm mb-2 font-medium`, { color: colors.textSecondary }]}>
                  Anchor Start Date
                </Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textSubtle}
                  style={[
                    tw`w-full border rounded-2xl px-4 py-3 text-sm`,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text
                    }
                  ]}
                />
              </View>
            </View>
          )}

          {/* 3. CUSTOM DATES */}
          {recurrenceType === 'custom_dates' && (
            <View
              style={[
                tw`p-4 rounded-2xl border gap-3`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('alarmForm.addedDates')}
              </Text>
              <View style={tw`flex-row gap-2`}>
                <TextInput
                  value={newCustomDate}
                  onChangeText={setNewCustomDate}
                  placeholder={t('alarmForm.datePlaceholder')}
                  placeholderTextColor={colors.textSubtle}
                  style={[
                    tw`flex-1 border rounded-xl px-3 py-2 text-xs`,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text
                    }
                  ]}
                />
                <TouchableOpacity
                  onPress={handleAddCustomDate}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('alarmForm.addDate')}
                  style={[
                    tw`px-3 py-2 rounded-xl flex-row items-center gap-1`,
                    { backgroundColor: colors.primary }
                  ]}
                >
                  <Plus size={14} color="#ffffff" />
                  <Text style={tw`text-xs font-semibold text-white`}>
                    {t('alarmForm.addDate')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={tw`flex-row flex-wrap gap-1.5 pt-1`}>
                {customDates.map((d) => (
                  <View
                    key={d}
                    style={[
                      tw`px-2.5 py-1 rounded-lg border flex-row items-center gap-1.5`,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Text style={[tw`text-xs font-mono`, { color: colors.textSecondary }]}>
                      {d}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveCustomDate(d)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove date ${d}`}
                    >
                      <X size={12} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 4. MONTHLY */}
          {recurrenceType === 'monthly' && (
            <View
              style={[
                tw`p-4 rounded-2xl border gap-3`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <View>
                <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>
                  {t('alarmForm.dayOfMonth')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1.5 mt-2`}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    const isSelected = dayOfMonth === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setDayOfMonth(d)}
                        accessible={true}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Day ${d}`}
                        style={[
                          tw`px-3 py-1.5 rounded-xl border min-w-9 items-center justify-center`,
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
                            tw`text-xs font-bold`,
                            { color: isSelected ? '#ffffff' : colors.textMuted }
                          ]}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View>
                <Text style={[tw`text-xs font-semibold mb-1.5`, { color: colors.textMuted }]}>
                  Months ({selectedMonths.length}/12):
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1`}>
                  {monthNames.map((m) => {
                    const isSelected = selectedMonths.includes(m.val);
                    return (
                      <TouchableOpacity
                        key={m.val}
                        onPress={() => toggleMonth(m.val)}
                        accessible={true}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={m.label}
                        style={[
                          tw`py-1 px-2.5 rounded-lg border`,
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
                            tw`text-xs font-medium`,
                            { color: isSelected ? '#ffffff' : colors.textSubtle }
                          ]}
                        >
                          {m.label}
                        </Text>
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
              <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>
                {t('alarmForm.notificationChannel')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
                {['medicines', 'appointments', 'routine', 'exercise', 'water_meals', 'habits', 'summaries'].map((ch) => {
                  const isSelected = channelId === ch;
                  return (
                    <TouchableOpacity
                      key={ch}
                      onPress={() => setChannelId(ch as NotificationChannelId)}
                      accessible={true}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={ch}
                      style={[
                        tw`px-4 py-2.5 rounded-2xl border min-h-11 justify-center`,
                        isSelected
                          ? {
                              backgroundColor: colors.primary,
                              borderColor: colors.primary
                            }
                          : {
                              backgroundColor: colors.card,
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
              <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>
                {t('alarmForm.alarmStyle')}
              </Text>
              <View style={tw`flex-row gap-2`}>
                <TouchableOpacity
                  onPress={() => setStyle('full_alarm')}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: style === 'full_alarm' }}
                  accessibilityLabel={t('alarmForm.fullScreenAlarm')}
                  style={[
                    tw`flex-1 py-3 px-3 rounded-2xl flex-row items-center justify-center gap-2 border min-h-11`,
                    style === 'full_alarm'
                      ? {
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          borderColor: '#f59e0b'
                        }
                      : {
                          backgroundColor: colors.card,
                          borderColor: colors.border
                        }
                  ]}
                >
                  <Volume2 size={16} color={style === 'full_alarm' ? '#d97706' : colors.textMuted} />
                  <Text
                    style={[
                      tw`text-sm font-bold`,
                      { color: style === 'full_alarm' ? '#d97706' : colors.textMuted }
                    ]}
                  >
                    {t('alarmForm.fullScreenAlarm')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStyle('notification')}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: style === 'notification' }}
                  accessibilityLabel={t('alarmForm.standardNotification')}
                  style={[
                    tw`flex-1 py-3 px-3 rounded-2xl flex-row items-center justify-center gap-2 border min-h-11`,
                    style === 'notification'
                      ? {
                          backgroundColor: colors.primaryBg,
                          borderColor: colors.primary
                        }
                      : {
                          backgroundColor: colors.card,
                          borderColor: colors.border
                        }
                  ]}
                >
                  <Bell size={16} color={style === 'notification' ? colors.primaryText : colors.textMuted} />
                  <Text
                    style={[
                      tw`text-sm font-bold`,
                      { color: style === 'notification' ? colors.primaryText : colors.textMuted }
                    ]}
                  >
                    {t('alarmForm.standardNotification')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Snooze Setting */}
          <View>
            <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>
              {t('alarmForm.snoozeInterval')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 pb-1`}>
              {[5, 10, 15, 30].map((mins) => {
                const isSelected = snoozeIntervalMinutes === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setSnoozeIntervalMinutes(mins)}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${mins} minutes`}
                    style={[
                      tw`px-5 py-3 rounded-2xl border min-h-11 justify-center`,
                      isSelected
                        ? {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary
                          }
                        : {
                            backgroundColor: colors.card,
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
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Next 5 Planned Occurrences Preview */}
          <View
            style={[
              tw`p-4 rounded-2xl border space-y-3`,
              {
                backgroundColor: colors.card,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Sparkles size={16} color="#10b981" />
                <Text style={tw`text-sm font-bold text-emerald-500`}>
                  {t('alarmForm.preview')}
                </Text>
              </View>
            </View>

            {previewOccurrences.length === 0 ? (
              <Text style={[tw`text-sm italic py-2`, { color: colors.textMuted }]}>
                No future triggers match this rule in the next 90 days.
              </Text>
            ) : (
              <View style={tw`gap-2`}>
                {previewOccurrences.map((occ, i) => (
                  <View
                    key={occ.id}
                    style={[
                      tw`p-3 rounded-xl border flex-row items-center justify-between`,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Text style={[tw`text-sm font-medium`, { color: colors.text }]}>
                      <Text style={[tw`font-mono text-xs mr-2`, { color: colors.textMuted }]}>#{i + 1} </Text>
                      {new Date(occ.triggerTimeMs).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={[tw`font-mono font-bold text-sm`, { color: colors.primaryText }]}>
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
              <AlertTriangle size={16} color="#f59e0b" style={tw`shrink-0 mt-0.5`} />
              <View style={tw`flex-1 gap-1`}>
                <Text style={tw`font-semibold text-amber-500 text-sm`}>
                  {t('alarmForm.conflictsDetected', { count: 1 })}
                </Text>
                <Text style={[tw`text-xs leading-relaxed`, { color: colors.textSecondary }]}>
                  {recurringConflict.conflictResult.warningSummary}
                </Text>
                {recurringConflict.conflictResult.suggestions.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      const sug = recurringConflict.conflictResult.suggestions[0];
                      setTimeOfDay(sug.formattedTime);
                    }}
                    style={tw`flex-row items-center gap-1 mt-1 pt-1 border-t border-amber-500/20`}
                  >
                    <Sparkles size={12} color="#10b981" />
                    <Text style={tw`text-xs text-emerald-500 font-semibold`}>
                      {t('conflict.useSuggested')}: {recurringConflict.conflictResult.suggestions[0].formattedTime}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View
          style={[
            tw`p-4 border-t flex-row items-center justify-between gap-4`,
            {
              backgroundColor: colors.bgHeader,
              borderTopColor: colors.border
            }
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alarmForm.cancel')}
            style={[
              tw`py-3.5 px-6 rounded-2xl border min-h-12 justify-center`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <Text style={[tw`text-sm font-bold`, { color: colors.textSecondary }]}>
              {t('alarmForm.cancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? t('alarmForm.updateSchedule') : t('alarmForm.save')}
            style={[
              tw`flex-1 py-3.5 px-5 rounded-2xl flex-row items-center justify-center gap-2 shadow-md min-h-12`,
              { backgroundColor: colors.primary }
            ]}
          >
            <CheckCircle2 size={18} color="#ffffff" />
            <Text style={tw`text-base font-bold text-white`}>
              {isEditing ? t('alarmForm.updateSchedule') : t('alarmForm.save')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
