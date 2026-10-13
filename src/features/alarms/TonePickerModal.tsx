import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, SectionList, Modal, ActivityIndicator } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { Check, Play, Square, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { reminderService } from '../../services/AlarmEngineService';
import type { NativeTone } from '../../../modules/alarm-engine';

export interface ToneSelection {
  /** Content URI of the chosen tone; undefined = the default tone. */
  uri?: string;
  name?: string;
}

interface TonePickerModalProps {
  visible: boolean;
  selectedUri?: string;
  onSelect: (selection: ToneSelection) => void;
  onClose: () => void;
}

interface ToneRow {
  uri?: string;
  title: string;
}

const KIND_ORDER: NativeTone['kind'][] = ['alarm', 'notification', 'ringtone'];

/** Pick one of the phone's sounds (or the default) with a short preview. Mounted only while open. */
const TonePickerContent: React.FC<Omit<TonePickerModalProps, 'visible'>> = ({ selectedUri, onSelect, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [tones, setTones] = useState<NativeTone[] | null>(null);
  const [selected, setSelected] = useState<string | undefined>(selectedUri);
  const [playingUri, setPlayingUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    reminderService
      .getSystemTones()
      .then((list) => {
        if (active) setTones(list);
      })
      .catch(() => {
        if (active) setTones([]);
      });
    return () => {
      active = false;
      reminderService.stopTonePreview();
    };
  }, []);

  const sections = useMemo(() => {
    const defaultSection = {
      key: 'default',
      title: t('tones.defaultSection'),
      data: [{ uri: undefined, title: t('tones.defaultTone') }] as ToneRow[]
    };
    const byKind = KIND_ORDER.map((kind) => ({
      key: kind,
      title: t(`tones.section_${kind}`),
      data: (tones ?? []).filter((tone) => tone.kind === kind).map((tone) => ({ uri: tone.uri, title: tone.title }))
    })).filter((section) => section.data.length > 0);
    return [defaultSection, ...byKind];
  }, [tones, t]);

  const handlePreview = async (uri: string) => {
    if (playingUri === uri) {
      await reminderService.stopTonePreview();
      setPlayingUri(null);
      return;
    }
    const ok = await reminderService.previewTone(uri);
    setPlayingUri(ok ? uri : null);
    if (ok) {
      setTimeout(() => setPlayingUri((current) => (current === uri ? null : current)), 6000);
    }
  };

  const handleDone = () => {
    const chosen = (tones ?? []).find((tone) => tone.uri === selected);
    onSelect(chosen ? { uri: chosen.uri, name: chosen.title } : {});
    onClose();
  };

  const toneCount = tones?.length ?? 0;

  return (
    <View style={tw`flex-1 justify-end bg-black/60`}>
      <View
        style={[tw`max-h-[85%] rounded-t-3xl border-t`, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityViewIsModal={true}
        accessibilityLabel={t('tones.title')}
      >
        <View style={[tw`flex-row items-center justify-between px-5 py-4 border-b`, { borderBottomColor: colors.border }]}>
          <Text style={[tw`text-base font-bold`, { color: colors.text }]}>{t('tones.title')}</Text>
          <TouchableOpacity
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.close')}
            style={tw`p-2`}
          >
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {tones === null ? (
          <View style={tw`py-10 items-center`}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => item.uri ?? `default-${index}`}
            contentContainerStyle={tw`px-4 pb-4`}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text style={[tw`text-[11px] font-bold uppercase tracking-wider mt-4 mb-2`, { color: colors.textMuted }]}>
                {section.title}
              </Text>
            )}
            ListFooterComponent={
              toneCount === 0 ? (
                <Text style={[tw`text-xs mt-3`, { color: colors.textMuted }]}>{t('tones.noPhoneTones')}</Text>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = item.uri === selected;
              const isPlaying = !!item.uri && playingUri === item.uri;
              return (
                <View
                  style={[
                    tw`flex-row items-center rounded-xl border mb-1.5`,
                    isSelected
                      ? { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }
                      : { backgroundColor: colors.cardSecondary, borderColor: colors.borderLight }
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setSelected(item.uri)}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.title}
                    style={tw`flex-1 flex-row items-center gap-2 px-3 py-3 min-h-11`}
                  >
                    <View style={tw`w-5 items-center`}>
                      {isSelected ? <Check size={16} color={colors.primary} /> : null}
                    </View>
                    <Text style={[tw`text-sm flex-1`, { color: colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                  {item.uri ? (
                    <TouchableOpacity
                      onPress={() => handlePreview(item.uri as string)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={isPlaying ? t('soundSettings.stop') : `${t('soundSettings.preview')}: ${item.title}`}
                      style={tw`px-3 py-3 min-h-11 min-w-11 items-center justify-center`}
                    >
                      {isPlaying ? <Square size={14} color={colors.primary} /> : <Play size={14} color={colors.textMuted} />}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        <View style={[tw`px-5 py-4 border-t`, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleDone}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('tones.useTone')}
            style={[tw`py-3.5 rounded-xl items-center min-h-11`, { backgroundColor: colors.primary }]}
          >
            <Text style={tw`text-sm font-bold text-white`}>{t('tones.useTone')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const TonePickerModal: React.FC<TonePickerModalProps> = ({ visible, ...props }) => (
  <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={props.onClose}>
    {visible && <TonePickerContent {...props} />}
  </Modal>
);
