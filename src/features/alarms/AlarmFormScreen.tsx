import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { addLocalDays, toLocalDateString } from '../../domain/dates';
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
import { RecurrenceOptions, isValidDateString } from './RecurrenceOptions';
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
  // New alarms start empty (no demo data that could be saved by accident).
  const [title, setTitle] = useState(initialSchedule?.title || '');
  const [message, setMessage] = useState(initialSchedule?.message || '');
  const [channelId, setChannelId] = useState<NotificationChannelId>(initialSchedule?.channelId || 'medicines');
  const [style, setStyle] = useState<AlarmStyle>(initialSchedule?.style || 'full_alarm');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(initialSchedule?.recurrenceType || 'daily');
  const [timeOfDay, setTimeOfDay] = useState(initialSchedule?.timeOfDay || '19:30');
  const [weekdays, setWeekdays] = useState<number[]>(initialSchedule?.weekdays || [1, 2, 3, 4, 5]); // Mon-Fri
  const [intervalDays, setIntervalDays] = useState<number>(initialSchedule?.intervalDays || 2); // e.g. 2 days after
  const [startDate, setStartDate] = useState<string>(() => initialSchedule?.startDate || toLocalDateString(Date.now()));
  const [dayOfMonth, setDayOfMonth] = useState<number>(initialSchedule?.dayOfMonth || 1);
  const [selectedMonths, setSelectedMonths] = useState<number[]>(initialSchedule?.monthsOfYear || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [customDates, setCustomDates] = useState<string[]>(
    initialSchedule?.specificDates || [
      addLocalDays(toLocalDateString(Date.now()), 1),
      addLocalDays(toLocalDateString(Date.now()), 3)
    ]
  );
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
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeOfDay.trim())) {
      Alert.alert(t('common.invalidTime'), t('common.invalidTimeDesc'));
      return;
    }
    if ((recurrenceType === 'every_n_days' || recurrenceType === 'once') && !isValidDateString(startDate)) {
      Alert.alert(t('common.invalidInput'), t('alarmForm.invalidDate'));
      return;
    }
    if (recurrenceType === 'custom_dates' && customDates.length === 0) {
      Alert.alert(t('common.missingField'), t('alarmForm.addedDates'));
      return;
    }
    const payload = {
      profileId: 'default',
      category,
      title: title.trim() || t('alarmForm.defaultTitle'),
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
          <RecurrenceOptions
            recurrenceType={recurrenceType}
            weekdays={weekdays}
            onChangeWeekdays={setWeekdays}
            intervalDays={intervalDays}
            onChangeIntervalDays={setIntervalDays}
            startDate={startDate}
            onChangeStartDate={setStartDate}
            customDates={customDates}
            onChangeCustomDates={setCustomDates}
            dayOfMonth={dayOfMonth}
            onChangeDayOfMonth={setDayOfMonth}
            selectedMonths={selectedMonths}
            onChangeSelectedMonths={setSelectedMonths}
          />

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
