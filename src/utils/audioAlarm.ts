/**
 * Web Audio API synthesizer for the full-screen alarm ringing.
 * Emulates the Android MediaPlayer Alarm Ringtone with alternating dual-tone siren.
 */

let audioCtx: AudioContext | null = null;
let sirenOscillator1: OscillatorNode | null = null;
let sirenOscillator2: OscillatorNode | null = null;
let sirenGainNode: GainNode | null = null;
let isPlaying = false;

export type AlarmToneType = 'default_siren' | 'gentle_chime' | 'medical_beep';

export function startAlarmSound(toneType: AlarmToneType = 'default_siren') {
  if (isPlaying) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    sirenGainNode = audioCtx.createGain();
    sirenGainNode.gain.setValueAtTime(0.18, audioCtx.currentTime);
    sirenGainNode.connect(audioCtx.destination);

    if (toneType === 'gentle_chime') {
      sirenOscillator1 = audioCtx.createOscillator();
      sirenOscillator1.type = 'sine';
      sirenOscillator1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5

      const now = audioCtx.currentTime;
      for (let i = 0; i < 60; i += 1.0) {
        sirenOscillator1.frequency.setValueAtTime(523.25, now + i);
        sirenOscillator1.frequency.setValueAtTime(659.25, now + i + 0.3); // E5
        sirenOscillator1.frequency.setValueAtTime(783.99, now + i + 0.6); // G5
      }
    } else if (toneType === 'medical_beep') {
      sirenOscillator1 = audioCtx.createOscillator();
      sirenOscillator1.type = 'triangle';
      sirenOscillator1.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6

      const now = audioCtx.currentTime;
      for (let i = 0; i < 60; i += 0.8) {
        sirenGainNode.gain.setValueAtTime(0.2, now + i);
        sirenGainNode.gain.setValueAtTime(0.01, now + i + 0.15);
        sirenGainNode.gain.setValueAtTime(0.2, now + i + 0.25);
        sirenGainNode.gain.setValueAtTime(0.01, now + i + 0.4);
      }
    } else {
      // default_siren (880Hz / A5 modulated)
      sirenOscillator1 = audioCtx.createOscillator();
      sirenOscillator1.type = 'sawtooth';
      sirenOscillator1.frequency.setValueAtTime(880, audioCtx.currentTime);

      const now = audioCtx.currentTime;
      for (let i = 0; i < 60; i += 0.5) {
        sirenOscillator1.frequency.setValueAtTime(750, now + i);
        sirenOscillator1.frequency.setValueAtTime(950, now + i + 0.25);
      }
    }

    sirenOscillator1.connect(sirenGainNode);
    sirenOscillator1.start();
    isPlaying = true;

    // Trigger device vibration if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([800, 400, 800, 400, 1000]);
    }
  } catch (e) {
    console.warn('Audio alarm playback not allowed or supported:', e);
  }
}

export function previewTone(toneType: AlarmToneType = 'default_siren', durationMs: number = 3000) {
  stopAlarmSound();
  startAlarmSound(toneType);
  setTimeout(() => {
    stopAlarmSound();
  }, durationMs);
}

export function isAudioPlaying(): boolean {
  return isPlaying;
}

export function stopAlarmSound() {
  if (!isPlaying) return;
  try {
    if (sirenOscillator1) {
      sirenOscillator1.stop();
      sirenOscillator1.disconnect();
      sirenOscillator1 = null;
    }
    if (sirenOscillator2) {
      sirenOscillator2.stop();
      sirenOscillator2.disconnect();
      sirenOscillator2 = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  } catch (e) {
    console.warn('Error stopping audio alarm:', e);
  } finally {
    isPlaying = false;
  }
}
