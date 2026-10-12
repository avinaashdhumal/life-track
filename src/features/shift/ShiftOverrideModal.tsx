import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { ShiftType } from '../../domain/shift';
import { ShiftTypePicker } from './ShiftTypePicker';

interface ShiftOverrideModalProps {
  visible: boolean;
  dateStr: string;
  shiftTypes: ShiftType[];
  initialShiftId: string;
  initialNote: string;
  hasOverride: boolean;
  onSave: (shiftTypeId: string, note: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Assigns a different shift to one calendar date (swap, leave, overtime). */
const ShiftOverrideModalContent: React.FC<Omit<ShiftOverrideModalProps, 'visible'>> = ({ dateStr,
  shiftTypes,
  initialShiftId,
  initialNote,
  hasOverride,
  onSave,
  onRemove,
  onClose
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [shiftId, setShiftId] = useState(initialShiftId);
  const [note, setNote] = useState(initialNote);

  return (
    <View style={tw`flex-1 bg-black/60 items-center justify-center p-4`}>
      <View
        style={[
          tw`w-full max-w-sm rounded-3xl p-5 border shadow-2xl`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <View>
            <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
              {t('shift.overrideModalTitle', 'Manual Shift Override')}
            </Text>
            <Text style={[tw`text-xs font-mono`, { color: colors.primary }]}>{dateStr}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
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
        <ShiftTypePicker shiftTypes={shiftTypes} selectedId={shiftId} onSelect={setShiftId} />

        <Text style={[tw`text-xs font-bold mb-1`, { color: colors.textMuted }]}>
          {t('shift.overrideNoteLabel', 'Reason / Note (Optional):')}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('shift.overrideNotePlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessible={true}
          accessibilityLabel={t('shift.overrideNoteLabel', 'Reason / Note (Optional):')}
          style={[
            tw`p-2.5 rounded-xl border text-xs mb-4`,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }
          ]}
        />

        <View style={tw`flex-row items-center gap-2`}>
          {hasOverride && (
            <TouchableOpacity
              onPress={onRemove}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('shift.revertCycle', 'Revert to Cycle')}
              style={tw`flex-1 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 items-center`}
            >
              <Text style={tw`text-xs font-bold text-rose-400`}>{t('shift.revertCycle', 'Revert to Cycle')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onSave(shiftId, note.trim())}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('shift.saveOverride', 'Save Override')}
            style={tw`flex-1 p-2.5 rounded-xl bg-amber-500 items-center shadow-md`}
          >
            <Text style={tw`text-xs font-bold text-white`}>{t('shift.saveOverride', 'Save Override')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const ShiftOverrideModal: React.FC<ShiftOverrideModalProps> = ({ visible, ...props }) => (
  <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={props.onClose}>
    {visible && <ShiftOverrideModalContent {...props} />}
  </Modal>
);
