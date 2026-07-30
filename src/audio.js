export class AudioDirector {
  constructor() {
    this.context = null;
    this.master = null;
    this.captureDestination = null;
    this.enabled = true;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.context.destination);
      this.captureDestination = this.context.createMediaStreamDestination();
      this.master.connect(this.captureDestination);
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.28 : 0;
    return this.enabled;
  }

  captureStream() {
    this.unlock();
    return this.captureDestination?.stream || new MediaStream();
  }

  tone(frequency, duration, options = {}) {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || "sawtooth";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency || frequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.2, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  noise(duration, volume = 0.12, highpass = 500) {
    if (!this.enabled || !this.context || !this.master) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  shoot() {
    this.tone(180, 0.1, { endFrequency: 62, volume: 0.16, type: "square" });
    this.noise(0.07, 0.08, 1200);
  }

  pulse() {
    this.tone(120, 0.38, { endFrequency: 720, volume: 0.22, type: "sawtooth" });
    this.tone(62, 0.42, { endFrequency: 38, volume: 0.18, type: "sine" });
  }

  dash() {
    this.noise(0.18, 0.11, 1700);
    this.tone(260, 0.16, { endFrequency: 520, volume: 0.1, type: "triangle" });
  }

  hit() {
    this.tone(920, 0.065, { endFrequency: 420, volume: 0.11, type: "square" });
  }

  kill() {
    this.tone(440, 0.12, { endFrequency: 880, volume: 0.11, type: "triangle" });
  }

  hurt() {
    this.tone(88, 0.25, { endFrequency: 42, volume: 0.2, type: "sawtooth" });
    this.noise(0.16, 0.1, 180);
  }

  pickup() {
    this.tone(520, 0.12, { endFrequency: 1040, volume: 0.12, type: "sine" });
    window.setTimeout(() => this.tone(780, 0.14, { endFrequency: 1320, volume: 0.1, type: "sine" }), 45);
  }

  stage() {
    this.tone(110, 0.5, { endFrequency: 220, volume: 0.16, type: "triangle" });
    window.setTimeout(() => this.tone(220, 0.46, { endFrequency: 440, volume: 0.14, type: "triangle" }), 100);
  }

  boss() {
    this.tone(54, 0.8, { endFrequency: 28, volume: 0.26, type: "sawtooth" });
    this.noise(0.65, 0.12, 80);
  }

  victory() {
    [261, 329, 392, 523].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.36, { endFrequency: frequency * 1.5, volume: 0.13, type: "triangle" }), index * 115);
    });
  }
}
