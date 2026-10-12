import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import {
  DailyRoutine,
  RoutineAnchor,
  RoutineCustomBlock,
  getDefaultDailyRoutine,
  getOrderedRoutineTimeline,
  timeStringToMinutes,
  minutesToTimeString
} from '../../domain/routine';
import { routineRepository } from '../../data/routineRepository';
import {
  Sun,
  Moon,
  Coffee,
  Utensils,
  Activity,
  Sparkles,
  Bed,
  Plus,
  Trash2,
  X,
  Check,
  Clock,
  ChevronRight,
  Info
} from 'lucide-react-native';

interface RoutineSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onRoutineUpdated?: (routine: DailyRoutine) => void;
}

export const RoutineSettingsModal: React.FC<RoutineSettingsModalProps> = ({
  visible,
  onClose,
  onRoutineUpdated
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [routine, setRoutine] = useState<DailyRoutine>(() => getDefaultDailyRoutine('default'));
  const [wakeTime, setWakeTime] = useState<string>('07:00');
  const [breakfastTime, setBreakfastTime] = useState<string>('08:30');
  const [lunchTime, setLunchTime] = useState<string>('13:00');
  const [dinnerTime, setDinnerTime] = useState<string>('20:00');
  const [windDownTime, setWindDownTime] = useState<string>('22:00');
  const [sleepTime, setSleepTime] = useState<string>('23:00');
  const [exerciseTime, setExerciseTime] = useState<string>('18:00');
  const [customBlocks, setCustomBlocks] = useState<RoutineCustomBlock[]>([]);

  // Add custom block state
  const [newCustomLabel, setNewCustomLabel] = useState<string>('');
  const [newCustomTime, setNewCustomTime] = useState<string>('16:00');
  const [showAddCustom, setShowAddCustom] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      loadRoutine();
    }
  }, [visible]);

  const loadRoutine = async () => {
    try {
      const loaded = await routineRepository.getRoutine('default');
      setRoutine(loaded);
      setWakeTime(loaded.wakeTime || '07:00');
      setBreakfastTime(loaded.breakfastTime || '08:30');
      setLunchTime(loaded.lunchTime || '13:00');
      setDinnerTime(loaded.dinnerTime || '20:00');
      setWindDownTime(loaded.windDownTime || '22:00');
      setSleepTime(loaded.sleepTime || '23:00');
      setExerciseTime(loaded.exerciseTime || '18:00');
      setCustomBlocks(loaded.customBlocks || []);
    } catch {
      // Fallback
    }
  };

  const handleAdjustTime = (
    current: string,
    deltaMinutes: number,
    setter: (val: string) => void
  ) => {
    const mins = timeStringToMinutes(current);
    const newMins = (mins + deltaMinutes + 1440) % 1440;
    setter(minutesToTimeString(newMins));
  };

  const handleAddCustomBlock = () => {
    if (!newCustomLabel.trim()) {
      Alert.alert(t('common.error'), t('routine.customLabelRequired', 'Please enter a name for this routine block'));
      return;
    }
    const newBlock: RoutineCustomBlock = {
      id: `custom_${Date.now()}`,
      label: newCustomLabel.trim(),
      time: newCustomTime
    };
    setCustomBlocks((prev) => [...prev, newBlock]);
    setNewCustomLabel('');
    setShowAddCustom(false);
  };

  const handleRemoveCustomBlock = (id: string) => {
    setCustomBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated: DailyRoutine = {
        ...routine,
        wakeTime,
        breakfastTime,
        lunchTime,
        dinnerTime,
        windDownTime,
        sleepTime,
        exerciseTime,
        customBlocks,
        updatedAt: Date.now()
      };

      // Saving emits a routine change; reminders anchored to the routine re-sync automatically.
      await routineRepository.saveRoutine(updated);

      if (onRoutineUpdated) {
        onRoutineUpdated(updated);
      }
      onClose();
    } catch {
      Alert.alert(t('common.error'), t('routine.saveFailed', 'Failed to save daily routine'));
    } finally {
      setIsSaving(false);
    }
  };

  // Preview timeline calculated from current modal inputs
  const currentDraftRoutine: DailyRoutine = {
    ...routine,
    wakeTime,
    breakfastTime,
    lunchTime,
    dinnerTime,
    windDownTime,
    sleepTime,
    exerciseTime,
    customBlocks
  };
  const timeline = getOrderedRoutineTimeline(currentDraftRoutine);

  // Calculate sleep target hours
  const sleepMins = timeStringToMinutes(sleepTime);
  const wakeMins = timeStringToMinutes(wakeTime);
  const sleepDurationMins = (wakeMins - sleepMins + 1440) % 1440;
  const sleepHours = Math.floor(sleepDurationMins / 60);
  const sleepRemMins = sleepDurationMins % 60;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={tw`flex-1 justify-end bg-black/60`}
      >
        <View
          style={[
            tw`rounded-t-3xl max-h-[92%] border-t shadow-2xl`,
            {
              backgroundColor: colors.card,
              borderColor: colors.border
            }
          ]}
        >
          {/* Header */}
          <View
            style={[
              tw`flex-row items-center justify-between p-4 border-b`,
              { borderColor: colors.borderLight }
            ]}
          >
            <View style={tw`flex-row items-center gap-2.5`}>
              <View
                style={[
                  tw`w-10 h-10 rounded-2xl items-center justify-center border`,
                  {
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                    borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe'
                  }
                ]}
              >
                <Sun size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[tw`text-lg font-bold`, { color: colors.text }]}>
                  {t('routine.title', 'Daily Routine')}
                </Text>
                <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                  {t('routine.subtitle', 'Configure daily anchors for smart reminders')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.close')}
              style={[
                tw`p-2 rounded-full`,
                { backgroundColor: colors.cardSecondary }
              ]}
            >
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={tw`p-4`} contentContainerStyle={tw`pb-10`}>
            {/* Visual Timeline Bar */}
            <View
              style={[
                tw`p-3.5 rounded-2xl border mb-5`,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.borderLight
                }
              ]}
            >
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: colors.textMuted }]}>
                  {t('routine.timelinePreview', '24-Hour Routine Timeline')}
                </Text>
                <View
                  style={[
                    tw`px-2 py-0.5 rounded-full border flex-row items-center gap-1`,
                    {
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0'
                    }
                  ]}
                >
                  <Bed size={12} color="#10b981" />
                  <Text style={tw`text-[10px] font-bold text-emerald-500`}>
                    {sleepHours}h {sleepRemMins > 0 ? `${sleepRemMins}m` : ''} sleep target
                  </Text>
                </View>
              </View>

              {/* Horizontal Scroll of Anchors */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={tw`flex-row gap-2 py-1`}
              >
                {timeline.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      tw`px-3 py-2 rounded-xl border items-center min-w-[70px]`,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.borderLight
                      }
                    ]}
                  >
                    <Text style={[tw`text-[10px] font-semibold mb-0.5`, { color: colors.textMuted }]}>
                      {item.label}
                    </Text>
                    <Text style={[tw`text-xs font-bold font-mono`, { color: colors.primary }]}>
                      {item.time}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Core Daily Anchors */}
            <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2.5`, { color: colors.textMuted }]}>
              {t('routine.coreAnchors', 'Core Daily Anchors')}
            </Text>

            {/* Anchor Card: Wake */}
            <RoutineAnchorRow
              icon={<Sun size={18} color="#f59e0b" />}
              iconBg={isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7'}
              label={t('routine.wakeTime', 'Wake Up Time')}
              time={wakeTime}
              onAdjust={(delta) => handleAdjustTime(wakeTime, delta, setWakeTime)}
              colors={colors}
              isDark={isDark}
            />

            {/* Anchor Card: Breakfast */}
            <RoutineAnchorRow
              icon={<Coffee size={18} color="#f97316" />}
              iconBg={isDark ? 'rgba(249, 115, 22, 0.15)' : '#ffedd5'}
              label={t('routine.breakfastTime', 'Breakfast')}
              time={breakfastTime}
              onAdjust={(delta) => handleAdjustTime(breakfastTime, delta, setBreakfastTime)}
              colors={colors}
              isDark={isDark}
            />

            {/* Anchor Card: Lunch */}
            <RoutineAnchorRow
              icon={<Utensils size={18} color="#10b981" />}
              iconBg={isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5'}
              label={t('routine.lunchTime', 'Lunch')}
              time={lunchTime}
              onAdjust={(delta) => handleAdjustTime(lunchTime, delta, setLunchTime)}
              colors={colors}
              isDark={isDark}
            />

            {/* Anchor Card: Exercise */}
            <RoutineAnchorRow
              icon={<Activity size={18} color="#06b6d4" />}
              iconBg={isDark ? 'rgba(6, 182, 212, 0.15)' : '#cffafe'}
              label={t('routine.exerciseTime', 'Workout / Exercise')}
              time={exerciseTime}
              onAdjust={(delta) => handleAdjustTime(exerciseTime, delta, setExerciseTime)}
              colors={colors}
              isDark={isDark}
            />

            {/* Anchor Card: Dinner */}
            <RoutineAnchorRow
              icon={<Utensils size={18} color="#8b5cf6" />}
              iconBg={isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe'}
              label={t('routine.dinnerTime', 'Dinner')}
              time={dinnerTime}
              onAdjust={(delta) => handleAdjustTime(dinnerTime, delta, setDinnerTime)}
              colors={colors}
              isDark={isDark}
            />

            {/* Anchor Card: Wind Down */}
            <RoutineAnchorRow
              icon={<Sparkles size={18} color="#ec4899" />}
              iconBg={isDark ? 'rgba(236, 72, 153, 0.15)' : '#fce7f3'}
              label={t('routine.windDownTime', 'Wind Down')}
              time={windDownTime}
              onAdjust={(delta) => handleAdjustTime(windDownTime, delta, setWindDownTime)}
              colors={colors}
              isDark={isDark}
            />

            {/* Anchor Card: Sleep */}
            <RoutineAnchorRow
              icon={<Moon size={18} color="#6366f1" />}
              iconBg={isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff'}
              label={t('routine.sleepTime', 'Bedtime / Sleep')}
              time={sleepTime}
              onAdjust={(delta) => handleAdjustTime(sleepTime, delta, setSleepTime)}
              colors={colors}
              isDark={isDark}
            />

            {/* Custom Anchors Section */}
            <View style={tw`mt-4 mb-2`}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: colors.textMuted }]}>
                  {t('routine.customBlocks', 'Custom Routine Anchors')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddCustom(true)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('routine.addCustomBlock', 'Add Custom Anchor')}
                  style={[
                    tw`flex-row items-center gap-1 px-2.5 py-1 rounded-full border`,
                    {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                      borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe'
                    }
                  ]}
                >
                  <Plus size={12} color={colors.primary} />
                  <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                    {t('common.add', 'Add')}
                  </Text>
                </TouchableOpacity>
              </View>

              {customBlocks.length === 0 ? (
                <View
                  style={[
                    tw`p-3.5 rounded-2xl border items-center justify-center`,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.borderLight
                    }
                  ]}
                >
                  <Text style={[tw`text-xs text-center`, { color: colors.textMuted }]}>
                    {t('routine.noCustomBlocks', 'No custom anchors added (e.g. Morning Walk, Meditation)')}
                  </Text>
                </View>
              ) : (
                customBlocks.map((block) => (
                  <View
                    key={block.id}
                    style={[
                      tw`flex-row items-center justify-between p-3 rounded-2xl border mb-2`,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.borderLight
                      }
                    ]}
                  >
                    <View style={tw`flex-row items-center gap-3 flex-1`}>
                      <View
                        style={[
                          tw`w-8 h-8 rounded-xl items-center justify-center border`,
                          {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.borderLight
                          }
                        ]}
                      >
                        <Clock size={16} color={colors.primary} />
                      </View>
                      <Text style={[tw`text-sm font-semibold flex-1`, { color: colors.text }]}>
                        {block.label}
                      </Text>
                    </View>
                    <View style={tw`flex-row items-center gap-2`}>
                      <Text style={[tw`text-sm font-bold font-mono px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200`]}>
                        {block.time}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveCustomBlock(block.id)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                        style={tw`p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20`}
                      >
                        <Trash2 size={14} color="#f43f5e" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {/* Add Custom Anchor Dialog */}
              {showAddCustom && (
                <View
                  style={[
                    tw`p-3.5 rounded-2xl border mt-2`,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.primary
                    }
                  ]}
                >
                  <Text style={[tw`text-xs font-bold mb-2`, { color: colors.text }]}>
                    {t('routine.newCustomAnchor', 'New Routine Anchor')}
                  </Text>
                  <TextInput
                    value={newCustomLabel}
                    onChangeText={setNewCustomLabel}
                    placeholder="e.g. Evening Walk, Meditation"
                    placeholderTextColor={colors.textMuted}
                    accessible={true}
                    accessibilityLabel="Custom anchor label input"
                    style={[
                      tw`p-2.5 rounded-xl border text-sm mb-2`,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        color: colors.text
                      }
                    ]}
                  />
                  <View style={tw`flex-row items-center justify-between mb-3`}>
                    <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                      {t('routine.time', 'Time (HH:mm)')}
                    </Text>
                    <View style={tw`flex-row items-center gap-2`}>
                      <TouchableOpacity
                        onPress={() => handleAdjustTime(newCustomTime, -15, setNewCustomTime)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Subtract 15 minutes"
                        style={tw`px-2 py-1 rounded bg-zinc-800 border border-zinc-700`}
                      >
                        <Text style={tw`text-xs font-bold text-zinc-300`}>-15m</Text>
                      </TouchableOpacity>
                      <Text style={[tw`text-sm font-bold font-mono px-2 py-1 rounded bg-zinc-800 text-indigo-400`]}>
                        {newCustomTime}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleAdjustTime(newCustomTime, 15, setNewCustomTime)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Add 15 minutes"
                        style={tw`px-2 py-1 rounded bg-zinc-800 border border-zinc-700`}
                      >
                        <Text style={tw`text-xs font-bold text-zinc-300`}>+15m</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={tw`flex-row justify-end gap-2`}>
                    <TouchableOpacity
                      onPress={() => setShowAddCustom(false)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.cancel')}
                      style={tw`px-3 py-1.5 rounded-xl bg-zinc-800`}
                    >
                      <Text style={tw`text-xs font-semibold text-zinc-300`}>
                        {t('common.cancel')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleAddCustomBlock}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.add')}
                      style={tw`px-3.5 py-1.5 rounded-xl bg-indigo-600`}
                    >
                      <Text style={tw`text-xs font-bold text-white`}>
                        {t('common.add')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Smart Reminders Help Note */}
            <View
              style={[
                tw`p-3 rounded-2xl border flex-row gap-2.5 mt-2 mb-4`,
                {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.08)' : '#eff6ff',
                  borderColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#bfdbfe'
                }
              ]}
            >
              <Info size={16} color={colors.primary} style={tw`mt-0.5 shrink-0`} />
              <Text style={[tw`text-xs leading-4 flex-1`, { color: colors.textMuted }]}>
                {t(
                  'routine.infoNote',
                  'When you schedule medications or habits relative to routine anchors (e.g. "with breakfast"), updating your routine here automatically adjusts those alarms.'
                )}
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
              style={[
                tw`p-3.5 rounded-2xl items-center justify-center flex-row gap-2 shadow-lg`,
                {
                  backgroundColor: colors.primary,
                  opacity: isSaving ? 0.7 : 1
                }
              ]}
            >
              <Check size={18} color="#ffffff" />
              <Text style={tw`text-sm font-bold text-white`}>
                {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save Daily Routine')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface RoutineAnchorRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  time: string;
  onAdjust: (delta: number) => void;
  colors: any;
  isDark: boolean;
}

const RoutineAnchorRow: React.FC<RoutineAnchorRowProps> = ({
  icon,
  iconBg,
  label,
  time,
  onAdjust,
  colors,
  isDark
}) => {
  return (
    <View
      style={[
        tw`flex-row items-center justify-between p-3 rounded-2xl border mb-2`,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderLight
        }
      ]}
    >
      <View style={tw`flex-row items-center gap-3 flex-1`}>
        <View style={[tw`w-9 h-9 rounded-xl items-center justify-center shrink-0`, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
          {label}
        </Text>
      </View>

      <View style={tw`flex-row items-center gap-1.5`}>
        <TouchableOpacity
          onPress={() => onAdjust(-15)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Subtract 15 minutes from ${label}`}
          style={[
            tw`px-2 py-1 rounded-lg border`,
            {
              backgroundColor: isDark ? '#27272a' : '#f4f4f5',
              borderColor: isDark ? '#3f3f46' : '#e4e4e7'
            }
          ]}
        >
          <Text style={[tw`text-xs font-bold`, { color: colors.textMuted }]}>-15m</Text>
        </TouchableOpacity>

        <Text
          style={[
            tw`text-sm font-bold font-mono px-2.5 py-1 rounded-lg border min-w-[55px] text-center`,
            {
              backgroundColor: isDark ? '#18181b' : '#fafafa',
              borderColor: colors.primary,
              color: colors.primary
            }
          ]}
        >
          {time}
        </Text>

        <TouchableOpacity
          onPress={() => onAdjust(15)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Add 15 minutes to ${label}`}
          style={[
            tw`px-2 py-1 rounded-lg border`,
            {
              backgroundColor: isDark ? '#27272a' : '#f4f4f5',
              borderColor: isDark ? '#3f3f46' : '#e4e4e7'
            }
          ]}
        >
          <Text style={[tw`text-xs font-bold`, { color: colors.textMuted }]}>+15m</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
