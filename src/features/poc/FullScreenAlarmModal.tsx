import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image } from 'react-native';
import tw from 'twrnc';
import { AlarmItem } from '../../domain/alarm';
import { startAlarmSound, stopAlarmSound } from '../../utils/audioAlarm';
import { Bell, CheckCircle, Clock, XCircle, Volume2, ShieldAlert } from 'lucide-react-native';

interface FullScreenAlarmModalProps {
  alarm: AlarmItem | null;
  onAction: (action: 'TAKEN' | 'SNOOZE_10' | 'DISMISS') => void;
}

export const FullScreenAlarmModal: React.FC<FullScreenAlarmModalProps> = ({
  alarm,
  onAction
}) => {
  useEffect(() => {
    if (alarm) {
      startAlarmSound();
    } else {
      stopAlarmSound();
    }
    return () => {
      stopAlarmSound();
    };
  }, [alarm]);

  if (!alarm) return null;

  return (
    <View style={tw`absolute inset-0 z-50 flex flex-col items-center justify-between bg-zinc-950 p-6`}>
      {/* Top Banner: Native Lockscreen Emulation Badge */}
      <View style={tw`w-full flex-row items-center justify-between pt-4 pb-2 border-b border-zinc-800`}>
        <View style={tw`flex-row items-center gap-2`}>
          <View style={tw`w-2.5 h-2.5 rounded-full bg-emerald-500`} />
          <Text style={tw`text-xs font-semibold tracking-wider text-emerald-400 uppercase`}>
            Android Native Alarm Overlay
          </Text>
        </View>
        <View style={tw`flex-row items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800`}>
          <Volume2 size={14} color={tw.color('amber-400')} />
          <Text style={tw`text-[11px] text-zinc-300`}>Ringtone Active</Text>
        </View>
      </View>

      {/* Main Alert Card */}
      <ScrollView style={tw`w-full my-auto`} contentContainerStyle={tw`flex flex-col items-center justify-center py-4`} showsVerticalScrollIndicator={false}>
        <View style={tw`flex flex-col items-center max-w-sm w-full`}>
          <View style={tw`relative mb-6`}>
            <View style={tw`w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center`}>
              <Bell size={48} color={tw.color('amber-400')} />
            </View>
            <View style={tw`absolute -top-1 -right-1 h-4 w-4`}>
              <View style={tw`absolute h-full w-full rounded-full bg-red-400 opacity-75`}></View>
              <View style={tw`relative rounded-full h-4 w-4 bg-red-500`}></View>
            </View>
          </View>

          <View style={tw`px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 mb-3`}>
            <Text style={tw`text-xs text-amber-300 font-medium`}>Channel: {alarm.channelId.toUpperCase()}</Text>
          </View>

          <Text style={tw`text-2xl font-bold tracking-tight text-white mb-2 text-center`}>
            {alarm.title}
          </Text>

          <Text style={tw`text-sm text-zinc-400 mb-6 leading-relaxed text-center`}>
            {alarm.message || 'Scheduled dose / life reminder is due now.'}
          </Text>

          <View style={tw`p-3 bg-zinc-900 rounded-xl border border-zinc-800 w-full flex-row items-start gap-2.5 mb-2`}>
            <ShieldAlert size={16} color={tw.color('emerald-400')} style={tw`shrink-0 mt-0.5`} />
            <Text style={tw`text-xs text-zinc-400 flex-1`}>
              <Text style={tw`font-semibold text-zinc-200`}>Bypasses Doze Mode:</Text> This full-screen alarm fires over lock screen via <Text style={tw`text-emerald-300 font-mono`}>setAlarmClock()</Text> and native <Text style={tw`text-emerald-300 font-mono`}>AlarmFullScreenActivity</Text>.
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
          style={tw`w-full py-4 px-6 rounded-2xl bg-emerald-600 flex-row items-center justify-center gap-2 shadow-lg`}
        >
          <CheckCircle size={20} color={tw.color('white')} />
          <Text style={tw`text-white font-semibold text-base`}>✓ Taken / Done</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            stopAlarmSound();
            onAction('SNOOZE_10');
          }}
          style={tw`w-full py-3.5 px-6 rounded-2xl bg-amber-600 flex-row items-center justify-center gap-2 shadow-md`}
        >
          <Clock size={16} color={tw.color('white')} />
          <Text style={tw`text-white font-semibold text-sm`}>Snooze {alarm.snoozeIntervalMinutes || 10} Minutes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            stopAlarmSound();
            onAction('DISMISS');
          }}
          style={tw`w-full py-3 px-6 rounded-2xl bg-zinc-800 flex-row items-center justify-center gap-2 border border-zinc-700`}
        >
          <XCircle size={16} color={tw.color('zinc-300')} />
          <Text style={tw`text-zinc-300 font-medium text-sm`}>Dismiss / Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
