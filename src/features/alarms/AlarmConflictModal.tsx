import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { AlarmConflictResult } from '../../domain/alarmConflict';
import { resolveAlarmCategory } from '../../domain/alarm';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  ShieldAlert,
  Sparkles
} from 'lucide-react-native';

interface AlarmConflictModalProps {
  conflictResult: AlarmConflictResult;
  candidateTitle: string;
  candidateTimeMs: number;
  onProceedAnyway: () => void;
  onApplySuggestion: (suggestedTimeMs: number) => void;
  onCancel: () => void;
}

export const AlarmConflictModal: React.FC<AlarmConflictModalProps> = ({
  conflictResult,
  candidateTitle,
  candidateTimeMs,
  onProceedAnyway,
  onApplySuggestion,
  onCancel
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  if (!conflictResult.hasConflict || conflictResult.conflictingAlarms.length === 0) {
    return null;
  }

  const primaryConflict = conflictResult.conflictingAlarms[0];
  const existingCat = resolveAlarmCategory(primaryConflict.alarm);

  const candidateTimeStr = new Date(candidateTimeMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  const existingTimeStr = new Date(primaryConflict.alarm.triggerTimeMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <View
      style={tw`fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4`}
      accessible={true}
      accessibilityRole="alert"
    >
      <View
        style={[
          tw`rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden border`,
          {
            backgroundColor: colors.card,
            borderColor: '#f59e0b'
          }
        ]}
      >
        {/* Header */}
        <View
          style={[
            tw`p-4 border-b flex-row items-center justify-between`,
            {
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.15)',
              borderBottomColor: colors.border
            }
          ]}
        >
          <View style={tw`flex-row items-center gap-2.5 flex-1`}>
            <View style={tw`w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center`}>
              <AlertTriangle size={16} color="#f59e0b" />
            </View>
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm font-bold tracking-tight`, { color: colors.text }]}>
                {t('conflict.title')}
              </Text>
              <Text style={tw`text-[11px] text-amber-500 font-medium`}>
                Within {conflictResult.windowMinutes}-minute safety buffer
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onCancel}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('conflict.cancelSchedule')}
            style={[tw`p-1.5 rounded-lg`, { backgroundColor: colors.cardSecondary }]}
          >
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={tw`p-5 flex-col gap-4`}>
          <Text style={[tw`leading-relaxed text-sm`, { color: colors.textSecondary }]}>
            {t('conflict.description', { title: candidateTitle || 'Alarm' })}
          </Text>

          {/* Comparison Side-by-Side Card */}
          <View
            style={[
              tw`p-4 rounded-2xl border flex-col gap-3`,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border
              }
            ]}
          >
            {/* Candidate / New Alarm */}
            <View style={tw`flex-row items-center justify-between gap-2`}>
              <View style={tw`flex-row items-center gap-2 flex-1`}>
                <View style={tw`w-2 h-2 rounded-full bg-indigo-500 shrink-0`} />
                <Text style={[tw`shrink-0 text-sm`, { color: colors.textMuted }]}>New:</Text>
                <Text style={[tw`font-bold shrink text-sm`, { color: colors.text }]} numberOfLines={1}>
                  {candidateTitle || 'Untitled'}
                </Text>
              </View>
              <Text style={[tw`font-mono font-bold shrink-0 text-sm`, { color: colors.primaryText }]}>
                {candidateTimeStr}
              </Text>
            </View>

            <View style={[tw`border-t pt-3 flex-row items-center justify-between gap-2`, { borderTopColor: colors.border }]}>
              <View style={tw`flex-row items-center gap-2 flex-1`}>
                <View
                  style={[tw`w-2 h-2 rounded-full shrink-0`, { backgroundColor: existingCat.color }]}
                />
                <Text style={[tw`shrink-0 text-sm`, { color: colors.textMuted }]}>Existing:</Text>
                <Text style={[tw`font-bold shrink text-sm`, { color: colors.text }]} numberOfLines={1}>
                  {primaryConflict.alarm.title}
                </Text>
              </View>
              <Text style={[tw`font-mono font-bold shrink-0 text-sm`, { color: colors.textSecondary }]}>
                {existingTimeStr}
              </Text>
            </View>

            <View style={tw`text-[11px] bg-amber-500/10 p-2.5 rounded-xl flex-row items-center gap-1.5`}>
              <ShieldAlert size={14} color="#f59e0b" style={tw`shrink-0`} />
              <Text style={tw`text-amber-500 font-medium text-xs flex-1`}>
                {primaryConflict.isExactOverlap
                  ? 'Fires at the exact same minute!'
                  : `Separated by only ${primaryConflict.differenceMinutes} minute${primaryConflict.differenceMinutes === 1 ? '' : 's'}.`}
              </Text>
            </View>
          </View>

          {/* Smart Resolution Suggestions */}
          {conflictResult.suggestions.length > 0 && (
            <View style={tw`flex-col gap-3 pt-2`}>
              <View style={tw`flex-row items-center gap-1.5`}>
                <Sparkles size={14} color="#10b981" />
                <Text style={tw`text-sm font-bold text-emerald-500`}>
                  Recommended One-Tap Adjustments:
                </Text>
              </View>

              <View style={tw`flex-col gap-2.5`}>
                {conflictResult.suggestions.map((sug, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => onApplySuggestion(sug.suggestedTimeMs)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('conflict.suggestion', { time: sug.formattedTime })}
                    style={tw`w-full p-3.5 rounded-2xl bg-emerald-500/10 active:bg-emerald-500/20 border border-emerald-500/30 flex-row items-center justify-between min-h-12`}
                  >
                    <View style={tw`flex-row items-center gap-2.5`}>
                      <Clock size={16} color="#10b981" />
                      <Text style={tw`text-sm font-bold text-emerald-500`}>{sug.label}</Text>
                    </View>
                    <Text style={tw`font-mono font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg text-sm`}>
                      {sug.formattedTime}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Footer Actions */}
        <View
          style={[
            tw`p-5 border-t flex-row items-center justify-between gap-3`,
            {
              backgroundColor: colors.cardSecondary,
              borderTopColor: colors.border
            }
          ]}
        >
          <TouchableOpacity
            onPress={onCancel}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('conflict.cancelSchedule')}
            style={[
              tw`py-3.5 px-6 rounded-2xl border min-h-12 justify-center`,
              {
                backgroundColor: colors.card,
                borderColor: colors.border
              }
            ]}
          >
            <Text style={[tw`text-sm font-bold`, { color: colors.textSecondary }]}>
              {t('conflict.cancelSchedule')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onProceedAnyway}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('conflict.proceedAnyway')}
            style={tw`flex-1 py-3.5 px-4 rounded-2xl bg-amber-600 active:bg-amber-700 shadow-md flex-row items-center justify-center gap-2 min-h-12`}
          >
            <CheckCircle2 size={18} color="#fff" />
            <Text style={tw`text-sm font-bold text-white`}>
              {t('conflict.proceedAnyway')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
