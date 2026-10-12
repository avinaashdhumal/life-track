import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { ReminderLogEntry } from '../../domain/alarm';

interface ReminderLogsModalProps {
  visible: boolean;
  logs: ReminderLogEntry[];
  onClose: () => void;
  onClear: () => void;
}

export const ReminderLogsModal: React.FC<ReminderLogsModalProps> = ({ visible, logs, onClose, onClear }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={tw`flex-1 justify-center items-center bg-black/75 p-4`}>
        <View
          style={[
            tw`w-full max-w-lg max-h-[90%] rounded-3xl border flex flex-col overflow-hidden shadow-2xl`,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
          accessible={true}
          accessibilityViewIsModal={true}
          accessibilityLabel={t('profileSettings.viewLogs')}
        >
          <View
            style={[
              tw`flex-row items-center justify-between px-5 py-4 border-b`,
              { backgroundColor: colors.bgHeader, borderBottomColor: colors.border }
            ]}
          >
            <View>
              <Text style={[tw`text-base font-bold`, { color: colors.text }]}>{t('profileSettings.viewLogs')}</Text>
              <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                {logs.length} {t('profileSettings.recordedEvents')}
              </Text>
            </View>
            <View style={tw`flex-row items-center gap-2`}>
              {logs.length > 0 && (
                <TouchableOpacity
                  onPress={onClear}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('storage.clearLogs')}
                  style={tw`p-2 rounded-lg bg-red-500/10`}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.close')}
                style={tw`p-2`}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={tw`p-4`} contentContainerStyle={tw`flex-col gap-2.5`}>
            {logs.length === 0 ? (
              <View style={tw`py-8 items-center`}>
                <Text style={[tw`text-xs`, { color: colors.textMuted }]}>{t('logs.noLogs')}</Text>
              </View>
            ) : (
              logs.map((log) => (
                <View
                  key={log.id}
                  style={[
                    tw`p-3 rounded-xl border flex-col gap-1`,
                    { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
                  ]}
                >
                  <View style={tw`flex-row items-center justify-between`}>
                    <View style={tw`px-2 py-0.5 rounded-full bg-zinc-800`}>
                      <Text style={tw`text-[10px] font-bold text-zinc-300 font-mono`}>{log.action}</Text>
                    </View>
                    <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
                      {new Date(log.timestampMs).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={[tw`text-xs font-medium`, { color: colors.text }]}>{log.note || log.alarmId}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
