import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage } from '../../i18n';
import { X, Check, Globe, Sun, Moon, Monitor } from 'lucide-react-native';

interface LanguageThemeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LanguageThemeModal: React.FC<LanguageThemeModalProps> = ({
  visible,
  onClose
}) => {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const currentLang = getCurrentLanguage();

  if (!visible) return null;

  const handleSelectLanguage = async (code: 'en' | 'hi' | 'mr' | 'es') => {
    await changeLanguage(code);
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'light',
      label: t('theme.light'),
      icon: <Sun size={18} color={isDark ? '#e4e4e7' : '#0f172a'} />
    },
    {
      mode: 'dark',
      label: t('theme.dark'),
      icon: <Moon size={18} color={isDark ? '#e4e4e7' : '#0f172a'} />
    },
    {
      mode: 'system',
      label: t('theme.system'),
      icon: <Monitor size={18} color={isDark ? '#e4e4e7' : '#0f172a'} />
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessible={true}
      accessibilityViewIsModal={true}
    >
      <View
        style={tw`flex-1 items-center justify-center p-4 bg-black/60`}
        accessibilityRole="none"
      >
        <View
          style={[
            tw`w-full max-w-sm rounded-3xl p-5 shadow-2xl`,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1
            }
          ]}
          accessible={true}
          accessibilityRole="header"
        >
          {/* Header */}
          <View style={[tw`flex-row items-center justify-between pb-3 border-b mb-4`, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={tw`flex-row items-center gap-2`}>
              <Globe size={20} color={colors.primary} />
              <Text style={[tw`text-base font-bold`, { color: colors.text }]}>
                {t('settings.language')} & {t('settings.theme')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('alarmForm.cancel')}
              style={[tw`p-2 rounded-xl`, { backgroundColor: colors.cardSecondary }]}
            >
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Language Selection Section */}
            <View style={tw`mb-5`}>
              <Text
                style={[tw`text-xs font-semibold uppercase tracking-wider mb-2.5`, { color: colors.textMuted }]}
                accessibilityRole="header"
              >
                {t('settings.selectLanguage')}
              </Text>
              <View style={tw`flex-col gap-2`}>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = currentLang === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      onPress={() => handleSelectLanguage(lang.code)}
                      accessible={true}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${lang.nativeName} (${lang.name})`}
                      style={[
                        tw`flex-row items-center justify-between p-3.5 rounded-2xl border`,
                        {
                          backgroundColor: isSelected ? colors.primaryBg : colors.cardSecondary,
                          borderColor: isSelected ? colors.primary : colors.border
                        }
                      ]}
                    >
                      <View style={tw`flex-row items-center gap-3`}>
                        <Text style={tw`text-xl`}>{lang.flag}</Text>
                        <View>
                          <Text
                            style={[
                              tw`text-sm font-semibold`,
                              { color: isSelected ? colors.primaryText : colors.text }
                            ]}
                          >
                            {lang.nativeName}
                          </Text>
                          <Text style={[tw`text-xs`, { color: colors.textMuted }]}>
                            {lang.name}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <View
                          style={[
                            tw`w-6 h-6 rounded-full items-center justify-center`,
                            { backgroundColor: colors.primary }
                          ]}
                        >
                          <Check size={14} color="#ffffff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Theme Selection Section */}
            <View style={tw`mb-2`}>
              <Text
                style={[tw`text-xs font-semibold uppercase tracking-wider mb-2.5`, { color: colors.textMuted }]}
                accessibilityRole="header"
              >
                {t('settings.theme')}
              </Text>
              <View style={tw`flex-row gap-2`}>
                {themeOptions.map((opt) => {
                  const isSelected = themeMode === opt.mode;
                  return (
                    <TouchableOpacity
                      key={opt.mode}
                      onPress={() => setThemeMode(opt.mode)}
                      accessible={true}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${opt.label} theme`}
                      style={[
                        tw`flex-1 flex-col items-center justify-center py-3 px-2 rounded-2xl border gap-1.5`,
                        {
                          backgroundColor: isSelected ? colors.primaryBg : colors.cardSecondary,
                          borderColor: isSelected ? colors.primary : colors.border
                        }
                      ]}
                    >
                      {opt.icon}
                      <Text
                        style={[
                          tw`text-xs font-semibold`,
                          { color: isSelected ? colors.primaryText : colors.text }
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('alarmForm.cancel')}
            style={[
              tw`mt-4 w-full py-3 rounded-2xl items-center justify-center`,
              { backgroundColor: colors.primary }
            ]}
          >
            <Text style={tw`text-white font-semibold text-sm`}>
              {t('timeline.all')} / Done
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
