import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { useTheme } from '../../context/ThemeContext';
import { ShiftType } from '../../domain/shift';

interface ShiftTypePickerProps {
  shiftTypes: ShiftType[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** List of shift types (with colour and hours) used by the override and rotation-step modals. */
export const ShiftTypePicker: React.FC<ShiftTypePickerProps> = ({ shiftTypes, selectedId, onSelect }) => {
  const { colors } = useTheme();
  return (
    <View style={tw`gap-1.5 mb-3`}>
      {shiftTypes.map((st) => (
        <TouchableOpacity
          key={st.id}
          onPress={() => onSelect(st.id)}
          accessible={true}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedId === st.id }}
          accessibilityLabel={`${st.name} ${st.startTime} - ${st.endTime}`}
          style={[
            tw`p-2.5 rounded-xl border flex-row items-center justify-between`,
            selectedId === st.id
              ? { backgroundColor: `${st.color}20`, borderColor: st.color }
              : { backgroundColor: colors.card, borderColor: colors.borderLight }
          ]}
        >
          <View style={tw`flex-row items-center gap-2`}>
            <View style={[tw`w-3 h-3 rounded-full`, { backgroundColor: st.color }]} />
            <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>{st.name}</Text>
          </View>
          <Text style={[tw`text-[10px] font-mono`, { color: colors.textMuted }]}>
            {st.startTime} - {st.endTime}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
