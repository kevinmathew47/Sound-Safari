// Audio utility functions for enhanced spatial audio processing

export interface AudioPosition {
  x: number
  y: number
  z?: number
}

export interface AudioEnvironment {
  reverbLevel: number
  dampening: number
  roomSize: "small" | "medium" | "large"
  materialType: "soft" | "hard" | "mixed"
}

export class AudioEffectsProcessor {
  private audioContext: AudioContext
  private convolver: ConvolverNode | null = null
  private compressor: DynamicsCompressorNode

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.compressor = audioContext.createDynamicsCompressor()
    this.setupCompressor()
    this.createImpulseResponse()
  }

  private setupCompressor() {
    // Configure compressor for better audio clarity
    this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime)
    this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime)
    this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime)
    this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime)
    this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime)
  }

  private createImpulseResponse() {
    // Create a simple impulse response for reverb
    const length = this.audioContext.sampleRate * 2 // 2 seconds
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2)
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.1
      }
    }

    this.convolver = this.audioContext.createConvolver()
    this.convolver.buffer = impulse
  }

  applyEnvironmentalEffects(source: AudioNode, environment: AudioEnvironment): AudioNode {
    let processedNode: AudioNode = source

    // Apply reverb based on environment
    if (this.convolver && environment.reverbLevel > 0) {
      const wetGain = this.audioContext.createGain()
      const dryGain = this.audioContext.createGain()
      const outputGain = this.audioContext.createGain()

      wetGain.gain.setValueAtTime(environment.reverbLevel, this.audioContext.currentTime)
      dryGain.gain.setValueAtTime(1 - environment.reverbLevel, this.audioContext.currentTime)

      // Dry signal
      source.connect(dryGain)
      dryGain.connect(outputGain)

      // Wet signal (with reverb)
      source.connect(this.convolver)
      this.convolver.connect(wetGain)
      wetGain.connect(outputGain)

      processedNode = outputGain
    }

    // Apply compression
    processedNode.connect(this.compressor)

    return this.compressor
  }

  calculateDistance3D(pos1: AudioPosition, pos2: AudioPosition): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = (pos1.z || 0) - (pos2.z || 0)
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  getEnvironmentForLevel(levelName: string): AudioEnvironment {
    switch (levelName.toLowerCase()) {
      case "enchanted forest":
        return {
          reverbLevel: 0.3,
          dampening: 0.7,
          roomSize: "large",
          materialType: "soft",
        }
      case "ocean shore":
        return {
          reverbLevel: 0.5,
          dampening: 0.3,
          roomSize: "large",
          materialType: "hard",
        }
      case "mystical cave":
        return {
          reverbLevel: 0.8,
          dampening: 0.2,
          roomSize: "medium",
          materialType: "hard",
        }
      default:
        return {
          reverbLevel: 0.2,
          dampening: 0.5,
          roomSize: "medium",
          materialType: "mixed",
        }
    }
  }
}

export function createBinauralProcessor(audioContext: AudioContext) {
  // Simple binaural processing for enhanced 3D audio
  const splitter = audioContext.createChannelSplitter(2)
  const merger = audioContext.createChannelMerger(2)

  // Create delay nodes for basic HRTF simulation
  const leftDelay = audioContext.createDelay(0.001)
  const rightDelay = audioContext.createDelay(0.001)

  // Create filters for frequency response simulation
  const leftFilter = audioContext.createBiquadFilter()
  const rightFilter = audioContext.createBiquadFilter()

  leftFilter.type = "highpass"
  leftFilter.frequency.setValueAtTime(200, audioContext.currentTime)
  rightFilter.type = "highpass"
  rightFilter.frequency.setValueAtTime(200, audioContext.currentTime)

  return {
    splitter,
    merger,
    leftDelay,
    rightDelay,
    leftFilter,
    rightFilter,

    connect: (source: AudioNode, destination: AudioNode) => {
      source.connect(splitter)

      // Left channel processing
      splitter.connect(leftDelay, 0)
      leftDelay.connect(leftFilter)
      leftFilter.connect(merger, 0, 0)

      // Right channel processing
      splitter.connect(rightDelay, 1)
      rightDelay.connect(rightFilter)
      rightFilter.connect(merger, 0, 1)

      merger.connect(destination)
    },
  }
}
