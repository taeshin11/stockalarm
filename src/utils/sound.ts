let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function playAlertSound(soundName: string = 'alert-1') {
  try {
    // Generate alert sounds programmatically (no mp3 files needed)
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (soundName === 'alert-1') {
      // Rising beep
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(800 + i * 200, now + i * 0.2);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.15);
        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.15);
      }
    } else if (soundName === 'alert-2') {
      // Urgent double beep
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1000, now + i * 0.15);
        osc.type = 'square';
        gain.gain.setValueAtTime(0.2, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.1);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.1);
      }
    } else if (soundName === 'alert-3') {
      // Soft chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.3); // G5
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch {
    // Silent fail if audio not available
  }
}

export function testSound(soundName: string) {
  playAlertSound(soundName);
}
