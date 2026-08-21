type AudioContextConstructor = new () => AudioContext;

export class FeedbackController {
  private audioContext: AudioContext | null = null;

  unlock(): void {
    try {
      const AudioContextClass = (globalThis as typeof globalThis & {
        webkitAudioContext?: AudioContextConstructor;
      }).AudioContext ?? (globalThis as typeof globalThis & {
        webkitAudioContext?: AudioContextConstructor;
      }).webkitAudioContext;
      if (AudioContextClass === undefined) return;
      this.audioContext ??= new AudioContextClass();
      void this.audioContext.resume().catch(() => undefined);
    } catch {
      // Audio is optional presentation feedback.
    }
  }

  playHeld(): void {
    this.playTone(520, 0.045, 'sine', 0.035);
  }

  playSafeLanding(): void {
    this.playTone(240, 0.07, 'sine', 0.045);
  }

  playFastLanding(): void {
    this.playTone(380, 0.095, 'triangle', 0.055);
  }

  vibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Vibration is optional presentation feedback.
    }
  }

  private playTone(
    frequency: number,
    durationSeconds: number,
    waveform: OscillatorType,
    volume: number,
  ): void {
    try {
      const context = this.audioContext;
      if (context === null || context.state === 'closed') return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSeconds);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + durationSeconds);
    } catch {
      // Audio failures must not affect interaction state.
    }
  }
}
