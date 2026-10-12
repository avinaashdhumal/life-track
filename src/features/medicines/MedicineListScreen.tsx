import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  RefreshControl,
  Platform
} from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { medicinesRepository } from '../../data/medicinesRepository';
import { Medicine, DoseLogEntry, calculateStockLevel } from '../../domain/medicine';
import { MedicineFormModal } from './MedicineFormModal';
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Edit3,
  Trash2,
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react-native';

interface MedicineListScreenProps {
  onOpenPOCAlarms?: () => void;
}

export const MedicineListScreen: React.FC<MedicineListScreenProps> = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'low_stock'>('all');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  // Quick Refill Modal
  const [refillMed, setRefillMed] = useState<Medicine | null>(null);
  const [refillAmount, setRefillAmount] = useState<string>('30');

  const loadData = useCallback(async () => {
    try {
      const all = await medicinesRepository.getAll('default');
      setMedicines(all);
    } catch (e) {
      console.warn('Error loading medicines:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stay current when doses are logged elsewhere (Today, notification actions) and stock changes.
  useEffect(() => medicinesRepository.changes.subscribe(() => loadData()), [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveMedicine = async (data: Partial<Medicine> & { name: string }) => {
    try {
      await medicinesRepository.upsert(data);
      await loadData();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || 'Failed to save medicine');
      throw err;
    }
  };

  const handleDeleteMedicine = async (id: string) => {
    try {
      await medicinesRepository.delete(id);
      await loadData();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || 'Failed to delete medicine');
      throw err;
    }
  };

  const confirmDeleteMedicine = (med: Medicine) => {
    const message = `${t('medicines.deleteConfirm', 'Are you sure you want to delete this medicine and its history?')}\n(${med.name})`;

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && window.confirm
          ? window.confirm(message)
          : true;
      if (confirmed) {
        handleDeleteMedicine(med.id);
      }
      return;
    }

    Alert.alert(
      t('medicines.deleteTitle', 'Delete Medicine'),
      message,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => handleDeleteMedicine(med.id)
        }
      ]
    );
  };

  const handleTakeDose = async (medicine: Medicine) => {
    try {
      const result = await medicinesRepository.logDose({
        profileId: 'default',
        medicineId: medicine.id,
        medicineName: medicine.name,
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
      } else {
        Alert.alert(
          t('medicines.doseLogged', 'Dose Logged'),
          `${medicine.name} taken. ${result.updatedStock} ${medicine.unit} remaining in stock.`,
          [{ text: t('common.ok', 'OK') }]
        );
      }
      await loadData();
    } catch (err: any) {
      Alert.alert(t('common.error', 'Error'), err?.message || 'Could not log dose');
    }
  };

  const handleRefillSubmit = async () => {
    if (!refillMed) return;
    const amount = parseInt(refillAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.invalidInput', 'Invalid'), 'Please enter a valid refill amount.');
      return;
    }

    await medicinesRepository.refillStock(refillMed.id, amount);
    setRefillMed(null);
    await loadData();
  };

  // Filter & Search
  const filteredMedicines = medicines.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.strength && m.strength.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'active') return m.isActive;
    if (filterType === 'low_stock') return m.stockCount <= m.refillThreshold;
    return true;
  });

  const lowStockCount = medicines.filter((m) => m.stockCount <= m.refillThreshold).length;

  return (
    <View
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
      accessible={true}
      accessibilityLabel="Medicine List Screen"
    >
      {/* Top Header */}
      <View
        style={[
          tw`pt-12 pb-4 px-6 border-b flex-row items-center justify-between`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <View>
          <Text style={[tw`text-xl font-black`, { color: colors.text }]}>
            {t('medicines.title', 'Medicines')}
          </Text>
          <Text style={[tw`text-xs mt-0.5`, { color: colors.textSecondary }]}>
            {t('medicines.subtitle', 'Schedules, stock & safety protection')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            setSelectedMedicine(null);
            setIsFormOpen(true);
          }}
          style={[
            tw`px-3 py-2 rounded-xl flex-row items-center shadow-sm`,
            { backgroundColor: colors.primary }
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new medicine"
        >
          <Plus size={16} color="#ffffff" style={tw`mr-1`} />
          <Text style={tw`text-white text-xs font-bold`}>
            {t('medicines.add', 'Add Medicine')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={tw`p-5 pb-28`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Quick Filter & Stats Row */}
        <View style={tw`flex-row gap-2 mb-4`}>
          <TouchableOpacity
            onPress={() => setFilterType('all')}
            style={[
              tw`flex-1 py-2 rounded-xl border items-center justify-center`,
              filterType === 'all'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter all medicines"
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                filterType === 'all' ? tw`text-white` : { color: colors.text }
              ]}
            >
              {t('medicines.filterAll', 'All')} ({medicines.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterType('active')}
            style={[
              tw`flex-1 py-2 rounded-xl border items-center justify-center`,
              filterType === 'active'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter active medicines"
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                filterType === 'active' ? tw`text-white` : { color: colors.text }
              ]}
            >
              {t('medicines.filterActive', 'Active')} (
              {medicines.filter((m) => m.isActive).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterType('low_stock')}
            style={[
              tw`flex-1 py-2 rounded-xl border items-center justify-center flex-row`,
              filterType === 'low_stock'
                ? { backgroundColor: '#e11d48', borderColor: '#e11d48' }
                : { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter low stock medicines"
          >
            <AlertTriangle
              size={12}
              color={filterType === 'low_stock' ? '#ffffff' : '#e11d48'}
              style={tw`mr-1`}
            />
            <Text
              style={[
                tw`text-xs font-bold`,
                filterType === 'low_stock' ? tw`text-white` : { color: colors.text }
              ]}
            >
              {t('medicines.filterLowStock', 'Low Stock')} ({lowStockCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={[
            tw`p-2.5 rounded-xl border flex-row items-center mb-5`,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <Search size={16} color={colors.textSecondary} style={tw`mr-2 ml-1`} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('medicines.searchPlaceholder', 'Search medicine or strength...')}
            placeholderTextColor={colors.textSecondary}
            style={[tw`flex-1 text-xs font-medium`, { color: colors.text }]}
            accessible={true}
            accessibilityRole="none"
            accessibilityLabel="Search medicine input"
          />
        </View>

        {/* Medicines List */}
        {filteredMedicines.length === 0 ? (
          <View
            style={[
              tw`p-8 rounded-2xl border items-center justify-center my-6`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <Package size={36} color={colors.textSecondary} style={tw`mb-2`} />
            <Text style={[tw`text-sm font-bold text-center mb-1`, { color: colors.text }]}>
              {t('medicines.noMedicinesFound', 'No medicines found')}
            </Text>
            <Text style={[tw`text-xs text-center`, { color: colors.textSecondary }]}>
              {searchQuery
                ? t('medicines.noSearchResults', 'Try adjusting your search query')
                : t('medicines.tapToAddFirst', 'Tap "Add Medicine" to create your first schedule')}
            </Text>
          </View>
        ) : (
          filteredMedicines.map((med) => {
            const stockStatus = calculateStockLevel(med.stockCount, med.refillThreshold);

            return (
              <View
                key={med.id}
                style={[
                  tw`p-4 rounded-2xl border mb-3 shadow-sm`,
                  { backgroundColor: colors.card, borderColor: colors.border }
                ]}
              >
                {/* Header row: Name, Form, and Edit */}
                <View style={tw`flex-row items-start justify-between mb-2`}>
                  <View style={tw`flex-1 mr-2`}>
                    <View style={tw`flex-row items-center flex-wrap gap-1.5`}>
                      <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                        {med.name}
                      </Text>
                      {med.strength ? (
                        <Text
                          style={[
                            tw`text-xs font-semibold px-2 py-0.5 rounded-md`,
                            {
                              backgroundColor: isDark ? '#27272a' : '#f1f5f9',
                              color: colors.textSecondary
                            }
                          ]}
                        >
                          {med.strength}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={[tw`text-xs mt-0.5`, { color: colors.textSecondary }]}>
                      {med.form.toUpperCase()} •{' '}
                      {med.foodRelation === 'with'
                        ? t('medicines.foodWith', 'With Meal')
                        : med.foodRelation === 'before'
                        ? t('medicines.foodBefore', 'Before Meal')
                        : med.foodRelation === 'after'
                        ? t('medicines.foodAfter', 'After Meal')
                        : med.foodRelation === 'empty_stomach'
                        ? t('medicines.foodEmptyStomach', 'Empty Stomach')
                        : t('medicines.foodNone', 'No Food Relation')}
                    </Text>
                  </View>

                  <View style={tw`flex-row items-center gap-1.5`}>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedMedicine(med);
                        setIsFormOpen(true);
                      }}
                      style={[
                        tw`p-2 rounded-xl`,
                        { backgroundColor: isDark ? '#27272a' : '#f1f5f9' }
                      ]}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${med.name}`}
                    >
                      <Edit3 size={15} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => confirmDeleteMedicine(med)}
                      style={[
                        tw`p-2 rounded-xl`,
                        { backgroundColor: isDark ? '#450a0a30' : '#fee2e250' }
                      ]}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${med.name}`}
                    >
                      <Trash2 size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Schedule info row */}
                <View style={tw`flex-row items-center flex-wrap gap-2 mb-3`}>
                  <View style={tw`flex-row items-center`}>
                    <Clock size={13} color={colors.primary} style={tw`mr-1`} />
                    <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                      {med.scheduleType === 'prn_as_needed'
                        ? t('medicines.asNeeded', 'As Needed (PRN)')
                        : med.timesOfDay.join(', ')}
                    </Text>
                  </View>

                  {med.minGapMinutes ? (
                    <Text
                      style={[
                        tw`text-[10px] font-semibold px-2 py-0.5 rounded-full`,
                        {
                          backgroundColor: `${colors.primary}15`,
                          color: colors.primary
                        }
                      ]}
                    >
                      Min {med.minGapMinutes}m gap
                    </Text>
                  ) : null}

                  {med.maxDailyDoses ? (
                    <Text
                      style={[
                        tw`text-[10px] font-semibold px-2 py-0.5 rounded-full`,
                        {
                          backgroundColor: isDark ? '#27272a' : '#f1f5f9',
                          color: colors.textSecondary
                        }
                      ]}
                    >
                      Max {med.maxDailyDoses}/day
                    </Text>
                  ) : null}
                </View>

                {/* Missed Dose Advice if present */}
                {med.missedDoseAdvice ? (
                  <View
                    style={[
                      tw`p-2.5 rounded-xl mb-3 flex-row items-start`,
                      { backgroundColor: isDark ? '#18181b' : '#f8fafc' }
                    ]}
                  >
                    <HelpCircle size={13} color="#0284c7" style={tw`mr-1.5 mt-0.5`} />
                    <Text style={[tw`text-[10px] leading-3.5 flex-1`, { color: colors.textSecondary }]}>
                      <Text style={tw`font-bold text-sky-500`}>
                        {t('medicines.missedAdvicePrefix', 'Doctor Advice: ')}
                      </Text>
                      {med.missedDoseAdvice}
                    </Text>
                  </View>
                ) : null}

                {/* Bottom Row: Stock count & Take Dose Action */}
                <View
                  style={[
                    tw`pt-2.5 border-t flex-row items-center justify-between`,
                    { borderColor: colors.border }
                  ]}
                >
                  {/* Stock Badge & Refill */}
                  <TouchableOpacity
                    onPress={() => {
                      setRefillMed(med);
                      setRefillAmount('30');
                    }}
                    style={tw`flex-row items-center`}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Refill stock for ${med.name}. Current stock ${med.stockCount}`}
                  >
                    <Package
                      size={14}
                      color={stockStatus.isLowStock || stockStatus.isOutOfStock ? '#e11d48' : '#10b981'}
                      style={tw`mr-1.5`}
                    />
                    <Text
                      style={[
                        tw`text-xs font-bold`,
                        stockStatus.isLowStock || stockStatus.isOutOfStock
                          ? tw`text-red-500`
                          : { color: colors.text }
                      ]}
                    >
                      {med.stockCount} {med.unit}
                    </Text>
                    {stockStatus.isLowStock || stockStatus.isOutOfStock ? (
                      <View style={tw`ml-1.5 px-1.5 py-0.5 rounded bg-red-500/20`}>
                        <Text style={tw`text-red-500 text-[10px] font-black`}>
                          {stockStatus.isOutOfStock
                            ? t('medicines.empty', 'OUT')
                            : t('medicines.low', 'LOW')}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[tw`text-[10px] font-semibold ml-2 text-sky-500 underline`]}>
                      {t('medicines.refill', '+ Refill')}
                    </Text>
                  </TouchableOpacity>

                  {/* 1-Tap Take Dose Button */}
                  <TouchableOpacity
                    onPress={() => handleTakeDose(med)}
                    style={[
                      tw`px-3.5 py-2 rounded-xl flex-row items-center`,
                      { backgroundColor: `${colors.primary}20` }
                    ]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Take dose of ${med.name}`}
                  >
                    <CheckCircle2 size={15} color={colors.primary} style={tw`mr-1.5`} />
                    <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
                      {t('medicines.takeDose', 'Take Dose')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Edit / Add Modal */}
      <MedicineFormModal
        visible={isFormOpen}
        medicine={selectedMedicine}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedMedicine(null);
        }}
        onSave={handleSaveMedicine}
        onDelete={handleDeleteMedicine}
      />

      {/* Quick Refill Modal */}
      <Modal
        visible={Boolean(refillMed)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRefillMed(null)}
      >
        <View
          style={tw`flex-1 bg-black/60 items-center justify-center p-6`}
          accessible={true}
          accessibilityLabel="Refill Stock Modal"
        >
          <View
            style={[
              tw`w-full max-w-sm p-6 rounded-3xl border shadow-2xl`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <Text style={[tw`text-lg font-bold mb-1`, { color: colors.text }]}>
              {t('medicines.refillStockTitle', 'Refill Inventory')}
            </Text>
            <Text style={[tw`text-xs mb-4`, { color: colors.textSecondary }]}>
              {refillMed?.name} • Current: {refillMed?.stockCount} {refillMed?.unit}
            </Text>

            <View style={tw`flex-row gap-2 mb-4`}>
              {['10', '30', '60'].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => setRefillAmount(amt)}
                  style={[
                    tw`flex-1 py-2 rounded-xl border items-center justify-center`,
                    refillAmount === amt
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.bg, borderColor: colors.border }
                  ]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${amt} units`}
                >
                  <Text
                    style={[
                      tw`text-xs font-bold`,
                      refillAmount === amt ? tw`text-white` : { color: colors.text }
                    ]}
                  >
                    +{amt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={refillAmount}
              onChangeText={setRefillAmount}
              keyboardType="numeric"
              placeholder="Custom quantity"
              placeholderTextColor={colors.textSecondary}
              style={[
                tw`p-3 rounded-xl border text-sm font-bold mb-5 text-center`,
                { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }
              ]}
              accessible={true}
              accessibilityRole="none"
              accessibilityLabel="Refill quantity input"
            />

            <View style={tw`flex-row gap-2`}>
              <TouchableOpacity
                onPress={() => setRefillMed(null)}
                style={[tw`flex-1 py-3 rounded-xl items-center border`, { borderColor: colors.border }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel refill"
              >
                <Text style={[tw`text-xs font-bold`, { color: colors.textSecondary }]}>
                  {t('common.cancel', 'Cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRefillSubmit}
                style={[tw`flex-1 py-3 rounded-xl items-center`, { backgroundColor: colors.primary }]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Confirm refill"
              >
                <Text style={tw`text-white text-xs font-bold`}>
                  {t('medicines.addStock', 'Add Stock')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
