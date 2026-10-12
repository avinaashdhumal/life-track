import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { UserProfileRecord } from '../../services/DatabaseService';
import { profileRepository } from '../../data/profileRepository';
import { routineRepository } from '../../data/routineRepository';
import { DailyRoutine } from '../../domain/routine';

interface EditProfileModalProps {
  visible: boolean;
  profile: UserProfileRecord | null;
  routine: DailyRoutine | null;
  onClose: () => void;
  onSaved: () => void;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, profile, routine, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formBloodGroup, setFormBloodGroup] = useState('');
  const [formEmergencyContact, setFormEmergencyContact] = useState('');
  const [formEmergencyPhone, setFormEmergencyPhone] = useState('');
  const [formConditions, setFormConditions] = useState('');
  const [formWakeTime, setFormWakeTime] = useState('07:00');
  const [formSleepTime, setFormSleepTime] = useState('23:00');

  useEffect(() => {
    if (!visible) return;
    setFormName(profile?.name || '');
    setFormPhone(profile?.phone || '');
    setFormBloodGroup(profile?.bloodGroup || '');
    setFormEmergencyContact(profile?.emergencyContact || '');
    setFormEmergencyPhone(profile?.emergencyContactPhone || '');
    setFormConditions((profile?.medicalConditions || []).join(', '));
    setFormWakeTime(routine?.wakeTime || '07:00');
    setFormSleepTime(routine?.sleepTime || '23:00');
  }, [visible, profile, routine]);

  const handleSave = async () => {
    const wake = formWakeTime.trim();
    const sleep = formSleepTime.trim();
    if (!TIME_PATTERN.test(wake) || !TIME_PATTERN.test(sleep)) {
      Alert.alert(t('common.invalidTime'), t('common.invalidTimeDesc'));
      return;
    }

    await profileRepository.updateProfile({
      name: formName.trim() || 'User',
      phone: formPhone.trim(),
      bloodGroup: formBloodGroup.trim(),
      emergencyContact: formEmergencyContact.trim(),
      emergencyContactPhone: formEmergencyPhone.trim(),
      medicalConditions: formConditions.split(',').map((c) => c.trim()).filter(Boolean)
    });

    // Wake and sleep belong to the daily routine (the one place reminders read them from).
    if (!routine || routine.wakeTime !== wake || routine.sleepTime !== sleep) {
      await routineRepository.updateRoutine({ wakeTime: wake, sleepTime: sleep });
    }

    onSaved();
    onClose();
  };

  const inputStyle = [
    tw`p-3 rounded-xl border text-sm`,
    { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }
  ];
  const labelStyle = [tw`text-xs font-semibold mb-1`, { color: colors.textSecondary }];

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
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
            <Text style={[tw`text-base font-bold`, { color: colors.text }]}>{t('profileSettings.editProfile')}</Text>
            <TouchableOpacity
              onPress={onClose}
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
              <Text style={labelStyle}>{t('profileSettings.nameLabel')}</Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                style={inputStyle}
                placeholder={t('profileSettings.nameLabel')}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={t('profileSettings.nameLabel')}
              />
            </View>

            <View style={tw`flex-row gap-3`}>
              <View style={tw`flex-1`}>
                <Text style={labelStyle}>{t('profileSettings.phoneLabel')}</Text>
                <TextInput
                  value={formPhone}
                  onChangeText={setFormPhone}
                  keyboardType="phone-pad"
                  style={inputStyle}
                  placeholder="+91..."
                  placeholderTextColor={colors.textSubtle}
                  accessibilityLabel={t('profileSettings.phoneLabel')}
                />
              </View>
              <View style={tw`w-24`}>
                <Text style={labelStyle}>{t('profileSettings.bloodGroupLabel')}</Text>
                <TextInput
                  value={formBloodGroup}
                  onChangeText={setFormBloodGroup}
                  style={inputStyle}
                  placeholder="O+"
                  placeholderTextColor={colors.textSubtle}
                  accessibilityLabel={t('profileSettings.bloodGroupLabel')}
                />
              </View>
            </View>

            <View>
              <Text style={labelStyle}>{t('profileSettings.emergencyContactNameLabel')}</Text>
              <TextInput
                value={formEmergencyContact}
                onChangeText={setFormEmergencyContact}
                style={inputStyle}
                placeholder={t('profileSettings.emergencyContactNameLabel')}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={t('profileSettings.emergencyContactNameLabel')}
              />
            </View>

            <View>
              <Text style={labelStyle}>{t('profileSettings.emergencyContactPhoneLabel')}</Text>
              <TextInput
                value={formEmergencyPhone}
                onChangeText={setFormEmergencyPhone}
                keyboardType="phone-pad"
                style={inputStyle}
                placeholder="+91..."
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={t('profileSettings.emergencyContactPhoneLabel')}
              />
            </View>

            <View>
              <Text style={labelStyle}>{t('profileSettings.conditionsLabel')}</Text>
              <TextInput
                value={formConditions}
                onChangeText={setFormConditions}
                style={inputStyle}
                placeholder={t('profileSettings.conditionsPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel={t('profileSettings.conditionsLabel')}
              />
            </View>

            <View style={tw`flex-row gap-3`}>
              <View style={tw`flex-1`}>
                <Text style={labelStyle}>{t('profileSettings.wakeTimeLabel')}</Text>
                <TextInput
                  value={formWakeTime}
                  onChangeText={setFormWakeTime}
                  style={inputStyle}
                  placeholder="07:00"
                  placeholderTextColor={colors.textSubtle}
                  accessibilityLabel={t('profileSettings.wakeTimeLabel')}
                />
              </View>
              <View style={tw`flex-1`}>
                <Text style={labelStyle}>{t('profileSettings.sleepTimeLabel')}</Text>
                <TextInput
                  value={formSleepTime}
                  onChangeText={setFormSleepTime}
                  style={inputStyle}
                  placeholder="23:00"
                  placeholderTextColor={colors.textSubtle}
                  accessibilityLabel={t('profileSettings.sleepTimeLabel')}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
              style={[tw`py-3.5 px-4 rounded-xl items-center justify-center mt-3 min-h-11`, { backgroundColor: colors.primary }]}
            >
              <Text style={tw`text-sm font-bold text-white`}>{t('common.save')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
