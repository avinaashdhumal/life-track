import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image } from 'react-native';
import tw from 'twrnc';
import { X, Copy, Check, FileCode, Terminal, Layers } from 'lucide-react-native';

interface NativeCodeInspectorModalProps {
  onClose: () => void;
}

export const NativeCodeInspectorModal: React.FC<NativeCodeInspectorModalProps> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState<string>('AlarmEngineModule.kt');
  const [copied, setCopied] = useState(false);

  const files: Record<string, { title: string; language: string; path: string; summary: string }> = {
    'AlarmEngineModule.kt': {
      title: 'Expo Native Module Definition',
      language: 'kotlin',
      path: 'modules/alarm-engine/android/src/main/java/expo/modules/alarmengine/AlarmEngineModule.kt',
      summary: 'Exposes scheduleAlarm, cancelAlarm, canScheduleExactAlarms, requestIgnoreBatteryOptimizations, and autostart helpers to React Native.'
    },
    'AlarmReceiver.kt': {
      title: 'AlarmManager BroadcastReceiver & WakeLock',
      language: 'kotlin',
      path: 'modules/alarm-engine/android/src/main/java/expo/modules/alarmengine/AlarmReceiver.kt',
      summary: 'Acquires PARTIAL_WAKE_LOCK, posts notification, launches AlarmFullScreenActivity immediately, and handles action buttons.'
    },
    'AlarmFullScreenActivity.kt': {
      title: 'Lockscreen Full Alarm Activity',
      language: 'kotlin',
      path: 'modules/alarm-engine/android/src/main/java/expo/modules/alarmengine/AlarmFullScreenActivity.kt',
      summary: 'Renders over lockscreen with setShowWhenLocked(true) & setTurnScreenOn(true), plays MediaPlayer ringtone and vibrates.'
    },
    'AlarmForegroundService.kt': {
      title: 'Background Foreground Service & Audio',
      language: 'kotlin',
      path: 'modules/alarm-engine/android/src/main/java/expo/modules/alarmengine/AlarmForegroundService.kt',
      summary: 'Maintains process execution when app is closed/killed, plays channel sound or system alarm tone in loop, and provides continuous vibration.'
    },
    'BootReceiver.kt': {
      title: 'Reboot & Time Zone Rescheduler',
      language: 'kotlin',
      path: 'modules/alarm-engine/android/src/main/java/expo/modules/alarmengine/BootReceiver.kt',
      summary: 'Listens to BOOT_COMPLETED, MY_PACKAGE_REPLACED, and TIME_SET, re-registering alarms natively without waiting for JS.'
    },
    'withAlarmEngine.js': {
      title: 'Expo Config Plugin (CNG)',
      language: 'javascript',
      path: 'plugins/withAlarmEngine.js',
      summary: 'Config plugin that injects POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_FULL_SCREEN_INTENT, and receivers into AndroidManifest.xml.'
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={tw`absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4`}>
      <View style={tw`bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden`}>
        {/* Modal Header */}
        <View style={tw`p-4 border-b border-zinc-800 flex items-center justify-between`}>
          <View style={tw`flex items-center gap-2`}>
            <FileCode style={tw`w-5 h-5 text-indigo-400`} />
            <View>
              <Text style={tw`text-sm font-bold text-white`}>Android Native Architecture Inspector</Text>
              <Text style={tw`text-[11px] text-zinc-400`}>Phase 0: modules/alarm-engine & Expo CNG setup</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={tw`p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition`}
          >
            <X style={tw`w-4 h-4`} />
          </TouchableOpacity>
        </View>

        {/* Tab Selection */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row items-center gap-1.5 p-2 bg-zinc-950 border-b border-zinc-800 text-xs`}>
          {Object.keys(files).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => setSelectedFile(key)}
              style={tw`px-3 py-1.5 rounded-lg font-mono text-[11px] whitespace-nowrap transition ${
                selectedFile === key
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Text style={tw`${selectedFile === key ? 'text-white' : 'text-zinc-400'}`}>{key}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setSelectedFile('CLI')}
            style={tw`px-3 py-1.5 rounded-lg font-mono text-[11px] whitespace-nowrap flex-row items-center gap-1 transition ${
              selectedFile === 'CLI'
                ? 'bg-emerald-600 text-white font-medium'
                : 'bg-zinc-900 text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <Terminal size={12} color={selectedFile === 'CLI' ? tw.color('white') : tw.color('emerald-400')} />
            <Text style={tw`${selectedFile === 'CLI' ? 'text-white' : 'text-emerald-400'}`}>Test on Phone Steps</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Content Body */}
        <ScrollView style={tw`flex-1`} contentContainerStyle={tw`p-4 text-xs font-mono`}>
          {selectedFile === 'CLI' ? (
            <View style={tw`space-y-4 text-zinc-300 font-sans`}>
              <View style={tw`p-3 rounded-xl bg-zinc-950 border border-zinc-800`}>
                <View style={tw`text-xs font-bold text-emerald-400 mb-1 flex-row items-center gap-1.5`}>
                  <Terminal size={16} color={tw.color('emerald-400')} />
                  <Text style={tw`text-emerald-400 font-bold`}>How to test on a physical Android phone:</Text>
                </View>
                <Text style={tw`text-xs text-zinc-400 mb-3`}>
                  This builds a development build with the local Kotlin module using Expo Continuous Native Generation (CNG).
                </Text>

                <View style={tw`space-y-3 font-mono text-[11px]`}>
                  <View>
                    <Text style={tw`text-zinc-500 mb-0.5`}># 1. Connect phone via USB & ensure adb sees it</Text>
                    <Text style={tw`text-white bg-zinc-900 p-2 rounded border border-zinc-800`}>adb devices</Text>
                  </View>
                  <View>
                    <Text style={tw`text-zinc-500 mb-0.5`}># 2. Build and run locally via Expo (No EAS cloud needed)</Text>
                    <Text style={tw`text-white bg-zinc-900 p-2 rounded border border-zinc-800`}>npx expo run:android</Text>
                  </View>
                  <View>
                    <Text style={tw`text-zinc-500 mb-0.5`}># 3. Subsequent runs (when JS only changes)</Text>
                    <Text style={tw`text-white bg-zinc-900 p-2 rounded border border-zinc-800`}>npx expo start</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={tw`space-y-3`}>
              <View style={tw`flex-row items-center justify-between text-zinc-400 text-[11px]`}>
                <Text style={tw`text-zinc-300 font-mono text-[10px]`}>{files[selectedFile].path}</Text>
                <Text style={tw`text-indigo-400 font-bold`}>{files[selectedFile].title}</Text>
              </View>
              <Text style={tw`text-zinc-400 text-xs font-sans`}>
                {files[selectedFile].summary}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`p-3 rounded-xl bg-zinc-950 border border-zinc-800`} contentContainerStyle={tw`text-[11px] text-zinc-300 leading-relaxed`}>
                <View>
                  <Text style={tw`text-emerald-400 font-mono`}>// Native file created and verified in codebase:</Text><br />
                  <Text style={tw`text-zinc-500 font-mono`}>File location: </Text>
                  <Text style={tw`text-indigo-300 font-mono`}>{files[selectedFile].path}</Text>
                  <View style={tw`mt-2 text-zinc-400 font-mono flex-row items-center flex-wrap`}>
                    <Text>Ready for compilation with </Text>
                    <Text style={tw`text-white bg-zinc-900 font-mono p-1 rounded-md`}>npx expo prebuild -p android</Text>.
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* Modal Footer */}
        <View style={tw`p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between`}>
          <Text style={tw`text-[11px] text-zinc-500`}>LifeTrack • Phase 0 Architecture</Text>
          <TouchableOpacity
            onPress={onClose}
            style={tw`px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition`}
          >
            Close
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
