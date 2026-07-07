"use client";

/**
 * Lightweight voice-activity detection over the microphone, in-browser via the
 * Web Audio API — no model, no backend, no recording (audio is analysed live
 * and never stored or uploaded).
 *
 * Emits a single boolean: is speech-band sound currently present? The tracker
 * fuses this with the student's mouth motion to tell apart:
 *   - the student talking  (voice + their mouth moving)
 *   - another voice        (voice while their mouth is still → someone else)
 *
 * Uses an adaptive noise floor so a quiet room's hum doesn't read as talking:
 * the floor slowly tracks ambient level, and speech is flagged only when energy
 * jumps a margin above it and sustains for a couple of reads (debounced).
 */

// Human speech energy concentrates roughly in this band.
const SPEECH_LOW_HZ = 250;
const SPEECH_HIGH_HZ = 3500;
const NOISE_FLOOR_ALPHA = 0.02; // slow EMA — ambient adapts, speech spikes don't move it much
const SPEECH_MARGIN = 12; // dB-ish margin above the floor to count as speech
const ACTIVATE_READS = 2;
const RELEASE_READS = 3;

export type AudioState = { available: boolean; speechActive: boolean; level: number };

export class AudioMonitor {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private freqData: Uint8Array | null = null;
  private binHz = 0;
  private noiseFloor = 0;
  private calibrated = false;
  private active = false;
  private positiveReads = 0;
  private negativeReads = 0;

  /** Wire the monitor to a stream's audio track. No-op (available=false) if there is none. */
  async start(stream: MediaStream): Promise<boolean> {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || typeof window === "undefined") {
      return false;
    }
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return false;
    }
    this.context = new AudioCtx();
    this.source = this.context.createMediaStreamSource(stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.source.connect(this.analyser);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.binHz = this.context.sampleRate / this.analyser.fftSize;
    return true;
  }

  read(): AudioState {
    if (!this.analyser || !this.freqData) {
      return { available: false, speechActive: false, level: 0 };
    }
    this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);

    const lowBin = Math.max(1, Math.floor(SPEECH_LOW_HZ / this.binHz));
    const highBin = Math.min(this.freqData.length - 1, Math.ceil(SPEECH_HIGH_HZ / this.binHz));
    let sum = 0;
    for (let i = lowBin; i <= highBin; i += 1) {
      sum += this.freqData[i];
    }
    const level = sum / Math.max(1, highBin - lowBin + 1); // mean speech-band magnitude, 0..255

    // Seed the floor on the first read so the very first frame isn't a false spike.
    if (!this.calibrated) {
      this.noiseFloor = level;
      this.calibrated = true;
    }

    const isLoud = level > this.noiseFloor + SPEECH_MARGIN;
    if (isLoud) {
      this.positiveReads += 1;
      this.negativeReads = 0;
      if (this.positiveReads >= ACTIVATE_READS) {
        this.active = true;
      }
    } else {
      this.negativeReads += 1;
      this.positiveReads = 0;
      if (this.negativeReads >= RELEASE_READS) {
        this.active = false;
      }
      // Only let the floor drift upward while it's quiet, so speech never raises it.
      this.noiseFloor = this.noiseFloor + (level - this.noiseFloor) * NOISE_FLOOR_ALPHA;
    }

    return { available: true, speechActive: this.active, level };
  }

  stop() {
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.freqData = null;
    this.calibrated = false;
    this.active = false;
    this.positiveReads = 0;
    this.negativeReads = 0;
  }
}
