import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Switch,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import {
  Medicine,
  MedicineForm,
  FoodRelation,
  MedicineScheduleType
} from '../../domain/medicine';
import {
  X,
  Plus,
  Trash2,
  Clock,
  ShieldAlert,
  Package,
  HelpCircle,
  FileText,
  Check,
  AlertCircle
} from 'lucide-react-native';

interface MedicineFormModalProps {
  visible: boolean;
  medicine?: Medicine | null;
  onClose: () => void;
  onSave: (data: Partial<Medicine> & { name: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const MedicineFormModal: React.FC<MedicineFormModalProps> = ({
  visible,
  medicine,
  onClose,
  onSave,
  onDelete
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const isEditing = Boolean(medicine);

  const [name, setName] = useState<string>(medicine?.name || '');
  const [form, setForm] = useState<MedicineForm>(medicine?.form || 'tablet');
  const [strength, setStrength] = useState<string>(medicine?.strength || '');
  const [foodRelation, setFoodRelation] = useState<FoodRelation>(medicine?.foodRelation || 'with');
  const [scheduleType, setScheduleType] = useState<MedicineScheduleType>(
    medicine?.scheduleType || 'fixed_time'
  );
  const [timesOfDay, setTimesOfDay] = useState<string[]>(
    medicine?.timesOfDay && medicine.timesOfDay.length > 0 ? medicine.timesOfDay : ['08:00']
  );
  const [newTimeInput, setNewTimeInput] = useState<string>('20:00');

  // Safety rules
  const [minGapMinutes, setMinGapMinutes] = useState<string>(
    medicine?.minGapMinutes !== undefined ? String(medicine.minGapMinutes) : '240'
  );
  const [maxDailyDoses, setMaxDailyDoses] = useState<string>(
    medicine?.maxDailyDoses !== undefined ? String(medicine.maxDailyDoses) : '4'
  );

  // Inventory
  const [stockCount, setStockCount] = useState<string>(
    medicine ? String(medicine.stockCount) : '30'
  );
  const [refillThreshold, setRefillThreshold] = useState<string>(
    medicine ? String(medicine.refillThreshold) : '5'
  );
  const [unit, setUnit] = useState<string>(medicine?.unit || 'tablets');

  // Doctor advice
  const [missedDoseAdvice, setMissedDoseAdvice] = useState<string>(
    medicine?.missedDoseAdvice ||
      'Take as soon as remembered unless close to the next scheduled dose. Never take a double dose.'
  );
  const [instructions, setInstructions] = useState<string>(medicine?.instructions || '');
  const [isActive, setIsActive] = useState<boolean>(medicine?.isActive ?? true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Synchronize form fields whenever modal opens or selected medicine changes
  useEffect(() => {
    if (visible) {
      if (medicine) {
        setName(medicine.name || '');
        setForm(medicine.form || 'tablet');
        setStrength(medicine.strength || '');
        setFoodRelation(medicine.foodRelation || 'with');
        setScheduleType(medicine.scheduleType || 'fixed_time');
        setTimesOfDay(
          medicine.timesOfDay && medicine.timesOfDay.length > 0
            ? [...medicine.timesOfDay]
            : ['08:00']
        );
        setMinGapMinutes(
          medicine.minGapMinutes !== undefined ? String(medicine.minGapMinutes) : '240'
        );
        setMaxDailyDoses(
          medicine.maxDailyDoses !== undefined ? String(medicine.maxDailyDoses) : '4'
        );
        setStockCount(String(medicine.stockCount ?? 30));
        setRefillThreshold(String(medicine.refillThreshold ?? 5));
        setUnit(medicine.unit || 'tablets');
        setMissedDoseAdvice(
          medicine.missedDoseAdvice ||
            'Take as soon as remembered unless close to the next scheduled dose. Never take a double dose.'
        );
        setInstructions(medicine.instructions || '');
        setIsActive(medicine.isActive ?? true);
      } else {
        setName('');
        setForm('tablet');
        setStrength('');
        setFoodRelation('with');
        setScheduleType('fixed_time');
        setTimesOfDay(['08:00']);
        setMinGapMinutes('240');
        setMaxDailyDoses('4');
        setStockCount('30');
        setRefillThreshold('5');
        setUnit('tablets');
        setMissedDoseAdvice(
          'Take as soon as remembered unless close to the next scheduled dose. Never take a double dose.'
        );
        setInstructions('');
        setIsActive(true);
      }
      setNewTimeInput('20:00');
      setIsSaving(false);
      setIsDeleting(false);
    }
  }, [visible, medicine]);

  const formOptions: { value: MedicineForm; label: string; icon: string }[] = [
    { value: 'tablet', label: t('medicines.formTablet', 'Tablet'), icon: '💊' },
    { value: 'capsule', label: t('medicines.formCapsule', 'Capsule'), icon: '💊' },
    { value: 'syrup', label: t('medicines.formSyrup', 'Syrup'), icon: '🧴' },
    { value: 'injection', label: t('medicines.formInjection', 'Injection'), icon: '💉' },
    { value: 'drops', label: t('medicines.formDrops', 'Drops'), icon: '💧' },
    { value: 'inhaler', label: t('medicines.formInhaler', 'Inhaler'), icon: '🫁' },
    { value: 'other', label: t('medicines.formOther', 'Other'), icon: '🩹' }
  ];

  const foodOptions: { value: FoodRelation; label: string }[] = [
    { value: 'before', label: t('medicines.foodBefore', 'Before Meal') },
    { value: 'with', label: t('medicines.foodWith', 'With Meal') },
    { value: 'after', label: t('medicines.foodAfter', 'After Meal') },
    { value: 'empty_stomach', label: t('medicines.foodEmptyStomach', 'Empty Stomach') },
    { value: 'no_relation', label: t('medicines.foodNone', 'No Relation') }
  ];

  const handleAddTime = () => {
    const trimmed = newTimeInput.trim();
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
      if (!timesOfDay.includes(trimmed)) {
        setTimesOfDay([...timesOfDay, trimmed].sort());
      }
    } else {
      Alert.alert(
        t('common.invalidTime', 'Invalid Time'),
        t('common.invalidTimeDesc', 'Please enter time in 24h format (HH:mm), e.g. 14:30')
      );
    }
  };

  const handleRemoveTime = (timeToRemove: string) => {
    if (timesOfDay.length === 1) {
      Alert.alert(
        t('medicines.atLeastOneTime', 'Notice'),
        t('medicines.atLeastOneTimeDesc', 'Fixed schedules require at least one scheduled time.')
      );
      return;
    }
    setTimesOfDay(timesOfDay.filter((t) => t !== timeToRemove));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        t('common.missingField', 'Required'),
        t('medicines.nameRequired', 'Please enter medicine name.')
      );
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        id: medicine?.id,
        profileId: medicine?.profileId || 'default',
        name: name.trim(),
        form,
        strength: strength.trim(),
        foodRelation,
        scheduleType,
        timesOfDay: scheduleType === 'fixed_time' ? timesOfDay : [],
        minGapMinutes: minGapMinutes ? Math.max(0, parseInt(minGapMinutes, 10)) : undefined,
        maxDailyDoses: maxDailyDoses ? Math.max(1, parseInt(maxDailyDoses, 10)) : undefined,
        stockCount: Math.max(0, parseInt(stockCount, 10) || 0),
        refillThreshold: Math.max(0, parseInt(refillThreshold, 10) || 0),
        unit: unit.trim() || 'tablets',
        missedDoseAdvice: missedDoseAdvice.trim() || undefined,
        instructions: instructions.trim() || undefined,
        color: medicine?.color,
        icon: medicine?.icon,
        createdAt: medicine?.createdAt,
        isActive
      });
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e.message || 'Could not save medicine');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!medicine?.id || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(medicine.id);
      onClose();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || 'Could not delete medicine');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!medicine?.id || !onDelete) return;

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && window.confirm
          ? window.confirm(
              t('medicines.deleteConfirm', 'Are you sure you want to delete this medicine and its history?')
            )
          : true;
      if (confirmed) {
        executeDelete();
      }
      return;
    }

    Alert.alert(
      t('medicines.deleteTitle', 'Delete Medicine'),
      t('medicines.deleteConfirm', 'Are you sure you want to delete this medicine and its history?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: executeDelete
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[tw`flex-1`, { backgroundColor: colors.bg }]}
        accessible={true}
        accessibilityLabel="Medicine Form Modal"
      >
        {/* Header */}
        <View
          style={[
            tw`pt-12 pb-4 px-6 border-b flex-row items-center justify-between`,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <View style={tw`flex-row items-center`}>
            <Text style={[tw`text-lg font-bold`, { color: colors.text }]}>
              {isEditing
                ? t('medicines.editMedicine', 'Edit Medicine')
                : t('medicines.addMedicine', 'Add Medicine')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[
              tw`p-2 rounded-full`,
              { backgroundColor: isDark ? '#27272a' : '#f1f5f9' }
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close medicine form"
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={tw`p-6 pb-24`}>
          {/* Active Status Switch */}
          <View
            style={[
              tw`p-3.5 rounded-2xl border mb-5 flex-row items-center justify-between`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <View>
              <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                {t('medicines.activeStatus', 'Active Schedule')}
              </Text>
              <Text style={[tw`text-xs`, { color: colors.textSecondary }]}>
                {isActive
                  ? t('medicines.activeDesc', 'Reminders & alerts are enabled')
                  : t('medicines.pausedDesc', 'Medication is paused')}
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: '#71717a', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Medicine Name */}
          <View style={tw`mb-4`}>
            <Text style={[tw`text-xs font-bold mb-1.5`, { color: colors.text }]}>
              {t('medicines.nameLabel', 'Medicine Name')} *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Metformin, Paracetamol"
              placeholderTextColor={colors.textSecondary}
              style={[
                tw`p-3.5 rounded-xl border text-sm font-medium`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel="Medicine name input"
            />
          </View>

          {/* Strength / Dosage */}
          <View style={tw`mb-4`}>
            <Text style={[tw`text-xs font-bold mb-1.5`, { color: colors.text }]}>
              {t('medicines.strengthLabel', 'Strength / Dosage')}
            </Text>
            <TextInput
              value={strength}
              onChangeText={setStrength}
              placeholder="e.g. 500 mg, 10 ml, 1 spray"
              placeholderTextColor={colors.textSecondary}
              style={[
                tw`p-3.5 rounded-xl border text-sm font-medium`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel="Strength input"
            />
          </View>

          {/* Dosage Form Selector */}
          <View style={tw`mb-5`}>
            <Text style={[tw`text-xs font-bold mb-2`, { color: colors.text }]}>
              {t('medicines.formLabel', 'Form')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`gap-2`}>
              {formOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setForm(opt.value)}
                  style={[
                    tw`px-3 py-2 rounded-xl border flex-row items-center`,
                    form === opt.value
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border }
                  ]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Form ${opt.label}`}
                >
                  <Text style={tw`mr-1.5 text-xs`}>{opt.icon}</Text>
                  <Text
                    style={[
                      tw`text-xs font-bold`,
                      form === opt.value ? tw`text-white` : { color: colors.text }
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Food Relation Selector */}
          <View style={tw`mb-5`}>
            <Text style={[tw`text-xs font-bold mb-2`, { color: colors.text }]}>
              {t('medicines.foodRelationLabel', 'Food Instructions')}
            </Text>
            <View style={tw`flex-row flex-wrap gap-2`}>
              {foodOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setFoodRelation(opt.value)}
                  style={[
                    tw`px-3 py-2 rounded-xl border`,
                    foodRelation === opt.value
                      ? { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border }
                  ]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Food relation ${opt.label}`}
                >
                  <Text
                    style={[
                      tw`text-xs font-bold`,
                      foodRelation === opt.value ? { color: colors.primary } : { color: colors.text }
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Schedule Type */}
          <View style={tw`mb-5`}>
            <Text style={[tw`text-xs font-bold mb-2`, { color: colors.text }]}>
              {t('medicines.scheduleTypeLabel', 'Schedule Type')}
            </Text>
            <View style={tw`flex-row gap-2`}>
              {[
                { type: 'fixed_time' as MedicineScheduleType, label: t('medicines.scheduleFixed', 'Fixed Times') },
                { type: 'prn_as_needed' as MedicineScheduleType, label: t('medicines.schedulePRN', 'As Needed (PRN)') }
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  onPress={() => setScheduleType(opt.type)}
                  style={[
                    tw`flex-1 py-2.5 rounded-xl border items-center justify-center`,
                    scheduleType === opt.type
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border }
                  ]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Schedule type ${opt.label}`}
                >
                  <Text
                    style={[
                      tw`text-xs font-bold`,
                      scheduleType === opt.type ? tw`text-white` : { color: colors.text }
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Fixed Time Slots */}
          {scheduleType === 'fixed_time' && (
            <View
              style={[
                tw`p-4 rounded-2xl border mb-5`,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <View style={tw`flex-row items-center mb-3`}>
                <Clock size={16} color={colors.primary} />
                <Text style={[tw`text-xs font-bold ml-1.5`, { color: colors.text }]}>
                  {t('medicines.scheduledTimesTitle', 'Daily Dose Times (24h)')}
                </Text>
              </View>

              <View style={tw`flex-row flex-wrap gap-2 mb-3`}>
                {timesOfDay.map((time) => (
                  <View
                    key={time}
                    style={[
                      tw`px-3 py-1.5 rounded-xl border flex-row items-center`,
                      { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }
                    ]}
                  >
                    <Text style={[tw`text-xs font-bold mr-2`, { color: colors.primary }]}>
                      {time}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveTime(time)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove time ${time}`}
                    >
                      <X size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={tw`flex-row gap-2 items-center`}>
                <TextInput
                  value={newTimeInput}
                  onChangeText={setNewTimeInput}
                  placeholder="HH:mm (e.g. 14:00)"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    tw`flex-1 p-2.5 rounded-xl border text-xs font-medium`,
                    {
                      backgroundColor: isDark ? '#18181b' : '#f8fafc',
                      borderColor: colors.border,
                      color: colors.text
                    }
                  ]}
                  accessible={true}
                  accessibilityRole="none"
                  accessibilityLabel="Add time input"
                />
                <TouchableOpacity
                  onPress={handleAddTime}
                  style={[tw`px-3 py-2.5 rounded-xl flex-row items-center`, { backgroundColor: colors.primary }]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Add dose time"
                >
                  <Plus size={14} color="#ffffff" />
                  <Text style={tw`text-white text-xs font-bold ml-1`}>
                    {t('common.add', 'Add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Medication Safety Section */}
          <View
            style={[
              tw`p-4 rounded-2xl border mb-5`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <View style={tw`flex-row items-center mb-3`}>
              <ShieldAlert size={16} color="#e11d48" />
              <Text style={[tw`text-xs font-bold ml-1.5`, { color: colors.text }]}>
                {t('medicines.safetyRulesTitle', 'Safety & Double-Dose Protection')}
              </Text>
            </View>

            {/* Min Dose Gap */}
            <View style={tw`mb-3`}>
              <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                {t('medicines.minGapLabel', 'Minimum Gap Between Doses (Minutes)')}
              </Text>
              <TextInput
                value={minGapMinutes}
                onChangeText={setMinGapMinutes}
                keyboardType="numeric"
                placeholder="240 (4 hours)"
                placeholderTextColor={colors.textSecondary}
                style={[
                  tw`p-2.5 rounded-xl border text-xs font-medium`,
                  {
                    backgroundColor: isDark ? '#18181b' : '#f8fafc',
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                accessible={true}
                accessibilityRole="none"
                accessibilityLabel="Minimum gap input"
              />
            </View>

            {/* Max Daily Doses */}
            <View>
              <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                {t('medicines.maxDailyLabel', 'Maximum Doses Allowed Per 24 Hours')}
              </Text>
              <TextInput
                value={maxDailyDoses}
                onChangeText={setMaxDailyDoses}
                keyboardType="numeric"
                placeholder="4"
                placeholderTextColor={colors.textSecondary}
                style={[
                  tw`p-2.5 rounded-xl border text-xs font-medium`,
                  {
                    backgroundColor: isDark ? '#18181b' : '#f8fafc',
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                accessible={true}
                accessibilityRole="none"
                accessibilityLabel="Max daily doses input"
              />
            </View>
          </View>

          {/* Stock & Refill Threshold */}
          <View
            style={[
              tw`p-4 rounded-2xl border mb-5`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <View style={tw`flex-row items-center mb-3`}>
              <Package size={16} color="#0284c7" />
              <Text style={[tw`text-xs font-bold ml-1.5`, { color: colors.text }]}>
                {t('medicines.inventoryTitle', 'Stock Inventory & Refill Alert')}
              </Text>
            </View>

            <View style={tw`flex-row gap-3 mb-3`}>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('medicines.currentStockLabel', 'Current Stock')}
                </Text>
                <TextInput
                  value={stockCount}
                  onChangeText={setStockCount}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    tw`p-2.5 rounded-xl border text-xs font-medium`,
                    {
                      backgroundColor: isDark ? '#18181b' : '#f8fafc',
                      borderColor: colors.border,
                      color: colors.text
                    }
                  ]}
                  accessible={true}
                  accessibilityRole="none"
                  accessibilityLabel="Current stock input"
                />
              </View>

              <View style={tw`flex-1`}>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('medicines.refillAlertLabel', 'Refill Alert At')}
                </Text>
                <TextInput
                  value={refillThreshold}
                  onChangeText={setRefillThreshold}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    tw`p-2.5 rounded-xl border text-xs font-medium`,
                    {
                      backgroundColor: isDark ? '#18181b' : '#f8fafc',
                      borderColor: colors.border,
                      color: colors.text
                    }
                  ]}
                  accessible={true}
                  accessibilityRole="none"
                  accessibilityLabel="Refill threshold input"
                />
              </View>
            </View>

            <View>
              <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                {t('medicines.unitLabel', 'Unit (e.g. tablets, capsules, ml)')}
              </Text>
              <TextInput
                value={unit}
                onChangeText={setUnit}
                placeholder="tablets"
                placeholderTextColor={colors.textSecondary}
                style={[
                  tw`p-2.5 rounded-xl border text-xs font-medium`,
                  {
                    backgroundColor: isDark ? '#18181b' : '#f8fafc',
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                accessible={true}
                accessibilityRole="none"
                accessibilityLabel="Unit input"
              />
            </View>
          </View>

          {/* Missed Dose Advice */}
          <View style={tw`mb-4`}>
            <View style={tw`flex-row items-center mb-1.5`}>
              <HelpCircle size={14} color={colors.primary} />
              <Text style={[tw`text-xs font-bold ml-1.5`, { color: colors.text }]}>
                {t('medicines.missedDoseAdviceLabel', 'Doctor Advice: If I Miss a Dose')}
              </Text>
            </View>
            <TextInput
              value={missedDoseAdvice}
              onChangeText={setMissedDoseAdvice}
              multiline
              numberOfLines={3}
              placeholder="e.g. Take as soon as remembered unless close to next dose."
              placeholderTextColor={colors.textSecondary}
              style={[
                tw`p-3.5 rounded-xl border text-xs font-medium leading-4`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                  minHeight: 70
                }
              ]}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel="Missed dose advice input"
            />
          </View>

          {/* Special Instructions */}
          <View style={tw`mb-6`}>
            <View style={tw`flex-row items-center mb-1.5`}>
              <FileText size={14} color={colors.primary} />
              <Text style={[tw`text-xs font-bold ml-1.5`, { color: colors.text }]}>
                {t('medicines.instructionsLabel', 'Special Instructions / Notes')}
              </Text>
            </View>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={2}
              placeholder="e.g. Take with plenty of water. Avoid taking before sleep."
              placeholderTextColor={colors.textSecondary}
              style={[
                tw`p-3.5 rounded-xl border text-xs font-medium leading-4`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                  minHeight: 50
                }
              ]}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel="Special instructions input"
            />
          </View>

          {/* Action Buttons */}
          <View style={tw`gap-3`}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[
                tw`py-4 rounded-xl items-center justify-center flex-row shadow-sm`,
                { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Save medicine"
            >
              <Check size={18} color="#ffffff" style={tw`mr-2`} />
              <Text style={tw`text-white font-bold text-base`}>
                {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save Medicine')}
              </Text>
            </TouchableOpacity>

            {isEditing && (
              <TouchableOpacity
                onPress={handleDelete}
                disabled={isDeleting || isSaving}
                style={[
                  tw`py-3.5 rounded-xl items-center justify-center flex-row border border-red-500/30`,
                  {
                    backgroundColor: isDark ? '#450a0a30' : '#fee2e250',
                    opacity: isDeleting ? 0.6 : 1
                  }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Delete medicine"
              >
                <Trash2 size={16} color="#ef4444" style={tw`mr-2`} />
                <Text style={tw`text-red-500 font-bold text-sm`}>
                  {isDeleting
                    ? t('common.deleting', 'Deleting...')
                    : t('medicines.deleteMedicine', 'Delete Medicine')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
