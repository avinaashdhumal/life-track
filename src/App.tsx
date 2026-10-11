import React, { useState } from 'react';
import { SafeAreaView, StatusBar, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import tw from 'twrnc';
import appIcon from '../assets/icon.png';
import { AlarmTestScreen } from './features/poc/AlarmTestScreen';
import { HealthCheckScreen } from './features/poc/HealthCheckScreen';
import { FullScreenAlarmModal } from './features/poc/FullScreenAlarmModal';
import { NativeCodeInspectorModal } from './features/poc/NativeCodeInspectorModal';
import { AlarmItem } from './domain/alarm';
import { reminderService } from './services/AlarmEngineService';
import {
  Bell,
  Activity,
  Heart,
  ShieldCheck
} from 'lucide-react-native';

export function App() {
  const [activeTab, setActiveTab] = useState<'poc_test' | 'health_check'>('poc_test');
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [showCodeInspector, setShowCodeInspector] = useState(false);

  const handleTriggerAlarmDirectly = (alarm: AlarmItem) => {
    setRingingAlarm(alarm);
  };

  const handleModalAction = async (action: 'TAKEN' | 'SNOOZE_10' | 'DISMISS') => {
    if (!ringingAlarm) return;
    const now = Date.now();

    if (action === 'TAKEN') {
      await reminderService.logAction({
        profileId: 'default',
        alarmId: ringingAlarm.id,
        action: 'TAKEN',
        timestampMs: now,
        scheduledTimeMs: ringingAlarm.triggerTimeMs,
        note: `${ringingAlarm.title} marked taken by user`
      });
      await reminderService.cancelAlarm(ringingAlarm.id);
    } else if (action === 'SNOOZE_10') {
      const snoozeTarget = now + 10 * 60 * 1000;
      await reminderService.logAction({
        profileId: 'default',
        alarmId: ringingAlarm.id,
        action: 'SNOOZED',
        timestampMs: now,
        scheduledTimeMs: ringingAlarm.triggerTimeMs,
        note: `Snoozed for 10 minutes (until ${new Date(snoozeTarget).toLocaleTimeString()})`
      });
      // Re-schedule for 10m
      await reminderService.scheduleAlarm({
        id: `${ringingAlarm.id}_snooze`,
        triggerTimeMs: snoozeTarget,
        title: `${ringingAlarm.title} (Snoozed)`,
        message: ringingAlarm.message,
        channelId: ringingAlarm.channelId,
        isFullAlarm: ringingAlarm.style === 'full_alarm',
        snoozeIntervalMinutes: 10
      });
    } else {
      await reminderService.logAction({
        profileId: 'default',
        alarmId: ringingAlarm.id,
        action: 'DISMISSED',
        timestampMs: now,
        scheduledTimeMs: ringingAlarm.triggerTimeMs,
        note: 'Alarm dismissed / skipped'
      });
    }

    setRingingAlarm(null);
  };

  const handleSendTestAlarmInOneMinute = async () => {
    const targetMs = Date.now() + 60 * 1000;
    await reminderService.scheduleAlarm({
      id: `health_test_${Date.now()}`,
      triggerTimeMs: targetMs,
      title: 'Health Check 1-Min Test',
      message: 'Verifying AlarmManager setAlarmClock reliability',
      channelId: 'medicines',
      isFullAlarm: true,
      snoozeIntervalMinutes: 5
    });
    setActiveTab('poc_test');
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-zinc-950`}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      
      {/* App Bar (Fixed at top) */}
        <View style={tw`shrink-0 px-5 py-3 border-b border-zinc-800/80 flex-row items-center justify-between bg-zinc-900/95 z-20`}>
          <View>
            <View style={tw`flex-row items-center gap-2.5`}>
              <Image
                source={typeof appIcon === 'string' ? { uri: appIcon } : appIcon}
                style={tw`w-7 h-7 rounded-lg border border-zinc-700/60`}
                resizeMode="cover"
              />
              <Text style={tw`text-base font-bold text-white tracking-tight`}>LifeTrack</Text>
            </View>
            <Text style={tw`text-[10px] text-zinc-400 mt-0.5`}>Offline Health & Life Tracker</Text>
          </View>
        </View>

        {/* Main Content Area (Independently Scrollable Above Fixed Navigation) */}
        <ScrollView style={tw`flex-1 p-4 min-h-0`}>
          {activeTab === 'poc_test' ? (
            <AlarmTestScreen
              onTriggerAlarmDirectly={handleTriggerAlarmDirectly}
              onOpenHealthCheck={() => setActiveTab('health_check')}
            />
          ) : (
            <HealthCheckScreen
              onBack={() => setActiveTab('poc_test')}
              onSendTestAlarmInOneMinute={handleSendTestAlarmInOneMinute}
            />
          )}
        </ScrollView>

        {/* Bottom Tab Navigation (Fixed at Bottom) */}
        <View style={tw`shrink-0 border-t border-zinc-800 bg-zinc-950 px-2 py-2 flex-row items-center justify-around z-30`}>
          <TouchableOpacity
            onPress={() => setActiveTab('poc_test')}
            style={tw`flex flex-col items-center gap-1 py-1 px-3 rounded-xl`}
          >
            <Bell size={16} color={activeTab === 'poc_test' ? tw.color('indigo-400') : tw.color('zinc-500')} />
            <Text style={tw`text-[10px] ${activeTab === 'poc_test' ? 'text-indigo-400 font-semibold' : 'text-zinc-500'}`}>Alarms (PoC)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('health_check')}
            style={tw`flex flex-col items-center gap-1 py-1 px-3 rounded-xl`}
          >
            <ShieldCheck size={16} color={activeTab === 'health_check' ? tw.color('indigo-400') : tw.color('zinc-500')} />
            <Text style={tw`text-[10px] ${activeTab === 'health_check' ? 'text-indigo-400 font-semibold' : 'text-zinc-500'}`}>Health Check</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled
            style={tw`flex flex-col items-center gap-1 py-1 px-3 opacity-40`}
          >
            <Activity size={16} color={tw.color('zinc-500')} />
            <Text style={tw`text-[10px] text-zinc-500`}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled
            style={tw`flex flex-col items-center gap-1 py-1 px-3 opacity-40`}
          >
            <Heart size={16} color={tw.color('zinc-500')} />
            <Text style={tw`text-[10px] text-zinc-500`}>Health</Text>
          </TouchableOpacity>

        </View>

      {/* Full-Screen Alarm Modal Overlay (Lockscreen Simulation) */}
      <FullScreenAlarmModal
        alarm={ringingAlarm}
        onAction={handleModalAction}
      />

      {/* Native Code and Device Testing Guide Inspector */}
      {showCodeInspector && (
        <NativeCodeInspectorModal
          onClose={() => setShowCodeInspector(false)}
        />
      )}
    </SafeAreaView>
  );
}

export default App;
