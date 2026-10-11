import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { databaseService, UserProfileRecord, DatabaseStats } from '../../services/DatabaseService';
import { storageService, AppSettings } from '../../services/StorageService';
import { reminderService } from '../../services/AlarmEngineService';
import { ReminderLogEntry } from '../../domain/alarm';
import { SUPPORTED_LANGUAGES, getCurrentLanguage, changeLanguage } from '../../i18n';
import {
  User,
  Settings,
  ChevronLeft,
  Database,
  ShieldCheck,
  Bell,
  Volume2,
  Globe,
  Sun,
  Moon,
  Smartphone,
  Heart,
  Phone,
  FileText,
  Clock,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  CheckCircle,
  X,
  Edit3,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react-native';

interface ProfileSettingsScreenProps {
  onBack: () => void;
  onOpenToneSettings?: () => void;
  onOpenHealthCheck?: () => void;
}

export const ProfileSettingsScreen: React.FC<ProfileSettingsScreenProps> = ({
  onBack,
  onOpenToneSettings,
  onOpenHealthCheck
}) => {
  const { t } = useTranslation();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();

  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSyncSettings());
  const [logs, setLogs] = useState<ReminderLogEntry[]>([]);

  // Modals state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupJson, setBackupJson] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Edit profile form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBloodGroup, setFormBloodGroup] = useState('');
  const [formEmergencyContact, setFormEmergencyContact] = useState('');
  const [formEmergencyPhone, setFormEmergencyPhone] = useState('');
  const [formConditions, setFormConditions] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formWakeTime, setFormWakeTime] = useState('07:00');
  const [formSleepTime, setFormSleepTime] = useState('23:00');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const p = await databaseService.getUserProfile();
      setProfile(p);
      setFormName(p.name);
      setFormPhone(p.phone);
      setFormEmail(p.email);
      setFormBloodGroup(p.bloodGroup);
      setFormEmergencyContact(p.emergencyContact);
      setFormEmergencyPhone(p.emergencyContactPhone);
      setFormConditions(p.medicalConditions.join(', '));
      setFormNotes(p.notes);
      setFormWakeTime(p.wakeTime);
      setFormSleepTime(p.sleepTime);

      const stats = await databaseService.getDatabaseStats();
      setDbStats(stats);

      const l = await databaseService.getLogs(100);
      setLogs(l);

      const s = await storageService.getSettings();
      setSettings(s);
    } catch {
      // Fallback
    }
  };

  const handleSaveProfile = async () => {
    const updated = await databaseService.updateUserProfile({
      name: formName.trim() || 'Avinash Dhumal',
      phone: formPhone.trim(),
      email: formEmail.trim(),
      bloodGroup: formBloodGroup.trim() || 'O+',
      emergencyContact: formEmergencyContact.trim(),
      emergencyContactPhone: formEmergencyPhone.trim(),
      medicalConditions: formConditions.split(',').map((c) => c.trim()).filter(Boolean),
      notes: formNotes.trim(),
      wakeTime: formWakeTime.trim() || '07:00',
      sleepTime: formSleepTime.trim() || '23:00'
    });
    setProfile(updated);
    setShowEditProfileModal(false);
    await loadData();
  };

  const handleClearLogs = async () => {
    await databaseService.clearLogs();
    await loadData();
  };

  const handleOptimizeDb = async () => {
    await databaseService.optimizeDatabase();
    await loadData();
  };

  const handleExportBackup = async () => {
    const dump = await databaseService.exportDatabaseDump();
    setBackupJson(JSON.stringify(dump, null, 2));
    setImportStatus(null);
    setShowBackupModal(true);
  };

  const handleImportBackup = async () => {
    try {
      const parsed = JSON.parse(backupJson);
      const success = await databaseService.importDatabaseDump(parsed);
      if (success) {
        setImportStatus(t('storage.restoreSuccess'));
        await loadData();
      } else {
        setImportStatus(t('storage.restoreFailed'));
      }
    } catch {
      setImportStatus(t('storage.restoreFailed'));
    }
  };

  const handleLanguageChange = async (langCode: 'en' | 'hi' | 'mr' | 'es') => {
    await changeLanguage(langCode);
    await storageService.updateSettings({ language: langCode });
    setSettings((prev) => ({ ...prev, language: langCode }));
  };

  const handleThemeModeChange = async (mode: ThemeMode) => {
    setThemeMode(mode);
    await storageService.updateSettings({ themeMode: mode });
    setSettings((prev) => ({ ...prev, themeMode: mode }));
  };

  const handleToggleVibration = async () => {
    const nextVal = !settings.vibrationEnabled;
    await storageService.updateSettings({ vibrationEnabled: nextVal });
    setSettings((prev) => ({ ...prev, vibrationEnabled: nextVal }));
  };

  const handleToggleFullScreenAlarm = async () => {
    const nextVal = !settings.fullScreenAlarmEnabled;
    await storageService.updateSettings({ fullScreenAlarmEnabled: nextVal });
    setSettings((prev) => ({ ...prev, fullScreenAlarmEnabled: nextVal }));
  };

  const handleSelectSnooze = async (minutes: number) => {
    await storageService.updateSettings({ defaultSnoozeMinutes: minutes });
    setSettings((prev) => ({ ...prev, defaultSnoozeMinutes: minutes }));
  };

  const currentLang = getCurrentLanguage();

  return (
    <View style={tw`flex-1 pb-16`} accessible={true} accessibilityLabel={t('profileSettings.screenLabel')}>
      {/* Top Header Bar */}
      <View
        style={[
          tw`flex-row items-center justify-between pb-4 mb-4 border-b`,
          { borderBottomColor: colors.border }
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.back')}
          style={[
            tw`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border min-h-11`,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <ChevronLeft size={18} color={colors.text} />
          <Text style={[tw`text-xs font-semibold`, { color: colors.text }]}>
            {t('profileSettings.backButton')}
          </Text>
        </TouchableOpacity>

        <View style={tw`flex-1 items-center px-2`}>
          <Text style={[tw`text-base font-bold`, { color: colors.text }]} numberOfLines={1}>
            {t('profileSettings.title')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleExportBackup}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.backupData')}
          style={[
            tw`p-2.5 rounded-xl border min-h-11 min-w-11 items-center justify-center`,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <Download size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 1. User Health Profile Card */}
      <View
        style={[
          tw`rounded-3xl p-5 mb-4 shadow-sm border`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-row items-center gap-3 flex-1 min-w-0 pr-2`}>
            {/* Avatar with Initials */}
            <View
              style={[
                tw`w-14 h-14 rounded-2xl items-center justify-center border`,
                {
                  backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                  borderColor: 'rgba(99, 102, 241, 0.35)'
                }
              ]}
            >
              <Text style={tw`text-xl font-extrabold text-indigo-500`}>
                {profile?.name
                  ? profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'AD'}
              </Text>
            </View>

            <View style={tw`flex-1 min-w-0`}>
              <View style={tw`flex-row items-center gap-2`}>
                <Text style={[tw`text-lg font-bold`, { color: colors.text }]} numberOfLines={1}>
                  {profile?.name || 'Avinash Dhumal'}
                </Text>
                <View style={tw`px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30`}>
                  <Text style={tw`text-[10px] font-bold text-red-500`}>
                    {profile?.bloodGroup || 'O+'}
                  </Text>
                </View>
              </View>
              <Text style={[tw`text-xs mt-0.5`, { color: colors.textMuted }]} numberOfLines={1}>
                {profile?.email || 'avinash@example.com'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setShowEditProfileModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profileSettings.editProfile')}
            style={[
              tw`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border min-h-10`,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border }
            ]}
          >
            <Edit3 size={13} color={colors.primary} />
            <Text style={[tw`text-xs font-semibold`, { color: colors.primary }]}>
              {t('profileSettings.editProfile')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Contact & Routine Row */}
        <View style={tw`flex-col gap-2.5 pt-3 border-t border-zinc-800/20`}>
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-2`}>
              <Phone size={14} color="#ef4444" />
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('profileSettings.emergencyContact')}:
              </Text>
            </View>
            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
              {profile?.emergencyContact || 'Guardian'} ({profile?.emergencyContactPhone || '+91 91234 56789'})
            </Text>
          </View>

          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-2`}>
              <Clock size={14} color={colors.primary} />
              <Text style={[tw`text-xs font-semibold`, { color: colors.textSecondary }]}>
                {t('profileSettings.dailyRoutine')}:
              </Text>
            </View>
            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
              Wake: {profile?.wakeTime || '07:00'} • Sleep: {profile?.sleepTime || '23:00'}
            </Text>
          </View>

          {profile?.medicalConditions && profile.medicalConditions.length > 0 && (
            <View style={tw`flex-row items-center gap-1.5 flex-wrap mt-1`}>
              {profile.medicalConditions.map((cond, idx) => (
                <View
                  key={idx}
                  style={[
                    tw`px-2.5 py-1 rounded-lg border`,
                    { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
                  ]}
                >
                  <Text style={[tw`text-[11px] font-medium`, { color: colors.textMuted }]}>
                    ⚕ {cond}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* 2. Structured Local Database Engine Card */}
      <View
        style={[
          tw`rounded-3xl p-5 mb-4 shadow-sm border`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <View style={tw`flex-row items-center justify-between mb-3 flex-wrap gap-2`}>
          <View style={tw`flex-row items-center gap-2.5`}>
            <View
              style={[
                tw`w-9 h-9 rounded-xl border items-center justify-center shrink-0`,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)'
                }
              ]}
            >
              <Database size={18} color="#10b981" />
            </View>
            <View>
              <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                {t('storage.localDbEngineTitle')}
              </Text>
              <Text style={[tw`text-[11px]`, { color: colors.textMuted }]}>
                {dbStats?.databaseName || 'lifetrack_local.db'} (v{dbStats?.version || 1})
              </Text>
            </View>
          </View>

          <View style={tw`px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25`}>
            <Text style={tw`text-[10px] font-bold text-emerald-500`}>
              ✓ {t('storage.crudStatus')}
            </Text>
          </View>
        </View>

        <Text style={[tw`text-xs leading-relaxed mb-3`, { color: colors.textSecondary }]}>
          {t('storage.localDbDescription')}
        </Text>

        {/* Database Tables & Record Counts Grid */}
        <View style={tw`flex-col gap-2 mb-4`}>
          {dbStats?.tables.map((tbl) => (
            <View
              key={tbl.tableName}
              style={[
                tw`p-2.5 rounded-xl border flex-row items-center justify-between`,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
              ]}
            >
              <View style={tw`flex-row items-center gap-2 flex-1 min-w-0 pr-2`}>
                <Layers size={13} color={colors.primary} />
                <View style={tw`flex-1 min-w-0`}>
                  <Text style={[tw`text-xs font-bold`, { color: colors.text }]} numberOfLines={1}>
                    TABLE {tbl.tableName}
                  </Text>
                  <Text style={[tw`text-[10px]`, { color: colors.textMuted }]} numberOfLines={1}>
                    {tbl.description}
                  </Text>
                </View>
              </View>
              <View style={tw`px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 shrink-0`}>
                <Text style={tw`text-xs font-mono font-bold text-emerald-400`}>
                  {tbl.rowCount} rows
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Database Management Action Buttons */}
        <View style={tw`flex-row items-center gap-2 flex-wrap`}>
          <TouchableOpacity
            onPress={() => setShowLogsModal(true)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profileSettings.viewLogs')}
            style={[
              tw`flex-1 py-2.5 px-3 rounded-xl border flex-row items-center justify-center gap-1.5 min-h-10`,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border }
            ]}
          >
            <Activity size={14} color={colors.primary} />
            <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
              {t('profileSettings.viewLogs')} ({logs.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleOptimizeDb}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profileSettings.optimizeDb')}
            style={[
              tw`py-2.5 px-3 rounded-xl border flex-row items-center justify-center gap-1.5 min-h-10`,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border }
            ]}
          >
            <Sparkles size={14} color="#10b981" />
            <Text style={tw`text-xs font-bold text-emerald-500`}>
              {t('profileSettings.optimizeDb')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExportBackup}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.backupData')}
            style={[
              tw`py-2.5 px-3 rounded-xl border flex-row items-center justify-center gap-1.5 min-h-10`,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border }
            ]}
          >
            <Download size={14} color={colors.text} />
            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
              {t('storage.backupData')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Alarm & Notification Preferences */}
      <View
        style={[
          tw`rounded-3xl p-5 mb-4 shadow-sm border`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <Text style={[tw`text-sm font-bold mb-3`, { color: colors.text }]}>
          {t('profileSettings.alarmPreferencesHeader')}
        </Text>

        {/* Tone Picker Button */}
        <TouchableOpacity
          onPress={onOpenToneSettings}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.soundSettingsButton')}
          style={[
            tw`p-3.5 rounded-2xl border flex-row items-center justify-between mb-3`,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border }
          ]}
        >
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`w-8 h-8 rounded-full bg-amber-500/10 items-center justify-center`}>
              <Volume2 size={16} color="#f59e0b" />
            </View>
            <View>
              <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
                {t('soundSettings.title')}
              </Text>
              <Text style={[tw`text-[11px]`, { color: colors.textMuted }]}>
                {settings.alarmTone === 'gentle_chime'
                  ? t('soundSettings.toneGentleChime')
                  : t('soundSettings.toneDefaultSiren')}
              </Text>
            </View>
          </View>
          <Text style={[tw`text-xs font-bold`, { color: colors.primary }]}>
            {t('profileSettings.changeTone')} ›
          </Text>
        </TouchableOpacity>

        {/* Full-Screen Lockscreen Alarm Toggle */}
        <View
          style={[
            tw`p-3.5 rounded-2xl border flex-row items-center justify-between mb-3`,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border }
          ]}
        >
          <View style={tw`flex-1 pr-3`}>
            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
              {t('profileSettings.fullScreenOverlayTitle')}
            </Text>
            <Text style={[tw`text-[10px] mt-0.5`, { color: colors.textMuted }]}>
              {t('profileSettings.fullScreenOverlaySubtitle')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleToggleFullScreenAlarm}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profileSettings.fullScreenOverlayTitle')}
            style={[
              tw`px-3 py-1.5 rounded-xl border`,
              settings.fullScreenAlarmEnabled
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                { color: settings.fullScreenAlarmEnabled ? '#ffffff' : colors.textMuted }
              ]}
            >
              {settings.fullScreenAlarmEnabled ? t('common.enabled') : t('common.disabled')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Default Snooze Minutes */}
        <View
          style={[
            tw`p-3.5 rounded-2xl border flex-row items-center justify-between mb-3`,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border }
          ]}
        >
          <View style={tw`flex-1 pr-3`}>
            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
              {t('profileSettings.defaultSnoozeTitle')}
            </Text>
            <Text style={[tw`text-[10px] mt-0.5`, { color: colors.textMuted }]}>
              {t('profileSettings.defaultSnoozeSubtitle')}
            </Text>
          </View>
          <View style={tw`flex-row gap-1.5`}>
            {[5, 10, 15].map((mins) => (
              <TouchableOpacity
                key={mins}
                onPress={() => handleSelectSnooze(mins)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${mins} minutes snooze`}
                style={[
                  tw`px-2.5 py-1.5 rounded-lg border`,
                  settings.defaultSnoozeMinutes === mins
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.border }
                ]}
              >
                <Text
                  style={[
                    tw`text-[11px] font-bold`,
                    { color: settings.defaultSnoozeMinutes === mins ? '#ffffff' : colors.text }
                  ]}
                >
                  {mins}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Vibration Toggle */}
        <View
          style={[
            tw`p-3.5 rounded-2xl border flex-row items-center justify-between`,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border }
          ]}
        >
          <View style={tw`flex-1 pr-3`}>
            <Text style={[tw`text-xs font-bold`, { color: colors.text }]}>
              {t('profileSettings.vibrationTitle')}
            </Text>
            <Text style={[tw`text-[10px] mt-0.5`, { color: colors.textMuted }]}>
              {t('profileSettings.vibrationSubtitle')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleToggleVibration}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('profileSettings.vibrationTitle')}
            style={[
              tw`px-3 py-1.5 rounded-xl border`,
              settings.vibrationEnabled
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border }
            ]}
          >
            <Text
              style={[
                tw`text-xs font-bold`,
                { color: settings.vibrationEnabled ? '#ffffff' : colors.textMuted }
              ]}
            >
              {settings.vibrationEnabled ? t('common.enabled') : t('common.disabled')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. App Theme & Language Preferences */}
      <View
        style={[
          tw`rounded-3xl p-5 mb-4 shadow-sm border`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <Text style={[tw`text-sm font-bold mb-3`, { color: colors.text }]}>
          {t('profileSettings.themeAndLanguageHeader')}
        </Text>

        {/* Theme Selector */}
        <View style={tw`mb-4`}>
          <Text style={[tw`text-xs font-semibold mb-2`, { color: colors.textSecondary }]}>
            {t('profileSettings.themeModeLabel')}
          </Text>
          <View style={tw`flex-row gap-2`}>
            {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => handleThemeModeChange(mode)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${mode} theme`}
                style={[
                  tw`flex-1 py-2.5 px-3 rounded-xl border items-center justify-center min-h-10`,
                  themeMode === mode
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                ]}
              >
                <Text
                  style={[
                    tw`text-xs font-bold capitalize`,
                    { color: themeMode === mode ? '#ffffff' : colors.text }
                  ]}
                >
                  {mode === 'dark' ? '🌙 Dark' : mode === 'light' ? '☀️ Light' : '⚙ System'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Language Selector */}
        <View>
          <Text style={[tw`text-xs font-semibold mb-2`, { color: colors.textSecondary }]}>
            {t('profileSettings.languageLabel')}
          </Text>
          <View style={tw`flex-row gap-2 flex-wrap`}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={lang.name}
                style={[
                  tw`flex-1 min-w-[45%] py-2.5 px-3 rounded-xl border flex-row items-center justify-center gap-2 min-h-10`,
                  currentLang === lang.code
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.cardSecondary, borderColor: colors.border }
                ]}
              >
                <Text style={tw`text-sm`}>{lang.flag}</Text>
                <Text
                  style={[
                    tw`text-xs font-bold`,
                    { color: currentLang === lang.code ? '#ffffff' : colors.text }
                  ]}
                >
                  {lang.nativeName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* 5. Health Check Shortcut */}
      {onOpenHealthCheck && (
        <TouchableOpacity
          onPress={onOpenHealthCheck}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.healthCheck')}
          style={[
            tw`p-4 rounded-3xl border flex-row items-center justify-between mb-8 shadow-sm`,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
        >
          <View style={tw`flex-row items-center gap-3`}>
            <View style={tw`w-10 h-10 rounded-2xl bg-emerald-500/10 items-center justify-center border border-emerald-500/30`}>
              <ShieldCheck size={20} color="#10b981" />
            </View>
            <View>
              <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                {t('healthCheck.title')}
              </Text>
              <Text style={[tw`text-[11px]`, { color: colors.textMuted }]}>
                {t('healthCheck.subtitle')}
              </Text>
            </View>
          </View>
          <Text style={[tw`text-xs font-bold text-emerald-500`]}>
            {t('healthCheck.button')} ›
          </Text>
        </TouchableOpacity>
      )}

      {/* MODAL 1: Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/75 p-4`}>
          <View
            style={[
              tw`w-full max-w-lg max-h-[90%] rounded-3xl border flex flex-col overflow-hidden shadow-2xl`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            accessible={true}
            accessibilityViewIsModal={true}
            accessibilityLabel={t('profileSettings.editProfile')}
          >
            <View
              style={[
                tw`flex-row items-center justify-between px-5 py-4 border-b`,
                { backgroundColor: colors.bgHeader, borderBottomColor: colors.border }
              ]}
            >
              <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                {t('profileSettings.editProfile')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowEditProfileModal(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.close')}
                style={tw`p-1.5`}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={tw`p-5`} contentContainerStyle={tw`flex-col gap-3.5`}>
              <View>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('profileSettings.nameLabel')}
                </Text>
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  style={[
                    tw`p-3 rounded-xl border text-sm`,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                  ]}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textSubtle}
                />
              </View>

              <View style={tw`flex-row gap-3`}>
                <View style={tw`flex-1`}>
                  <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                    {t('profileSettings.phoneLabel')}
                  </Text>
                  <TextInput
                    value={formPhone}
                    onChangeText={setFormPhone}
                    style={[
                      tw`p-3 rounded-xl border text-sm`,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                    ]}
                    placeholder="+91..."
                    placeholderTextColor={colors.textSubtle}
                  />
                </View>
                <View style={tw`w-24`}>
                  <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                    {t('profileSettings.bloodGroupLabel')}
                  </Text>
                  <TextInput
                    value={formBloodGroup}
                    onChangeText={setFormBloodGroup}
                    style={[
                      tw`p-3 rounded-xl border text-sm`,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                    ]}
                    placeholder="O+"
                    placeholderTextColor={colors.textSubtle}
                  />
                </View>
              </View>

              <View>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('profileSettings.emergencyContactNameLabel')}
                </Text>
                <TextInput
                  value={formEmergencyContact}
                  onChangeText={setFormEmergencyContact}
                  style={[
                    tw`p-3 rounded-xl border text-sm`,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                  ]}
                  placeholder="Contact Name"
                  placeholderTextColor={colors.textSubtle}
                />
              </View>

              <View>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('profileSettings.emergencyContactPhoneLabel')}
                </Text>
                <TextInput
                  value={formEmergencyPhone}
                  onChangeText={setFormEmergencyPhone}
                  style={[
                    tw`p-3 rounded-xl border text-sm`,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                  ]}
                  placeholder="+91..."
                  placeholderTextColor={colors.textSubtle}
                />
              </View>

              <View>
                <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                  {t('profileSettings.conditionsLabel')}
                </Text>
                <TextInput
                  value={formConditions}
                  onChangeText={setFormConditions}
                  style={[
                    tw`p-3 rounded-xl border text-sm`,
                    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                  ]}
                  placeholder="e.g. Hypertension, Diabetes (comma separated)"
                  placeholderTextColor={colors.textSubtle}
                />
              </View>

              <View style={tw`flex-row gap-3`}>
                <View style={tw`flex-1`}>
                  <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                    {t('profileSettings.wakeTimeLabel')}
                  </Text>
                  <TextInput
                    value={formWakeTime}
                    onChangeText={setFormWakeTime}
                    style={[
                      tw`p-3 rounded-xl border text-sm`,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                    ]}
                    placeholder="07:00"
                    placeholderTextColor={colors.textSubtle}
                  />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={[tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }]}>
                    {t('profileSettings.sleepTimeLabel')}
                  </Text>
                  <TextInput
                    value={formSleepTime}
                    onChangeText={setFormSleepTime}
                    style={[
                      tw`p-3 rounded-xl border text-sm`,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
                    ]}
                    placeholder="23:00"
                    placeholderTextColor={colors.textSubtle}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveProfile}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
                style={[
                  tw`py-3.5 px-4 rounded-xl items-center justify-center mt-3 min-h-11`,
                  { backgroundColor: colors.primary }
                ]}
              >
                <Text style={tw`text-sm font-bold text-white`}>
                  {t('common.save')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Audit Logs Explorer Modal */}
      <Modal
        visible={showLogsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLogsModal(false)}
      >
        <View style={tw`flex-1 justify-center items-center bg-black/75 p-4`}>
          <View
            style={[
              tw`w-full max-w-lg max-h-[90%] rounded-3xl border flex flex-col overflow-hidden shadow-2xl`,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            accessible={true}
            accessibilityViewIsModal={true}
            accessibilityLabel={t('profileSettings.viewLogs')}
          >
            <View
              style={[
                tw`flex-row items-center justify-between px-5 py-4 border-b`,
                { backgroundColor: colors.bgHeader, borderBottomColor: colors.border }
              ]}
            >
              <View>
                <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                  {t('profileSettings.viewLogs')}
                </Text>
                <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                  {logs.length} {t('profileSettings.recordedEvents')}
                </Text>
              </View>
              <View style={tw`flex-row items-center gap-2`}>
                {logs.length > 0 && (
                  <TouchableOpacity
                    onPress={handleClearLogs}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('storage.clearLogs')}
                    style={tw`p-2 rounded-lg bg-red-500/10`}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowLogsModal(false)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('accessibility.close')}
                  style={tw`p-2`}
                >
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={tw`p-4`} contentContainerStyle={tw`flex-col gap-2.5`}>
              {logs.length === 0 ? (
                <View style={tw`py-8 items-center`}>
                  <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                    {t('alarm.noLogs')}
                  </Text>
                </View>
              ) : (
                logs.map((log) => (
                  <View
                    key={log.id}
                    style={[
                      tw`p-3 rounded-xl border flex-col gap-1`,
                      { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
                    ]}
                  >
                    <View style={tw`flex-row items-center justify-between`}>
                      <View style={tw`px-2 py-0.5 rounded-full bg-zinc-800`}>
                        <Text style={tw`text-[10px] font-bold text-zinc-300 font-mono`}>
                          {log.action}
                        </Text>
                      </View>
                      <Text style={[tw`text-[10px]`, { color: colors.textMuted }]}>
                        {new Date(log.timestampMs).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={[tw`text-xs font-medium`, { color: colors.text }]}>
                      {log.note || log.alarmId}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Database Backup & Restore Modal */}
      <Modal
        visible={showBackupModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBackupModal(false)}
      >
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
              <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                {t('storage.modalTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBackupModal(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={t('accessibility.close')}
                style={tw`p-1.5`}
              >
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={tw`p-5`} contentContainerStyle={tw`flex-col gap-3`}>
              {importStatus && (
                <View style={tw`p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30`}>
                  <Text style={tw`text-xs font-semibold text-emerald-400`}>
                    {importStatus}
                  </Text>
                </View>
              )}

              <Text style={[tw`text-xs leading-relaxed`, { color: colors.textMuted }]}>
                {t('storage.restorePlaceholder')}
              </Text>

              <TextInput
                value={backupJson}
                onChangeText={setBackupJson}
                multiline={true}
                numberOfLines={8}
                style={[
                  tw`p-3 rounded-xl border text-xs font-mono max-h-48`,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text
                  }
                ]}
                placeholder={t('storage.restorePlaceholder')}
                placeholderTextColor={colors.textSubtle}
              />

              <View style={tw`flex-row gap-2 mt-2`}>
                <TouchableOpacity
                  onPress={handleImportBackup}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('accessibility.restoreData')}
                  style={[
                    tw`flex-1 py-3 px-4 rounded-xl items-center justify-center min-h-11`,
                    { backgroundColor: colors.primary }
                  ]}
                >
                  <Text style={tw`text-xs font-bold text-white`}>
                    {t('storage.restoreData')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleExportBackup}
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
    </View>
  );
};
