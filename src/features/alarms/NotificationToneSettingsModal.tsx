import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { reminderService } from '../../services/AlarmEngineService';
import { ChannelToneInfo, ALARM_CATEGORIES, NotificationChannelId } from '../../domain/alarm';
import { previewTone, stopAlarmSound, isAudioPlaying, AlarmToneType } from '../../utils/audioAlarm';
import {
  Volume2,
  VolumeX,
  Settings,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  Bell,
  Clock,
  Sparkles,
  Play,
  Square,
  Smartphone,
  Info,
  X
} from 'lucide-react-native';

import { storageService } from '../../services/StorageService';

interface NotificationToneSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onScheduleQuickTestAlarm: (secondsAhead: number) => void;
}

export const NotificationToneSettingsModal: React.FC<NotificationToneSettingsModalProps> = ({
  visible,
  onClose,
  onScheduleQuickTestAlarm
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [channels, setChannels] = useState<ChannelToneInfo[]>([]);
  const [playingTone, setPlayingTone] = useState<AlarmToneType | null>(null);
  const [selectedInAppTone, setSelectedInAppTone] = useState<AlarmToneType>(() => storageService.getSyncSetting('alarmTone') || 'default_siren');
  const [backgroundProtected, setBackgroundProtected] = useState(true);

  useEffect(() => {
    if (visible) {
      loadChannels();
      storageService.getSettings().then((s) => {
        if (s.alarmTone) {
          setSelectedInAppTone(s.alarmTone);
        }
      }).catch(() => {
        // ignore
      });
    } else {
      stopAlarmSound();
      setPlayingTone(null);
    }
    return () => {
      stopAlarmSound();
    };
  }, [visible]);

  const loadChannels = async () => {
    try {
      const list = await reminderService.getNotificationChannels();
      // Native returns every channel on the app; keep only LifeTrack's known channel ids.
      const known = new Set<string>(['medicines', 'appointments', 'routine', 'exercise', 'water_meals', 'habits', 'summaries']);
      setChannels(list.filter((c) => known.has(c.id)) as ChannelToneInfo[]);
    } catch {
      // Fallback
    }
  };

  const handleSelectInAppTone = async (tone: AlarmToneType) => {
    setSelectedInAppTone(tone);
    await storageService.updateSettings({ alarmTone: tone });
  };

  const handleTogglePlayTone = (tone: AlarmToneType) => {
    if (playingTone === tone && isAudioPlaying()) {
      stopAlarmSound();
      setPlayingTone(null);
    } else {
      stopAlarmSound();
      setPlayingTone(tone);
      previewTone(tone, 4000);
      setTimeout(() => {
        setPlayingTone(null);
      }, 4000);
    }
  };

  const handleOpenChannelSettings = async (channelId: string) => {
    await reminderService.openChannelNotificationSettings(channelId);
  };

  const handleOpenAllAppNotificationSettings = async () => {
    await reminderService.openAppNotificationSettings();
  };

  const getChannelCategoryColor = (channelId: string) => {
    switch (channelId) {
      case 'medicines':
        return '#EF4444'; // Red
      case 'appointments':
        return '#6366F1'; // Indigo
      case 'routine':
        return '#3B82F6'; // Blue
      case 'exercise':
        return '#10B981'; // Emerald
      case 'water_meals':
        return '#06B6D4'; // Cyan
      case 'habits':
        return '#8B5CF6'; // Purple
      default:
        return '#F59E0B'; // Amber
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={tw`flex-1 justify-center items-center bg-black/75 p-3 sm:p-4`}
        accessible={true}
        accessibilityRole="none"
      >
        <View
          style={[
            tw`w-full max-w-lg max-h-[90%] rounded-3xl border flex flex-col overflow-hidden shadow-2xl`,
            {
              backgroundColor: colors.card,
              borderColor: colors.border
            }
          ]}
          accessible={true}
          accessibilityViewIsModal={true}
          accessibilityLabel={t('soundSettings.title')}
        >
          {/* Header */}
          <View
            style={[
              tw`flex-row items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 border-b`,
              {
                backgroundColor: colors.bgHeader,
                borderBottomColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center gap-2.5 flex-1 min-w-0 pr-2`}>
              <View
                style={[
                  tw`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center border shrink-0`,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                  }
                ]}
              >
                <Volume2 size={18} color="#F59E0B" />
              </View>
              <View style={tw`flex-1 min-w-0`}>
                <Text
                  style={[tw`text-sm sm:text-base font-bold`, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {t('soundSettings.title')}
                </Text>
                <Text
                  style={[tw`text-[11px] sm:text-xs`, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {t('soundSettings.subtitle')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                tw`w-8 h-8 rounded-full items-center justify-center border shrink-0`,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.borderLight
                }
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.close')}
            >
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView
            style={tw`px-3.5 py-4 sm:px-5 sm:py-5`}
            contentContainerStyle={tw`flex flex-col gap-4 pb-6`}
            showsVerticalScrollIndicator={true}
          >
            {/* Background & Foreground Working Verification Banner */}
            <View
              style={[
                tw`p-3.5 sm:p-4 rounded-2xl border flex flex-col gap-2.5`,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                  borderColor: 'rgba(16, 185, 129, 0.25)'
                }
              ]}
            >
              <View style={tw`flex-row flex-wrap items-center justify-between gap-1.5`}>
                <View style={tw`flex-row items-center gap-2 flex-1 min-w-0`}>
                  <ShieldCheck size={18} color="#10B981" style={tw`shrink-0`} />
                  <Text style={tw`text-xs sm:text-sm font-bold text-emerald-500 flex-1 min-w-0`}>
                    {t('soundSettings.bgFgWorkingBadge')}
                  </Text>
                </View>
                <View style={tw`flex-row items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 shrink-0`}>
                  <View style={tw`w-2 h-2 rounded-full bg-emerald-500`} />
                  <Text style={tw`text-[10px] sm:text-[11px] font-semibold text-emerald-400 uppercase tracking-wider`}>
                    {t('soundSettings.appClosedReliability')}
                  </Text>
                </View>
              </View>

              <Text style={[tw`text-[11px] sm:text-xs leading-relaxed`, { color: colors.textSecondary }]}>
                {t('soundSettings.bgFgExplanation')}
              </Text>

              {/* Quick 5s Background Test Button */}
              <TouchableOpacity
                onPress={() => {
                  onScheduleQuickTestAlarm(5);
                  onClose();
                }}
                style={[
                  tw`flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl border mt-0.5`,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                    borderColor: 'rgba(16, 185, 129, 0.4)'
                  }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('soundSettings.test5SecButton')}
              >
                <Clock size={14} color="#10B981" />
                <Text style={tw`text-xs font-semibold text-emerald-500 text-center`}>
                  {t('soundSettings.test5SecButton')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Option 1: In-App Default Sound Option */}
            <View
              style={[
                tw`p-3.5 sm:p-4 rounded-2xl border flex flex-col gap-3`,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border
                }
              ]}
            >
              <View style={tw`flex-row items-center justify-between gap-2`}>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs sm:text-sm font-bold`, { color: colors.text }]}>
                    {t('soundSettings.option1Title')}
                  </Text>
                  <Text style={[tw`text-[11px] sm:text-xs`, { color: colors.textMuted }]}>
                    {t('soundSettings.option1Subtitle')}
                  </Text>
                </View>
                <View style={tw`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-amber-500/20 border border-amber-500/30 shrink-0`}>
                  <Text style={tw`text-[10px] sm:text-[11px] font-semibold text-amber-500`}>
                    {t('soundSettings.defaultOptionBadge')}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  tw`p-3 rounded-xl border flex-row items-center justify-between gap-2`,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.borderLight
                  }
                ]}
              >
                <View style={tw`flex-row items-center gap-2.5 flex-1 min-w-0`}>
                  <View style={tw`w-8 h-8 rounded-full bg-amber-500/10 items-center justify-center shrink-0`}>
                    <Bell size={16} color="#F59E0B" />
                  </View>
                  <View style={tw`flex-1 min-w-0`}>
                    <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                      {t('soundSettings.lifeTrackDefaultSiren')}
                    </Text>
                    <Text style={[tw`text-[10px] sm:text-[11px]`, { color: colors.textMuted }]} numberOfLines={2}>
                      {t('soundSettings.sirenDescription')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => handleTogglePlayTone('default_siren')}
                  style={[
                    tw`flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shrink-0`,
                    playingTone === 'default_siren'
                      ? tw`bg-amber-500 border-amber-600`
                      : {
                          backgroundColor: colors.cardSecondary,
                          borderColor: colors.border
                        }
                  ]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('soundSettings.testPlay')}
                >
                  {playingTone === 'default_siren' ? (
                    <>
                      <Square size={12} color="#FFFFFF" />
                      <Text style={tw`text-xs font-semibold text-white`}>
                        {t('soundSettings.stop')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Play size={12} color={colors.text} />
                      <Text style={[tw`text-xs font-medium`, { color: colors.text }]}>
                        {t('soundSettings.preview')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Option 2: Choose from Phone Settings (The User's Request) */}
            <View style={tw`flex flex-col gap-3`}>
              <View style={tw`flex flex-col gap-0.5`}>
                <Text style={[tw`text-xs sm:text-sm font-bold`, { color: colors.text }]}>
                  {t('soundSettings.option2Title')}
                </Text>
                <Text style={[tw`text-[11px] sm:text-xs`, { color: colors.textMuted }]}>
                  {t('soundSettings.option2Subtitle')}
                </Text>
              </View>

              {/* Master Button to Open Phone's App Notification Settings */}
              <TouchableOpacity
                onPress={handleOpenAllAppNotificationSettings}
                style={[
                  tw`flex-row items-center justify-between p-3 sm:p-3.5 rounded-2xl border gap-2`,
                  {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                    borderColor: 'rgba(59, 130, 246, 0.35)'
                  }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('soundSettings.openMasterSettingsButton')}
              >
                <View style={tw`flex-row items-center gap-2.5 sm:gap-3 flex-1 min-w-0`}>
                  <View style={tw`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 items-center justify-center shrink-0`}>
                    <Settings size={16} color="#3B82F6" />
                  </View>
                  <View style={tw`flex-1 min-w-0`}>
                    <Text style={tw`text-xs font-bold text-blue-500`} numberOfLines={1}>
                      {t('soundSettings.openMasterSettingsButton')}
                    </Text>
                    <Text style={[tw`text-[10px] sm:text-[11px]`, { color: colors.textMuted }]} numberOfLines={1}>
                      {t('soundSettings.openMasterSettingsHint')}
                    </Text>
                  </View>
                </View>
                <ExternalLink size={15} color="#3B82F6" style={tw`shrink-0`} />
              </TouchableOpacity>

              {/* Category Channels List */}
              <View style={tw`flex flex-col gap-2.5 mt-1`}>
                <Text style={[tw`text-[11px] font-bold uppercase tracking-wider px-1`, { color: colors.textMuted }]}>
                  {t('soundSettings.channelsSectionHeader')}
                </Text>

                {channels.map((channel) => {
                  const channelColor = getChannelCategoryColor(channel.id);
                  return (
                    <View
                      key={channel.id}
                      style={[
                        tw`p-3 sm:p-3.5 rounded-xl border flex flex-col gap-2.5`,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.borderLight
                        }
                      ]}
                    >
                      <View style={tw`flex-row flex-wrap sm:flex-nowrap items-center justify-between gap-2`}>
                        <View style={tw`flex-row items-center gap-2.5 flex-1 min-w-0`}>
                          <View
                            style={[
                              tw`w-3 h-3 rounded-full shrink-0`,
                              { backgroundColor: channelColor }
                            ]}
                          />
                          <View style={tw`flex-1 min-w-0`}>
                            <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                              {channel.name}
                            </Text>
                            <Text style={[tw`text-[10px] sm:text-[11px]`, { color: colors.textMuted }]} numberOfLines={1}>
                              {channel.description}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleOpenChannelSettings(channel.id)}
                          style={[
                            tw`flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg border shrink-0`,
                            {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F4F4F5',
                              borderColor: colors.border
                            }
                          ]}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={t('soundSettings.changeToneButton')}
                        >
                          <Smartphone size={12} color={colors.textSecondary} />
                          <Text style={[tw`text-[11px] sm:text-xs font-semibold`, { color: colors.textSecondary }]}>
                            {t('soundSettings.changeToneButton')}
                          </Text>
                          <ExternalLink size={10} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>

                      <View
                        style={[
                          tw`flex-row items-center justify-between px-2.5 py-1.5 rounded-lg`,
                          { backgroundColor: colors.cardSecondary }
                        ]}
                      >
                        <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
                          {t('soundSettings.currentSound')}
                        </Text>
                        <Text style={[tw`text-[10px] sm:text-[11px] font-medium`, { color: colors.textSecondary }]}>
                          {channel.hasCustomSound
                            ? t('soundSettings.customSystemSound')
                            : t('soundSettings.defaultChannelTone')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Educational Instructions */}
            <View
              style={[
                tw`p-3.5 sm:p-4 rounded-2xl border flex flex-col gap-2`,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border
                }
              ]}
            >
              <View style={tw`flex-row items-center gap-2`}>
                <Info size={16} color={colors.textMuted} style={tw`shrink-0`} />
                <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                  {t('soundSettings.howItWorksTitle')}
                </Text>
              </View>
              <Text style={[tw`text-[11px] leading-relaxed`, { color: colors.textMuted }]}>
                {t('soundSettings.howItWorksDescription')}
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              tw`p-3.5 sm:p-4 border-t flex-row items-center justify-end`,
              {
                backgroundColor: colors.bgHeader,
                borderTopColor: colors.border
              }
            ]}
          >
            <TouchableOpacity
              onPress={onClose}
              style={[
                tw`w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 shadow-sm items-center justify-center`,
                { minHeight: 44 }
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('soundSettings.doneButton')}
            >
              <Text style={tw`text-sm font-bold text-zinc-950 text-center`}>
                {t('soundSettings.doneButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
