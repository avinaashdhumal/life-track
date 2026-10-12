import { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Alert,
  AppState,
  BackHandler,
  Linking,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet
} from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageThemeModal } from './features/settings/LanguageThemeModal';
import i18n, { getCurrentLanguage, SUPPORTED_LANGUAGES } from './i18n';
import appIcon from '../assets/icon.png';
import { TodayScreen } from './features/today/TodayScreen';
import { MedicineListScreen } from './features/medicines/MedicineListScreen';
import { AlarmTestScreen } from './features/alarms/AlarmTestScreen';
import { HealthCheckScreen } from './features/reliability/HealthCheckScreen';
import { ProfileSettingsScreen } from './features/settings/ProfileSettingsScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { FullScreenAlarmModal } from './features/alarms/FullScreenAlarmModal';
import { NotificationToneSettingsModal } from './features/alarms/NotificationToneSettingsModal';
import { RoutineSettingsModal } from './features/routine/RoutineSettingsModal';
import { ShiftScheduleScreen } from './features/shift/ShiftScheduleScreen';
import { profileRepository } from './data/profileRepository';

import { AlarmItem } from './domain/alarm';
import { reminderService } from './services/AlarmEngineService';
import { reminderCoordinator, InAppAlarmAction } from './services/reminderCoordinator';
import { storageService } from './services/StorageService';
import { runMigrations } from './services/migrations';
import {
  Bell,
  ShieldCheck,
  Sun,
  Moon,
  Globe,
  Volume2,
  User,
  MoreVertical,
  X,
  ChevronRight,
  Calendar,
  Package,
  RotateCcw,
  Briefcase
} from 'lucide-react-native';

export type MainTabType = 'today' | 'medicines' | 'poc_test' | 'health_check' | 'profile_settings';

// Deep links: lifetrack://today, lifetrack://medicines, lifetrack://alarms, lifetrack://health, lifetrack://profile
const DEEP_LINK_TABS: Record<string, MainTabType> = {
  today: 'today',
  medicines: 'medicines',
  alarms: 'poc_test',
  health: 'health_check',
  profile: 'profile_settings'
};

export function tabFromDeepLink(url: string | null): MainTabType | null {
  if (!url) return null;
  const match = /^lifetrack:\/\/([a-z_-]+)/i.exec(url.trim());
  return match ? DEEP_LINK_TABS[match[1].toLowerCase()] ?? null : null;
}

/**
 * Startup order matters: load settings into the sync cache, migrate stored data, then start the
 * reminder coordinator and top up alarms. Nothing reads app data before this finishes.
 */
async function bootstrapApp(): Promise<{ hasCompletedOnboarding: boolean }> {
  await storageService.preload();
  const migration = await runMigrations();
  const settings = await storageService.getSettings();
  if (settings.language && i18n.language !== settings.language) {
    await i18n.changeLanguage(settings.language);
  }
  reminderCoordinator.start();
  reminderCoordinator.refresh({ force: migration.alarmsNeedRebuild });
  return { hasCompletedOnboarding: settings.hasCompletedOnboarding };
}

function AppContent() {
  const { t } = useTranslation();
  const { colors, isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<MainTabType>('today');
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showToneModal, setShowToneModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  const currentLangCode = getCurrentLanguage();
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  // Bootstrap: migrations, reminder sync, onboarding status
  useEffect(() => {
    let cancelled = false;
    bootstrapApp()
      .then(({ hasCompletedOnboarding: completed }) => {
        if (!cancelled) setHasCompletedOnboarding(completed);
      })
      .catch((err) => {
        console.warn('[App] bootstrap failed:', err);
        if (!cancelled) setHasCompletedOnboarding(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ask for notification permission once the user is past onboarding
  useEffect(() => {
    if (hasCompletedOnboarding) {
      reminderService.requestNotificationPermission();
    }
  }, [hasCompletedOnboarding]);

  // Back on screen: apply notification actions taken meanwhile and top up reminders
  useEffect(() => {
    const onActive = () => {
      reminderCoordinator.refresh();
    };
    const changeSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') onActive();
    });
    // Android: pulling down the shade and tapping an action doesn't change AppState, only focus.
    // The 'focus' event exists only on Android (subscribing elsewhere throws).
    const focusSub = Platform.OS === 'android' ? AppState.addEventListener('focus', onActive) : null;
    return () => {
      changeSub.remove();
      focusSub?.remove();
    };
  }, []);

  // In-app alarm engine (only when the native engine is missing: web, Expo Go)
  useEffect(() => {
    return reminderCoordinator.startInAppEngine((item) => {
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
    });
  }, [t]);

  // Android hardware back: return to Today before leaving the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTab !== 'today') {
        setActiveTab('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeTab]);

  // Deep links (lifetrack://medicines etc.)
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        const tab = tabFromDeepLink(url);
        if (tab) setActiveTab(tab);
      })
      .catch(() => undefined);
    const sub = Linking.addEventListener('url', ({ url }) => {
      const tab = tabFromDeepLink(url);
      if (tab) setActiveTab(tab);
    });
    return () => sub.remove();
  }, []);

  const handleTriggerAlarmDirectly = (alarm: AlarmItem) => {
    setRingingAlarm(alarm);
  };

  const handleModalAction = async (action: 'TAKEN' | 'SNOOZE_10' | 'DISMISS') => {
    if (!ringingAlarm) return;
    const alarm = ringingAlarm;
    setRingingAlarm(null);
    const mapped: InAppAlarmAction = action === 'TAKEN' ? 'TAKEN' : action === 'SNOOZE_10' ? 'SNOOZE' : 'DISMISS';
    const warning = await reminderCoordinator.handleInAppAction(alarm, mapped);
    if (warning) {
      Alert.alert(t('medicines.safetyWarningTitle'), warning, [{ text: t('common.ok') }]);
    }
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

  if (hasCompletedOnboarding === null) {
    return (
      <SafeAreaView style={[tw`flex-1 items-center justify-center`, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.statusBarBg} />
        <ActivityIndicator color={colors.primary} accessibilityLabel={t('app.loading')} />
      </SafeAreaView>
    );
  }

  // If first launch and onboarding not completed, display OnboardingScreen
  if (hasCompletedOnboarding === false) {
    return (
      <SafeAreaView style={[tw`flex-1`, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.statusBarBg} />
        <OnboardingScreen
          onComplete={() => {
            setHasCompletedOnboarding(true);
            setActiveTab('today');
          }}
        />
      </SafeAreaView>
    );
  }

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

        {/* Single Top Right Menu Button */}
        <TouchableOpacity
          onPress={() => setShowTopMenu(true)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.topMenuButton')}
          style={[
            tw`p-2.5 rounded-2xl border flex-row items-center justify-center min-h-11 min-w-11 shrink-0`,
            showTopMenu
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.cardSecondary, borderColor: colors.border }
          ]}
        >
          <MoreVertical
            size={18}
            color={showTopMenu ? '#ffffff' : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={[tw`flex-1 min-h-0`, { backgroundColor: colors.bg }]}>
        {activeTab === 'today' ? (
          <TodayScreen
            onNavigateToMedicines={() => setActiveTab('medicines')}
          />
        ) : activeTab === 'medicines' ? (
          <MedicineListScreen
            onOpenPOCAlarms={() => setActiveTab('poc_test')}
          />
        ) : activeTab === 'poc_test' ? (
          <ScrollView keyboardShouldPersistTaps="handled"
            style={[tw`flex-1 p-4 min-h-0`, { backgroundColor: colors.bg }]}
            showsVerticalScrollIndicator={false}
          >
            <AlarmTestScreen
              onTriggerAlarmDirectly={handleTriggerAlarmDirectly}
              onOpenHealthCheck={() => setActiveTab('health_check')}
            />
          </ScrollView>
        ) : activeTab === 'health_check' ? (
          <ScrollView keyboardShouldPersistTaps="handled"
            style={[tw`flex-1 p-4 min-h-0`, { backgroundColor: colors.bg }]}
            showsVerticalScrollIndicator={false}
          >
            <HealthCheckScreen
              onBack={() => setActiveTab('today')}
              onSendTestAlarmInOneMinute={handleSendTestAlarmInOneMinute}
              onOpenToneSettings={() => setShowToneModal(true)}
            />
          </ScrollView>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled"
            style={[tw`flex-1 p-4 min-h-0`, { backgroundColor: colors.bg }]}
            showsVerticalScrollIndicator={false}
          >
            <ProfileSettingsScreen
              onBack={() => setActiveTab('today')}
              onOpenToneSettings={() => setShowToneModal(true)}
              onOpenHealthCheck={() => setActiveTab('health_check')}
            />
          </ScrollView>
        )}
      </View>

      {/* Bottom Tab Navigation (Fixed at Bottom with 5 core tabs) */}
      <View
        style={[
          tw`shrink-0 border-t px-1 py-2 flex-row items-center justify-around z-30 shadow-sm`,
          {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder
          }
        ]}
      >
        {/* TAB 1: Today */}
        <TouchableOpacity
          onPress={() => setActiveTab('today')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'today' }}
          accessibilityLabel={t('accessibility.tabToday')}
          style={[
            tw`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl min-w-15 min-h-11 justify-center`,
            activeTab === 'today' ? { backgroundColor: colors.primaryBg } : {}
          ]}
        >
          <Calendar
            size={18}
            color={activeTab === 'today' ? colors.primary : colors.textSubtle}
          />
          <Text
            style={[
              tw`text-[10px] font-medium`,
              { color: activeTab === 'today' ? colors.primaryText : colors.textSubtle },
              activeTab === 'today' ? tw`font-bold` : {}
            ]}
          >
            {t('tabs.today')}
          </Text>
        </TouchableOpacity>

        {/* TAB 2: Medicines */}
        <TouchableOpacity
          onPress={() => setActiveTab('medicines')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'medicines' }}
          accessibilityLabel={t('accessibility.tabMedicines')}
          style={[
            tw`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl min-w-15 min-h-11 justify-center`,
            activeTab === 'medicines' ? { backgroundColor: colors.primaryBg } : {}
          ]}
        >
          <Package
            size={18}
            color={activeTab === 'medicines' ? colors.primary : colors.textSubtle}
          />
          <Text
            style={[
              tw`text-[10px] font-medium`,
              { color: activeTab === 'medicines' ? colors.primaryText : colors.textSubtle },
              activeTab === 'medicines' ? tw`font-bold` : {}
            ]}
          >
            {t('tabs.medicines')}
          </Text>
        </TouchableOpacity>

        {/* TAB 3: Alarms & Routines */}
        <TouchableOpacity
          onPress={() => setActiveTab('poc_test')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'poc_test' }}
          accessibilityLabel={t('accessibility.tabAlarms')}
          style={[
            tw`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl min-w-15 min-h-11 justify-center`,
            activeTab === 'poc_test' ? { backgroundColor: colors.primaryBg } : {}
          ]}
        >
          <Bell
            size={18}
            color={activeTab === 'poc_test' ? colors.primary : colors.textSubtle}
          />
          <Text
            style={[
              tw`text-[10px] font-medium`,
              { color: activeTab === 'poc_test' ? colors.primaryText : colors.textSubtle },
              activeTab === 'poc_test' ? tw`font-bold` : {}
            ]}
          >
            {t('tabs.alarms')}
          </Text>
        </TouchableOpacity>

        {/* TAB 4: Health Check */}
        <TouchableOpacity
          onPress={() => setActiveTab('health_check')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'health_check' }}
          accessibilityLabel={t('accessibility.tabHealthCheck')}
          style={[
            tw`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl min-w-15 min-h-11 justify-center`,
            activeTab === 'health_check' ? { backgroundColor: colors.primaryBg } : {}
          ]}
        >
          <ShieldCheck
            size={18}
            color={activeTab === 'health_check' ? colors.primary : colors.textSubtle}
          />
          <Text
            style={[
              tw`text-[10px] font-medium`,
              { color: activeTab === 'health_check' ? colors.primaryText : colors.textSubtle },
              activeTab === 'health_check' ? tw`font-bold` : {}
            ]}
          >
            {t('tabs.healthCheck')}
          </Text>
        </TouchableOpacity>

        {/* TAB 5: Profile */}
        <TouchableOpacity
          onPress={() => setActiveTab('profile_settings')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'profile_settings' }}
          accessibilityLabel={t('tabs.profile')}
          style={[
            tw`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl min-w-15 min-h-11 justify-center`,
            activeTab === 'profile_settings' ? { backgroundColor: colors.primaryBg } : {}
          ]}
        >
          <User
            size={18}
            color={activeTab === 'profile_settings' ? colors.primary : colors.textSubtle}
          />
          <Text
            style={[
              tw`text-[10px] font-medium`,
              { color: activeTab === 'profile_settings' ? colors.primaryText : colors.textSubtle },
              activeTab === 'profile_settings' ? tw`font-bold` : {}
            ]}
          >
            {t('tabs.profile')}
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

      {/* Top Right Quick Actions Menu Modal */}
      <Modal
        visible={showTopMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTopMenu(false)}
      >
        <View style={tw`flex-1 justify-start items-end pt-16 px-4`}>
          {/* Backdrop is a sibling behind the card (not a wrapper), so menu buttons aren't nested
              inside another button and screen readers can reach each item. */}
          <Pressable
            onPress={() => setShowTopMenu(false)}
            style={[StyleSheet.absoluteFill, tw`bg-black/60`]}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.close')}
          />
          <View
            style={[
              tw`w-full max-w-xs rounded-3xl border p-4 shadow-2xl flex flex-col gap-2 overflow-hidden`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            accessibilityViewIsModal={true}
            accessibilityLabel={t('settings.quickMenu')}
          >
            {/* Header: Title & Close */}
            <View style={tw`flex-row items-center justify-between pb-3 border-b border-zinc-800/15 mb-1`}>
              <View style={tw`flex-row items-center gap-2`}>
                <View style={tw`w-7 h-7 rounded-lg bg-indigo-500/10 items-center justify-center border border-indigo-500/25`}>
                  <User size={14} color={colors.primary} />
                </View>
                <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                  {t('settings.quickMenu')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTopMenu(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.close')}
                style={tw`p-1 rounded-lg`}
              >
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Menu Item 1: Profile & Settings */}
            <TouchableOpacity
              onPress={() => {
                setShowTopMenu(false);
                setActiveTab('profile_settings');
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.profileSettingsButton')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                activeTab === 'profile_settings'
                  ? { backgroundColor: colors.primaryBg, borderColor: colors.primary }
                  : { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-xl bg-indigo-500/10 items-center justify-center border border-indigo-500/20 shrink-0`}>
                  <User size={16} color={colors.primary} />
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('profileSettings.title')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {t('settings.menuProfileDesc')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Menu Item: Daily Routine */}
            <TouchableOpacity
              onPress={() => {
                setShowTopMenu(false);
                setShowRoutineModal(true);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('routine.title', 'Daily Routine')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-xl bg-amber-500/10 items-center justify-center border border-amber-500/20 shrink-0`}>
                  <Sun size={16} color="#f59e0b" />
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('routine.title', 'Daily Routine')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {t('routine.menuDesc', 'Wake, meals, sleep milestones')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Menu Item: Shift & Schedule */}
            <TouchableOpacity
              onPress={() => {
                setShowTopMenu(false);
                setShowShiftModal(true);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('shift.title', 'Shift & Schedule')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-xl bg-indigo-500/10 items-center justify-center border border-indigo-500/20 shrink-0`}>
                  <Briefcase size={16} color="#6366f1" />
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('shift.title', 'Shift & Schedule')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {t('shift.menuDesc', 'Rotating shifts & 90-day calendar')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Menu Item 2: Sound & Tones */}
            <TouchableOpacity
              onPress={() => {
                setShowTopMenu(false);
                setShowToneModal(true);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.soundSettingsButton')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-full bg-amber-500/10 items-center justify-center shrink-0`}>
                  <Volume2 size={16} color="#f59e0b" />
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('soundSettings.button')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {t('soundSettings.title')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Menu Item 3: Language Selector */}
            <TouchableOpacity
              onPress={() => {
                setShowTopMenu(false);
                setShowSettingsModal(true);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.selectLanguage')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-full bg-indigo-500/10 items-center justify-center shrink-0`}>
                  <Globe size={16} color={colors.primary} />
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('settings.language')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {currentLang.flag} {currentLang.nativeName}
                  </Text>
                </View>
              </View>
              <View style={tw`px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700`}>
                <Text style={tw`text-[10px] font-bold text-zinc-300 font-mono`}>
                  {currentLang.code.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Menu Item 4: Theme Toggle (Instant 1-Tap Switch) */}
            <TouchableOpacity
              onPress={toggleTheme}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.toggleTheme')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-full items-center justify-center shrink-0 bg-amber-500/10`}>
                  {isDark ? (
                    <Sun size={16} color="#fbbf24" />
                  ) : (
                    <Moon size={16} color="#6366f1" />
                  )}
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('settings.theme')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {isDark ? t('theme.dark') : t('theme.light')}
                  </Text>
                </View>
              </View>
              <View style={tw`px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-800`}>
                <Text style={tw`text-[10px] font-bold text-zinc-300`}>
                  {isDark ? `🌙 ${t('theme.dark')}` : `☀️ ${t('theme.light')}`}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Menu Item 5: System Health Check Shortcut */}
            <TouchableOpacity
              onPress={() => {
                setShowTopMenu(false);
                setActiveTab('health_check');
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.tabHealthCheck')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                activeTab === 'health_check'
                  ? { backgroundColor: colors.primaryBg, borderColor: colors.primary }
                  : { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-xl bg-emerald-500/10 items-center justify-center border border-emerald-500/20 shrink-0`}>
                  <ShieldCheck size={16} color="#10b981" />
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('healthCheck.systemHealth')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {t('healthCheck.menuDesc')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Menu Item 6: Test / Re-run Onboarding */}
            <TouchableOpacity
              onPress={async () => {
                setShowTopMenu(false);
                await profileRepository.setCompletedOnboarding(false);
                setHasCompletedOnboarding(false);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.rerunLabel')}
              style={[
                tw`p-3 rounded-2xl border flex-row items-center justify-between min-h-12`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
                <View style={tw`w-8 h-8 rounded-xl bg-sky-500/10 items-center justify-center border border-sky-500/20 shrink-0`}>
                  <RotateCcw size={16} color="#0284c7" />
                </View>
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    {t('onboarding.rerunTitle')}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {t('onboarding.rerunDesc')}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Daily Routine Settings Modal */}
      {showRoutineModal && (
        <RoutineSettingsModal
          visible={showRoutineModal}
          onClose={() => setShowRoutineModal(false)}
        />
      )}

      {/* Shift & Schedule Engine Screen */}
      {showShiftModal && (
        <ShiftScheduleScreen
          visible={showShiftModal}
          onClose={() => setShowShiftModal(false)}
        />
      )}
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
