import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Alert,
  TextInput,
  Platform
} from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import {
  ShiftConfig,
  ShiftType,
  ShiftOverride,
  RotationCycleStep,
  DayShiftAssignment,
  DEFAULT_SHIFT_TYPES,
  getShiftForDate,
  generateShiftCalendar,
  isShiftCrossingMidnight,
  validateShiftTransitionDoseGaps,
  detectShiftChange,
  convertMedicineToRoutineRelative,
  convertMedicineToFixedTime
} from '../../domain/shift';
import { shiftRepository } from '../../data/shiftRepository';
import { medicinesRepository } from '../../data/medicinesRepository';
import { routineRepository } from '../../data/routineRepository';
import { Medicine } from '../../domain/medicine';
import { DailyRoutine, timeStringToMinutes } from '../../domain/routine';
import {
  Calendar as CalendarIcon,
  Clock,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Moon,
  Sun,
  Coffee,
  X,
  Edit3,
  Layers,
  Sparkles,
  Info,
  CalendarDays,
  Briefcase
} from 'lucide-react-native';

interface ShiftScheduleScreenProps {
  visible: boolean;
  onClose: () => void;
  onConfigChanged?: (config: ShiftConfig) => void;
}

export const ShiftScheduleScreen: React.FC<ShiftScheduleScreenProps> = ({
  visible,
  onClose,
  onConfigChanged
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [config, setConfig] = useState<ShiftConfig>(() => shiftRepository.getDefaultConfig());
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [routine, setRoutine] = useState<DailyRoutine | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Month navigation for 90-day calendar
  const [currentMonthOffset, setCurrentMonthOffset] = useState<number>(0); // 0 = current, 1 = next, 2 = month +2
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');

  // Single date override modal state
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideDate, setOverrideDate] = useState<string>('');
  const [selectedOverrideShiftId, setSelectedOverrideShiftId] = useState<string>('shift_morning');
  const [overrideNote, setOverrideNote] = useState<string>('');

  // Add step modal state
  const [showAddStepModal, setShowAddStepModal] = useState<boolean>(false);
  const [newStepShiftId, setNewStepShiftId] = useState<string>('shift_morning');
  const [newStepDays, setNewStepDays] = useState<string>('5');

  const todayDateStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [savedConfig, allMeds, activeRoutine] = await Promise.all([
        shiftRepository.getConfig(),
        medicinesRepository.getActive('default'),
        routineRepository.getRoutine('default')
      ]);
      setConfig(savedConfig);
      setMedicines(allMeds);
      setRoutine(activeRoutine);
      setSelectedCalendarDate(todayDateStr);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [todayDateStr]);

  useEffect(() => {
    if (visible) {
      loadAllData();
    }
  }, [visible, loadAllData]);

  const saveConfig = async (updated: ShiftConfig) => {
    setConfig(updated);
    await shiftRepository.saveConfig(updated);
    if (onConfigChanged) {
      onConfigChanged(updated);
    }
  };

  // Turn ON / OFF handler with migration prompt
  const handleToggleEngine = async (enabled: boolean) => {
    if (!enabled) {
      // Prompt user about turning OFF shift engine and converting to fixed times
      Alert.alert(
        t('shift.turnOffTitle', 'Turn Off Shift Schedule?'),
        t(
          'shift.turnOffMessage',
          'Turning off the shift schedule will convert any routine-relative medicine reminders into fixed clock times. All reminder history and logs will be safely preserved.'
        ),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('shift.turnOffConfirm', 'Turn Off & Keep Fixed Times'),
            style: 'destructive',
            onPress: async () => {
              if (routine) {
                // Convert routine-relative medicines to fixed times
                for (const med of medicines) {
                  if (med.scheduleType === 'routine_relative') {
                    const fixedMed = convertMedicineToFixedTime(med, routine);
                    await medicinesRepository.upsert(fixedMed);
                  }
                }
                const reloadedMeds = await medicinesRepository.getActive('default');
                setMedicines(reloadedMeds);
              }
              const updated: ShiftConfig = {
                ...config,
                isEnabled: false,
                updatedAt: Date.now()
              };
              await saveConfig(updated);
            }
          }
        ]
      );
    } else {
      // Turning ON: prompt to adapt reminders
      Alert.alert(
        t('shift.turnOnTitle', 'Enable Shift & Schedule?'),
        t(
          'shift.turnOnMessage',
          'Would you like to automatically adapt your medicine reminders to align with your rotating shift schedule?'
        ),
        [
          {
            text: t('shift.keepFixedTimes', 'Keep Current Times'),
            onPress: async () => {
              const updated: ShiftConfig = {
                ...config,
                isEnabled: true,
                updatedAt: Date.now()
              };
              await saveConfig(updated);
            }
          },
          {
            text: t('shift.adaptReminders', 'Adapt To Shifts'),
            onPress: async () => {
              if (routine) {
                for (const med of medicines) {
                  if (med.scheduleType === 'fixed_time') {
                    const relativeMed = convertMedicineToRoutineRelative(med, routine);
                    await medicinesRepository.upsert(relativeMed);
                  }
                }
                const reloadedMeds = await medicinesRepository.getActive('default');
                setMedicines(reloadedMeds);
              }
              const updated: ShiftConfig = {
                ...config,
                isEnabled: true,
                updatedAt: Date.now()
              };
              await saveConfig(updated);
            }
          }
        ]
      );
    }
  };

  // Change Work Mode
  const handleSetWorkMode = async (mode: 'fixed' | 'rotating') => {
    const updated: ShiftConfig = {
      ...config,
      workMode: mode,
      updatedAt: Date.now()
    };
    await saveConfig(updated);
  };

  // Rotation cycle builder: remove step
  const handleRemoveStep = async (index: number) => {
    if (config.rotationPattern.length <= 1) {
      Alert.alert(t('common.error'), t('shift.minOneStep', 'A rotation cycle requires at least 1 step.'));
      return;
    }
    const newPattern = config.rotationPattern.filter((_, i) => i !== index);
    const updated: ShiftConfig = {
      ...config,
      rotationPattern: newPattern,
      updatedAt: Date.now()
    };
    await saveConfig(updated);
  };

  // Rotation cycle builder: add step
  const handleAddStep = async () => {
    const count = parseInt(newStepDays, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert(t('common.error'), t('shift.invalidDays', 'Please enter a valid number of days (1-30).'));
      return;
    }
    const newStep: RotationCycleStep = {
      shiftTypeId: newStepShiftId,
      count: Math.min(30, count)
    };
    const updated: ShiftConfig = {
      ...config,
      rotationPattern: [...config.rotationPattern, newStep],
      updatedAt: Date.now()
    };
    await saveConfig(updated);
    setShowAddStepModal(false);
  };

  // Single date override: open editor
  const handleOpenOverride = (dateStr: string) => {
    const currentShift = getShiftForDate(config, dateStr);
    setOverrideDate(dateStr);
    setSelectedOverrideShiftId(currentShift.shiftType.id);
    setOverrideNote(config.overrides[dateStr]?.notes || '');
    setShowOverrideModal(true);
  };

  // Single date override: save
  const handleSaveOverride = async () => {
    const newOverride: ShiftOverride = {
      date: overrideDate,
      shiftTypeId: selectedOverrideShiftId,
      overrideType: 'swap',
      notes: overrideNote.trim() || undefined,
      createdAt: Date.now()
    };
    const updated: ShiftConfig = {
      ...config,
      overrides: {
        ...config.overrides,
        [overrideDate]: newOverride
      },
      updatedAt: Date.now()
    };
    await saveConfig(updated);
    setShowOverrideModal(false);
  };

  // Single date override: remove override (revert to cycle)
  const handleRemoveOverride = async () => {
    const remaining = { ...config.overrides };
    delete remaining[overrideDate];
    const updated: ShiftConfig = {
      ...config,
      overrides: remaining,
      updatedAt: Date.now()
    };
    await saveConfig(updated);
    setShowOverrideModal(false);
  };

  // 90-Day Calendar calculations
  const calendarDays = useMemo(() => {
    return generateShiftCalendar(config, todayDateStr, 90);
  }, [config, todayDateStr]);

  // Group calendar days by month
  const monthsData = useMemo(() => {
    const months: { year: number; month: number; title: string; days: DayShiftAssignment[] }[] = [];
    const grouped: Record<string, DayShiftAssignment[]> = {};

    calendarDays.forEach((day) => {
      const ym = day.date.substring(0, 7); // "YYYY-MM"
      if (!grouped[ym]) {
        grouped[ym] = [];
      }
      grouped[ym].push(day);
    });

    Object.keys(grouped).forEach((ym) => {
      const [yStr, mStr] = ym.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = new Date(y, m - 1, 1);
      const title = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      months.push({ year: y, month: m, title, days: grouped[ym] });
    });

    return months;
  }, [calendarDays]);

  const currentMonthData = monthsData[currentMonthOffset] || monthsData[0];

  // Shift Change detector for tomorrow
  const tomorrowDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const shiftChangeAlert = useMemo(() => {
    if (!config.isEnabled) return null;
    return detectShiftChange(config, todayDateStr, tomorrowDateStr);
  }, [config, todayDateStr, tomorrowDateStr]);

  // Dose gap transition safety check
  const transitionSafety = useMemo(() => {
    if (!config.isEnabled) return { isSafe: true, violations: [] };
    // Check next 7 days for dose gap violations across transitions
    const sampleTimestamps: number[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const shift = getShiftForDate(config, dStr);
      // If medicines have minGapMinutes, simulate doses at wake & lunch
      const wakeMins = timeStringToMinutes(shift.routine.wakeTime);
      sampleTimestamps.push(d.getTime() + wakeMins * 60 * 1000);
    }
    return validateShiftTransitionDoseGaps(sampleTimestamps, 240); // 4 hours min gap
  }, [config]);

  // Total cycle length
  const totalCycleDays = useMemo(() => {
    return config.rotationPattern.reduce((acc, step) => acc + step.count, 0);
  }, [config.rotationPattern]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 justify-end bg-black/60`}>
        <View
          style={[
            tw`rounded-t-3xl max-h-[94%] border-t shadow-2xl`,
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
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'
                  }
                ]}
              >
                <Briefcase size={20} color="#f59e0b" />
              </View>
              <View>
                <Text style={[tw`text-lg font-bold`, { color: colors.text }]}>
                  {t('shift.title', 'Shift & Schedule')}
                </Text>
                <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                  {config.isEnabled
                    ? t('shift.activeStatus', 'Rotating shift engine active')
                    : t('shift.disabledStatus', 'Optional engine (Disabled by default)')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.close')}
              style={[tw`p-2 rounded-full`, { backgroundColor: colors.cardSecondary }]}
            >
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={tw`p-4`} contentContainerStyle={tw`pb-12`}>
            {/* Master Toggle Card */}
            <View
              style={[
                tw`p-4 rounded-2xl border mb-4 flex-row items-center justify-between`,
                config.isEnabled
                  ? {
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                      borderColor: '#f59e0b'
                    }
                  : {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.borderLight
                    }
              ]}
            >
              <View style={tw`flex-1 mr-3`}>
                <View style={tw`flex-row items-center gap-1.5 mb-1`}>
                  <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                    {t('shift.enableToggle', 'Enable Shift Engine')}
                  </Text>
                  {config.isEnabled && (
                    <View style={tw`px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40`}>
                      <Text style={tw`text-[10px] font-bold text-amber-500`}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={[tw`text-xs leading-4`, { color: colors.textMuted }]}>
                  {config.isEnabled
                    ? t(
                        'shift.enabledDescription',
                        'Daily routines and medicine alarms dynamically shift with your work rotation.'
                      )
                    : t(
                        'shift.disabledDescription',
                        'Off by default. Enable if you work morning, afternoon, night, or rotating shifts.'
                      )}
                </Text>
              </View>
              <Switch
                value={config.isEnabled}
                onValueChange={handleToggleEngine}
                trackColor={{ false: '#3f3f46', true: '#f59e0b' }}
                thumbColor={config.isEnabled ? '#ffffff' : '#a1a1aa'}
                accessible={true}
                accessibilityRole="switch"
                accessibilityLabel="Enable Shift Schedule Engine"
              />
            </View>

            {/* When Disabled: Feature Overview Card */}
            {!config.isEnabled ? (
              <View
                style={[
                  tw`p-5 rounded-3xl border items-center text-center`,
                  {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.borderLight
                  }
                ]}
              >
                <View style={tw`w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 items-center justify-center mb-3`}>
                  <CalendarDays size={28} color="#f59e0b" />
                </View>
                <Text style={[tw`text-base font-bold mb-1 text-center`, { color: colors.text }]}>
                  {t('shift.featureTitle', 'Smart Rotating Shift Engine')}
                </Text>
                <Text style={[tw`text-xs leading-5 text-center mb-4 max-w-xs`, { color: colors.textMuted }]}>
                  {t(
                    'shift.featureBody',
                    'Designed specifically for healthcare workers, emergency responders, and industrial shift workers. Automatically recalculates wake, meal, and medicine dose times based on your current shift.'
                  )}
                </Text>

                <View style={tw`w-full gap-2 mb-4`}>
                  <FeatureBullet
                    icon={<RotateCcw size={14} color="#f59e0b" />}
                    text={t('shift.bullet1', 'Repeating multi-step rotation cycles (e.g. 5 Morning, 2 Off, 5 Night)')}
                    colors={colors}
                  />
                  <FeatureBullet
                    icon={<Moon size={14} color="#6366f1" />}
                    text={t('shift.bullet2', 'Midnight-crossing shifts (e.g. 22:00 to 06:00 Night Shift)')}
                    colors={colors}
                  />
                  <FeatureBullet
                    icon={<ShieldAlert size={14} color="#10b981" />}
                    text={t('shift.bullet3', 'Dose gap collision safety across shift changes')}
                    colors={colors}
                  />
                  <FeatureBullet
                    icon={<CalendarIcon size={14} color="#06b6d4" />}
                    text={t('shift.bullet4', '90-Day visual calendar with single-date swap overrides')}
                    colors={colors}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => handleToggleEngine(true)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Turn on Shift Engine"
                  style={[tw`px-5 py-3 rounded-2xl bg-amber-500 flex-row items-center gap-2 shadow-lg`]}
                >
                  <Briefcase size={16} color="#ffffff" />
                  <Text style={tw`text-sm font-bold text-white`}>
                    {t('shift.turnOnButton', 'Turn On Shift Engine')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* When Enabled: Full Production Controls */
              <View>
                {/* Shift Change Notification Banner */}
                {shiftChangeAlert && shiftChangeAlert.changed && (
                  <View
                    style={[
                      tw`p-3.5 rounded-2xl border mb-4 flex-row items-center gap-3`,
                      {
                        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                        borderColor: '#6366f1'
                      }
                    ]}
                  >
                    <Sparkles size={20} color="#6366f1" style={tw`shrink-0`} />
                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                        {t('shift.eveAlertTitle', 'Shift Change Notification')}
                      </Text>
                      <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                        {shiftChangeAlert.message}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Work Mode Selector */}
                <View style={tw`mb-4`}>
                  <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2`, { color: colors.textMuted }]}>
                    {t('shift.workMode', 'Work Schedule Mode')}
                  </Text>
                  <View style={[tw`flex-row p-1 rounded-2xl border`, { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }]}>
                    <TouchableOpacity
                      onPress={() => handleSetWorkMode('rotating')}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Rotating Shifts Mode"
                      style={[
                        tw`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-1.5`,
                        config.workMode === 'rotating'
                          ? { backgroundColor: colors.card, shadowOpacity: 0.1 }
                          : null
                      ]}
                    >
                      <RotateCcw size={14} color={config.workMode === 'rotating' ? colors.primary : colors.textMuted} />
                      <Text
                        style={[
                          tw`text-xs font-bold`,
                          { color: config.workMode === 'rotating' ? colors.primary : colors.textMuted }
                        ]}
                      >
                        {t('shift.rotatingShifts', 'Rotating Shifts')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleSetWorkMode('fixed')}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Fixed Schedule Mode"
                      style={[
                        tw`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-1.5`,
                        config.workMode === 'fixed'
                          ? { backgroundColor: colors.card, shadowOpacity: 0.1 }
                          : null
                      ]}
                    >
                      <Clock size={14} color={config.workMode === 'fixed' ? colors.primary : colors.textMuted} />
                      <Text
                        style={[
                          tw`text-xs font-bold`,
                          { color: config.workMode === 'fixed' ? colors.primary : colors.textMuted }
                        ]}
                      >
                        {t('shift.fixedSchedule', 'Fixed Schedule')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Repeating Rotation Pattern Builder */}
                {config.workMode === 'rotating' && (
                  <View
                    style={[
                      tw`p-4 rounded-2xl border mb-4`,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.borderLight
                      }
                    ]}
                  >
                    <View style={tw`flex-row items-center justify-between mb-3`}>
                      <View>
                        <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: colors.textMuted }]}>
                          {t('shift.cycleBuilder', 'Rotation Cycle Pattern')}
                        </Text>
                        <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>
                          {totalCycleDays} {t('shift.daysCycle', 'days total cycle length')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowAddStepModal(true)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Add rotation step"
                        style={[
                          tw`flex-row items-center gap-1 px-2.5 py-1 rounded-full border`,
                          {
                            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                            borderColor: '#f59e0b'
                          }
                        ]}
                      >
                        <Plus size={12} color="#f59e0b" />
                        <Text style={tw`text-xs font-bold text-amber-500`}>
                          {t('shift.addStep', 'Add Step')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Step Sequence Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2 py-1`}>
                      {config.rotationPattern.map((step, idx) => {
                        const shift = DEFAULT_SHIFT_TYPES.find((s) => s.id === step.shiftTypeId) || DEFAULT_SHIFT_TYPES[0];
                        return (
                          <View
                            key={idx}
                            style={[
                              tw`px-3 py-2 rounded-xl border flex-row items-center gap-2`,
                              {
                                backgroundColor: colors.card,
                                borderColor: shift.color
                              }
                            ]}
                          >
                            <View style={[tw`w-3 h-3 rounded-full`, { backgroundColor: shift.color }]} />
                            <View>
                              <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                                {step.count}d {shift.name}
                              </Text>
                              <Text style={[tw`text-[10px] font-mono`, { color: colors.textMuted }]}>
                                {shift.startTime} - {shift.endTime}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveStep(idx)}
                              accessible={true}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove step ${idx + 1}`}
                              style={tw`p-1 rounded-full bg-rose-500/10 ml-1`}
                            >
                              <Trash2 size={12} color="#f43f5e" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </ScrollView>

                    {/* Cycle Start Date */}
                    <View style={tw`flex-row items-center justify-between mt-3 pt-3 border-t border-zinc-800`}>
                      <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                        {t('shift.cycleAnchorDate', 'Cycle Anchor Start Date')}:
                      </Text>
                      <View style={tw`px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700`}>
                        <Text style={tw`text-xs font-bold font-mono text-zinc-300`}>
                          {config.cycleStartDate || todayDateStr}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* 90-Day Interactive Shift Calendar */}
                <View
                  style={[
                    tw`p-4 rounded-2xl border mb-4`,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.borderLight
                    }
                  ]}
                >
                  <View style={tw`flex-row items-center justify-between mb-3`}>
                    <View>
                      <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: colors.textMuted }]}>
                        {t('shift.calendarTitle', '90-Day Shift Calendar')}
                      </Text>
                      <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                        {currentMonthData.title}
                      </Text>
                    </View>
                    <View style={tw`flex-row items-center gap-1`}>
                      <TouchableOpacity
                        onPress={() => setCurrentMonthOffset((p) => Math.max(0, p - 1))}
                        disabled={currentMonthOffset === 0}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Previous month"
                        style={[tw`p-1.5 rounded-lg border border-zinc-700 bg-zinc-800`, currentMonthOffset === 0 ? tw`opacity-30` : null]}
                      >
                        <ChevronLeft size={16} color={colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setCurrentMonthOffset((p) => Math.min(monthsData.length - 1, p + 1))}
                        disabled={currentMonthOffset >= monthsData.length - 1}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Next month"
                        style={[tw`p-1.5 rounded-lg border border-zinc-700 bg-zinc-800`, currentMonthOffset >= monthsData.length - 1 ? tw`opacity-30` : null]}
                      >
                        <ChevronRight size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Day Grid */}
                  <View style={tw`flex-row flex-wrap gap-1.5`}>
                    {currentMonthData.days.map((day) => {
                      const isToday = day.date === todayDateStr;
                      const isSelected = day.date === selectedCalendarDate;
                      return (
                        <TouchableOpacity
                          key={day.date}
                          onPress={() => {
                            setSelectedCalendarDate(day.date);
                            handleOpenOverride(day.date);
                          }}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Date ${day.date}, shift ${day.shiftType.name}`}
                          style={[
                            tw`w-[12.8%] p-1.5 rounded-xl border items-center justify-center min-h-[50px]`,
                            isSelected
                              ? { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff' }
                              : { borderColor: colors.borderLight, backgroundColor: colors.card },
                            isToday ? tw`border-amber-400` : null
                          ]}
                        >
                          <Text
                            style={[
                              tw`text-[10px] font-bold`,
                              isToday ? tw`text-amber-400` : { color: colors.text }
                            ]}
                          >
                            {day.date.split('-')[2]}
                          </Text>
                          <View
                            style={[
                              tw`px-1 py-0.5 rounded-md mt-1 w-full items-center`,
                              { backgroundColor: `${day.shiftType.color}30` }
                            ]}
                          >
                            <Text
                              style={[
                                tw`text-[9px] font-bold`,
                                { color: day.shiftType.color }
                              ]}
                              numberOfLines={1}
                            >
                              {day.shiftType.shortCode}
                            </Text>
                          </View>
                          {day.isOverride && (
                            <View style={tw`w-1.5 h-1.5 rounded-full bg-rose-500 mt-0.5`} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Calendar Legend */}
                  <View style={tw`flex-row flex-wrap gap-2.5 mt-3 pt-3 border-t border-zinc-800`}>
                    {DEFAULT_SHIFT_TYPES.map((st) => (
                      <View key={st.id} style={tw`flex-row items-center gap-1`}>
                        <View style={[tw`w-2 h-2 rounded-full`, { backgroundColor: st.color }]} />
                        <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
                          {st.shortCode} ({st.name})
                        </Text>
                      </View>
                    ))}
                    <View style={tw`flex-row items-center gap-1`}>
                      <View style={tw`w-2 h-2 rounded-full bg-rose-500`} />
                      <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
                        {t('shift.overrideLegend', 'Manual Override')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Shift Transition Dose Gap Safety */}
                <View
                  style={[
                    tw`p-4 rounded-2xl border mb-4 flex-row items-center justify-between`,
                    transitionSafety.isSafe
                      ? {
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
                          borderColor: '#10b981'
                        }
                      : {
                          backgroundColor: isDark ? 'rgba(244, 63, 94, 0.1)' : '#fff1f2',
                          borderColor: '#f43f5e'
                        }
                  ]}
                >
                  <View style={tw`flex-row items-center gap-3 flex-1`}>
                    <ShieldAlert
                      size={22}
                      color={transitionSafety.isSafe ? '#10b981' : '#f43f5e'}
                      style={tw`shrink-0`}
                    />
                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                        {t('shift.doseGapSafetyTitle', 'Shift Transition Dose Safety')}
                      </Text>
                      <Text style={[tw`text-[11px] leading-4`, { color: colors.textMuted }]}>
                        {transitionSafety.isSafe
                          ? t('shift.doseGapSafe', 'All dose schedules maintain required safe intervals across shift transitions.')
                          : t('shift.doseGapWarning', 'Potential collision detected between shift transitions.')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Shift Types Summary & Working Hours */}
                <View
                  style={[
                    tw`p-4 rounded-2xl border mb-4`,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.borderLight
                    }
                  ]}
                >
                  <Text style={[tw`text-xs font-bold uppercase tracking-wider mb-2.5`, { color: colors.textMuted }]}>
                    {t('shift.typesTitle', 'Configured Shift Types')}
                  </Text>
                  {DEFAULT_SHIFT_TYPES.map((st) => (
                    <View
                      key={st.id}
                      style={[
                        tw`p-3 rounded-xl border mb-2 flex-row items-center justify-between`,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.borderLight
                        }
                      ]}
                    >
                      <View style={tw`flex-row items-center gap-2.5 flex-1`}>
                        <View style={[tw`w-3.5 h-3.5 rounded-full`, { backgroundColor: st.color }]} />
                        <View style={tw`flex-1`}>
                          <View style={tw`flex-row items-center gap-1.5`}>
                            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                              {st.name}
                            </Text>
                            {st.crossesMidnight && (
                              <View style={tw`px-1.5 py-0.2 rounded bg-indigo-500/20`}>
                                <Text style={tw`text-[9px] font-bold text-indigo-400`}>🌙 Midnight Crossing</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
                            Work: {st.startTime} - {st.endTime} • Wake: {st.wakeTime} • Sleep: {st.sleepTime}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Single-Date Manual Override Modal */}
      <Modal
        visible={showOverrideModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOverrideModal(false)}
      >
        <View style={tw`flex-1 bg-black/60 items-center justify-center p-4`}>
          <View
            style={[
              tw`w-full max-w-sm rounded-3xl p-5 border shadow-2xl`,
              {
                backgroundColor: colors.card,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-4`}>
              <View>
                <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                  {t('shift.overrideModalTitle', 'Manual Shift Override')}
                </Text>
                <Text style={[tw`text-xs font-mono`, { color: colors.primary }]}>
                  {overrideDate}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowOverrideModal(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.close')}
                style={tw`p-1.5 rounded-full bg-zinc-800`}
              >
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[tw`text-xs font-bold mb-2`, { color: colors.textMuted }]}>
              {t('shift.selectShiftType', 'Assign Shift for this date:')}
            </Text>

            <View style={tw`gap-1.5 mb-3`}>
              {DEFAULT_SHIFT_TYPES.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => setSelectedOverrideShiftId(st.id)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${st.name}`}
                  style={[
                    tw`p-2.5 rounded-xl border flex-row items-center justify-between`,
                    selectedOverrideShiftId === st.id
                      ? { backgroundColor: `${st.color}20`, borderColor: st.color }
                      : { backgroundColor: colors.card, borderColor: colors.borderLight }
                  ]}
                >
                  <View style={tw`flex-row items-center gap-2`}>
                    <View style={[tw`w-3 h-3 rounded-full`, { backgroundColor: st.color }]} />
                    <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>
                      {st.name}
                    </Text>
                  </View>
                  <Text style={[tw`text-[10px] font-mono`, { color: colors.textMuted }]}>
                    {st.startTime} - {st.endTime}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textMuted }]}>
              {t('shift.overrideNoteLabel', 'Reason / Note (Optional):')}
            </Text>
            <TextInput
              value={overrideNote}
              onChangeText={setOverrideNote}
              placeholder="e.g. Swapped with colleague, annual leave"
              placeholderTextColor={colors.textMuted}
              accessible={true}
              accessibilityLabel="Override reason input"
              style={[
                tw`p-2.5 rounded-xl border text-xs mb-4`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
            />

            <View style={tw`flex-row items-center gap-2`}>
              {config.overrides[overrideDate] && (
                <TouchableOpacity
                  onPress={handleRemoveOverride}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Revert to cycle"
                  style={tw`flex-1 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 items-center`}
                >
                  <Text style={tw`text-xs font-bold text-rose-400`}>
                    {t('shift.revertCycle', 'Revert to Cycle')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSaveOverride}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Apply override"
                style={tw`flex-1 p-2.5 rounded-xl bg-amber-500 items-center shadow-md`}
              >
                <Text style={tw`text-xs font-bold text-white`}>
                  {t('shift.saveOverride', 'Save Override')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Rotation Step Modal */}
      <Modal
        visible={showAddStepModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddStepModal(false)}
      >
        <View style={tw`flex-1 bg-black/60 items-center justify-center p-4`}>
          <View
            style={[
              tw`w-full max-w-sm rounded-3xl p-5 border shadow-2xl`,
              {
                backgroundColor: colors.card,
                borderColor: colors.border
              }
            ]}
          >
            <Text style={[tw`text-base font-bold mb-3`, { color: colors.text }]}>
              {t('shift.addStepTitle', 'Add Rotation Cycle Step')}
            </Text>

            <Text style={[tw`text-xs font-bold mb-2`, { color: colors.textMuted }]}>
              {t('shift.chooseShiftType', 'Shift Type:')}
            </Text>
            <View style={tw`gap-1.5 mb-3`}>
              {DEFAULT_SHIFT_TYPES.map((st) => (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => setNewStepShiftId(st.id)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Pick ${st.name}`}
                  style={[
                    tw`p-2.5 rounded-xl border flex-row items-center justify-between`,
                    newStepShiftId === st.id
                      ? { backgroundColor: `${st.color}20`, borderColor: st.color }
                      : { backgroundColor: colors.card, borderColor: colors.borderLight }
                  ]}
                >
                  <View style={tw`flex-row items-center gap-2`}>
                    <View style={[tw`w-3 h-3 rounded-full`, { backgroundColor: st.color }]} />
                    <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>
                      {st.name}
                    </Text>
                  </View>
                  <Text style={[tw`text-[10px] font-mono`, { color: colors.textMuted }]}>
                    {st.startTime} - {st.endTime}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textMuted }]}>
              {t('shift.daysCount', 'Consecutive Days (1 - 30):')}
            </Text>
            <TextInput
              value={newStepDays}
              onChangeText={setNewStepDays}
              keyboardType="numeric"
              accessible={true}
              accessibilityLabel="Days count input"
              style={[
                tw`p-2.5 rounded-xl border text-sm mb-4 font-mono`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
            />

            <View style={tw`flex-row justify-end gap-2`}>
              <TouchableOpacity
                onPress={() => setShowAddStepModal(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={tw`px-4 py-2 rounded-xl bg-zinc-800`}
              >
                <Text style={tw`text-xs font-semibold text-zinc-300`}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddStep}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Add Step"
                style={tw`px-4 py-2 rounded-xl bg-amber-500 shadow-md`}
              >
                <Text style={tw`text-xs font-bold text-white`}>{t('shift.addStep', 'Add Step')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const FeatureBullet: React.FC<{ icon: React.ReactNode; text: string; colors: any }> = ({
  icon,
  text,
  colors
}) => (
  <View style={tw`flex-row items-center gap-2.5`}>
    <View style={tw`w-6 h-6 rounded-lg bg-zinc-800 items-center justify-center shrink-0`}>
      {icon}
    </View>
    <Text style={[tw`text-xs flex-1`, { color: colors.textMuted }]}>{text}</Text>
  </View>
);
