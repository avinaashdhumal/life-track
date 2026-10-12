import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, AppState } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { reminderService } from '../../services/AlarmEngineService';
import { HealthCheckStatus, AlarmItem } from '../../domain/alarm';
import {
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Clock,
  Battery,
  Bell,
  Smartphone,
  ExternalLink,
  ChevronLeft,
  RefreshCw,
  Database,
  Maximize
} from 'lucide-react-native';

async function fetchHealthData(): Promise<{ status: HealthCheckStatus; alarms: AlarmItem[] }> {
  const [status, alarms] = await Promise.all([reminderService.getHealthCheck(), reminderService.getScheduledAlarms()]);
  return { status, alarms };
}

interface HealthCheckScreenProps {
  onBack: () => void;
  onSendTestAlarmInOneMinute: () => void;
  onOpenToneSettings?: () => void;
}

export const HealthCheckScreen: React.FC<HealthCheckScreenProps> = ({
  onBack,
  onSendTestAlarmInOneMinute,
  onOpenToneSettings
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [status, setStatus] = useState<HealthCheckStatus | null>(null);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [brandOverride, setBrandOverride] = useState<string>('auto');

  const loadHealthData = async () => {
    const data = await fetchHealthData();
    setStatus(data.status);
    setAlarms(data.alarms);
  };

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchHealthData()
        .then((data) => {
          if (!active) return;
          setStatus(data.status);
          setAlarms(data.alarms);
        })
        .catch(() => undefined);
    };
    load();
    // Re-check after the user returns from a system settings screen.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const handleOpenFullScreenSettings = async () => {
    await reminderService.openFullScreenIntentSettings();
  };

  const handleOpenNotificationSettings = async () => {
    if (status && !status.notificationsAllowed) {
      const granted = await reminderService.requestNotificationPermission();
      if (!granted) await reminderService.openAppNotificationSettings();
      loadHealthData();
      return;
    }
    handleOpenToneSettings();
  };

  const handleOpenExactAlarmSettings = async () => {
    await reminderService.openExactAlarmSettings();
  };

  const handleRequestBatteryExemption = async () => {
    await reminderService.requestIgnoreBatteryOptimizations();
  };

  const handleOpenAutostartSettings = async () => {
    await reminderService.openAutostartSettings();
  };

  const handleOpenToneSettings = () => {
    if (onOpenToneSettings) {
      onOpenToneSettings();
    } else {
      reminderService.openAppNotificationSettings();
    }
  };

  const detectedBrand = (brandOverride !== 'auto' ? brandOverride : status?.manufacturer || 'generic').toLowerCase();

  const getBrandInstructions = () => {
    if (detectedBrand.includes('xiaomi') || detectedBrand.includes('redmi') || detectedBrand.includes('poco')) {
      return {
        brand: 'Xiaomi / Redmi / Poco (MIUI / HyperOS)',
        steps: [
          'Enable "Autostart" in Settings > Apps > Manage Apps > LifeTrack > Autostart.',
          'Set Battery Saver to "No restrictions" so MIUI does not kill background alarms.',
          'Lock the app in the Recent Apps tray (tap & hold LifeTrack preview and tap the Padlock icon).'
        ]
      };
    }
    if (detectedBrand.includes('samsung')) {
      return {
        brand: 'Samsung (One UI)',
        steps: [
          'Go to Settings > Battery and device care > Battery > Background usage limits.',
          'Add LifeTrack to "Never sleeping apps".',
          'Disable "Put unused apps to sleep".'
        ]
      };
    }
    if (detectedBrand.includes('oneplus') || detectedBrand.includes('oppo') || detectedBrand.includes('realme')) {
      return {
        brand: 'OnePlus / Oppo / Realme (ColorOS / OxygenOS)',
        steps: [
          'Settings > Apps > App Management > LifeTrack > Battery usage > Allow background activity & Allow auto-launch.',
          'Disable "Deep optimization" or "Sleep standby optimization".'
        ]
      };
    }
    if (detectedBrand.includes('vivo') || detectedBrand.includes('iqoo')) {
      return {
        brand: 'Vivo / iQOO (Funtouch OS / OriginOS)',
        steps: [
          'Settings > Battery > High background power consumption > Allow LifeTrack.',
          'Settings > Applications and Permissions > Permission Management > Autostart > Enable LifeTrack.'
        ]
      };
    }
    return {
      brand: 'Standard Android (Pixel / Motorola / Other)',
      steps: [
        'Allow "Schedule exact alarms" in App Settings.',
        'Set Battery usage to "Unrestricted" so alarms ring during deep Doze mode.'
      ]
    };
  };

  const brandInfo = getBrandInstructions();

  return (
    <View style={tw`flex flex-col gap-5 pb-12`}>
      {/* Top Header Buttons */}
      <View style={tw`flex-row items-center justify-between`}>
        <TouchableOpacity
          onPress={onBack}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('healthCheck.back')}
          style={[
            tw`flex-row items-center gap-2 px-4 py-2.5 rounded-xl border min-h-11`,
            {
              backgroundColor: colors.card,
              borderColor: colors.border
            }
          ]}
        >
          <ChevronLeft size={18} color={colors.text} />
          <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
            {t('healthCheck.back')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={loadHealthData}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('healthCheck.refresh')}
          style={[
            tw`flex-row items-center gap-2 px-4 py-2.5 rounded-xl border min-h-11`,
            {
              backgroundColor: colors.card,
              borderColor: colors.border
            }
          ]}
        >
          <RefreshCw size={15} color={colors.primary} />
          <Text style={[tw`text-sm font-semibold`, { color: colors.primaryText }]}>
            {t('healthCheck.refresh')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Health Card */}
      <View
        style={[
          tw`rounded-3xl p-5 shadow-sm border`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-row items-start justify-between mb-5`}>
          <View>
            <View style={tw`flex-row items-center gap-2 mb-1`}>
              <ShieldCheck size={26} color="#10b981" />
              <Text style={[tw`text-xl font-bold tracking-tight`, { color: colors.text }]}>
                {t('healthCheck.title')}
              </Text>
            </View>
            <Text style={[tw`text-sm mt-1`, { color: colors.textMuted }]}>
              {t('healthCheck.subtitle')}
            </Text>
          </View>
        </View>

        {/* 3 Vital Health Indicators */}
        <View style={tw`flex-col gap-3 mb-5`}>
          {/* 1. Exact Alarms */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex flex-col justify-between`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Clock size={16} color={colors.primary} />
                <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                  {t('healthCheck.exactAlarms')}
                </Text>
              </View>
              {status?.exactAlarmsAllowed ? (
                <CheckCircle size={20} color="#10b981" />
              ) : (
                <AlertCircle size={20} color="#f59e0b" />
              )}
            </View>
            <Text style={[tw`text-xs mb-3`, { color: colors.textMuted }]}>
              {status?.exactAlarmsAllowed
                ? `${t('healthCheck.allowed')}: ${t('healthCheck.exactAllowedDesc')}`
                : `${t('healthCheck.denied')}: ${t('healthCheck.exactDeniedDesc')}`}
            </Text>
            <TouchableOpacity
              onPress={handleOpenExactAlarmSettings}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${t('healthCheck.openSettings')}: ${t('healthCheck.exactAlarms')}`}
              style={[
                tw`mt-auto w-full py-2.5 rounded-xl items-center justify-center border`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('healthCheck.openSettings')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 2. Notifications & Sound Channels */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex flex-col justify-between`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Bell size={16} color={colors.primary} />
                <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                  {t('healthCheck.notifications')}
                </Text>
              </View>
              {status?.notificationsAllowed === false ? (
                <AlertCircle size={20} color="#ef4444" />
              ) : (
                <CheckCircle size={20} color="#10b981" />
              )}
            </View>
            <Text style={[tw`text-xs mb-3`, { color: colors.textMuted }]}>
              {status?.notificationsAllowed === false
                ? `${t('healthCheck.denied')}: ${t('healthCheck.notificationsDeniedDesc')}`
                : `${status?.notificationChannelsCount || 7} ${t('soundSettings.channelsSectionHeader')} (${t('healthCheck.allowed')})`}
            </Text>
            <TouchableOpacity
              onPress={handleOpenNotificationSettings}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('soundSettings.title')}
              style={[
                tw`mt-auto w-full py-2.5 rounded-xl items-center justify-center border`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('soundSettings.button')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3. Battery Optimization */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex flex-col justify-between`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Battery size={16} color={colors.primary} />
                <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                  {t('healthCheck.batteryOptimization')}
                </Text>
              </View>
              {status?.batteryOptimizationsIgnored ? (
                <CheckCircle size={20} color="#10b981" />
              ) : (
                <AlertCircle size={20} color="#f59e0b" />
              )}
            </View>
            <Text style={[tw`text-xs mb-3`, { color: colors.textMuted }]}>
              {status?.batteryOptimizationsIgnored
                ? `${t('healthCheck.exempt')}: ${t('healthCheck.batteryExemptDesc')}`
                : `${t('healthCheck.notExempt')}: ${t('healthCheck.batteryNotExemptDesc')}`}
            </Text>
            <TouchableOpacity
              onPress={handleRequestBatteryExemption}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${t('healthCheck.openSettings')}: ${t('healthCheck.batteryOptimization')}`}
              style={[
                tw`mt-auto w-full py-2.5 rounded-xl items-center justify-center border`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('healthCheck.openSettings')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Full-screen lock-screen alarms (Android 14+ can revoke this) */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex flex-col justify-between`,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Maximize size={16} color={colors.primary} />
                <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                  {t('healthCheck.fullScreenIntent')}
                </Text>
              </View>
              {status?.fullScreenIntentAllowed === false ? (
                <AlertCircle size={20} color="#f59e0b" />
              ) : (
                <CheckCircle size={20} color="#10b981" />
              )}
            </View>
            <Text style={[tw`text-xs mb-3`, { color: colors.textMuted }]}>
              {status?.fullScreenIntentAllowed === false
                ? `${t('healthCheck.denied')}: ${t('healthCheck.fullScreenDeniedDesc')}`
                : `${t('healthCheck.allowed')}: ${t('healthCheck.fullScreenAllowedDesc')}`}
            </Text>
            <TouchableOpacity
              onPress={handleOpenFullScreenSettings}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${t('healthCheck.openSettings')}: ${t('healthCheck.fullScreenIntent')}`}
              style={[
                tw`mt-auto w-full py-2.5 rounded-xl items-center justify-center border`,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('healthCheck.openSettings')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 4. Background & Foreground Protection */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex flex-col justify-between`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <ShieldCheck size={16} color="#10b981" />
                <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                  {t('soundSettings.appClosedReliability')}
                </Text>
              </View>
              <CheckCircle size={20} color="#10b981" />
            </View>
            <Text style={[tw`text-xs mb-3`, { color: colors.textMuted }]}>
              Foreground Service & RTC WakeLock active (works when closed)
            </Text>
            <TouchableOpacity
              onPress={handleOpenToneSettings}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('soundSettings.bgFgWorkingBadge')}
              style={[
                tw`mt-auto w-full py-2.5 rounded-xl items-center justify-center border`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[tw`text-xs font-semibold text-emerald-500`]}>
                ✓ {t('soundSettings.bgFgWorkingBadge')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 5. On-Phone Persistent Storage Engine */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex flex-col justify-between`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Database size={16} color="#10b981" />
                <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
                  {t('storage.title')}
                </Text>
              </View>
              <CheckCircle size={20} color="#10b981" />
            </View>
            <Text style={[tw`text-xs mb-3`, { color: colors.textMuted }]}>
              {t('storage.persistedBadge')} • SQLite
            </Text>
            <View
              accessible={true}
              accessibilityRole="text"
              accessibilityLabel={t('storage.persistedBadge')}
              style={[
                tw`mt-auto w-full py-2.5 rounded-xl items-center justify-center border`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[tw`text-xs font-semibold text-emerald-500`]}>
                ✓ {t('storage.crudStatus')}
              </Text>
            </View>
          </View>
        </View>

        {/* Action: Send Test Alarm in 1 Minute */}
        <View
          style={[
            tw`p-4 rounded-2xl border flex-col gap-3.5`,
            {
              backgroundColor: colors.primaryBg,
              borderColor: colors.primaryBorder
            }
          ]}
        >
          <View style={tw`flex-row items-center gap-3`}>
            <View
              style={[
                tw`w-10 h-10 rounded-xl border flex items-center justify-center`,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Clock size={20} color={colors.primary} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                {t('healthCheck.sendTestAlarm')}
              </Text>
              <Text style={[tw`text-xs mt-0.5`, { color: colors.textMuted }]}>
                Verifies system wake-lock and notification intent
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onSendTestAlarmInOneMinute}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('healthCheck.sendTestAlarm')}
            style={[
              tw`px-5 py-3.5 rounded-xl items-center justify-center shadow-md min-h-12`,
              { backgroundColor: colors.primary }
            ]}
          >
            <Text style={tw`text-sm font-bold text-white`}>
              {t('healthCheck.sendTestAlarm')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* OEM Autostart Guide */}
      <View
        style={[
          tw`rounded-3xl p-5 border`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-row items-center gap-2`}>
            <Smartphone size={18} color="#f59e0b" />
            <Text style={[tw`text-base font-semibold`, { color: colors.text }]}>
              {t('healthCheck.troubleshooting')}
            </Text>
          </View>
          {/* Brand simulator selector */}
          <ScrollView keyboardShouldPersistTaps="handled"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={tw`flex-row gap-2`}
            style={tw`max-w-[50%]`}
          >
            {[
              { val: 'auto', label: `${t('healthCheck.manufacturer')}: ${status?.manufacturer || 'Android'}` },
              { val: 'xiaomi', label: 'Xiaomi / Redmi' },
              { val: 'samsung', label: 'Samsung' },
              { val: 'oneplus', label: 'OnePlus / Oppo' },
              { val: 'vivo', label: 'Vivo / iQOO' },
              { val: 'pixel', label: 'Google Pixel' }
            ].map((opt) => (
              <TouchableOpacity
                key={opt.val}
                onPress={() => setBrandOverride(opt.val)}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ selected: brandOverride === opt.val }}
                accessibilityLabel={opt.label}
                style={[
                  tw`py-1.5 px-3 rounded-xl border`,
                  brandOverride === opt.val
                    ? {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary
                      }
                    : {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.border
                      }
                ]}
              >
                <Text
                  style={[
                    tw`text-xs font-medium`,
                    { color: brandOverride === opt.val ? '#ffffff' : colors.text }
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View
          style={[
            tw`p-4 rounded-2xl border mb-4`,
            {
              backgroundColor: colors.cardSecondary,
              borderColor: colors.border
            }
          ]}
        >
          <Text style={tw`text-sm font-semibold text-amber-500 mb-2.5`}>
            {brandInfo.brand} Setup Steps:
          </Text>
          <View style={tw`gap-2`}>
            {brandInfo.steps.map((step, idx) => (
              <View key={idx} style={tw`flex-row items-start`}>
                <Text style={tw`text-sm font-bold text-amber-500 mr-2`}>•</Text>
                <Text style={[tw`flex-1 text-sm leading-relaxed`, { color: colors.textSecondary }]}>
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleOpenAutostartSettings}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`${t('healthCheck.openSettings')}: Autostart`}
          style={[
            tw`w-full py-3.5 px-4 rounded-xl border flex-row items-center justify-center gap-2 min-h-12`,
            {
              backgroundColor: colors.cardSecondary,
              borderColor: colors.border
            }
          ]}
        >
          <ExternalLink size={16} color={colors.textMuted} />
          <Text style={[tw`text-sm font-semibold`, { color: colors.text }]}>
            {t('healthCheck.openSettings')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Next 10 Scheduled Alarms */}
      <View
        style={[
          tw`rounded-3xl p-5 border`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <Text style={[tw`text-base font-semibold`, { color: colors.text }]}>
            {t('healthCheck.scheduledCount')}
          </Text>
          <Text style={[tw`text-xs font-mono`, { color: colors.textMuted }]}>
            {alarms.length} {t('alarm.scheduled', { count: alarms.length })}
          </Text>
        </View>

        {alarms.length === 0 ? (
          <View style={tw`py-6 items-center justify-center`}>
            <Text style={[tw`text-sm`, { color: colors.textMuted }]}>
              {t('alarm.noUpcoming')}
            </Text>
          </View>
        ) : (
          <View style={tw`gap-3`}>
            {alarms.slice(0, 10).map((a, i) => (
              <View
                key={a.id}
                style={[
                  tw`p-4 rounded-2xl border flex-row items-center justify-between`,
                  {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.border
                  }
                ]}
              >
                <View style={tw`flex-row items-center gap-3 flex-1`}>
                  <Text style={[tw`font-mono text-xs font-bold w-4`, { color: colors.textSubtle }]}>
                    {i + 1}.
                  </Text>
                  <View style={tw`flex-1`}>
                    <Text style={[tw`font-semibold text-base mb-0.5`, { color: colors.text }]} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                      Channel: <Text style={[tw`uppercase font-medium`, { color: colors.textSecondary }]}>{a.channelId}</Text> • Style: {a.style === 'full_alarm' ? t('alarm.fullAlarm') : t('alarm.notification')}
                    </Text>
                  </View>
                </View>
                <View style={tw`items-end shrink-0 pl-2`}>
                  <Text style={[tw`font-mono font-bold text-sm`, { color: colors.primaryText }]}>
                    {new Date(a.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={[tw`text-xs mt-0.5`, { color: colors.textSubtle }]}>
                    {new Date(a.triggerTimeMs).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Last Fired Alarm Record */}
      <View
        style={[
          tw`rounded-3xl p-5 border`,
          {
            backgroundColor: colors.card,
            borderColor: colors.border
          }
        ]}
      >
        <Text style={[tw`text-sm font-semibold mb-2`, { color: colors.textMuted }]}>
          {t('healthCheck.lastFired')}:
        </Text>
        {status?.lastFiredAlarm ? (
          <Text style={[tw`text-sm leading-relaxed`, { color: colors.textSecondary }]}>
            <Text style={tw`font-bold text-emerald-500`}>{status.lastFiredAlarm.title}</Text>{' '}
            fired at {new Date(status.lastFiredAlarm.firedAtMs).toLocaleTimeString()} on{' '}
            {new Date(status.lastFiredAlarm.firedAtMs).toLocaleDateString()}
          </Text>
        ) : (
          <Text style={[tw`text-sm italic`, { color: colors.textSubtle }]}>
            {t('healthCheck.none')}
          </Text>
        )}
      </View>
    </View>
  );
};
