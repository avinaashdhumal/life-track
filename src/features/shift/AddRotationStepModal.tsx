import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { ShiftType } from '../../domain/shift';
import { ShiftTypePicker } from './ShiftTypePicker';

interface AddRotationStepModalProps {
  visible: boolean;
  shiftTypes: ShiftType[];
  onAdd: (shiftTypeId: string, days: number) => void;
  onClose: () => void;
}

/** Adds "N days of shift X" to the rotation cycle. */
const AddRotationStepModalContent: React.FC<Omit<AddRotationStepModalProps, 'visible'>> = ({ shiftTypes, onAdd, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [shiftId, setShiftId] = useState(shiftTypes[0]?.id || 'shift_morning');
  const [days, setDays] = useState('5');

  const handleAdd = () => {
    const count = parseInt(days, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert(t('common.error'), t('shift.invalidDays', 'Please enter a valid number of days (1-30).'));
      return;
    }
    onAdd(shiftId, Math.min(30, count));
  };

  return (
    <View style={tw`flex-1 bg-black/60 items-center justify-center p-4`}>
      <View
        style={[
          tw`w-full max-w-sm rounded-3xl p-5 border shadow-2xl`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <Text style={[tw`text-base font-bold mb-3`, { color: colors.text }]}>
          {t('shift.addStepTitle', 'Add Rotation Cycle Step')}
        </Text>

        <Text style={[tw`text-xs font-bold mb-2`, { color: colors.textMuted }]}>
          {t('shift.chooseShiftType', 'Shift Type:')}
        </Text>
        <ShiftTypePicker shiftTypes={shiftTypes} selectedId={shiftId} onSelect={setShiftId} />

        <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textMuted }]}>
          {t('shift.daysCount', 'Consecutive Days (1 - 30):')}
        </Text>
        <TextInput
          value={days}
          onChangeText={setDays}
          keyboardType="numeric"
          accessible={true}
          accessibilityLabel={t('shift.daysCount', 'Consecutive Days (1 - 30):')}
          style={[
            tw`p-2.5 rounded-xl border text-sm mb-4 font-mono`,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }
          ]}
        />

        <View style={tw`flex-row justify-end gap-2`}>
          <TouchableOpacity
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={tw`px-4 py-2 rounded-xl bg-zinc-800`}
          >
            <Text style={tw`text-xs font-semibold text-zinc-300`}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAdd}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('shift.addStep', 'Add Step')}
            style={tw`px-4 py-2 rounded-xl bg-amber-500 shadow-md`}
          >
            <Text style={tw`text-xs font-bold text-white`}>{t('shift.addStep', 'Add Step')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const AddRotationStepModal: React.FC<AddRotationStepModalProps> = ({ visible, ...props }) => (
  <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={props.onClose}>
    {visible && <AddRotationStepModalContent {...props} />}
  </Modal>
);
