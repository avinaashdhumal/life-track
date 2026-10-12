import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { AlarmItem } from '../../domain/alarm';
import { startAlarmSound, stopAlarmSound } from '../../utils/audioAlarm';
import { Bell, CheckCircle, Clock, XCircle, Volume2, ShieldAlert } from 'lucide-react-native';

import { storageService } from '../../services/StorageService';

interface FullScreenAlarmModalProps {
  alarm: AlarmItem | null;
  onAction: (action: 'TAKEN' | 'SNOOZE_10' | 'DISMISS') => void;
}

export const FullScreenAlarmModal: React.FC<FullScreenAlarmModalProps> = ({
  alarm,
  onAction
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (alarm) {
      const userTone = storageService.getSyncSetting('alarmTone') || 'default_siren';
      const tone = (alarm.channelId === 'exercise' || alarm.channelId === 'water_meals' || alarm.channelId === 'habits')
        ? 'gentle_chime'
        : userTone;
      startAlarmSound(tone);
    } else {
      stopAlarmSound();
    }
    return () => {
      stopAlarmSound();
    };
  }, [alarm]);

  if (!alarm) return null;

  const snoozeMins = alarm.snoozeIntervalMinutes || 10;

  return (
    <View
      style={tw`absolute inset-0 z-50 flex flex-col items-center justify-between bg-zinc-950 p-6`}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`${alarm.title}, ${alarm.message || t('fullScreenAlarm.defaultMessage')}`}
    >
      {/* Top Banner: Native Lockscreen Emulation Badge */}
      <View style={tw`w-full flex-row items-center justify-between pt-4 pb-2 border-b border-zinc-800`}>
        <View style={tw`flex-row items-center gap-2`}>
          <View style={tw`w-2.5 h-2.5 rounded-full bg-emerald-500`} />
          <Text style={tw`text-xs font-semibold tracking-wider text-emerald-400 uppercase`}>
            {t('fullScreenAlarm.nativeOverlay')}
          </Text>
        </View>
        <View
          style={tw`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800`}
          accessible={true}
          accessibilityLabel={t('fullScreenAlarm.ringtoneActive')}
        >
          <Volume2 size={14} color="#fbbf24" />
          <Text style={tw`text-[11px] text-zinc-300 font-medium`}>
            {t('fullScreenAlarm.ringtoneActive')}
          </Text>
        </View>
      </View>

      {/* Main Alert Card */}
      <ScrollView
        style={tw`w-full my-auto`}
        contentContainerStyle={tw`flex flex-col items-center justify-center py-4`}
        showsVerticalScrollIndicator={false}
      >
        <View style={tw`flex flex-col items-center max-w-sm w-full`}>
          <View style={tw`relative mb-6`}>
            <View style={tw`w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center`}>
              <Bell size={48} color="#fbbf24" />
            </View>
            <View style={tw`absolute -top-1 -right-1 h-4 w-4`}>
              <View style={tw`absolute h-full w-full rounded-full bg-red-400 opacity-75`} />
              <View style={tw`relative rounded-full h-4 w-4 bg-red-500`} />
            </View>
          </View>

          <View style={tw`px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 mb-3`}>
            <Text style={tw`text-xs text-amber-300 font-medium`}>
              {t('fullScreenAlarm.channel', { channel: alarm.channelId.toUpperCase() })}
            </Text>
          </View>

          <Text style={tw`text-2xl font-bold tracking-tight text-white mb-2 text-center`}>
            {alarm.title}
          </Text>

          <Text style={tw`text-sm text-zinc-300 mb-6 leading-relaxed text-center`}>
            {alarm.message || t('fullScreenAlarm.defaultMessage')}
          </Text>

          <View style={tw`p-3 bg-zinc-900 rounded-xl border border-zinc-800 w-full flex-row items-start gap-2.5 mb-2`}>
            <ShieldAlert size={16} color="#34d399" style={tw`shrink-0 mt-0.5`} />
            <Text style={tw`text-xs text-zinc-400 flex-1`}>
              <Text style={tw`font-semibold text-zinc-200`}>
                {t('fullScreenAlarm.bypassesDoze')}:{' '}
              </Text>
              {t('fullScreenAlarm.bypassesDozeDescription')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Primary 3 Action Buttons */}
      <View style={tw`w-full max-w-sm flex-col gap-3 pb-6`}>
        <TouchableOpacity
          onPress={() => {
            stopAlarmSound();
            onAction('TAKEN');
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.takenAction')}
          style={tw`w-full py-4 px-6 rounded-2xl bg-emerald-600 active:bg-emerald-700 flex-row items-center justify-center gap-2 shadow-lg min-h-12`}
        >
          <CheckCircle size={20} color="#ffffff" />
          <Text style={tw`text-white font-bold text-base`}>
            {t('fullScreenAlarm.taken')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            stopAlarmSound();
            onAction('SNOOZE_10');
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.snoozeAction')}
          style={tw`w-full py-3.5 px-6 rounded-2xl bg-amber-600 active:bg-amber-700 flex-row items-center justify-center gap-2 shadow-md min-h-12`}
        >
          <Clock size={16} color="#ffffff" />
          <Text style={tw`text-white font-bold text-sm`}>
            {t('fullScreenAlarm.snooze', { minutes: snoozeMins })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            stopAlarmSound();
            onAction('DISMISS');
          }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.dismissAction')}
          style={tw`w-full py-3 px-6 rounded-2xl bg-zinc-800 active:bg-zinc-700 flex-row items-center justify-center gap-2 border border-zinc-700 min-h-12`}
        >
          <XCircle size={16} color="#d4d4d8" />
          <Text style={tw`text-zinc-200 font-medium text-sm`}>
            {t('fullScreenAlarm.dismiss')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
