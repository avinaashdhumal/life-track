import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { RecurrenceType } from '../../domain/alarm';

/** "YYYY-MM-DD" that is a real calendar date. */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

interface RecurrenceOptionsProps {
  recurrenceType: RecurrenceType;
  weekdays: number[];
  onChangeWeekdays: (days: number[]) => void;
  intervalDays: number;
  onChangeIntervalDays: (days: number) => void;
  startDate: string;
  onChangeStartDate: (date: string) => void;
  customDates: string[];
  onChangeCustomDates: (dates: string[]) => void;
  dayOfMonth: number;
  onChangeDayOfMonth: (day: number) => void;
  selectedMonths: number[];
  onChangeSelectedMonths: (months: number[]) => void;
}

/** The per-recurrence-type options (weekdays, interval, custom dates, monthly) of the alarm form. */
export const RecurrenceOptions: React.FC<RecurrenceOptionsProps> = ({
  recurrenceType,
  weekdays,
  onChangeWeekdays,
  intervalDays,
  onChangeIntervalDays,
  startDate,
  onChangeStartDate,
  customDates,
  onChangeCustomDates,
  dayOfMonth,
  onChangeDayOfMonth,
  selectedMonths,
  onChangeSelectedMonths
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [newCustomDate, setNewCustomDate] = useState('');

  const dayNames = t('alarmForm.dayNames', { returnObjects: true }) as unknown as string[];
  const weekdayOptions = [0, 1, 2, 3, 4, 5, 6].map((val) => ({
    val,
    label: Array.isArray(dayNames) && dayNames[val] ? dayNames[val] : String(val)
  }));

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    let label = String(i + 1);
    try {
      label = new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(new Date(2026, i, 1));
    } catch {
      // Intl unavailable: fall back to month numbers
    }
    return { val: i + 1, label };
  });

  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      if (weekdays.length > 1) onChangeWeekdays(weekdays.filter((d) => d !== day));
    } else {
      onChangeWeekdays([...weekdays, day].sort());
    }
  };

  const toggleMonth = (m: number) => {
    if (selectedMonths.includes(m)) {
      if (selectedMonths.length > 1) onChangeSelectedMonths(selectedMonths.filter((item) => item !== m));
    } else {
      onChangeSelectedMonths([...selectedMonths, m].sort((a, b) => a - b));
    }
  };

  const handleAddCustomDate = () => {
    const value = newCustomDate.trim();
    if (!isValidDateString(value)) {
      Alert.alert(t('common.invalidInput'), t('alarmForm.invalidDate'));
      return;
    }
    if (!customDates.includes(value)) {
      onChangeCustomDates([...customDates, value].sort());
    }
    setNewCustomDate('');
  };

  const cardStyle = [tw`p-4 rounded-2xl border gap-3`, { backgroundColor: colors.card, borderColor: colors.border }];
  const chip = (selected: boolean) =>
    selected
      ? { backgroundColor: colors.primary, borderColor: colors.primary }
      : { backgroundColor: colors.cardSecondary, borderColor: colors.border };

  if (recurrenceType === 'weekly') {
    return (
      <View style={cardStyle}>
        <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textSecondary }]}>{t('alarmForm.selectWeekdays')}:</Text>
        <View style={tw`flex-row items-center justify-between gap-1`}>
          {weekdayOptions.map((w) => {
            const isSelected = weekdays.includes(w.val);
            return (
              <TouchableOpacity
                key={w.val}
                onPress={() => toggleWeekday(w.val)}
                accessible={true}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={w.label}
                style={[tw`w-11 h-11 rounded-xl items-center justify-center border`, chip(isSelected)]}
              >
                <Text style={[tw`text-xs font-bold`, { color: isSelected ? '#ffffff' : colors.textSubtle }]}>{w.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  if (recurrenceType === 'every_n_days') {
    const startDateInvalid = startDate.length > 0 && !isValidDateString(startDate);
    return (
      <View style={[tw`p-4 rounded-2xl border gap-4`, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={tw`flex-row items-center justify-between`}>
          <View>
            <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>{t('alarmForm.interval')}</Text>
            <Text style={[tw`text-xs mt-0.5`, { color: colors.textMuted }]}>{t('alarmForm.intervalHint')}</Text>
          </View>
          <View style={tw`flex-row items-center gap-3`}>
            <TouchableOpacity
              onPress={() => onChangeIntervalDays(Math.max(1, intervalDays - 1))}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('alarmForm.decreaseInterval')}
              style={[tw`w-10 h-10 rounded-xl items-center justify-center border`, chip(false)]}
            >
              <Text style={[tw`font-bold text-lg`, { color: colors.text }]}>-</Text>
            </TouchableOpacity>
            <Text style={[tw`font-mono text-lg font-bold w-10 text-center`, { color: colors.primaryText }]}>{intervalDays}d</Text>
            <TouchableOpacity
              onPress={() => onChangeIntervalDays(Math.min(365, intervalDays + 1))}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('alarmForm.increaseInterval')}
              style={[tw`w-10 h-10 rounded-xl items-center justify-center border`, chip(false)]}
            >
              <Text style={[tw`font-bold text-lg`, { color: colors.text }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={[tw`text-sm mb-2 font-medium`, { color: colors.textSecondary }]}>{t('alarmForm.anchorStartDate')}</Text>
          <TextInput
            value={startDate}
            onChangeText={onChangeStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={t('alarmForm.anchorStartDate')}
            style={[
              tw`w-full border rounded-2xl px-4 py-3 text-sm`,
              {
                backgroundColor: colors.inputBg,
                borderColor: startDateInvalid ? '#ef4444' : colors.inputBorder,
                color: colors.text
              }
            ]}
          />
          {startDateInvalid && <Text style={tw`text-xs text-red-500 mt-1`}>{t('alarmForm.invalidDate')}</Text>}
        </View>
      </View>
    );
  }

  if (recurrenceType === 'custom_dates') {
    return (
      <View style={cardStyle}>
        <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>{t('alarmForm.addedDates')}</Text>
        <View style={tw`flex-row gap-2`}>
          <TextInput
            value={newCustomDate}
            onChangeText={setNewCustomDate}
            placeholder={t('alarmForm.datePlaceholder')}
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel={t('alarmForm.datePlaceholder')}
            style={[
              tw`flex-1 border rounded-xl px-3 py-2 text-xs`,
              { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
            ]}
          />
          <TouchableOpacity
            onPress={handleAddCustomDate}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alarmForm.addDate')}
            style={[tw`px-3 py-2 rounded-xl flex-row items-center gap-1`, { backgroundColor: colors.primary }]}
          >
            <Plus size={14} color="#ffffff" />
            <Text style={tw`text-xs font-semibold text-white`}>{t('alarmForm.addDate')}</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-row flex-wrap gap-1.5 pt-1`}>
          {customDates.map((d) => (
            <View
              key={d}
              style={[
                tw`px-2.5 py-1 rounded-lg border flex-row items-center gap-1.5`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border }
              ]}
            >
              <Text style={[tw`text-xs font-mono`, { color: colors.textSecondary }]}>{d}</Text>
              <TouchableOpacity
                onPress={() => onChangeCustomDates(customDates.filter((item) => item !== d))}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('alarmForm.removeDate', { date: d })}
              >
                <X size={12} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (recurrenceType === 'monthly') {
    return (
      <View style={cardStyle}>
        <View>
          <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>{t('alarmForm.dayOfMonth')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1.5 mt-2`}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
              const isSelected = dayOfMonth === d;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => onChangeDayOfMonth(d)}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t('alarmForm.dayLabel', { day: d })}
                  style={[tw`px-3 py-1.5 rounded-xl border min-w-9 items-center justify-center`, chip(isSelected)]}
                >
                  <Text style={[tw`text-xs font-bold`, { color: isSelected ? '#ffffff' : colors.textMuted }]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View>
          <Text style={[tw`text-xs font-semibold mb-1.5`, { color: colors.textMuted }]}>
            {t('alarmForm.monthsSelected', { count: selectedMonths.length })}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-1`}>
            {monthOptions.map((m) => {
              const isSelected = selectedMonths.includes(m.val);
              return (
                <TouchableOpacity
                  key={m.val}
                  onPress={() => toggleMonth(m.val)}
                  accessible={true}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={m.label}
                  style={[tw`py-1 px-2.5 rounded-lg border`, chip(isSelected)]}
                >
                  <Text style={[tw`text-xs font-medium`, { color: isSelected ? '#ffffff' : colors.textSubtle }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  }

  return null;
};
