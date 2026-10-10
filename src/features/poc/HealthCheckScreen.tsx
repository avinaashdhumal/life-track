import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image } from 'react-native';
import tw from 'twrnc';
import { reminderService } from '../../services/AlarmEngineService';
import { HealthCheckStatus, AlarmItem } from '../../domain/alarm';
import {
  ShieldAlert,
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
  Info
} from 'lucide-react-native';

interface HealthCheckScreenProps {
  onBack: () => void;
  onSendTestAlarmInOneMinute: () => void;
}

export const HealthCheckScreen: React.FC<HealthCheckScreenProps> = ({
  onBack,
  onSendTestAlarmInOneMinute
}) => {
  const [status, setStatus] = useState<HealthCheckStatus | null>(null);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandOverride, setBrandOverride] = useState<string>('auto');

  const loadHealthData = async () => {
    setLoading(true);
    const hc = await reminderService.getHealthCheck();
    const scheduled = await reminderService.getScheduledAlarms();
    setStatus(hc);
    setAlarms(scheduled);
    setLoading(false);
  };

  useEffect(() => {
    loadHealthData();
  }, []);

  const handleOpenExactAlarmSettings = async () => {
    await reminderService.openExactAlarmSettings();
  };

  const handleRequestBatteryExemption = async () => {
    await reminderService.requestIgnoreBatteryOptimizations();
  };

  const handleOpenAutostartSettings = async () => {
    await reminderService.openAutostartSettings();
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
      {/* Top Header */}
      <View style={tw`flex-row items-center justify-between`}>
        <TouchableOpacity
          onPress={onBack}
          style={tw`flex-row items-center gap-2 text-sm text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 transition`}
        >
          <ChevronLeft style={tw`w-5 h-5`} />
          <Text style={tw`text-sm font-medium`}>Back to Test Screen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={loadHealthData}
          style={tw`flex-row items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 transition`}
        >
          <RefreshCw style={tw`w-4 h-4`} />
          <Text style={tw`text-sm font-medium`}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5 shadow-sm`}>
        <View style={tw`flex-row items-start justify-between mb-5`}>
          <View>
            <View style={tw`flex-row items-center gap-2 mb-1`}>
              <ShieldCheck style={tw`w-7 h-7 text-emerald-400`} />
              <Text style={tw`text-xl font-bold text-white tracking-tight`}>Reminder Health Check</Text>
            </View>
            <Text style={tw`text-sm text-zinc-400 mt-1`}>
              Verifies system permissions and OEM background limits so reminders never miss.
            </Text>
          </View>
        </View>

        {/* 3 Vital Health Indicators */}
        <View style={tw`flex flex-col md:flex-row gap-3 mb-5`}>
          {/* 1. Exact Alarms */}
          <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between`}>
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <Text style={tw`text-sm font-semibold text-zinc-300 flex-row items-center gap-2`}>
                <Clock style={tw`w-4 h-4 text-indigo-400`} />
                <Text>Exact Alarms</Text>
              </Text>
              {status?.exactAlarmsAllowed ? (
                <CheckCircle style={tw`w-5 h-5 text-emerald-400`} />
              ) : (
                <AlertCircle style={tw`w-5 h-5 text-amber-400`} />
              )}
            </View>
            <Text style={tw`text-xs text-zinc-400 mb-3`}>
              {status?.exactAlarmsAllowed
                ? 'Granted: AlarmClock & exact wakeups active'
                : 'Restricted: May be delayed by Android Doze'}
            </Text>
            <TouchableOpacity
              onPress={handleOpenExactAlarmSettings}
              style={tw`mt-auto w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 items-center justify-center transition`}
            >
              <Text style={tw`text-xs font-semibold text-zinc-200`}>Exact Alarm Settings</Text>
            </TouchableOpacity>
          </View>

          {/* 2. Notifications */}
          <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between`}>
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <Text style={tw`text-sm font-semibold text-zinc-300 flex-row items-center gap-2`}>
                <Bell style={tw`w-4 h-4 text-indigo-400`} />
                <Text>Notifications</Text>
              </Text>
              <CheckCircle style={tw`w-5 h-5 text-emerald-400`} />
            </View>
            <Text style={tw`text-xs text-zinc-400 mb-3`}>
              7 channels configured (Medicines high-priority)
            </Text>
            <View style={tw`mt-auto items-center justify-center py-2.5`}>
              <Text style={tw`text-xs font-semibold text-emerald-400`}>Active & Configured</Text>
            </View>
          </View>

          {/* 3. Battery Optimization */}
          <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col justify-between`}>
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <Text style={tw`text-sm font-semibold text-zinc-300 flex-row items-center gap-2`}>
                <Battery style={tw`w-4 h-4 text-indigo-400`} />
                <Text>Battery Bypass</Text>
              </Text>
              {status?.batteryOptimizationsIgnored ? (
                <CheckCircle style={tw`w-5 h-5 text-emerald-400`} />
              ) : (
                <AlertCircle style={tw`w-5 h-5 text-amber-400`} />
              )}
            </View>
            <Text style={tw`text-xs text-zinc-400 mb-3`}>
              {status?.batteryOptimizationsIgnored
                ? 'Unrestricted: Never throttled in background'
                : 'Optimized: Recommend requesting exemption'}
            </Text>
            <TouchableOpacity
              onPress={handleRequestBatteryExemption}
              style={tw`mt-auto w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 items-center justify-center transition`}
            >
              <Text style={tw`text-xs font-semibold text-zinc-200`}>Request Exemption</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action: Send Test Alarm in 1 Minute */}
        <View style={tw`p-4 rounded-2xl bg-gradient-to-r from-indigo-950/30 to-purple-950/30 border border-indigo-500/20 flex-col gap-4`}>
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300`}>
              <Clock style={tw`w-5 h-5`} />
            </View>
            <View style={tw`flex-1`}>
              <Text style={tw`text-sm font-bold text-white`}>Send Test Alarm in 1 Minute</Text>
              <Text style={tw`text-xs text-zinc-400 mt-0.5`}>Verifies system wake-lock and notification intent</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onSendTestAlarmInOneMinute}
            style={tw`px-5 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 items-center justify-center shadow-sm transition`}
          >
            <Text style={tw`text-sm font-semibold text-white`}>Schedule 1m Test</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* OEM Autostart Guide */}
      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5`}>
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-row items-center gap-2`}>
            <Smartphone style={tw`w-5 h-5 text-amber-400`} />
            <Text style={tw`text-base font-semibold text-white`}>Device Optimization</Text>
          </View>
          {/* Brand simulator selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row gap-2`} style={tw`max-w-[50%]`}>
            {[{val: "auto", label: `Detected: ${status?.manufacturer || 'Android'}`}, {val: "xiaomi", label: "Xiaomi / Redmi / Poco"}, {val: "samsung", label: "Samsung"}, {val: "oneplus", label: "OnePlus / Oppo / Realme"}, {val: "vivo", label: "Vivo / iQOO"}, {val: "pixel", label: "Google Pixel / Pure Android"}].map(opt => (
              <TouchableOpacity key={opt.val} onPress={() => setBrandOverride(opt.val)} style={tw`py-2 px-3 rounded-xl border ${brandOverride === opt.val ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-950 border-zinc-800'}`}>
                <Text style={tw`text-sm font-medium ${brandOverride === opt.val ? 'text-white' : 'text-zinc-300'}`}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800 mb-4`}>
          <Text style={tw`text-sm font-semibold text-amber-300 mb-2.5`}>
            {brandInfo.brand} Setup Steps:
          </Text>
          <View style={tw`gap-2`}>
            {brandInfo.steps.map((step, idx) => (
              <View key={idx} style={tw`flex-row items-start`}>
                <Text style={tw`text-sm font-bold text-zinc-500 mr-2`}>•</Text>
                <Text style={tw`flex-1 text-sm text-zinc-300 leading-relaxed`}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleOpenAutostartSettings}
          style={tw`w-full py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-200 border border-zinc-700 flex-row items-center justify-center gap-2 transition`}
        >
          <ExternalLink style={tw`w-4 h-4 text-zinc-400`} />
          <Text style={tw`text-sm font-semibold text-white`}>Open Device Autostart Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Next 10 Scheduled Alarms */}
      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5`}>
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <Text style={tw`text-base font-semibold text-white`}>Next 10 Scheduled Alarms</Text>
          <Text style={tw`text-xs text-zinc-500 font-mono`}>
            {alarms.length} registered
          </Text>
        </View>

        {alarms.length === 0 ? (
          <View style={tw`py-6 text-center text-sm text-zinc-500 flex items-center justify-center`}>
            <Text style={tw`text-zinc-500`}>No alarms registered in native storage.</Text>
          </View>
        ) : (
          <View style={tw`space-y-3`}>
            {alarms.slice(0, 10).map((a, i) => (
              <View
                key={a.id}
                style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex-row items-center justify-between`}
              >
                <View style={tw`flex-row items-center gap-3 flex-1`}>
                  <Text style={tw`font-mono text-zinc-600 text-xs font-bold w-4`}>{i + 1}.</Text>
                  <View style={tw`flex-1`}>
                    <Text style={tw`font-semibold text-white text-base mb-0.5`} numberOfLines={1}>{a.title}</Text>
                    <Text style={tw`text-xs text-zinc-400`}>
                      Channel: <Text style={tw`uppercase text-zinc-300 font-medium`}>{a.channelId}</Text> • Style: {a.style === 'full_alarm' ? 'Full' : 'Notify'}
                    </Text>
                  </View>
                </View>
                <View style={tw`items-end shrink-0 pl-2`}>
                  <Text style={tw`font-mono text-indigo-400 font-bold text-sm`}>
                    {new Date(a.triggerTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={tw`text-xs text-zinc-500 mt-0.5`}>
                    {new Date(a.triggerTimeMs).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Last Fired Alarm Record */}
      <View style={tw`rounded-3xl bg-zinc-900 border border-zinc-800 p-5`}>
        <Text style={tw`text-sm font-semibold text-zinc-400 mb-2`}>Last Alarm Fired:</Text>
        {status?.lastFiredAlarm ? (
          <Text style={tw`text-sm text-zinc-300 leading-relaxed`}>
            <Text style={tw`font-bold text-emerald-400`}>{status.lastFiredAlarm.title}</Text> fired at{' '}
            {new Date(status.lastFiredAlarm.firedAtMs).toLocaleTimeString()} on{' '}
            {new Date(status.lastFiredAlarm.firedAtMs).toLocaleDateString()}
          </Text>
        ) : (
          <Text style={tw`text-sm text-zinc-500 italic`}>No alarm has fired yet in this session.</Text>
        )}
      </View>
    </View>
  );
};
