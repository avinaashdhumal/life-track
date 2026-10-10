/**
 * Web Audio API synthesizer for the full-screen alarm ringing.
 * Emulates the Android MediaPlayer Alarm Ringtone with alternating dual-tone siren.
 */

let audioCtx: AudioContext | null = null;
let sirenOscillator1: OscillatorNode | null = null;
let sirenOscillator2: OscillatorNode | null = null;
let sirenGainNode: GainNode | null = null;
let isPlaying = false;

export function startAlarmSound() {
  if (isPlaying) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    sirenGainNode = audioCtx.createGain();
    sirenGainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    sirenGainNode.connect(audioCtx.destination);

    // Osc 1: fundamental alarm beep (880Hz / A5)
    sirenOscillator1 = audioCtx.createOscillator();
    sirenOscillator1.type = 'sawtooth';
    sirenOscillator1.frequency.setValueAtTime(880, audioCtx.currentTime);

    // Frequency modulation for classic pulsed alarm
    const now = audioCtx.currentTime;
    for (let i = 0; i < 60; i += 0.5) {
      sirenOscillator1.frequency.setValueAtTime(750, now + i);
      sirenOscillator1.frequency.setValueAtTime(950, now + i + 0.25);
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
