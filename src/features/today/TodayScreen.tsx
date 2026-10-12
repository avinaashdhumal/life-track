import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  AppState
} from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { medicinesRepository } from '../../data/medicinesRepository';
import { profileRepository } from '../../data/profileRepository';
import { shiftRepository } from '../../data/shiftRepository';
import { routineRepository } from '../../data/routineRepository';
import {
  Medicine,
  DoseLogEntry,
  TodayDoseSlot,
  generateTodayDoseSlots,
  calculateStockLevel
} from '../../domain/medicine';
import { ShiftConfig, getShiftForDate } from '../../domain/shift';
import { DailyRoutine } from '../../domain/routine';
import { ShiftScheduleScreen } from '../shift/ShiftScheduleScreen';
import { RoutineSettingsModal } from '../routine/RoutineSettingsModal';
import { UserProfileRecord } from '../../services/DatabaseService';
import { reminderCoordinator } from '../../services/reminderCoordinator';
import { addLocalDays, toLocalDateString } from '../../domain/dates';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
  SkipForward,
  Heart,
  Sun,
  Moon,
  Coffee,
  X,
  Briefcase,
  Utensils,
  Bed
} from 'lucide-react-native';

interface TodayScreenProps {
  onNavigateToMedicines?: () => void;
  onNavigateToAlarms?: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  onNavigateToMedicines,
  onNavigateToAlarms
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [todayLogs, setTodayLogs] = useState<DoseLogEntry[]>([]);
  const [shiftConfig, setShiftConfig] = useState<ShiftConfig | null>(null);
  const [routine, setRoutine] = useState<DailyRoutine | null>(null);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [showRoutineModal, setShowRoutineModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Skip Modal state
  const [skipSlot, setSkipSlot] = useState<TodayDoseSlot | null>(null);
  const [skipReason, setSkipReason] = useState<string>('');

  // Recomputed on every load so the screen rolls over at midnight instead of showing yesterday.
  const [todayDateStr, setTodayDateStr] = useState<string>(() => toLocalDateString(Date.now()));
  const tomorrowDateStr = useMemo(() => addLocalDays(todayDateStr, 1), [todayDateStr]);

  const formattedDate = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('today.greetingMorning', 'Good morning');
    if (hour < 17) return t('today.greetingAfternoon', 'Good afternoon');
    return t('today.greetingEvening', 'Good evening');
  }, [t]);

  const loadData = useCallback(async () => {
    const dateStr = toLocalDateString(Date.now());
    setTodayDateStr(dateStr);
    try {
      const [userProfile, allMeds, logs, shiftConf, dailyRout] = await Promise.all([
        profileRepository.getProfile(),
        medicinesRepository.getActive('default'),
        medicinesRepository.getDosesForDay('default', dateStr),
        shiftRepository.getConfig(),
        routineRepository.getRoutine('default')
      ]);
      setProfile(userProfile);
      setMedicines(allMeds);
      setTodayLogs(logs);
      setShiftConfig(shiftConf);
      setRoutine(dailyRout);
    } catch (e) {
      console.warn('Error loading today data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload when doses or medicines change elsewhere (e.g. "Taken" pressed on a notification and
  // applied when the app comes back), when the routine changes, or when the app returns to the foreground.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(loadData, 300);
    };
    const unsubMeds = medicinesRepository.changes.subscribe(scheduleReload);
    const unsubRoutine = routineRepository.changes.subscribe(scheduleReload);
    const unsubShift = shiftRepository.changes.subscribe(scheduleReload);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleReload();
    });
    return () => {
      unsubMeds();
      unsubRoutine();
      unsubShift();
      appStateSub.remove();
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const todayShiftAssignment = useMemo(() => {
    if (!shiftConfig || !shiftConfig.isEnabled) return null;
    return getShiftForDate(shiftConfig, todayDateStr);
  }, [shiftConfig, todayDateStr]);

  const tomorrowShiftAssignment = useMemo(() => {
    if (!shiftConfig || !shiftConfig.isEnabled) return null;
    return getShiftForDate(shiftConfig, tomorrowDateStr);
  }, [shiftConfig, tomorrowDateStr]);

  // Generate today slots across all active medicines
  const todaySlots: TodayDoseSlot[] = useMemo(() => {
    const slots: TodayDoseSlot[] = [];
    for (const med of medicines) {
      const medSlots = generateTodayDoseSlots(med, todayDateStr, todayLogs, routine || undefined);
      slots.push(...medSlots);
    }
    // Sort: fixed-time chronologically, PRN at the bottom
    return slots.sort((a, b) => {
      if (a.scheduleType === 'prn_as_needed') return 1;
      if (b.scheduleType === 'prn_as_needed') return -1;
      return a.scheduledTimestampMs - b.scheduledTimestampMs;
    });
  }, [medicines, todayLogs, todayDateStr, routine]);

  // Next upcoming dose countdown
  const nextUpcomingSlot = useMemo(() => {
    const now = Date.now();
    return todaySlots.find(
      (s) => s.status === 'pending' && s.scheduleType !== 'prn_as_needed' && s.scheduledTimestampMs >= now - 15 * 60 * 1000
    );
  }, [todaySlots]);

  // Statistics
  const totalScheduled = todaySlots.filter((s) => s.scheduleType !== 'prn_as_needed').length;
  const takenCount = todaySlots.filter((s) => s.status === 'taken').length;
  const progressPct = totalScheduled > 0 ? Math.round((takenCount / totalScheduled) * 100) : 100;

  // Low stock alerts
  const lowStockMedicines = useMemo(() => {
    return medicines.filter((m) => m.stockCount <= m.refillThreshold);
  }, [medicines]);

  // Dose Actions
  const handleTakeSlot = async (slot: TodayDoseSlot) => {
    try {
      const result = await medicinesRepository.logDose({
        profileId: 'default',
        medicineId: slot.medicineId,
        medicineName: slot.medicineName,
        scheduledTime: slot.scheduledTime,
        scheduledTimestampMs: slot.scheduledTimestampMs,
        takenTimestampMs: Date.now(),
        status: 'taken',
        quantityTaken: 1
      });

      if (result.safetyWarning) {
        Alert.alert(
          t('medicines.safetyWarningTitle', '⚠️ Medication Safety Warning'),
          result.safetyWarning,
          [{ text: t('common.ok', 'Understood') }]
        );
      }
      await loadData();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || 'Could not log dose');
    }
  };

  const handleSnoozeSlot = async (slot: TodayDoseSlot) => {
    try {
      // Logs the snooze and schedules a real reminder after the default snooze time.
      const minutes = await reminderCoordinator.snoozeDose(slot);
      Alert.alert(
        t('today.snoozedTitle', 'Reminder Snoozed'),
        t('reminders.snoozedNotice', { name: slot.medicineName, minutes })
      );
      await loadData();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || t('common.error'));
    }
  };

  const handleConfirmSkip = async () => {
    if (!skipSlot) return;
    try {
      await medicinesRepository.logDose({
        profileId: 'default',
        medicineId: skipSlot.medicineId,
        medicineName: skipSlot.medicineName,
        scheduledTime: skipSlot.scheduledTime,
        scheduledTimestampMs: skipSlot.scheduledTimestampMs,
        takenTimestampMs: Date.now(),
        status: 'skipped',
        quantityTaken: 0,
        skipReason: skipReason.trim() || 'Skipped by user'
      });
      setSkipSlot(null);
      setSkipReason('');
      await loadData();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || 'Could not record skip');
    }
  };

  return (
    <View
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
      accessible={true}
      accessibilityLabel="Today Screen"
    >
      {/* Top Header */}
      <View
        style={[
          tw`pt-12 pb-4 px-6 border-b flex-row items-center justify-between`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <View>
          <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: colors.primary }]}>
            {formattedDate}
          </Text>
          <Text style={[tw`text-xl font-black mt-0.5`, { color: colors.text }]}>
            {greeting}, {profile?.name ? profile.name.split(' ')[0] : 'there'}
          </Text>
        </View>

        {/* Small Progress Pill */}
        <View
          style={[
            tw`px-3 py-1.5 rounded-full border flex-row items-center`,
            {
              backgroundColor: isDark ? '#27272a' : '#f1f5f9',
              borderColor: colors.border
            }
          ]}
        >
          <CheckCircle2 size={13} color={colors.primary} style={tw`mr-1`} />
          <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
            {takenCount}/{totalScheduled}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={tw`p-5 pb-28`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Conditional Shift Card (Strictly ONLY shown when shift engine is enabled) */}
        {todayShiftAssignment && (
          <TouchableOpacity
            onPress={() => setShowShiftModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Today's shift: ${todayShiftAssignment.shiftType.name}`}
            style={[
              tw`p-4 rounded-3xl border mb-4 shadow-sm`,
              {
                backgroundColor: `${todayShiftAssignment.shiftType.color}15`,
                borderColor: `${todayShiftAssignment.shiftType.color}40`
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <View
                  style={[
                    tw`w-3 h-3 rounded-full`,
                    { backgroundColor: todayShiftAssignment.shiftType.color }
                  ]}
                />
                <Text style={[tw`text-xs font-bold uppercase tracking-wider`, { color: colors.text }]}>
                  {t('shift.todayShift', "Today's Shift")}: {todayShiftAssignment.shiftType.name}
                </Text>
                {todayShiftAssignment.shiftType.crossesMidnight && (
                  <View style={tw`px-1.5 py-0.5 rounded-full bg-indigo-500/20`}>
                    <Text style={tw`text-[9px] font-bold text-indigo-400`}>🌙 Midnight</Text>
                  </View>
                )}
                {todayShiftAssignment.isOverride && (
                  <View style={tw`px-1.5 py-0.5 rounded-full bg-rose-500/20`}>
                    <Text style={tw`text-[9px] font-bold text-rose-400`}>Override</Text>
                  </View>
                )}
              </View>
              <ChevronRight size={14} color={colors.textMuted} />
            </View>

            <View style={tw`flex-row items-center justify-between`}>
              <Text style={[tw`text-base font-black font-mono`, { color: colors.text }]}>
                {todayShiftAssignment.shiftType.isOffDay
                  ? t('shift.offDay', 'Day Off 🌴')
                  : `${todayShiftAssignment.shiftType.startTime} - ${todayShiftAssignment.shiftType.endTime}`}
              </Text>
              {tomorrowShiftAssignment && (
                <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                  {t('shift.tomorrowPreview', 'Tomorrow')}: {tomorrowShiftAssignment.shiftType.name}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Daily Routine Summary Card */}
        {routine && (
          <TouchableOpacity
            onPress={() => setShowRoutineModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="View and edit daily routine anchors"
            style={[
              tw`p-3.5 rounded-2xl border mb-4 flex-row items-center justify-between`,
              {
                backgroundColor: colors.card,
                borderColor: colors.borderLight
              }
            ]}
          >
            <View style={tw`flex-row items-center gap-2.5 flex-1 mr-2`}>
              <View style={tw`w-8 h-8 rounded-xl bg-amber-500/10 items-center justify-center shrink-0`}>
                <Sun size={16} color="#f59e0b" />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                  {t('routine.title', 'Daily Routine')}
                </Text>
                <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                  Wake: {routine.wakeTime} • Lunch: {routine.lunchTime} • Dinner: {routine.dinnerTime} • Sleep: {routine.sleepTime}
                </Text>
              </View>
            </View>
            <ChevronRight size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Next Up Alert Card */}
        {nextUpcomingSlot ? (
          <View
            style={[
              tw`p-4 rounded-3xl border mb-5 shadow-sm flex-row items-center justify-between`,
              {
                backgroundColor: `${colors.primary}12`,
                borderColor: `${colors.primary}30`
              }
            ]}
          >
            <View style={tw`flex-row items-center flex-1 mr-3`}>
              <View
                style={[
                  tw`w-11 h-11 rounded-2xl items-center justify-center mr-3`,
                  { backgroundColor: colors.primary }
                ]}
              >
                <Clock size={20} color="#ffffff" />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-[10px] font-bold uppercase tracking-wider`, { color: colors.primary }]}>
                  {t('today.nextUp', 'Next Up')} • {nextUpcomingSlot.scheduledTime}
                </Text>
                <Text style={[tw`text-sm font-bold mt-0.5`, { color: colors.text }]}>
                  {nextUpcomingSlot.medicineName}{' '}
                  {nextUpcomingSlot.strength ? `(${nextUpcomingSlot.strength})` : ''}
                </Text>
                <Text style={[tw`text-[10px]`, { color: colors.textSecondary }]}>
                  {nextUpcomingSlot.foodRelation === 'with'
                    ? t('medicines.foodWith', 'With Meal')
                    : nextUpcomingSlot.foodRelation === 'before'
                    ? t('medicines.foodBefore', 'Before Meal')
                    : nextUpcomingSlot.foodRelation === 'after'
                    ? t('medicines.foodAfter', 'After Meal')
                    : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => handleTakeSlot(nextUpcomingSlot)}
              style={[tw`px-3 py-2 rounded-xl`, { backgroundColor: colors.primary }]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Take dose of ${nextUpcomingSlot.medicineName}`}
            >
              <Text style={tw`text-white text-xs font-bold`}>
                {t('today.takeNow', 'Take Now')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Attention / Low Stock Banner */}
        {lowStockMedicines.length > 0 ? (
          <View
            style={[
              tw`p-3.5 rounded-2xl border mb-5 flex-row items-center justify-between`,
              {
                backgroundColor: isDark ? '#450a0a20' : '#fee2e240',
                borderColor: '#ef444440'
              }
            ]}
          >
            <View style={tw`flex-row items-center flex-1 mr-2`}>
              <AlertCircle size={18} color="#ef4444" style={tw`mr-2`} />
              <View style={tw`flex-1`}>
                <Text style={tw`text-xs font-bold text-red-500`}>
                  {t('today.refillNeeded', 'Refill Alert')}
                </Text>
                <Text style={[tw`text-[10px] leading-3.5`, { color: colors.textSecondary }]}>
                  {lowStockMedicines.map((m) => `${m.name} (${m.stockCount})`).join(', ')}
                </Text>
              </View>
            </View>

            {onNavigateToMedicines ? (
              <TouchableOpacity
                onPress={onNavigateToMedicines}
                style={tw`px-2.5 py-1.5 rounded-lg bg-red-500`}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="View low stock medicines"
              >
                <Text style={tw`text-white text-[10px] font-bold`}>
                  {t('today.viewStock', 'View Stock')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Today Progress Header */}
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
            {t('today.scheduleTitle', "Today's Schedule")}
          </Text>
          <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
            {progressPct}% {t('today.completed', 'completed')}
          </Text>
        </View>

        {/* Dose Slots List */}
        {todaySlots.length === 0 ? (
          <View
            style={[
              tw`p-8 rounded-2xl border items-center justify-center my-6`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <Calendar size={36} color={colors.textSecondary} style={tw`mb-2`} />
            <Text style={[tw`text-sm font-bold text-center mb-1`, { color: colors.text }]}>
              {t('today.noDosesToday', 'No medicines scheduled for today')}
            </Text>
            <Text style={[tw`text-xs text-center mb-4`, { color: colors.textSecondary }]}>
              {t('today.addMedReminder', 'Add your regular medication routines in the Medicines tab')}
            </Text>
            {onNavigateToMedicines ? (
              <TouchableOpacity
                onPress={onNavigateToMedicines}
                style={[tw`px-4 py-2.5 rounded-xl`, { backgroundColor: colors.primary }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Go to medicines tab"
              >
                <Text style={tw`text-white text-xs font-bold`}>
                  {t('medicines.add', 'Add Medicine')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          todaySlots.map((slot) => {
            const isTaken = slot.status === 'taken';
            const isOverdue = slot.status === 'overdue';
            const isSkipped = slot.status === 'skipped';
            const isPRN = slot.scheduleType === 'prn_as_needed';

            return (
              <View
                key={slot.slotId}
                style={[
                  tw`p-4 rounded-2xl border mb-3 shadow-sm`,
                  {
                    backgroundColor: colors.card,
                    borderColor: isOverdue ? '#ef444450' : colors.border
                  }
                ]}
              >
                <View style={tw`flex-row items-center justify-between mb-2`}>
                  {/* Time Badge */}
                  <View style={tw`flex-row items-center`}>
                    <Clock
                      size={14}
                      color={isTaken ? colors.primary : isOverdue ? '#ef4444' : colors.textSecondary}
                      style={tw`mr-1.5`}
                    />
                    <Text
                      style={[
                        tw`text-xs font-bold`,
                        isOverdue ? tw`text-red-500` : { color: colors.text }
                      ]}
                    >
                      {slot.scheduledTime}
                    </Text>

                    {isOverdue && !isTaken ? (
                      <View style={tw`ml-2 px-1.5 py-0.5 rounded bg-red-500/20`}>
                        <Text style={tw`text-red-500 text-[10px] font-bold`}>
                          {t('today.overdue', 'OVERDUE')}
                        </Text>
                      </View>
                    ) : null}

                    {isPRN ? (
                      <View style={tw`ml-2 px-1.5 py-0.5 rounded bg-sky-500/20`}>
                        <Text style={tw`text-sky-500 text-[10px] font-bold`}>
                          {t('medicines.asNeeded', 'AS NEEDED')}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Status indicator */}
                  {isTaken ? (
                    <View style={tw`flex-row items-center`}>
                      <CheckCircle2 size={14} color="#10b981" style={tw`mr-1`} />
                      <Text style={tw`text-emerald-500 text-xs font-bold`}>
                        {t('today.taken', 'Taken')}
                      </Text>
                    </View>
                  ) : isSkipped ? (
                    <Text style={[tw`text-xs font-bold`, { color: colors.textSecondary }]}>
                      {t('today.skipped', 'Skipped')}
                    </Text>
                  ) : null}
                </View>

                {/* Medicine info */}
                <View style={tw`mb-3`}>
                  <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                    {slot.medicineName}{' '}
                    {slot.strength ? (
                      <Text style={[tw`text-xs font-normal`, { color: colors.textSecondary }]}>
                        ({slot.strength})
                      </Text>
                    ) : null}
                  </Text>

                  <Text style={[tw`text-xs mt-0.5`, { color: colors.textSecondary }]}>
                    {slot.form.toUpperCase()} •{' '}
                    {slot.foodRelation === 'with'
                      ? t('medicines.foodWith', 'With Meal')
                      : slot.foodRelation === 'before'
                      ? t('medicines.foodBefore', 'Before Meal')
                      : slot.foodRelation === 'after'
                      ? t('medicines.foodAfter', 'After Meal')
                      : slot.foodRelation === 'empty_stomach'
                      ? t('medicines.foodEmptyStomach', 'Empty Stomach')
                      : t('medicines.foodNone', 'No Food Relation')}
                  </Text>
                </View>

                {/* Action Buttons row */}
                {!isTaken && !isSkipped ? (
                  <View
                    style={[
                      tw`pt-2.5 border-t flex-row items-center justify-between gap-2`,
                      { borderColor: colors.border }
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleTakeSlot(slot)}
                      style={[
                        tw`flex-2 py-2.5 rounded-xl items-center justify-center flex-row shadow-sm`,
                        { backgroundColor: colors.primary }
                      ]}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Take dose of ${slot.medicineName}`}
                    >
                      <CheckCircle2 size={15} color="#ffffff" style={tw`mr-1.5`} />
                      <Text style={tw`text-white text-xs font-bold`}>
                        {t('today.take', 'Take')}
                      </Text>
                    </TouchableOpacity>

                    {!isPRN ? (
                      <>
                        <TouchableOpacity
                          onPress={() => handleSnoozeSlot(slot)}
                          style={[
                            tw`flex-1 py-2.5 rounded-xl items-center justify-center border`,
                            { borderColor: colors.border }
                          ]}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Snooze reminder for ${slot.medicineName}`}
                        >
                          <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                            {t('today.snooze', 'Snooze')}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setSkipSlot(slot);
                            setSkipReason('');
                          }}
                          style={[
                            tw`flex-1 py-2.5 rounded-xl items-center justify-center border`,
                            { borderColor: colors.border }
                          ]}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={`Skip dose of ${slot.medicineName}`}
                        >
                          <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                            {t('today.skip', 'Skip')}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Skip Reason Modal */}
      <Modal
        visible={Boolean(skipSlot)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSkipSlot(null)}
      >
        <View
          style={tw`flex-1 bg-black/60 items-center justify-center p-6`}
          accessible={true}
          accessibilityLabel="Skip Dose Reason Modal"
        >
          <View
            style={[
              tw`w-full max-w-sm p-6 rounded-3xl border shadow-2xl`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <Text style={[tw`text-lg font-bold mb-1`, { color: colors.text }]}>
              {t('today.skipDoseTitle', 'Skip Dose')}
            </Text>
            <Text style={[tw`text-xs mb-4`, { color: colors.textSecondary }]}>
              {skipSlot?.medicineName} • {skipSlot?.scheduledTime}
            </Text>

            {/* Quick reason chips */}
            <View style={tw`flex-row flex-wrap gap-2 mb-4`}>
              {[
                'Felt unwell / Nausea',
                'Doctor advised to pause',
                'Ran out of medication',
                'Forgot and took later'
              ].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setSkipReason(reason)}
                  style={[
                    tw`px-3 py-1.5 rounded-xl border`,
                    skipReason === reason
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.bg, borderColor: colors.border }
                  ]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Reason: ${reason}`}
                >
                  <Text
                    style={[
                      tw`text-[10px] font-semibold`,
                      skipReason === reason ? tw`text-white` : { color: colors.text }
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={skipReason}
              onChangeText={setSkipReason}
              placeholder="Or enter custom reason..."
              placeholderTextColor={colors.textSecondary}
              style={[
                tw`p-3 rounded-xl border text-xs font-medium mb-5`,
                { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }
              ]}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel="Custom skip reason input"
            />

            <View style={tw`flex-row gap-2`}>
              <TouchableOpacity
                onPress={() => setSkipSlot(null)}
                style={[tw`flex-1 py-3 rounded-xl items-center border`, { borderColor: colors.border }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel skip"
              >
                <Text style={[tw`text-xs font-bold`, { color: colors.textSecondary }]}>
                  {t('common.cancel', 'Cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmSkip}
                style={[tw`flex-1 py-3 rounded-xl items-center bg-red-500`]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Confirm skip dose"
              >
                <Text style={tw`text-white text-xs font-bold`}>
                  {t('today.confirmSkip', 'Confirm Skip')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shift & Schedule Engine Modal */}
      {showShiftModal && (
        <ShiftScheduleScreen
          visible={showShiftModal}
          onClose={() => {
            setShowShiftModal(false);
            loadData();
          }}
          onConfigChanged={() => loadData()}
        />
      )}

      {/* Daily Routine Settings Modal */}
      {showRoutineModal && (
        <RoutineSettingsModal
          visible={showRoutineModal}
          onClose={() => {
            setShowRoutineModal(false);
            loadData();
          }}
          onRoutineUpdated={() => loadData()}
        />
      )}
    </View>
  );
};
