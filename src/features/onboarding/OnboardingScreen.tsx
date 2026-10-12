import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { profileRepository } from '../../data/profileRepository';
import { shiftRepository } from '../../data/shiftRepository';
import {
  ShieldCheck,
  Bell,
  Clock,
  User,
  Heart,
  Calendar,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Battery
} from 'lucide-react-native';

interface OnboardingScreenProps {
  onComplete: () => void;
}

type ShiftChoice = 'no' | 'yes' | 'later';

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [emergencyContact, setEmergencyContact] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [shiftChoice, setShiftChoice] = useState<ShiftChoice>('no');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      // 1. Save profile information
      await profileRepository.updateProfile({
        name: name.trim() || 'User',
        bloodGroup,
        emergencyContact: emergencyContact.trim(),
        emergencyContactPhone: emergencyPhone.trim()
      });

      // 2. Set shift preference on the switch the shift engine reads: strictly OFF unless 'yes'
      await shiftRepository.setEnabled(shiftChoice === 'yes');

      // 3. Mark onboarding complete
      await profileRepository.setCompletedOnboarding(true);

      onComplete();
    } catch (e) {
      console.warn('Error completing onboarding:', e);
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View
      style={[tw`flex-1`, { backgroundColor: colors.bg }]}
      accessible={true}
      accessibilityLabel="Onboarding Screen"
    >
      {/* Top Header */}
      <View
        style={[
          tw`pt-12 pb-4 px-6 border-b flex-row items-center justify-between`,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
      >
        <View style={tw`flex-row items-center`}>
          <Sparkles size={22} color={colors.primary} />
          <Text style={[tw`text-lg font-bold ml-2`, { color: colors.text }]}>
            {t('onboarding.welcomeTitle', 'Welcome to LifeTrack')}
          </Text>
        </View>
        <Text style={[tw`text-xs font-semibold px-2 py-1 rounded-full`, { backgroundColor: isDark ? '#27272a' : '#f1f5f9', color: colors.textSecondary }]}>
          {step} / 4
        </Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tw`p-6 pb-16`}>
        {/* STEP 1: Privacy & Offline-First Core */}
        {step === 1 && (
          <View>
            <View style={tw`items-center my-6`}>
              <View
                style={[
                  tw`w-20 h-20 rounded-full items-center justify-center mb-4`,
                  { backgroundColor: `${colors.primary}20` }
                ]}
              >
                <ShieldCheck size={40} color={colors.primary} />
              </View>
              <Text style={[tw`text-2xl font-black text-center mb-2`, { color: colors.text }]}>
                {t('onboarding.privacyTitle', 'Offline-First & 100% Private')}
              </Text>
              <Text
                style={[
                  tw`text-sm text-center leading-5 px-4`,
                  { color: colors.textSecondary }
                ]}
              >
                {t(
                  'onboarding.privacyDesc',
                  'LifeTrack stores all your health, medication, and schedule data securely on this phone. No accounts, no cloud sync, no tracking.'
                )}
              </Text>
            </View>

            <View
              style={[
                tw`p-4 rounded-2xl border mb-4`,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <View style={tw`flex-row items-center mb-3`}>
                <Clock size={18} color="#0284c7" />
                <Text style={[tw`text-sm font-bold ml-2`, { color: colors.text }]}>
                  {t('onboarding.alarmGuaranteeTitle', 'Exact Hardware Alarms')}
                </Text>
              </View>
              <Text style={[tw`text-xs leading-4`, { color: colors.textSecondary }]}>
                {t(
                  'onboarding.alarmGuaranteeDesc',
                  'Uses Android AlarmClock API to ensure medication alarms ring on time even in battery-saver and Doze mode.'
                )}
              </Text>
            </View>

            <View
              style={[
                tw`p-4 rounded-2xl border mb-6`,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <View style={tw`flex-row items-center mb-3`}>
                <Heart size={18} color="#e11d48" />
                <Text style={[tw`text-sm font-bold ml-2`, { color: colors.text }]}>
                  {t('onboarding.safetyFirstTitle', 'Built-in Medication Safety')}
                </Text>
              </View>
              <Text style={[tw`text-xs leading-4`, { color: colors.textSecondary }]}>
                {t(
                  'onboarding.safetyFirstDesc',
                  'Automatic dose gap protection prevents double-dosing, ceiling dose tracking for pain relief, and real-time inventory management.'
                )}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setStep(2)}
              style={[
                tw`py-4 rounded-xl items-center justify-center flex-row shadow-sm`,
                { backgroundColor: colors.primary }
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Continue to permissions setup"
            >
              <Text style={tw`text-white font-bold text-base mr-2`}>
                {t('common.continue', 'Continue')}
              </Text>
              <ArrowRight size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Permissions Explanation */}
        {step === 2 && (
          <View>
            <View style={tw`items-center my-4`}>
              <View
                style={[
                  tw`w-16 h-16 rounded-full items-center justify-center mb-3`,
                  { backgroundColor: `${colors.primary}20` }
                ]}
              >
                <Bell size={32} color={colors.primary} />
              </View>
              <Text style={[tw`text-xl font-bold text-center mb-1`, { color: colors.text }]}>
                {t('onboarding.permissionsTitle', 'Reliability Permissions')}
              </Text>
              <Text
                style={[
                  tw`text-xs text-center px-4`,
                  { color: colors.textSecondary }
                ]}
              >
                {t(
                  'onboarding.permissionsSubtitle',
                  'To never miss a critical medication dose, LifeTrack uses dedicated Android system services.'
                )}
              </Text>
            </View>

            {/* Permission 1: Exact Alarm */}
            <View
              style={[
                tw`p-4 rounded-2xl border mb-3 flex-row items-start`,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <View style={tw`p-2 rounded-xl bg-blue-500/10 mr-3 mt-0.5`}>
                <Clock size={20} color="#0284c7" />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                  {t('onboarding.permExactAlarm', 'Exact Alarms & Timers')}
                </Text>
                <Text style={[tw`text-xs mt-1 leading-4`, { color: colors.textSecondary }]}>
                  {t('onboarding.permExactAlarmDesc', 'Allows firing exact alarms to the exact minute without OS deferrals.')}
                </Text>
              </View>
            </View>

            {/* Permission 2: Notifications */}
            <View
              style={[
                tw`p-4 rounded-2xl border mb-3 flex-row items-start`,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <View style={tw`p-2 rounded-xl bg-emerald-500/10 mr-3 mt-0.5`}>
                <Bell size={20} color="#10b981" />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                  {t('onboarding.permNotifications', 'High-Priority Notifications')}
                </Text>
                <Text style={[tw`text-xs mt-1 leading-4`, { color: colors.textSecondary }]}>
                  {t('onboarding.permNotificationsDesc', 'Displays full-screen alarm overlays with sound and vibration.')}
                </Text>
              </View>
            </View>

            {/* Permission 3: Battery Optimization */}
            <View
              style={[
                tw`p-4 rounded-2xl border mb-6 flex-row items-start`,
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
            >
              <View style={tw`p-2 rounded-xl bg-amber-500/10 mr-3 mt-0.5`}>
                <Battery size={20} color="#f59e0b" />
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                  {t('onboarding.permBattery', 'Battery Exemption')}
                </Text>
                <Text style={[tw`text-xs mt-1 leading-4`, { color: colors.textSecondary }]}>
                  {t('onboarding.permBatteryDesc', 'Prevents aggressive phone background task killers from silencing alarms.')}
                </Text>
              </View>
            </View>

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                onPress={() => setStep(1)}
                style={[
                  tw`flex-1 py-4 rounded-xl items-center justify-center border`,
                  { borderColor: colors.border }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Go back to previous step"
              >
                <Text style={[tw`font-semibold`, { color: colors.textSecondary }]}>
                  {t('common.back', 'Back')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(3)}
                style={[
                  tw`flex-2 py-4 rounded-xl items-center justify-center flex-row shadow-sm`,
                  { backgroundColor: colors.primary }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Continue to profile setup"
              >
                <Text style={tw`text-white font-bold text-base mr-2`}>
                  {t('common.continue', 'Continue')}
                </Text>
                <ArrowRight size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3: Basic Profile */}
        {step === 3 && (
          <View>
            <View style={tw`items-center my-4`}>
              <View
                style={[
                  tw`w-16 h-16 rounded-full items-center justify-center mb-3`,
                  { backgroundColor: `${colors.primary}20` }
                ]}
              >
                <User size={32} color={colors.primary} />
              </View>
              <Text style={[tw`text-xl font-bold text-center mb-1`, { color: colors.text }]}>
                {t('onboarding.profileTitle', 'Your Health Profile')}
              </Text>
              <Text
                style={[
                  tw`text-xs text-center px-4`,
                  { color: colors.textSecondary }
                ]}
              >
                {t(
                  'onboarding.profileSubtitle',
                  'Essential information kept safely on your device for medical emergencies.'
                )}
              </Text>
            </View>

            {/* Name Input */}
            <View style={tw`mb-4`}>
              <Text style={[tw`text-xs font-bold mb-1.5`, { color: colors.text }]}>
                {t('profile.fullName', 'Full Name')}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.textSecondary}
                style={[
                  tw`p-3.5 rounded-xl border text-sm font-medium`,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                accessible={true}
                accessibilityRole="none"
                accessibilityLabel="Full name input"
              />
            </View>

            {/* Blood Group Selector */}
            <View style={tw`mb-4`}>
              <Text style={[tw`text-xs font-bold mb-1.5`, { color: colors.text }]}>
                {t('profile.bloodGroup', 'Blood Group')}
              </Text>
              <View style={tw`flex-row flex-wrap gap-2`}>
                {bloodGroups.map((bg) => (
                  <TouchableOpacity
                    key={bg}
                    onPress={() => setBloodGroup(bg)}
                    style={[
                      tw`px-3.5 py-2 rounded-xl border items-center justify-center`,
                      bloodGroup === bg
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.card, borderColor: colors.border }
                    ]}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Blood group ${bg}`}
                  >
                    <Text
                      style={[
                        tw`text-xs font-bold`,
                        bloodGroup === bg ? tw`text-white` : { color: colors.text }
                      ]}
                    >
                      {bg}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Emergency Contact */}
            <View style={tw`mb-4`}>
              <Text style={[tw`text-xs font-bold mb-1.5`, { color: colors.text }]}>
                {t('profile.emergencyContact', 'Emergency Contact Name')}
              </Text>
              <TextInput
                value={emergencyContact}
                onChangeText={setEmergencyContact}
                placeholder="Doctor / Family Member"
                placeholderTextColor={colors.textSecondary}
                style={[
                  tw`p-3.5 rounded-xl border text-sm font-medium`,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                accessible={true}
                accessibilityRole="none"
                accessibilityLabel="Emergency contact name input"
              />
            </View>

            <View style={tw`mb-6`}>
              <Text style={[tw`text-xs font-bold mb-1.5`, { color: colors.text }]}>
                {t('profile.emergencyPhone', 'Emergency Phone Number')}
              </Text>
              <TextInput
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder="Contact phone number"
                keyboardType="phone-pad"
                placeholderTextColor={colors.textSecondary}
                style={[
                  tw`p-3.5 rounded-xl border text-sm font-medium`,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text
                  }
                ]}
                accessible={true}
                accessibilityRole="none"
                accessibilityLabel="Emergency phone input"
              />
            </View>

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                onPress={() => setStep(2)}
                style={[
                  tw`flex-1 py-4 rounded-xl items-center justify-center border`,
                  { borderColor: colors.border }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Go back to permissions step"
              >
                <Text style={[tw`font-semibold`, { color: colors.textSecondary }]}>
                  {t('common.back', 'Back')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(4)}
                style={[
                  tw`flex-2 py-4 rounded-xl items-center justify-center flex-row shadow-sm`,
                  { backgroundColor: colors.primary }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Continue to shift schedule question"
              >
                <Text style={tw`text-white font-bold text-base mr-2`}>
                  {t('common.continue', 'Continue')}
                </Text>
                <ArrowRight size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 4: Work & Shift Routine (Strictly OFF by default) */}
        {step === 4 && (
          <View>
            <View style={tw`items-center my-4`}>
              <View
                style={[
                  tw`w-16 h-16 rounded-full items-center justify-center mb-3`,
                  { backgroundColor: `${colors.primary}20` }
                ]}
              >
                <Calendar size={32} color={colors.primary} />
              </View>
              <Text style={[tw`text-xl font-bold text-center mb-2`, { color: colors.text }]}>
                {t('onboarding.shiftQuestionTitle', 'Work Routine & Shifts')}
              </Text>
              <Text
                style={[
                  tw`text-sm font-medium text-center px-2 mb-4 leading-5`,
                  { color: colors.text }
                ]}
              >
                {t(
                  'onboarding.shiftQuestion',
                  'Do you work in shifts or want your reminders to follow a work schedule?'
                )}
              </Text>
            </View>

            {/* Option 1: No / Regular Routine (Recommended) */}
            <TouchableOpacity
              onPress={() => setShiftChoice('no')}
              style={[
                tw`p-4 rounded-2xl border mb-3 flex-row items-start`,
                shiftChoice === 'no'
                  ? { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }
                  : { borderColor: colors.border, backgroundColor: colors.card }
              ]}
              accessible={true}
              accessibilityRole="radio"
              accessibilityLabel="No, I have a standard routine"
            >
              <View style={tw`mr-3 mt-1`}>
                <View
                  style={[
                    tw`w-5 h-5 rounded-full border items-center justify-center`,
                    shiftChoice === 'no'
                      ? { borderColor: colors.primary, backgroundColor: colors.primary }
                      : { borderColor: colors.textSecondary }
                  ]}
                >
                  {shiftChoice === 'no' && <View style={tw`w-2 h-2 rounded-full bg-white`} />}
                </View>
              </View>
              <View style={tw`flex-1`}>
                <View style={tw`flex-row items-center`}>
                  <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                    {t('onboarding.shiftOptionNo', 'No — Standard Daily Routine')}
                  </Text>
                  <Text style={[tw`text-xs ml-2 px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-600`]}>
                    {t('common.recommended', 'Recommended')}
                  </Text>
                </View>
                <Text style={[tw`text-xs mt-1 leading-4`, { color: colors.textSecondary }]}>
                  {t(
                    'onboarding.shiftOptionNoDesc',
                    'Single, clean daily routine. All complex shift UI will be hidden.'
                  )}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Yes / Shift Worker */}
            <TouchableOpacity
              onPress={() => setShiftChoice('yes')}
              style={[
                tw`p-4 rounded-2xl border mb-3 flex-row items-start`,
                shiftChoice === 'yes'
                  ? { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }
                  : { borderColor: colors.border, backgroundColor: colors.card }
              ]}
              accessible={true}
              accessibilityRole="radio"
              accessibilityLabel="Yes, I work in rotating shifts"
            >
              <View style={tw`mr-3 mt-1`}>
                <View
                  style={[
                    tw`w-5 h-5 rounded-full border items-center justify-center`,
                    shiftChoice === 'yes'
                      ? { borderColor: colors.primary, backgroundColor: colors.primary }
                      : { borderColor: colors.textSecondary }
                  ]}
                >
                  {shiftChoice === 'yes' && <View style={tw`w-2 h-2 rounded-full bg-white`} />}
                </View>
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                  {t('onboarding.shiftOptionYes', 'Yes — Rotating / Irregular Shifts')}
                </Text>
                <Text style={[tw`text-xs mt-1 leading-4`, { color: colors.textSecondary }]}>
                  {t(
                    'onboarding.shiftOptionYesDesc',
                    'Enable shift schedules to adapt reminder timings to Day, Evening, and Night shifts.'
                  )}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 3: Decide Later */}
            <TouchableOpacity
              onPress={() => setShiftChoice('later')}
              style={[
                tw`p-4 rounded-2xl border mb-6 flex-row items-start`,
                shiftChoice === 'later'
                  ? { borderColor: colors.primary, backgroundColor: `${colors.primary}10` }
                  : { borderColor: colors.border, backgroundColor: colors.card }
              ]}
              accessible={true}
              accessibilityRole="radio"
              accessibilityLabel="Decide later"
            >
              <View style={tw`mr-3 mt-1`}>
                <View
                  style={[
                    tw`w-5 h-5 rounded-full border items-center justify-center`,
                    shiftChoice === 'later'
                      ? { borderColor: colors.primary, backgroundColor: colors.primary }
                      : { borderColor: colors.textSecondary }
                  ]}
                >
                  {shiftChoice === 'later' && <View style={tw`w-2 h-2 rounded-full bg-white`} />}
                </View>
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-sm font-bold`, { color: colors.text }]}>
                  {t('onboarding.shiftOptionLater', 'Decide Later')}
                </Text>
                <Text style={[tw`text-xs mt-1 leading-4`, { color: colors.textSecondary }]}>
                  {t(
                    'onboarding.shiftOptionLaterDesc',
                    'Keeps shifts OFF for now. You can turn it on anytime under Profile & Settings.'
                  )}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                onPress={() => setStep(3)}
                style={[
                  tw`flex-1 py-4 rounded-xl items-center justify-center border`,
                  { borderColor: colors.border }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Go back to profile step"
              >
                <Text style={[tw`font-semibold`, { color: colors.textSecondary }]}>
                  {t('common.back', 'Back')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFinish}
                disabled={isSaving}
                style={[
                  tw`flex-2 py-4 rounded-xl items-center justify-center flex-row shadow-sm`,
                  { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Complete onboarding and open LifeTrack"
              >
                <Text style={tw`text-white font-bold text-base mr-2`}>
                  {isSaving ? t('common.saving', 'Saving...') : t('onboarding.startApp', 'Start LifeTrack')}
                </Text>
                <CheckCircle size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
