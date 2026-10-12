import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Share } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Share2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { dataManagementService } from '../../services/DataManagementService';
import { reminderCoordinator } from '../../services/reminderCoordinator';

interface BackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ visible, onClose, onRestored }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [backupJson, setBackupJson] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const generateBackup = async () => {
    setBackupJson(await dataManagementService.exportBackupJson());
    setStatus({ ok: true, text: t('storage.backupSuccess') });
  };

  useEffect(() => {
    if (visible) {
      setStatus(null);
      generateBackup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleShare = async () => {
    try {
      await Share.share({ title: t('storage.backupData'), message: backupJson });
    } catch {
      // User cancelled or sharing unavailable
    }
  };

  const doRestore = async () => {
    const result = await dataManagementService.restoreBackupJson(backupJson);
    if (!result.ok) {
      setStatus({
        ok: false,
        text: result.error === 'newer_version' ? t('storage.restoreNewerVersion') : t('storage.restoreFailed')
      });
      return;
    }
    await reminderCoordinator.rebuildAll();
    setStatus({
      ok: true,
      text: t('storage.restoreSuccessCounts', {
        medicines: result.counts?.medicines ?? 0,
        doses: result.counts?.doses ?? 0,
        schedules: result.counts?.schedules ?? 0
      })
    });
    onRestored();
  };

  const handleRestore = () => {
    // Validate first so the warning is only shown for a usable file.
    const { error } = dataManagementService.parseBackup(backupJson);
    if (error) {
      setStatus({
        ok: false,
        text: error === 'newer_version' ? t('storage.restoreNewerVersion') : t('storage.restoreFailed')
      });
      return;
    }
    Alert.alert(t('storage.restoreConfirmTitle'), t('storage.restoreConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('storage.restoreData'), style: 'destructive', onPress: doRestore }
    ]);
  };

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
          accessibilityLabel={t('storage.modalTitle')}
        >
          <View
            style={[
              tw`flex-row items-center justify-between px-5 py-4 border-b`,
              { backgroundColor: colors.bgHeader, borderBottomColor: colors.border }
            ]}
          >
            <Text style={[tw`text-base font-bold`, { color: colors.text }]}>{t('storage.modalTitle')}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.close')}
              style={tw`p-1.5`}
            >
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={tw`p-5`} contentContainerStyle={tw`flex-col gap-3`}>
            {status && (
              <View
                style={tw`p-3 rounded-xl border ${status.ok ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}
              >
                <Text style={tw`text-xs font-semibold ${status.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {status.text}
                </Text>
              </View>
            )}

            <Text style={[tw`text-xs leading-relaxed`, { color: colors.textMuted }]}>{t('storage.backupHelp')}</Text>

            <TextInput
              value={backupJson}
              onChangeText={setBackupJson}
              multiline={true}
              numberOfLines={8}
              style={[
                tw`p-3 rounded-xl border text-xs font-mono max-h-48`,
                { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
              ]}
              placeholder={t('storage.restorePlaceholder')}
              placeholderTextColor={colors.textSubtle}
              accessibilityLabel={t('storage.restorePlaceholder')}
            />

            <View style={tw`flex-row gap-2 mt-2`}>
              <TouchableOpacity
                onPress={handleRestore}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.restoreData')}
                style={[tw`flex-1 py-3 px-4 rounded-xl items-center justify-center min-h-11`, { backgroundColor: colors.primary }]}
              >
                <Text style={tw`text-xs font-bold text-white`}>{t('storage.restoreData')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('storage.shareBackup')}
                style={[
                  tw`py-3 px-4 rounded-xl border items-center justify-center min-h-11`,
                  { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                ]}
              >
                <Share2 size={14} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={generateBackup}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.backupData')}
                style={[
                  tw`py-3 px-4 rounded-xl border items-center justify-center min-h-11`,
                  { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                ]}
              >
                <RefreshCw size={14} color={colors.text} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
