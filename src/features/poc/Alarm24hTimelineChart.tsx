import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image } from 'react-native';
import tw from 'twrnc';
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
  CheckCircle2,
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
export const CategoryIcon: React.FC<{ category: AlarmCategory; className?: string }> = ({
  category,
  className = 'w-3.5 h-3.5'
}) => {
  switch (category) {
    case 'medicine':
      return <Pill style={tw.style(className)} />;
    case 'exercise':
      return <Dumbbell style={tw.style(className)} />;
    case 'reminder':
      return <Bell style={tw.style(className)} />;
    case 'appointment':
      return <Calendar style={tw.style(className)} />;
    case 'hydration':
      return <Droplets style={tw.style(className)} />;
    case 'habit':
      return <Sparkles style={tw.style(className)} />;
    case 'vitals':
      return <Activity style={tw.style(className)} />;
    default:
      return <Bell style={tw.style(className)} />;
  }
};

export const Alarm24hTimelineChart: React.FC<Alarm24hTimelineChartProps> = ({
  alarms,
  currentTimeMs,
  onTriggerAlarmDirectly
}) => {
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<AlarmCategory | 'all'>('all');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const next24hEnd = currentTimeMs + 24 * 60 * 60 * 1000;

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
    if (diffMins <= 1) return 'in < 1m';
    if (diffMins < 60) return `in ${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `in ${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  };

  return (
    <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5 shadow-lg space-y-4`}>
      {/* Header */}
      <View style={tw`flex items-center justify-between`}>
        <View style={tw`flex items-center gap-2.5`}>
          <View style={tw`w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400`}>
            <Clock style={tw`w-5 h-5`} />
          </View>
          <View>
            <Text style={tw`text-base font-bold text-white tracking-tight`}>
              24-Hour Alarm Timeline
            </Text>
            <Text style={tw`text-[11px] text-zinc-400`}>
              Categorized sequence of events scheduled for the next 24h
            </Text>
          </View>
        </View>

        <View style={tw`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300`}>
          <Text style={tw`w-2 h-2 rounded-full bg-emerald-400 animate-pulse`} />
          <Text style={tw`font-semibold text-white`}>{filtered24hAlarms.length}</Text>
          <Text style={tw`text-zinc-500`}>
            {selectedFilterCategory === 'all' ? 'scheduled' : 'in category'}
          </Text>
        </View>
      </View>

      {/* Category Filter Chips with Unique Icons & Colors */}
      <View style={tw`mb-2 mt-2`}>
        <View style={tw`flex-row items-center justify-between mb-3 text-[11px] text-zinc-400`}>
          <View style={tw`flex-row items-center gap-1.5`}>
            <Filter size={14} color={tw.color('indigo-400')} />
            <Text style={tw`font-bold text-zinc-300 text-xs`}>Filter by Category:</Text>
          </View>
          {selectedFilterCategory !== 'all' && (
            <TouchableOpacity
              onPress={() => setSelectedFilterCategory('all')}
              style={tw`px-2 py-1 rounded-md bg-indigo-500/10 active:bg-indigo-500/20`}
            >
              <Text style={tw`text-[10px] font-bold text-indigo-400`}>Reset ({all24hAlarms.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row items-center gap-2 pb-2 text-xs`}>
          {/* All Filter Chip */}
          <TouchableOpacity
            
            onPress={() => setSelectedFilterCategory('all')}
            style={tw`px-4 py-2.5 rounded-xl text-xs font-bold flex-row items-center gap-2 transition border ${
              selectedFilterCategory === 'all'
                ? 'bg-zinc-200 text-zinc-950 border-white shadow-sm'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800'
            }`}
          >
            <Text style={tw`${selectedFilterCategory === 'all' ? 'text-zinc-900' : 'text-zinc-300'} font-bold`}>All</Text>
            <Text style={tw`text-[10px] ${selectedFilterCategory === 'all' ? 'opacity-75 text-zinc-900' : 'opacity-75 text-zinc-400'}`}>({categoryCounts.all || 0})</Text>
          </TouchableOpacity>

          {/* Each Category Chip with unique icon and color badge */}
          {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
            const catDef = ALARM_CATEGORIES[catId];
            const isSelected = selectedFilterCategory === catId;
            const count = categoryCounts[catId] || 0;

            return (
              <TouchableOpacity
                key={catId}
                
                onPress={() => setSelectedFilterCategory(isSelected ? 'all' : catId)}
                style={tw`flex-row items-center gap-2 px-4 py-2.5 rounded-xl border ${isSelected ? 'border-zinc-500 bg-zinc-800' : 'border-zinc-800 bg-zinc-950'}`}
              >
                <View style={tw`w-4 h-4`}>
                  <CategoryIcon category={catId} />
                </View>
                <Text style={[tw`font-bold`, { color: catDef.color }]}>{catDef.label}</Text>
                <Text
                  style={[tw`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold`, {
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                    color: isSelected ? 'white' : '#A1A1AA'
                  }]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Native Visual Timeline Bar Chart */}
      <View style={tw`bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3.5`}>
        <View style={tw`flex-row items-center justify-between mb-2`}>
          <Text style={tw`text-xs font-semibold text-zinc-300`}>2-Hour Event Density</Text>
          <Text style={tw`text-[10px] text-zinc-500`}>Tap a bar to inspect</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row items-end gap-2 px-1 pt-2 pb-1`}>
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
                style={tw`items-center justify-end w-11`}
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
                      backgroundColor: hasAlarms ? slot.categoryColor : '#27272A',
                      opacity: isSelected ? 1 : hasAlarms ? 0.85 : 0.4,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: '#FFFFFF'
                    }
                  ]}
                />

                <Text style={tw`text-[10px] font-mono mt-2 ${isSelected ? 'text-white font-bold' : 'text-zinc-500'}`}>
                  {slot.hourLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Slot Inspector Card */}
        {selectedSlotIndex !== null && timelineData[selectedSlotIndex] && (
          <View style={tw`mt-3 p-3 rounded-xl bg-zinc-900 border border-zinc-700/70`}>
            <View style={tw`flex-row items-center justify-between border-b border-zinc-800 pb-2 mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Clock size={12} color={tw.color('indigo-400')} />
                <Text style={tw`text-xs font-bold text-white`}>
                  Window: {timelineData[selectedSlotIndex].hourLabel}
                </Text>
              </View>
              <Text style={tw`text-[10px] font-semibold text-zinc-400`}>
                {timelineData[selectedSlotIndex].alarmCount} {timelineData[selectedSlotIndex].alarmCount === 1 ? 'alarm' : 'alarms'}
              </Text>
            </View>

            {timelineData[selectedSlotIndex].alarmCount === 0 ? (
              <Text style={tw`text-xs text-zinc-500 italic py-1`}>
                No alarms scheduled in this 2-hour window.
              </Text>
            ) : (
              <View style={tw`gap-1.5`}>
                {timelineData[selectedSlotIndex].alarms.map((a) => {
                  const cat = resolveAlarmCategory(a);
                  return (
                    <View
                      key={a.id}
                      style={tw`flex-row items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800`}
                    >
                      <View style={tw`flex-row items-center gap-2 flex-1`}>
                        <View style={[tw`p-1 rounded-md`, { backgroundColor: `${cat.color}20` }]}>
                          <View style={tw`w-3.5 h-3.5`}>
                            <CategoryIcon category={cat.id} />
                          </View>
                        </View>
                        <View style={tw`flex-1`}>
                          <Text style={tw`text-xs font-bold text-white`} numberOfLines={1}>
                            {a.title}
                          </Text>
                          <Text style={tw`text-[10px] text-zinc-400`}>
                            {new Date(a.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {getRelativeTimeString(a.triggerTimeMs)}
                          </Text>
                        </View>
                      </View>
                      {onTriggerAlarmDirectly && (
                        <TouchableOpacity
                          onPress={() => onTriggerAlarmDirectly(a)}
                          style={tw`p-1.5 rounded-lg bg-zinc-800 active:bg-zinc-700`}
                        >
                          <Play size={12} color={tw.color('emerald-400')} />
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
      <View style={tw`flex-row flex-wrap items-center gap-x-3 gap-y-2 pt-3 pb-3 text-[10px] text-zinc-400 border-t border-b border-zinc-800/80`}>
        <Text style={tw`text-zinc-500 font-bold flex-row items-center gap-1`}>
          <Text>Categories:</Text>
        </Text>
        {(Object.keys(ALARM_CATEGORIES) as AlarmCategory[]).map((catId) => {
          const cat = ALARM_CATEGORIES[catId];
          return (
            <View key={catId} style={tw`flex-row items-center gap-1.5`}>
              <View
                style={[tw`w-2 h-2 rounded-full shrink-0`, { backgroundColor: cat.color }]}
              />
              <Text style={tw`text-zinc-300 font-medium text-[11px]`}>{cat.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Chronological Sequence List with Category Badges & Icons */}
      <View style={tw`mt-2`}>
        <View style={tw`flex-row text-xs font-bold text-zinc-300 mb-3 items-center justify-between`}>
          <View style={tw`flex-row items-center gap-2 flex-wrap`}>
            <Text style={tw`text-sm`}>Upcoming Timeline</Text>
            {selectedFilterCategory !== 'all' && (
              <Text style={tw`text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md`}>
                Filtered: {ALARM_CATEGORIES[selectedFilterCategory].label}
              </Text>
            )}
          </View>
          <Text style={tw`text-[10px] text-zinc-500 font-mono font-bold`}>Next 24h</Text>
        </View>

        {filtered24hAlarms.length === 0 ? (
          <View style={tw`p-6 rounded-3xl bg-zinc-950 border border-zinc-800 flex items-center justify-center`}>
            <Text style={tw`text-sm font-medium text-zinc-500 text-center`}>
              {selectedFilterCategory === 'all'
                ? 'No alarms scheduled in the next 24 hours. Use the scheduler above to add an alarm.'
                : `No alarms scheduled in category "${ALARM_CATEGORIES[selectedFilterCategory].label}" for the next 24 hours.`}
            </Text>
          </View>
        ) : (
          <ScrollView nestedScrollEnabled={true} style={tw`max-h-64`} contentContainerStyle={tw`flex-col gap-2 pr-1`}>
            {filtered24hAlarms.map((item) => {
              const cat = resolveAlarmCategory(item);
              return (
                <View
                  key={item.id}
                  style={tw`p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex-row items-center justify-between gap-3 text-xs`}
                >
                  <View style={tw`flex-row items-center gap-3.5 flex-1`}>
                    {/* Category Icon Badge Container */}
                    <View
                      style={[tw`w-10 h-10 rounded-xl flex items-center justify-center shrink-0`, {
                        backgroundColor: `${cat.color}15`,
                        border: `1px solid ${cat.color}30`
                      }]}
                    >
                      <View style={tw`w-5 h-5`}><CategoryIcon category={cat.id}  /></View>
                    </View>

                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center flex-wrap gap-2 mb-1`}>
                        <Text style={tw`text-sm font-bold text-white shrink`} numberOfLines={1}>{item.title}</Text>
                        <View style={tw`flex-row gap-1`}>
                          <Text
                            style={[tw`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0`, {
                              backgroundColor: `${cat.color}15`,
                              color: cat.color
                            }]}
                          >
                            {cat.label}
                          </Text>
                          <Text style={tw`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${item.style === 'full_alarm' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                            {item.style === 'full_alarm' ? 'Full Alarm' : 'Notif'}
                          </Text>
                        </View>
                      </View>
                      <View style={tw`text-xs text-zinc-400 flex-row items-center gap-2 mt-0.5`}>
                        <Text style={tw`font-mono font-bold text-zinc-300`}>
                          {new Date(item.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={tw`text-zinc-600`}>•</Text>
                        <Text style={tw`text-zinc-500 font-medium`}>
                          {new Date(item.triggerTimeMs).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={tw`flex-row items-center gap-2 shrink-0`}>
                    <Text style={tw`px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 font-bold text-[10px] font-mono`}>
                      {getRelativeTimeString(item.triggerTimeMs)}
                    </Text>
                    {onTriggerAlarmDirectly && (
                      <TouchableOpacity
                        onPress={() => onTriggerAlarmDirectly(item)}
                        style={tw`p-2.5 rounded-xl bg-zinc-900 active:bg-zinc-800`}
                        
                      >
                        <Play size={14} color={tw.color('emerald-400')} />
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
