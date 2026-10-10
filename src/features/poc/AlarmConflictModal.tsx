import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Switch, Image } from 'react-native';
import tw from 'twrnc';
import { AlarmConflictResult } from '../../domain/alarmConflict';
import { CategoryIcon } from './Alarm24hTimelineChart';
import { resolveAlarmCategory } from '../../domain/alarm';
import {
  AlertTriangle,
  Clock,
  ArrowRight,
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
    <View style={tw`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150`}>
      <View style={tw`bg-zinc-900 border border-amber-500/40 rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden text-white`}>
        {/* Header */}
        <View style={tw`p-4 border-b border-zinc-800 bg-amber-500/10 flex items-center justify-between`}>
          <View style={tw`flex items-center gap-2.5`}>
            <View style={tw`w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400`}>
              <AlertTriangle style={tw`w-4 h-4`} />
            </View>
            <View>
              <Text style={tw`text-sm font-bold text-white tracking-tight`}>
                Alarm Schedule Conflict Detected
              </Text>
              <Text style={tw`text-[11px] text-amber-300/80`}>
                Within {conflictResult.windowMinutes}-minute safety buffer
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onCancel}
            style={tw`p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition`}
          >
            <X style={tw`w-4 h-4`} />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={tw`p-5 flex-col gap-4 text-sm`}>
          <Text style={tw`text-zinc-300 leading-relaxed text-sm`}>
            Scheduling two alarms too close together can cause audio collisions or missed reminders when your phone rings.
          </Text>

          {/* Comparison Side-by-Side Card */}
          <View style={tw`p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex-col gap-3`}>
            {/* Candidate / New Alarm */}
            <View style={tw`flex-row items-center justify-between gap-2`}>
              <View style={tw`flex-row items-center gap-2 flex-1`}>
                <Text style={tw`w-2 h-2 rounded-full bg-indigo-400 shrink-0`} />
                <Text style={tw`text-zinc-400 shrink-0 text-sm`}>New:</Text>
                <Text style={tw`font-bold text-white shrink`} numberOfLines={1}>{candidateTitle || 'Untitled'}</Text>
              </View>
              <Text style={tw`font-mono text-indigo-300 font-bold shrink-0 text-sm`}>{candidateTimeStr}</Text>
            </View>

            <View style={tw`border-t border-zinc-800/80 pt-3 flex-row items-center justify-between gap-2`}>
              <View style={tw`flex-row items-center gap-2 flex-1`}>
                <Text
                  style={[tw`w-2 h-2 rounded-full shrink-0`, { backgroundColor: existingCat.color }]}
                />
                <Text style={tw`text-zinc-400 shrink-0 text-sm`}>Existing:</Text>
                <Text style={tw`font-bold text-white shrink`} numberOfLines={1}>
                  {primaryConflict.alarm.title}
                </Text>
              </View>
              <Text style={tw`font-mono text-zinc-300 font-bold shrink-0 text-sm`}>{existingTimeStr}</Text>
            </View>

            <View style={tw`text-[11px] text-amber-400 font-medium bg-amber-500/10 p-2 rounded-xl flex items-center gap-1.5`}>
              <ShieldAlert style={tw`w-3.5 h-3.5 shrink-0`} />
              <Text>
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
                <Sparkles size={14} color={tw.color('emerald-400')} />
                <Text style={tw`text-sm font-bold text-emerald-400`}>Recommended One-Tap Adjustments:</Text>
              </View>

              <View style={tw`flex-col gap-2.5`}>
                {conflictResult.suggestions.map((sug, idx) => (
                  <TouchableOpacity
                    key={idx}
                    
                    onPress={() => onApplySuggestion(sug.suggestedTimeMs)}
                    style={tw`w-full p-4 rounded-2xl bg-emerald-500/10 active:bg-emerald-500/20 border border-emerald-500/30 flex-row items-center justify-between transition`}
                  >
                    <View style={tw`flex-row items-center gap-2.5`}>
                      <Clock size={16} color={tw.color('emerald-400')} />
                      <Text style={tw`text-sm font-bold text-emerald-400`}>{sug.label}</Text>
                    </View>
                    <Text style={tw`font-mono font-bold text-white bg-emerald-600/30 px-2 py-1 rounded-lg text-sm`}>
                      {sug.formattedTime}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Footer Actions */}
        <View style={tw`p-5 border-t border-zinc-800 bg-zinc-950 flex-row items-center justify-between gap-3`}>
          <TouchableOpacity
            
            onPress={onCancel}
            style={tw`py-3.5 px-6 rounded-2xl bg-zinc-800 active:bg-zinc-700`}
          >
            <Text style={tw`text-sm font-bold text-zinc-300`}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            
            onPress={onProceedAnyway}
            style={tw`flex-1 py-3.5 px-4 rounded-2xl bg-amber-600 active:bg-amber-500 shadow-lg shadow-amber-900/40 flex-row items-center justify-center gap-2`}
            
          >
            <CheckCircle2 size={18} color="#fff" />
            <Text style={tw`text-sm font-bold text-white`}>Schedule Anyway</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
