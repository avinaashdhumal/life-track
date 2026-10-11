import React, { useState } from 'react';
import { SafeAreaView, StatusBar, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import './i18n';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageThemeModal } from './features/poc/LanguageThemeModal';
import { getCurrentLanguage, SUPPORTED_LANGUAGES } from './i18n';
import appIcon from '../assets/icon.png';
import { AlarmTestScreen } from './features/poc/AlarmTestScreen';
import { HealthCheckScreen } from './features/poc/HealthCheckScreen';
import { FullScreenAlarmModal } from './features/poc/FullScreenAlarmModal';
import { NotificationToneSettingsModal } from './features/poc/NotificationToneSettingsModal';

import { AlarmItem } from './domain/alarm';
import { reminderService } from './services/AlarmEngineService';
import {
  Bell,
  Activity,
  Heart,
  ShieldCheck,
  Sun,
  Moon,
  Globe,
  Volume2
} from 'lucide-react-native';

function AppContent() {
  const { t } = useTranslation();
  const { colors, isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'poc_test' | 'health_check'>('poc_test');
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showToneModal, setShowToneModal] = useState(false);

  const currentLangCode = getCurrentLanguage();
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  // Global background and foreground alarm engine loop
  React.useEffect(() => {
    reminderService.requestBrowserNotificationPermission();

    const checkAlarms = async () => {
      const list = await reminderService.getScheduledAlarms();
      const now = Date.now();
      for (const item of list) {
        if (item.triggerTimeMs <= now) {
          await reminderService.cancelAlarm(item.id);
          await reminderService.logAction({
            profileId: 'default',
            alarmId: item.id,
            action: 'FIRED',
            timestampMs: now,
            scheduledTimeMs: item.triggerTimeMs,
            note: 'Alarm triggered (foreground/background engine)'
          });

          // Browser notification if app/tab is in background
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(item.title, {
                body: item.message || t('fullScreenAlarm.defaultMessage'),
                icon: typeof appIcon === 'string' ? appIcon : undefined
              });
            } catch {
              // Ignore notification fallback error
            }
          }

          setRingingAlarm(item);
          break;
        }
      }
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [t]);

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

  const handleScheduleQuickTestAlarm = async (secondsAhead: number = 5) => {
    const targetMs = Date.now() + secondsAhead * 1000;
    await reminderService.scheduleAlarm({
      id: `test_${Date.now()}`,
      triggerTimeMs: targetMs,
      title: t('soundSettings.quickTestAlarmTitle'),
      message: t('soundSettings.quickTestAlarmMessage', { seconds: secondsAhead }),
      channelId: 'medicines',
      isFullAlarm: true,
      snoozeIntervalMinutes: 5
    });
  };

  const handleSendTestAlarmInOneMinute = async () => {
    await handleScheduleQuickTestAlarm(60);
    setActiveTab('poc_test');
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={colors.statusBarStyle}
        backgroundColor={colors.statusBarBg}
      />

      {/* App Bar (Fixed at top) */}
      <View
        style={[
          tw`shrink-0 px-4 py-3 border-b flex-row items-center justify-between z-20 shadow-sm`,
          {
            backgroundColor: colors.bgHeader,
            borderBottomColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-row items-center gap-2.5`}>
          <Image
            source={typeof appIcon === 'string' ? { uri: appIcon } : appIcon}
            style={[
              tw`w-8 h-8 rounded-xl border`,
              { borderColor: colors.borderLight }
            ]}
            resizeMode="cover"
            accessible={true}
            accessibilityRole="image"
            accessibilityLabel={t('accessibility.appLogo')}
          />
          <View>
            <Text style={[tw`text-base font-bold tracking-tight`, { color: colors.text }]}>
              {t('app.name')}
            </Text>
            <Text style={[tw`text-[10px] mt-0.5`, { color: colors.textMuted }]}>
              {t('app.tagline')}
            </Text>
          </View>
        </View>

        {/* Right Action Icons: Sound, Language & Theme Controls */}
        <View style={tw`flex-row items-center gap-2`}>
          {/* Sound & Notification Tone Settings Button */}
          <TouchableOpacity
            onPress={() => setShowToneModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.soundSettingsButton')}
            style={[
              tw`p-2 rounded-xl border`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <Volume2 size={16} color="#f59e0b" />
          </TouchableOpacity>

          {/* Language Selector Button */}
          <TouchableOpacity
            onPress={() => setShowSettingsModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.selectLanguage')}
            style={[
              tw`flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-xl border`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <Globe size={14} color={colors.primary} />
            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
              {currentLang.code.toUpperCase()}
            </Text>
          </TouchableOpacity>

          {/* Theme Quick Toggle Button */}
          <TouchableOpacity
            onPress={toggleTheme}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.toggleTheme')}
            style={[
              tw`p-2 rounded-xl border`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            {isDark ? (
              <Sun size={16} color="#fbbf24" />
            ) : (
              <Moon size={16} color="#6366f1" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area (Independently Scrollable Above Fixed Navigation) */}
      <ScrollView
        style={[tw`flex-1 p-4 min-h-0`, { backgroundColor: colors.bg }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'poc_test' ? (
          <AlarmTestScreen
            onTriggerAlarmDirectly={handleTriggerAlarmDirectly}
            onOpenHealthCheck={() => setActiveTab('health_check')}
          />
        ) : (
          <HealthCheckScreen
            onBack={() => setActiveTab('poc_test')}
            onSendTestAlarmInOneMinute={handleSendTestAlarmInOneMinute}
            onOpenToneSettings={() => setShowToneModal(true)}
          />
        )}
      </ScrollView>

      {/* Bottom Tab Navigation (Fixed at Bottom) */}
      <View
        style={[
          tw`shrink-0 border-t px-2 py-2 flex-row items-center justify-around z-30 shadow-sm`,
          {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => setActiveTab('poc_test')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'poc_test' }}
          accessibilityLabel={t('accessibility.tabAlarms')}
          style={[
            tw`flex flex-col items-center gap-1 py-1 px-3 rounded-xl min-w-16 min-h-11 justify-center`,
            activeTab === 'poc_test' ? { backgroundColor: colors.primaryBg } : {}
          ]}
        >
          <Bell
            size={18}
            color={activeTab === 'poc_test' ? colors.primary : colors.textSubtle}
          />
          <Text
            style={[
              tw`text-[11px] font-medium`,
              { color: activeTab === 'poc_test' ? colors.primaryText : colors.textSubtle },
              activeTab === 'poc_test' ? tw`font-bold` : {}
            ]}
          >
            {t('tabs.alarms')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('health_check')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'health_check' }}
          accessibilityLabel={t('accessibility.tabHealthCheck')}
          style={[
            tw`flex flex-col items-center gap-1 py-1 px-3 rounded-xl min-w-16 min-h-11 justify-center`,
            activeTab === 'health_check' ? { backgroundColor: colors.primaryBg } : {}
          ]}
        >
          <ShieldCheck
            size={18}
            color={activeTab === 'health_check' ? colors.primary : colors.textSubtle}
          />
          <Text
            style={[
              tw`text-[11px] font-medium`,
              { color: activeTab === 'health_check' ? colors.primaryText : colors.textSubtle },
              activeTab === 'health_check' ? tw`font-bold` : {}
            ]}
          >
            {t('tabs.healthCheck')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={t('accessibility.tabToday')}
          style={tw`flex flex-col items-center gap-1 py-1 px-3 opacity-40 min-w-16 min-h-11 justify-center`}
        >
          <Activity size={18} color={colors.textSubtle} />
          <Text style={[tw`text-[11px]`, { color: colors.textSubtle }]}>
            {t('tabs.today')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={t('accessibility.tabHealth')}
          style={tw`flex flex-col items-center gap-1 py-1 px-3 opacity-40 min-w-16 min-h-11 justify-center`}
        >
          <Heart size={18} color={colors.textSubtle} />
          <Text style={[tw`text-[11px]`, { color: colors.textSubtle }]}>
            {t('tabs.health')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full-Screen Alarm Modal Overlay (Lockscreen Simulation) */}
      <FullScreenAlarmModal
        alarm={ringingAlarm}
        onAction={handleModalAction}
      />

      {/* Language & Theme Settings Modal */}
      <LanguageThemeModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Sound & Notification Tone Settings Modal */}
      <NotificationToneSettingsModal
        visible={showToneModal}
        onClose={() => setShowToneModal(false)}
        onScheduleQuickTestAlarm={handleScheduleQuickTestAlarm}
      />
    </SafeAreaView>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
