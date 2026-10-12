import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import {
  AlarmItem,
  AlarmCategory,
  ALARM_CATEGORIES,
  resolveAlarmCategory
} from '../../domain/alarm';
import {
  Pill,
  Dumbbell,
  Bell,
  Calendar,
  Droplets,
  Sparkles,
  Activity,
  Clock,
  Filter,
  Play
} from 'lucide-react-native';

interface Alarm24hTimelineChartProps {
  alarms: AlarmItem[];
  currentTimeMs: number;
  onTriggerAlarmDirectly?: (alarm: AlarmItem) => void;
}

interface TimelineHourSlot {
  hourLabel: string;
  hourTimeMs: number;
  alarmCount: number;
  alarms: AlarmItem[];
  primaryCategory: AlarmCategory;
  categoryColor: string;
}

// Render the appropriate Lucide icon for any category
export const CategoryIcon: React.FC<{ category: AlarmCategory; className?: string; color?: string }> = ({
  category,
  className = 'w-3.5 h-3.5',
  color
}) => {
  const iconProps = { style: tw.style(className), color };
  switch (category) {
    case 'medicine':
      return <Pill {...iconProps} />;
    case 'exercise':
      return <Dumbbell {...iconProps} />;
    case 'reminder':
      return <Bell {...iconProps} />;
    case 'appointment':
      return <Calendar {...iconProps} />;
    case 'hydration':
      return <Droplets {...iconProps} />;
    case 'habit':
      return <Sparkles {...iconProps} />;
    case 'vitals':
      return <Activity {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
};

export const Alarm24hTimelineChart: React.FC<Alarm24hTimelineChartProps> = ({
  alarms,
  currentTimeMs,
  onTriggerAlarmDirectly
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<AlarmCategory | 'all'>('all');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const next24hEnd = currentTimeMs + 24 * 60 * 60 * 1000;

  const getCategoryLabel = (catId: AlarmCategory): string => {
    return t(`categories.${catId}`) || ALARM_CATEGORIES[catId]?.label || catId;
  };

  // Filter alarms falling in the next 24 hours
  const all24hAlarms = useMemo(() => {
    return alarms
      .filter((a) => a.triggerTimeMs >= currentTimeMs && a.triggerTimeMs <= next24hEnd)
      .sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
  }, [alarms, currentTimeMs, next24hEnd]);

  // Apply category filter if active
  const filtered24hAlarms = useMemo(() => {
    if (selectedFilterCategory === 'all') return all24hAlarms;
    return all24hAlarms.filter((a) => {
      const cat = resolveAlarmCategory(a).id;
      return cat === selectedFilterCategory;
    });
  }, [all24hAlarms, selectedFilterCategory]);

  // Counts per category for the filter bar
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: all24hAlarms.length };
    Object.keys(ALARM_CATEGORIES).forEach((k) => {
      counts[k] = 0;
    });
    all24hAlarms.forEach((a) => {
      const catId = resolveAlarmCategory(a).id;
      counts[catId] = (counts[catId] || 0) + 1;
    });
    return counts;
  }, [all24hAlarms]);

  // Construct 12 two-hour time slots spanning the 24 hours
  const timelineData = useMemo(() => {
    const slots: TimelineHourSlot[] = [];
    const slotDurationMs = 2 * 60 * 60 * 1000; // 2-hour increments
    const currentHourStart = new Date(currentTimeMs);
    currentHourStart.setMinutes(0, 0, 0);
    const startMs = currentHourStart.getTime();

    for (let i = 0; i < 12; i++) {
      const slotStart = startMs + i * slotDurationMs;
      const slotEnd = slotStart + slotDurationMs;
      const slotDate = new Date(slotStart);
      const hourStr = slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      const slotAlarms = filtered24hAlarms.filter(
        (a) => a.triggerTimeMs >= slotStart && a.triggerTimeMs < slotEnd
      );

      const firstAlarm = slotAlarms[0];
      const categoryDef = firstAlarm ? resolveAlarmCategory(firstAlarm) : ALARM_CATEGORIES.medicine;

      slots.push({
        hourLabel: hourStr,
        hourTimeMs: slotStart,
        alarmCount: slotAlarms.length,
        alarms: slotAlarms,
        primaryCategory: categoryDef.id,
        categoryColor: categoryDef.color
      });
    }

    return slots;
  }, [filtered24hAlarms, currentTimeMs]);

  // Relative countdown formatter
  const getRelativeTimeString = (targetMs: number) => {
    const diffMins = Math.round((targetMs - currentTimeMs) / (60 * 1000));
    if (diffMins <= 1) return t('timeline.inTime', { time: '< 1m' });
    if (diffMins < 60) return t('timeline.inTime', { time: `${diffMins}m` });
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const formatted = `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
    return t('timeline.inTime', { time: formatted });
  };

  return (
    <View
      style={[
        tw`rounded-3xl p-5 shadow-lg border`,
        {
          backgroundColor: colors.card,
          borderColor: colors.border
        }
      ]}
    >
      {/* Header */}
      <View style={tw`flex-row items-center justify-between mb-4`}>
        <View style={tw`flex-row items-center gap-2.5 flex-1`}>
          <View
            style={[
              tw`w-9 h-9 rounded-xl border flex items-center justify-center`,
              {
                backgroundColor: colors.primaryBg,
                borderColor: colors.primaryBorder
              }
            ]}
          >
            <Clock size={18} color={colors.primary} />
          </View>
          <View style={tw`flex-1`}>
            <Text style={[tw`text-base font-bold tracking-tight`, { color: colors.text }]}>
              {t('timeline.title')}
            </Text>
            <Text style={[tw`text-[11px]`, { color: colors.textMuted }]}>
              {t('timeline.subtitle')}
            </Text>
          </View>
        </View>

        <View
          style={[
            tw`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border`,
            {
              backgroundColor: colors.cardSecondary,
              borderColor: colors.border
            }
          ]}
        >
          <View style={tw`w-2 h-2 rounded-full bg-emerald-400`} />
          <Text style={[tw`font-bold text-xs`, { color: colors.text }]}>
            {filtered24hAlarms.length}
          </Text>
          <Text style={[tw`text-[11px]`, { color: colors.textSubtle }]}>
            {selectedFilterCategory === 'all'
              ? t('timeline.scheduled')
              : t('timeline.inCategory')}
          </Text>
        </View>
      </View>

      {/* Category Filter Chips with Unique Icons & Colors */}
      <View style={tw`mb-2 mt-1`}>
        <View style={tw`flex-row items-center justify-between mb-2.5`}>
          <View style={tw`flex-row items-center gap-1.5`}>
            <Filter size={14} color={colors.primary} />
            <Text style={[tw`font-bold text-xs`, { color: colors.textSecondary }]}>
              {t('timeline.filterByCategory')}
            </Text>
          </View>
          {selectedFilterCategory !== 'all' && (
            <TouchableOpacity
              onPress={() => setSelectedFilterCategory('all')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('timeline.reset', { count: all24hAlarms.length })}
              style={[
                tw`px-2.5 py-1 rounded-lg`,
                { backgroundColor: colors.primaryBg }
              ]}
            >
              <Text style={[tw`text-[10px] font-bold`, { color: colors.primaryText }]}>
                {t('timeline.reset', { count: all24hAlarms.length })}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tw`flex-row items-center gap-2 pb-2`}
        >
          {/* All Filter Chip */}
          <TouchableOpacity
            onPress={() => setSelectedFilterCategory('all')}
            accessible={true}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedFilterCategory === 'all' }}
            accessibilityLabel={`${t('timeline.all')}, ${categoryCounts.all || 0} ${t('timeline.scheduled')}`}
            style={[
              tw`px-3.5 py-2 rounded-xl text-xs font-bold flex-row items-center gap-2 border`,
              selectedFilterCategory === 'all'
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
                tw`font-bold text-xs`,
                { color: selectedFilterCategory === 'all' ? '#ffffff' : colors.text }
              ]}
            >
              {t('timeline.all')}
            </Text>
            <Text
              style={[
                tw`text-[10px] font-mono`,
                { color: selectedFilterCategory === 'all' ? 'rgba(255,255,255,0.8)' : colors.textMuted }
              ]}
            >
              ({categoryCounts.all || 0})
            </Text>
          </TouchableOpacity>

          {/* Each Category Chip */}
          {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
            const catDef = ALARM_CATEGORIES[catId];
            const isSelected = selectedFilterCategory === catId;
            const count = categoryCounts[catId] || 0;
            const catLabel = getCategoryLabel(catId);

            return (
              <TouchableOpacity
                key={catId}
                onPress={() => setSelectedFilterCategory(isSelected ? 'all' : catId)}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t('accessibility.categoryBadge', { category: catLabel, count })}
                style={[
                  tw`flex-row items-center gap-2 px-3 py-2 rounded-xl border`,
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
                <View style={tw`w-3.5 h-3.5`}>
                  <CategoryIcon category={catId} color={catDef.color} />
                </View>
                <Text style={[tw`font-bold text-xs`, { color: catDef.color }]}>
                  {catLabel}
                </Text>
                <Text
                  style={[
                    tw`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold`,
                    {
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
                      color: colors.text
                    }
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Visual Timeline Bar Chart */}
      <View
        style={[
          tw`border rounded-2xl p-3.5 mt-2`,
          {
            backgroundColor: colors.cardSecondary,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-2`}>
          <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>
            {t('timeline.eventDensity')}
          </Text>
          <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
            {t('timeline.tapToInspect')}
          </Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tw`flex-row items-end gap-2 px-1 pt-2 pb-1`}
        >
          {timelineData.map((slot, idx) => {
            const isSelected = selectedSlotIndex === idx;
            const hasAlarms = slot.alarmCount > 0;
            const maxVal = Math.max(3, ...timelineData.map((s) => s.alarmCount));
            const barHeight = hasAlarms ? Math.max(16, Math.min(76, (slot.alarmCount / maxVal) * 76)) : 6;

            return (
              <TouchableOpacity
                key={slot.hourLabel}
                onPress={() => setSelectedSlotIndex(isSelected ? null : idx)}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.timeSlot', {
                  time: slot.hourLabel,
                  count: slot.alarmCount
                })}
                style={tw`items-center justify-end w-11 min-h-24`}
              >
                <View style={tw`h-5 justify-center items-center mb-1`}>
                  {hasAlarms ? (
                    <View style={[tw`px-1.5 py-0.5 rounded-full`, { backgroundColor: `${slot.categoryColor}30` }]}>
                      <Text style={[tw`text-[10px] font-bold`, { color: slot.categoryColor }]}>
                        {slot.alarmCount}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View
                  style={[
                    tw`w-7 rounded-t-lg`,
                    {
                      height: barHeight,
                      backgroundColor: hasAlarms ? slot.categoryColor : isDark ? '#27272A' : '#cbd5e1',
                      opacity: isSelected ? 1 : hasAlarms ? 0.9 : 0.4,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: colors.text
                    }
                  ]}
                />

                <Text
                  style={[
                    tw`text-[10px] font-mono mt-2`,
                    isSelected
                      ? { color: colors.primaryText, fontWeight: 'bold' }
                      : { color: colors.textSubtle }
                  ]}
                >
                  {slot.hourLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Slot Inspector Card */}
        {selectedSlotIndex !== null && timelineData[selectedSlotIndex] && (
          <View
            style={[
              tw`mt-3 p-3 rounded-xl border`,
              {
                backgroundColor: colors.card,
                borderColor: colors.border
              }
            ]}
          >
            <View style={[tw`flex-row items-center justify-between border-b pb-2 mb-2`, { borderBottomColor: colors.border }]}>
              <View style={tw`flex-row items-center gap-2`}>
                <Clock size={12} color={colors.primary} />
                <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                  {t('timeline.window', { time: timelineData[selectedSlotIndex].hourLabel })}
                </Text>
              </View>
              <Text style={[tw`text-[10px] font-semibold`, { color: colors.textMuted }]}>
                {timelineData[selectedSlotIndex].alarmCount}{' '}
                {timelineData[selectedSlotIndex].alarmCount === 1
                  ? t('timeline.alarm')
                  : t('timeline.alarms')}
              </Text>
            </View>

            {timelineData[selectedSlotIndex].alarmCount === 0 ? (
              <Text style={[tw`text-xs italic py-1`, { color: colors.textSubtle }]}>
                {t('timeline.noAlarmsInWindow')}
              </Text>
            ) : (
              <View style={tw`gap-1.5`}>
                {timelineData[selectedSlotIndex].alarms.map((a) => {
                  const cat = resolveAlarmCategory(a);
                  return (
                    <View
                      key={a.id}
                      style={[
                        tw`flex-row items-center justify-between p-2 rounded-lg border`,
                        {
                          backgroundColor: colors.cardSecondary,
                          borderColor: colors.border
                        }
                      ]}
                    >
                      <View style={tw`flex-row items-center gap-2 flex-1`}>
                        <View style={[tw`p-1 rounded-md`, { backgroundColor: `${cat.color}20` }]}>
                          <View style={tw`w-3.5 h-3.5`}>
                            <CategoryIcon category={cat.id} color={cat.color} />
                          </View>
                        </View>
                        <View style={tw`flex-1`}>
                          <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                            {a.title}
                          </Text>
                          <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
                            {new Date(a.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {getRelativeTimeString(a.triggerTimeMs)}
                          </Text>
                        </View>
                      </View>
                      {onTriggerAlarmDirectly && (
                        <TouchableOpacity
                          onPress={() => onTriggerAlarmDirectly(a)}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={t('accessibility.testAlarm')}
                          style={[
                            tw`p-1.5 rounded-lg border`,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border
                            }
                          ]}
                        >
                          <Play size={12} color="#10b981" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Visual Category Legend */}
      <View
        style={[
          tw`flex-row flex-wrap items-center gap-x-3 gap-y-2 pt-3 pb-3 border-t border-b mt-3`,
          {
            borderColor: colors.border
          }
        ]}
      >
        <Text style={[tw`font-bold text-[11px]`, { color: colors.textMuted }]}>
          {t('timeline.categories')}
        </Text>
        {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
          const cat = ALARM_CATEGORIES[catId];
          return (
            <View key={catId} style={tw`flex-row items-center gap-1.5`}>
              <View
                style={[tw`w-2 h-2 rounded-full shrink-0`, { backgroundColor: cat.color }]}
              />
              <Text style={[tw`font-medium text-[11px]`, { color: colors.textSecondary }]}>
                {getCategoryLabel(catId)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Chronological Sequence List */}
      <View style={tw`mt-3`}>
        <View style={tw`flex-row text-xs font-bold mb-3 items-center justify-between`}>
          <View style={tw`flex-row items-center gap-2 flex-wrap`}>
            <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
              {t('timeline.upcomingTimeline')}
            </Text>
            {selectedFilterCategory !== 'all' && (
              <Text
                style={[
                  tw`text-[10px] font-bold px-2 py-0.5 rounded-md`,
                  {
                    backgroundColor: colors.primaryBg,
                    color: colors.primaryText
                  }
                ]}
              >
                {t('timeline.filtered', { label: getCategoryLabel(selectedFilterCategory) })}
              </Text>
            )}
          </View>
          <Text style={[tw`text-[10px] font-mono font-bold`, { color: colors.textMuted }]}>
            {t('timeline.next24h')}
          </Text>
        </View>

        {filtered24hAlarms.length === 0 ? (
          <View
            style={[
              tw`p-6 rounded-3xl border flex items-center justify-center`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <Text style={[tw`text-sm font-medium text-center`, { color: colors.textMuted }]}>
              {selectedFilterCategory === 'all'
                ? t('timeline.noAlarmsAll')
                : t('timeline.noAlarmsCategory', { category: getCategoryLabel(selectedFilterCategory) })}
            </Text>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true} style={tw`max-h-64`} contentContainerStyle={tw`flex-col gap-2 pr-1`}>
            {filtered24hAlarms.map((item) => {
              const cat = resolveAlarmCategory(item);
              const catLabel = getCategoryLabel(cat.id);
              return (
                <View
                  key={item.id}
                  style={[
                    tw`p-3.5 rounded-2xl border flex-row items-center justify-between gap-3`,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.border
                    }
                  ]}
                  accessible={true}
                  accessibilityLabel={`${item.title}, ${catLabel}, ${getRelativeTimeString(item.triggerTimeMs)}`}
                >
                  <View style={tw`flex-row items-center gap-3.5 flex-1`}>
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
                      <View style={tw`flex-row items-center flex-wrap gap-2 mb-1`}>
                        <Text style={[tw`text-sm font-bold shrink`, { color: colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View style={tw`flex-row gap-1`}>
                          <Text
                            style={[
                              tw`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0`,
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
                              tw`text-[10px] font-bold px-1.5 py-0.5 rounded-md`,
                              item.style === 'full_alarm'
                                ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }
                                : { backgroundColor: colors.border, color: colors.textMuted }
                            ]}
                          >
                            {item.style === 'full_alarm' ? t('alarm.fullAlarm') : t('alarm.notification')}
                          </Text>
                        </View>
                      </View>
                      <View style={tw`text-xs flex-row items-center gap-2 mt-0.5`}>
                        <Text style={[tw`font-mono font-bold text-xs`, { color: colors.textSecondary }]}>
                          {new Date(item.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={{ color: colors.borderStrong }}>•</Text>
                        <Text style={[tw`font-medium text-xs`, { color: colors.textMuted }]}>
                          {new Date(item.triggerTimeMs).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={tw`flex-row items-center gap-2 shrink-0`}>
                    <Text
                      style={[
                        tw`px-2.5 py-1 rounded-lg font-bold text-[10px] font-mono`,
                        {
                          backgroundColor: colors.primaryBg,
                          color: colors.primaryText
                        }
                      ]}
                    >
                      {getRelativeTimeString(item.triggerTimeMs)}
                    </Text>
                    {onTriggerAlarmDirectly && (
                      <TouchableOpacity
                        onPress={() => onTriggerAlarmDirectly(item)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={t('accessibility.testAlarm')}
                        style={[
                          tw`p-2.5 rounded-xl border`,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border
                          }
                        ]}
                      >
                        <Play size={14} color="#10b981" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
};
