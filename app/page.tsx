"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Volume2, Play, RotateCcw, Trophy, Heart, Settings, MessageCircle } from "lucide-react"

interface GameState {
  currentLevel: number
  playerPosition: { x: number; y: number }
  itemsCollected: number
  totalItems: number
  lives: number
  isPlaying: boolean
  gameStarted: boolean
  levelComplete: boolean
  gameComplete: boolean
  currentStoryPhase: string
  charactersEncountered: string[]
}

interface SoundItem {
  id: string
  x: number
  y: number
  sound: string
  name: string
  collected: boolean
  frequency?: number
  intensity?: number
  category: string
  story?: string
}

interface Character {
  id: string
  name: string
  x: number
  y: number
  voice: VoiceCharacteristics
  dialogue: string[]
  encountered: boolean
  personality: string
}

interface VoiceCharacteristics {
  pitch: number
  rate: number
  volume: number
  voiceType: "narrator" | "guide" | "character" | "mystical" | "nature"
  accent?: string
  emotional_tone?: string
}

interface AudioSettings {
  masterVolume: number
  spatialAudioEnabled: boolean
  environmentalSoundsEnabled: boolean
  voiceNarrationEnabled: boolean
  autoNarration: boolean
}

// Voice Synthesis and Spatial Audio Engine
class VoiceSpatialAudioEngine {
  private audioContext: AudioContext | null = null
  private listener: AudioListener | null = null
  private sources: Map<string, AudioBufferSourceNode> = new Map()
  private panners: Map<string, PannerNode> = new Map()
  private gainNodes: Map<string, GainNode> = new Map()
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private voiceSynthesis: SpeechSynthesis | null = null
  private settings: AudioSettings
  private currentNarration: SpeechSynthesisUtterance | null = null
  private voiceQueue: Array<{ text: string; voice: VoiceCharacteristics; position?: { x: number; y: number } }> = []
  private isPlayingVoice = false

  constructor(settings: AudioSettings) {
    this.settings = settings
    this.initializeAudioContext()
    this.initializeVoiceSynthesis()
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.listener = this.audioContext.listener

      if (this.listener.forwardX) {
        this.listener.forwardX.setValueAtTime(0, this.audioContext.currentTime)
        this.listener.forwardY.setValueAtTime(0, this.audioContext.currentTime)
        this.listener.forwardZ.setValueAtTime(-1, this.audioContext.currentTime)
        this.listener.upX.setValueAtTime(0, this.audioContext.currentTime)
        this.listener.upY.setValueAtTime(1, this.audioContext.currentTime)
        this.listener.upZ.setValueAtTime(0, this.audioContext.currentTime)
      }

      await this.loadAudioSamples()
    } catch (error) {
      console.warn("Web Audio API not supported, falling back to basic audio")
    }
  }

  private initializeVoiceSynthesis() {
    if ("speechSynthesis" in window) {
      this.voiceSynthesis = window.speechSynthesis
    }
  }

  // Enhanced voice synthesis with character positioning
  speakWithPosition(
    text: string,
    voiceChar: VoiceCharacteristics,
    position?: { x: number; y: number },
    callback?: () => void,
  ) {
    if (!this.settings.voiceNarrationEnabled || !this.voiceSynthesis) return

    // Add to queue if currently playing
    if (this.isPlayingVoice) {
      this.voiceQueue.push({ text, voice: voiceChar, position })
      return
    }

    this.isPlayingVoice = true

    const utterance = new SpeechSynthesisUtterance(text)

    // Configure voice characteristics
    utterance.pitch = voiceChar.pitch
    utterance.rate = voiceChar.rate
    utterance.volume = voiceChar.volume * this.settings.masterVolume

    // Select appropriate voice based on type
    const voices = this.voiceSynthesis.getVoices()
    let selectedVoice = null

    switch (voiceChar.voiceType) {
      case "narrator":
        selectedVoice = voices.find((v) => v.name.includes("Natural") || v.name.includes("Neural")) || voices[0]
        break
      case "guide":
        selectedVoice = voices.find((v) => v.name.includes("Female") || v.name.includes("Alice")) || voices[1]
        break
      case "character":
        selectedVoice = voices.find((v) => v.name.includes("Male") || v.name.includes("David")) || voices[2]
        break
      case "mystical":
        selectedVoice = voices.find((v) => v.name.includes("Whisper")) || voices[3] || voices[0]
        break
      case "nature":
        selectedVoice = voices.find((v) => v.name.includes("Soft")) || voices[4] || voices[0]
        break
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    // Add spatial audio processing if position is provided
    if (position && this.settings.spatialAudioEnabled) {
      this.createSpatialVoiceEffect(utterance, position)
    }

    utterance.onend = () => {
      this.isPlayingVoice = false
      this.currentNarration = null
      if (callback) callback()

      // Process next item in queue
      if (this.voiceQueue.length > 0) {
        const next = this.voiceQueue.shift()!
        setTimeout(() => {
          this.speakWithPosition(next.text, next.voice, next.position)
        }, 500) // Brief pause between voices
      }
    }

    utterance.onerror = () => {
      this.isPlayingVoice = false
      this.currentNarration = null
    }

    this.currentNarration = utterance
    this.voiceSynthesis.speak(utterance)
  }

  private createSpatialVoiceEffect(utterance: SpeechSynthesisUtterance, position: { x: number; y: number }) {
    // This is a simplified spatial voice effect
    // In a more advanced implementation, we would route the voice through Web Audio API
    const distance = Math.sqrt(Math.pow(position.x - 2, 2) + Math.pow(position.y - 2, 2))
    const maxDistance = 5

    // Adjust volume based on distance
    const spatialVolume = Math.max(0.1, 1 - distance / maxDistance)
    utterance.volume = Math.min(utterance.volume, spatialVolume)

    // Adjust pitch slightly based on position (left/right)
    const horizontalOffset = (position.x - 2) / 2
    utterance.pitch = Math.max(0.5, Math.min(2, utterance.pitch + horizontalOffset * 0.1))
  }

  // Stop current voice narration
  stopVoice() {
    if (this.voiceSynthesis && this.currentNarration) {
      this.voiceSynthesis.cancel()
      this.currentNarration = null
      this.isPlayingVoice = false
      this.voiceQueue = []
    }
  }

  // Queue multiple voice lines with timing
  queueNarrationSequence(
    sequence: Array<{ text: string; voice: VoiceCharacteristics; delay?: number; position?: { x: number; y: number } }>,
  ) {
    sequence.forEach((item, index) => {
      setTimeout(
        () => {
          this.speakWithPosition(item.text, item.voice, item.position)
        },
        (item.delay || 0) + index * 100,
      ) // Small offset for each item
    })
  }

  // Create character voices with distinct personalities
  getCharacterVoice(characterType: string): VoiceCharacteristics {
    const voiceProfiles = {
      narrator: {
        pitch: 1.0,
        rate: 0.9,
        volume: 0.8,
        voiceType: "narrator" as const,
        emotional_tone: "warm_authoritative",
      },
      forestGuide: {
        pitch: 1.2,
        rate: 0.8,
        volume: 0.7,
        voiceType: "guide" as const,
        emotional_tone: "friendly_wise",
      },
      oceanSpirit: {
        pitch: 0.8,
        rate: 0.7,
        volume: 0.8,
        voiceType: "mystical" as const,
        emotional_tone: "deep_mysterious",
      },
      caveEcho: {
        pitch: 0.9,
        rate: 0.6,
        volume: 0.9,
        voiceType: "mystical" as const,
        emotional_tone: "hollow_ancient",
      },
      magicalCreature: {
        pitch: 1.4,
        rate: 1.1,
        volume: 0.6,
        voiceType: "character" as const,
        emotional_tone: "playful_magical",
      },
      natureSpirit: {
        pitch: 1.1,
        rate: 0.8,
        volume: 0.7,
        voiceType: "nature" as const,
        emotional_tone: "gentle_nurturing",
      },
    }

    return voiceProfiles[characterType as keyof typeof voiceProfiles] || voiceProfiles.narrator
  }

  // Rest of the audio methods from previous implementation...
  private async loadAudioSamples() {
    if (!this.audioContext) return

    const sampleRate = this.audioContext.sampleRate

    // Enhanced audio samples (keeping previous implementation)
    await this.createNatureSounds(sampleRate)
    await this.createMagicalSounds(sampleRate)
    await this.createEnvironmentalSounds(sampleRate)
    await this.createActionSounds(sampleRate)
    await this.createUIFeedbackSounds(sampleRate)
  }

  private async createNatureSounds(sampleRate: number) {
    // Previous implementation remains the same...
    const duration = 1.0

    // Bird Chirp
    const birdChirpBuffer = this.audioContext!.createBuffer(1, sampleRate * duration, sampleRate)
    const birdData = birdChirpBuffer.getChannelData(0)
    for (let i = 0; i < birdData.length; i++) {
      const t = i / sampleRate
      const freq1 = 800 + Math.sin(t * 25) * 300
      const freq2 = 1200 + Math.sin(t * 15) * 200
      const envelope = Math.exp(-t * 4) * (1 - Math.exp(-t * 20))
      birdData[i] = (Math.sin(2 * Math.PI * freq1 * t) * 0.6 + Math.sin(2 * Math.PI * freq2 * t) * 0.3) * envelope * 0.4
    }
    this.audioBuffers.set("bird-chirp", birdChirpBuffer)

    // Continue with other sounds...
    const streamBuffer = this.audioContext!.createBuffer(1, sampleRate * duration, sampleRate)
    const streamData = streamBuffer.getChannelData(0)
    for (let i = 0; i < streamData.length; i++) {
      const t = i / sampleRate
      const noise = Math.random() * 2 - 1
      const filtered = noise * Math.sin(t * 20) * Math.sin(t * 5)
      streamData[i] = filtered * 0.3 * (1 - Math.exp(-t * 3))
    }
    this.audioBuffers.set("water-trickle", streamBuffer)

    // Simplified versions of other sounds for brevity
    this.audioBuffers.set("acorn-drop", birdChirpBuffer)
    this.audioBuffers.set("leaves-rustle", streamBuffer)
  }

  private async createMagicalSounds(sampleRate: number) {
    const duration = 1.2

    // Crystal Chime
    const crystalBuffer = this.audioContext!.createBuffer(1, sampleRate * duration, sampleRate)
    const crystalData = crystalBuffer.getChannelData(0)
    for (let i = 0; i < crystalData.length; i++) {
      const t = i / sampleRate
      const fundamental = Math.sin(2 * Math.PI * 523 * t)
      const harmonic2 = Math.sin(2 * Math.PI * 659 * t) * 0.6
      const envelope = Math.exp(-t * 1.5) * (1 - Math.exp(-t * 10))
      crystalData[i] = (fundamental + harmonic2) * envelope * 0.3
    }
    this.audioBuffers.set("crystal-chime", crystalBuffer)
    this.audioBuffers.set("magic-sparkle", crystalBuffer)
    this.audioBuffers.set("mystical-orb", crystalBuffer)
  }

  private async createEnvironmentalSounds(sampleRate: number) {
    const duration = 2.0

    // Ocean Waves
    const waveBuffer = this.audioContext!.createBuffer(1, sampleRate * duration, sampleRate)
    const waveData = waveBuffer.getChannelData(0)
    for (let i = 0; i < waveData.length; i++) {
      const t = i / sampleRate
      const noise = Math.random() * 2 - 1
      const wave = Math.sin(t * 0.5) * Math.sin(t * 0.5)
      waveData[i] = noise * wave * 0.4
    }
    this.audioBuffers.set("wave-crash", waveBuffer)
    this.audioBuffers.set("seagull-call", waveBuffer)
    this.audioBuffers.set("seashell-echo", waveBuffer)
    this.audioBuffers.set("water-drip", waveBuffer)
    this.audioBuffers.set("cave-wind", waveBuffer)
  }

  private async createActionSounds(sampleRate: number) {
    const footstepBuffer = this.audioContext!.createBuffer(1, sampleRate * 0.3, sampleRate)
    const footstepData = footstepBuffer.getChannelData(0)
    for (let i = 0; i < footstepData.length; i++) {
      const t = i / sampleRate
      const impact = Math.exp(-t * 12) * (Math.random() * 2 - 1) * 0.8
      footstepData[i] = impact * 0.4
    }
    this.audioBuffers.set("footstep", footstepBuffer)
    this.audioBuffers.set("search-sound", footstepBuffer)
    this.audioBuffers.set("item-collect", footstepBuffer)
  }

  private async createUIFeedbackSounds(sampleRate: number) {
    const successBuffer = this.audioContext!.createBuffer(1, sampleRate * 1.5, sampleRate)
    const successData = successBuffer.getChannelData(0)
    for (let i = 0; i < successData.length; i++) {
      const t = i / sampleRate
      const freq = 523 + Math.sin(t * 4) * 100
      const envelope = Math.exp(-t * 2)
      successData[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4
    }
    this.audioBuffers.set("success-fanfare", successBuffer)
    this.audioBuffers.set("error-sound", successBuffer)
    this.audioBuffers.set("menu-nav", successBuffer)
  }

  updateListenerPosition(x: number, y: number) {
    if (!this.audioContext || !this.listener) return

    const worldX = (x - 2) * 2
    const worldZ = (y - 2) * 2

    if (this.listener.positionX) {
      this.listener.positionX.setValueAtTime(worldX, this.audioContext.currentTime)
      this.listener.positionY.setValueAtTime(0, this.audioContext.currentTime)
      this.listener.positionZ.setValueAtTime(worldZ, this.audioContext.currentTime)
    }
  }

  playPositionalSound(soundId: string, x: number, y: number, loop = false, volume = 1) {
    if (!this.audioContext || !this.settings.spatialAudioEnabled) return

    const buffer = this.audioBuffers.get(soundId)
    if (!buffer) return

    this.stopSound(soundId)

    const source = this.audioContext.createBufferSource()
    const panner = this.audioContext.createPanner()
    const gainNode = this.audioContext.createGain()

    panner.panningModel = "HRTF"
    panner.distanceModel = "inverse"
    panner.refDistance = 1
    panner.maxDistance = 10
    panner.rolloffFactor = 1

    const worldX = (x - 2) * 2
    const worldZ = (y - 2) * 2

    if (panner.positionX) {
      panner.positionX.setValueAtTime(worldX, this.audioContext.currentTime)
      panner.positionY.setValueAtTime(0, this.audioContext.currentTime)
      panner.positionZ.setValueAtTime(worldZ, this.audioContext.currentTime)
    }

    source.buffer = buffer
    source.loop = loop

    gainNode.gain.setValueAtTime(volume * this.settings.masterVolume, this.audioContext.currentTime)

    source.connect(gainNode)
    gainNode.connect(panner)
    panner.connect(this.audioContext.destination)

    this.sources.set(soundId, source)
    this.panners.set(soundId, panner)
    this.gainNodes.set(soundId, gainNode)

    source.start()

    if (!loop) {
      source.onended = () => {
        this.stopSound(soundId)
      }
    }
  }

  stopSound(soundId: string) {
    const source = this.sources.get(soundId)
    if (source) {
      try {
        source.stop()
      } catch (e) {
        // Source might already be stopped
      }
      this.sources.delete(soundId)
    }
    this.panners.delete(soundId)
    this.gainNodes.delete(soundId)
  }

  updateSettings(newSettings: AudioSettings) {
    this.settings = { ...newSettings }

    this.gainNodes.forEach((gainNode) => {
      if (this.audioContext) {
        gainNode.gain.setValueAtTime(this.settings.masterVolume, this.audioContext.currentTime)
      }
    })
  }

  cleanup() {
    this.stopVoice()
    this.sources.forEach((source) => {
      try {
        source.stop()
      } catch (e) {
        // Ignore errors
      }
    })
    this.sources.clear()
    this.panners.clear()
    this.gainNodes.clear()

    if (this.audioContext) {
      this.audioContext.close()
    }
  }
}

// Story content with character interactions
const storyContent = {
  intro: {
    narrator:
      "Welcome, brave explorer, to the magical realms of Sound Safari. You are about to embark on an extraordinary journey where your ears will be your guide.",
    setting:
      "Long ago, these three mystical lands were filled with harmony and wonder. But the magical artifacts that kept the balance have been scattered.",
    mission:
      "Your mission is to help restore the harmony by finding these lost treasures using only the sounds around you.",
  },
  levels: [
    {
      name: "Enchanted Forest",
      intro:
        "You step into the Enchanted Forest, where ancient trees whisper secrets and magical creatures dwell among the leaves.",
      guide: {
        name: "Willow the Forest Guide",
        position: { x: 1, y: 1 },
        dialogue: [
          "Hello there, young adventurer! I'm Willow, guardian of this forest.",
          "Listen carefully to the sounds around you. The birds will chirp near golden treasures.",
          "Feel the wind in the leaves - it carries hints of magic nearby.",
          "Remember, each sound tells a story. Trust your ears to guide you.",
        ],
      },
      characters: [
        {
          id: "fairy",
          name: "Sparkle the Forest Fairy",
          x: 0,
          y: 2,
          voice: "magicalCreature",
          dialogue: [
            "Tee-hee! You found me! I'm Sparkle, and I love to hide among the fairy dust!",
            "The forest is full of musical magic - each treasure sings its own tune!",
            "Listen for the tinkling sounds - that's where the real magic happens!",
          ],
          encountered: false,
          personality: "playful_magical",
        },
      ],
      items: [
        {
          id: "bird1",
          x: 2,
          y: 1,
          sound: "bird-chirp",
          name: "Golden Feather",
          collected: false,
          category: "nature",
          story: "This feather once belonged to a phoenix that brought life to the forest.",
        },
        {
          id: "acorn1",
          x: 4,
          y: 3,
          sound: "acorn-drop",
          name: "Magic Acorn",
          collected: false,
          category: "nature",
          story: "This acorn holds the power to grow entire forests with just a whisper.",
        },
        {
          id: "stream1",
          x: 1,
          y: 4,
          sound: "water-trickle",
          name: "Crystal Water",
          collected: false,
          category: "nature",
          story: "Water from the spring of eternal youth, it sparkles with inner light.",
        },
        {
          id: "magic1",
          x: 0,
          y: 2,
          sound: "magic-sparkle",
          name: "Fairy Dust",
          collected: false,
          category: "magical",
          story: "Enchanted dust that makes dreams come true with a gentle breeze.",
        },
      ],
      completion: "Wonderful! You've restored harmony to the Enchanted Forest. The trees sing with joy!",
    },
    {
      name: "Ocean Shore",
      intro:
        "You arrive at the mystical Ocean Shore, where the waves carry ancient songs and sea creatures guard precious treasures.",
      guide: {
        name: "Marina the Ocean Spirit",
        position: { x: 0, y: 2 },
        dialogue: [
          "Greetings, land walker. I am Marina, voice of the endless seas.",
          "The ocean speaks in many tongues - waves, wind, and the calls of seabirds.",
          "Each treasure here holds the memory of ancient tides and forgotten storms.",
          "Let the rhythm of the waves guide your steps along the shore.",
        ],
      },
      characters: [
        {
          id: "seagull",
          name: "Captain Gull",
          x: 4,
          y: 4,
          voice: "character",
          dialogue: [
            "Ahoy there, matey! Captain Gull at your service!",
            "I've sailed these waters for a hundred years, heard every sound the sea makes!",
            "The best treasures are always where the waves sing loudest, ye know!",
          ],
          encountered: false,
          personality: "adventurous_salty",
        },
      ],
      items: [
        {
          id: "shell1",
          x: 3,
          y: 2,
          sound: "seashell-echo",
          name: "Singing Shell",
          collected: false,
          category: "environmental",
          story: "This shell echoes with the songs of mermaids from the deep.",
        },
        {
          id: "wave1",
          x: 1,
          y: 1,
          sound: "wave-crash",
          name: "Pearl of Tides",
          collected: false,
          category: "environmental",
          story: "A pearl formed by a thousand storms, it controls the rhythm of the waves.",
        },
        {
          id: "gull1",
          x: 4,
          y: 4,
          sound: "seagull-call",
          name: "Feather of Flight",
          collected: false,
          category: "nature",
          story: "This feather grants the power of flight to those pure of heart.",
        },
        {
          id: "orb1",
          x: 2,
          y: 0,
          sound: "mystical-orb",
          name: "Ocean's Heart",
          collected: false,
          category: "magical",
          story: "The heart of the ocean itself, pulsing with the life force of all sea creatures.",
        },
      ],
      completion: "Magnificent! The Ocean Shore resonates with harmony once more. The waves dance with joy!",
    },
    {
      name: "Mystical Cave",
      intro:
        "You descend into the Mystical Cave, where echoes hold memories and ancient spirits guard the deepest secrets.",
      guide: {
        name: "Echo the Cave Keeper",
        position: { x: 2, y: 2 },
        dialogue: [
          "Welcome to the deepest chambers, traveler. I am Echo, keeper of ancient wisdom.",
          "Here, every sound is amplified, every whisper becomes a song.",
          "The cave remembers all who have passed through. Listen to its stories.",
          "The greatest treasures lie where the echoes are strongest.",
        ],
      },
      characters: [
        {
          id: "crystal",
          name: "Resonance the Crystal Being",
          x: 4,
          y: 1,
          voice: "mystical",
          dialogue: [
            "I am Resonance, born from the harmony of crystals and time itself.",
            "My song has echoed through these chambers for millennia.",
            "Each crystal here vibrates with the frequency of pure magic.",
            "When all treasures are found, the cave will sing the song of ages.",
          ],
          encountered: false,
          personality: "ancient_wise",
        },
      ],
      items: [
        {
          id: "drip1",
          x: 2,
          y: 3,
          sound: "water-drip",
          name: "Echo Stone",
          collected: false,
          category: "environmental",
          story: "This stone captures and amplifies the wisdom of ages in every echo.",
        },
        {
          id: "crystal1",
          x: 4,
          y: 1,
          sound: "crystal-chime",
          name: "Glowing Crystal",
          collected: false,
          category: "magical",
          story: "A crystal that resonates with the heartbeat of the earth itself.",
        },
        {
          id: "wind1",
          x: 1,
          y: 2,
          sound: "cave-wind",
          name: "Wind Whistle",
          collected: false,
          category: "environmental",
          story: "This whistle carries the breath of ancient dragons who once lived here.",
        },
        {
          id: "rune1",
          x: 0,
          y: 4,
          sound: "mystical-orb",
          name: "Ancient Rune",
          collected: false,
          category: "magical",
          story: "A rune of power that connects all three realms in eternal harmony.",
        },
      ],
      completion: "Extraordinary! The Mystical Cave awakens with ancient power. All realms are now in perfect harmony!",
    },
  ],
  finalStory:
    "Congratulations, noble explorer! You have restored the balance to all three mystical realms. The Enchanted Forest blooms with life, the Ocean Shore sings with the voices of sea creatures, and the Mystical Cave resonates with ancient wisdom. You are now a true Guardian of Sound Safari, and these magical lands will remember your courage forever.",
}

export default function SoundSafari() {
  const [gameState, setGameState] = useState<GameState>({
    currentLevel: 0,
    playerPosition: { x: 2, y: 2 },
    itemsCollected: 0,
    totalItems: 4,
    lives: 3,
    isPlaying: false,
    gameStarted: false,
    levelComplete: false,
    gameComplete: false,
    currentStoryPhase: "intro",
    charactersEncountered: [],
  })

  const [currentItems, setCurrentItems] = useState<SoundItem[]>(storyContent.levels[0].items)
  const [currentCharacters, setCurrentCharacters] = useState<Character[]>(storyContent.levels[0].characters)
  const [announcement, setAnnouncement] = useState("")
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    masterVolume: 0.7,
    spatialAudioEnabled: true,
    environmentalSoundsEnabled: true,
    voiceNarrationEnabled: true,
    autoNarration: true,
  })
  const [showSettings, setShowSettings] = useState(false)
  const [currentDialogue, setCurrentDialogue] = useState<string>("")

  const spatialAudioRef = useRef<VoiceSpatialAudioEngine | null>(null)
  const proximityCheckInterval = useRef<NodeJS.Timeout | null>(null)

  // Initialize spatial audio engine
  useEffect(() => {
    spatialAudioRef.current = new VoiceSpatialAudioEngine(audioSettings)

    return () => {
      if (spatialAudioRef.current) {
        spatialAudioRef.current.cleanup()
      }
      if (proximityCheckInterval.current) {
        clearInterval(proximityCheckInterval.current)
      }
    }
  }, [])

  // Update audio settings
  useEffect(() => {
    if (spatialAudioRef.current) {
      spatialAudioRef.current.updateSettings(audioSettings)
    }
  }, [audioSettings])

  // Character encounter checking
  useEffect(() => {
    if (!spatialAudioRef.current || !gameState.isPlaying) return

    const { x: playerX, y: playerY } = gameState.playerPosition

    // Check for character encounters
    currentCharacters.forEach((character) => {
      if (!character.encountered && Math.abs(character.x - playerX) <= 1 && Math.abs(character.y - playerY) <= 1) {
        // Encounter character
        const updatedCharacters = currentCharacters.map((char) =>
          char.id === character.id ? { ...char, encountered: true } : char,
        )
        setCurrentCharacters(updatedCharacters)
        setGameState((prev) => ({
          ...prev,
          charactersEncountered: [...prev.charactersEncountered, character.id],
        }))

        // Play character dialogue
        const voice = spatialAudioRef.current.getCharacterVoice(character.voice)
        const dialogue = character.dialogue[0] // First dialogue line
        spatialAudioRef.current.speakWithPosition(dialogue, voice, { x: character.x, y: character.y })
        setCurrentDialogue(dialogue)

        announce(`You've met ${character.name}! ${dialogue}`)
      }
    })

    // Check for proximity to items
    currentItems.forEach((item) => {
      if (!item.collected) {
        const distance = Math.sqrt(Math.pow(item.x - playerX, 2) + Math.pow(item.y - playerY, 2))

        if (distance <= 2.5 && Math.random() < 0.3) {
          spatialAudioRef.current?.playPositionalSound(item.sound, item.x, item.y, false, 0.5)
        }
      }
    })
  }, [gameState.playerPosition, gameState.isPlaying, currentCharacters, currentItems])

  const playLevelIntroNarration = useCallback(
    (levelIndex: number) => {
      if (!spatialAudioRef.current || !audioSettings.voiceNarrationEnabled) return

      const level = storyContent.levels[levelIndex]
      const narratorVoice = spatialAudioRef.current.getCharacterVoice("narrator")
      const guideVoice = spatialAudioRef.current.getCharacterVoice("forestGuide")

      const narrationSequence = [
        { text: level.intro, voice: narratorVoice, delay: 0 },
        { text: level.guide.dialogue[0], voice: guideVoice, delay: 3000, position: level.guide.position },
        { text: level.guide.dialogue[1], voice: guideVoice, delay: 6000, position: level.guide.position },
      ]

      spatialAudioRef.current.queueNarrationSequence(narrationSequence)
    },
    [audioSettings.voiceNarrationEnabled],
  )

  // Announce function with voice
  const announce = (message: string, useVoice = true) => {
    setAnnouncement(message)

    if (useVoice && spatialAudioRef.current && audioSettings.voiceNarrationEnabled) {
      const narratorVoice = spatialAudioRef.current.getCharacterVoice("narrator")
      spatialAudioRef.current.speakWithPosition(message, narratorVoice)
    } else if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.rate = 0.8
      utterance.volume = 0.8
      speechSynthesis.speak(utterance)
    }
  }

  // Start game with story intro
  const startGame = () => {
    setGameState((prev) => ({ ...prev, gameStarted: true, isPlaying: true }))
    setCurrentItems(storyContent.levels[0].items)
    setCurrentCharacters(storyContent.levels[0].characters)

    if (spatialAudioRef.current) {
      spatialAudioRef.current.updateListenerPosition(2, 2)

      if (audioSettings.voiceNarrationEnabled && audioSettings.autoNarration) {
        const narratorVoice = spatialAudioRef.current.getCharacterVoice("narrator")

        // Play intro story sequence
        const introSequence = [
          { text: storyContent.intro.narrator, voice: narratorVoice, delay: 0 },
          { text: storyContent.intro.setting, voice: narratorVoice, delay: 4000 },
          { text: storyContent.intro.mission, voice: narratorVoice, delay: 8000 },
        ]

        spatialAudioRef.current.queueNarrationSequence(introSequence)

        // Play level intro after story intro
        setTimeout(() => {
          playLevelIntroNarration(0)
        }, 12000)
      }
    }

    announce("Welcome to Sound Safari! Your adventure begins now.", false) // Don't double-announce
  }

  // Reset game
  const resetGame = () => {
    if (spatialAudioRef.current) {
      spatialAudioRef.current.stopVoice()
    }

    setGameState({
      currentLevel: 0,
      playerPosition: { x: 2, y: 2 },
      itemsCollected: 0,
      totalItems: 4,
      lives: 3,
      isPlaying: false,
      gameStarted: false,
      levelComplete: false,
      gameComplete: false,
      currentStoryPhase: "intro",
      charactersEncountered: [],
    })
    setCurrentItems(storyContent.levels[0].items.map((item) => ({ ...item, collected: false })))
    setCurrentCharacters(storyContent.levels[0].characters.map((char) => ({ ...char, encountered: false })))
    setCurrentDialogue("")
    announce("Game reset. Ready to start your Sound Safari adventure!")
  }

  // Handle movement
  const movePlayer = (direction: string) => {
    if (!gameState.isPlaying || gameState.levelComplete) return

    setGameState((prev) => {
      const newPos = { ...prev.playerPosition }

      switch (direction) {
        case "up":
          if (newPos.y > 0) newPos.y--
          else {
            if (spatialAudioRef.current) {
              spatialAudioRef.current.playPositionalSound("error-sound", 2, 2, false, 0.3)
            }
            announce("Cannot move up - you've reached the edge of the area")
            return prev
          }
          break
        case "down":
          if (newPos.y < 4) newPos.y++
          else {
            if (spatialAudioRef.current) {
              spatialAudioRef.current.playPositionalSound("error-sound", 2, 2, false, 0.3)
            }
            announce("Cannot move down - you've reached the edge of the area")
            return prev
          }
          break
        case "left":
          if (newPos.x > 0) newPos.x--
          else {
            if (spatialAudioRef.current) {
              spatialAudioRef.current.playPositionalSound("error-sound", 2, 2, false, 0.3)
            }
            announce("Cannot move left - you've reached the edge of the area")
            return prev
          }
          break
        case "right":
          if (newPos.x < 4) newPos.x++
          else {
            if (spatialAudioRef.current) {
              spatialAudioRef.current.playPositionalSound("error-sound", 2, 2, false, 0.3)
            }
            announce("Cannot move right - you've reached the edge of the area")
            return prev
          }
          break
      }

      // Update spatial audio listener position
      if (spatialAudioRef.current) {
        spatialAudioRef.current.updateListenerPosition(newPos.x, newPos.y)
        spatialAudioRef.current.playPositionalSound("footstep", newPos.x, newPos.y, false, 0.4)
      }

      announce(`Moved ${direction}. Now at position ${newPos.x + 1}, ${newPos.y + 1}`)
      return { ...prev, playerPosition: newPos }
    })
  }

  // Enhanced search with story narration
  const searchArea = () => {
    if (!gameState.isPlaying || gameState.levelComplete) return

    if (spatialAudioRef.current) {
      spatialAudioRef.current.playPositionalSound(
        "search-sound",
        gameState.playerPosition.x,
        gameState.playerPosition.y,
        false,
        0.5,
      )
    }

    const { x, y } = gameState.playerPosition
    const nearbyItem = currentItems.find(
      (item) => Math.abs(item.x - x) <= 1 && Math.abs(item.y - y) <= 1 && !item.collected,
    )

    if (nearbyItem) {
      // Play the item's sound and story
      if (spatialAudioRef.current) {
        spatialAudioRef.current.playPositionalSound(nearbyItem.sound, nearbyItem.x, nearbyItem.y, false, 1.0)

        // Play item story narration
        if (audioSettings.voiceNarrationEnabled && nearbyItem.story) {
          const narratorVoice = spatialAudioRef.current.getCharacterVoice("narrator")
          setTimeout(() => {
            spatialAudioRef.current?.speakWithPosition(nearbyItem.story!, narratorVoice)
          }, 1500)
        }

        setTimeout(() => {
          spatialAudioRef.current?.playPositionalSound("item-collect", nearbyItem.x, nearbyItem.y, false, 0.8)
        }, 500)
      }

      const updatedItems = currentItems.map((item) => (item.id === nearbyItem.id ? { ...item, collected: true } : item))
      setCurrentItems(updatedItems)

      setGameState((prev) => {
        const newCollected = prev.itemsCollected + 1
        const levelComplete = newCollected >= prev.totalItems

        if (levelComplete) {
          const currentLevelData = storyContent.levels[prev.currentLevel]

          if (prev.currentLevel >= storyContent.levels.length - 1) {
            // Game complete
            if (spatialAudioRef.current && audioSettings.voiceNarrationEnabled) {
              const narratorVoice = spatialAudioRef.current.getCharacterVoice("narrator")
              setTimeout(() => {
                spatialAudioRef.current?.speakWithPosition(storyContent.finalStory, narratorVoice)
              }, 2000)
            }

            announce(`Congratulations! You found the ${nearbyItem.name}! ${storyContent.finalStory}`)
            return { ...prev, itemsCollected: newCollected, levelComplete: true, gameComplete: true, isPlaying: false }
          } else {
            // Level complete
            if (spatialAudioRef.current && audioSettings.voiceNarrationEnabled) {
              const narratorVoice = spatialAudioRef.current.getCharacterVoice("narrator")
              setTimeout(() => {
                spatialAudioRef.current?.speakWithPosition(currentLevelData.completion, narratorVoice)
              }, 2000)
            }

            announce(`Amazing! You found the ${nearbyItem.name}! ${currentLevelData.completion}`)

            setTimeout(() => {
              const nextLevel = prev.currentLevel + 1
              const nextLevelData = storyContent.levels[nextLevel]

              setCurrentItems(nextLevelData.items.map((item) => ({ ...item, collected: false })))
              setCurrentCharacters(nextLevelData.characters.map((char) => ({ ...char, encountered: false })))

              setGameState((prevState) => ({
                ...prevState,
                currentLevel: nextLevel,
                playerPosition: { x: 2, y: 2 },
                itemsCollected: 0,
                totalItems: nextLevelData.items.length,
                levelComplete: false,
                isPlaying: true,
                charactersEncountered: [],
              }))

              if (spatialAudioRef.current) {
                spatialAudioRef.current.updateListenerPosition(2, 2)
              }

              // Play next level intro
              setTimeout(() => {
                playLevelIntroNarration(nextLevel)
              }, 1000)

              announce(`Welcome to ${nextLevelData.name}!`)
            }, 4000)

            return { ...prev, itemsCollected: newCollected, levelComplete: true }
          }
        } else {
          announce(`Wonderful! You found the ${nearbyItem.name}! ${prev.totalItems - newCollected} items remaining.`)
          return { ...prev, itemsCollected: newCollected }
        }
      })
    } else {
      // Check proximity
      const closeItems = currentItems.filter(
        (item) => Math.abs(item.x - x) <= 2 && Math.abs(item.y - y) <= 2 && !item.collected,
      )

      if (closeItems.length > 0) {
        closeItems.forEach((item, index) => {
          if (spatialAudioRef.current) {
            const distance = Math.sqrt(Math.pow(item.x - x, 2) + Math.pow(item.y - y, 2))
            const volume = Math.max(0.1, 0.5 - distance / 4)
            setTimeout(() => {
              spatialAudioRef.current?.playPositionalSound(item.sound, item.x, item.y, false, volume)
            }, index * 200)
          }
        })

        announce(
          `You're getting warmer! Listen carefully - you can hear ${closeItems.length} item${closeItems.length > 1 ? "s" : ""} nearby.`,
        )
      } else {
        announce("Nothing here. Try exploring other areas. Listen for sounds and voices to guide you.")
      }
    }
  }

  // Interact with characters
  const interactWithCharacter = () => {
    const { x, y } = gameState.playerPosition
    const nearbyCharacter = currentCharacters.find(
      (char) => Math.abs(char.x - x) <= 1 && Math.abs(char.y - y) <= 1 && char.encountered,
    )

    if (nearbyCharacter && spatialAudioRef.current) {
      const voice = spatialAudioRef.current.getCharacterVoice(nearbyCharacter.voice)
      const randomDialogue = nearbyCharacter.dialogue[Math.floor(Math.random() * nearbyCharacter.dialogue.length)]

      spatialAudioRef.current.speakWithPosition(randomDialogue, voice, { x: nearbyCharacter.x, y: nearbyCharacter.y })
      setCurrentDialogue(randomDialogue)
      announce(`${nearbyCharacter.name} says: ${randomDialogue}`)
    }
  }

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameState.gameStarted) return

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          movePlayer("up")
          break
        case "ArrowDown":
          e.preventDefault()
          movePlayer("down")
          break
        case "ArrowLeft":
          e.preventDefault()
          movePlayer("left")
          break
        case "ArrowRight":
          e.preventDefault()
          movePlayer("right")
          break
        case " ":
          e.preventDefault()
          searchArea()
          break
        case "c":
          e.preventDefault()
          interactWithCharacter()
          break
        case "h":
          e.preventDefault()
          announce(
            `Help: Use arrow keys to move. Spacebar to search. C to talk to characters. You are at position ${gameState.playerPosition.x + 1}, ${gameState.playerPosition.y + 1}. Items: ${gameState.itemsCollected}/${gameState.totalItems}.`,
          )
          break
        case "s":
          e.preventDefault()
          setShowSettings(!showSettings)
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState, showSettings, currentCharacters])

  const currentLevelData = storyContent.levels[gameState.currentLevel]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-green-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Screen reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
            <Volume2 className="w-8 h-8" />
            Sound Safari
            <Badge variant="secondary" className="ml-2">
              Story Mode
            </Badge>
          </h1>
          <p className="text-lg text-gray-600">An Immersive Story-Driven Audio Adventure</p>
          <p className="text-sm text-gray-500 mt-2">
            Character Voices • Story Narration • 3D Spatial Audio • Fully Accessible
          </p>
        </header>

        {!gameState.gameStarted ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Welcome to Sound Safari Story Mode!</CardTitle>
              <CardDescription className="text-center text-lg">
                Experience an immersive audio adventure with character voices and story narration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Story Features:</h3>
                <ul className="space-y-2 text-sm">
                  <li>• Rich story narration with multiple characters</li>
                  <li>• Spatial character voices that guide your journey</li>
                  <li>• Interactive dialogue with forest spirits and magical creatures</li>
                  <li>• Item backstories and world-building narration</li>
                  <li>• Immersive 3D positioned character voices</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Controls:</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    • <kbd className="px-2 py-1 bg-gray-200 rounded">Arrow Keys</kbd> - Move around
                  </li>
                  <li>
                    • <kbd className="px-2 py-1 bg-gray-200 rounded">Spacebar</kbd> - Search for items
                  </li>
                  <li>
                    • <kbd className="px-2 py-1 bg-gray-200 rounded">C</kbd> - Talk to characters
                  </li>
                  <li>
                    • <kbd className="px-2 py-1 bg-gray-200 rounded">H</kbd> - Help
                  </li>
                  <li>
                    • <kbd className="px-2 py-1 bg-gray-200 rounded">S</kbd> - Audio settings
                  </li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Your Adventure:</h3>
                <p className="text-sm">
                  Journey through three mystical realms: the Enchanted Forest, Ocean Shore, and Mystical Cave. Meet
                  magical characters, discover ancient treasures, and restore harmony to the lands through the power of
                  sound and story.
                </p>
              </div>

              <Button
                onClick={startGame}
                className="w-full text-lg py-6"
                aria-label="Begin your Sound Safari story adventure"
              >
                <Play className="w-5 h-5 mr-2" />
                Begin Your Story Adventure
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Audio Settings Panel */}
            {showSettings && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Audio & Voice Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label htmlFor="volume" className="block text-sm font-medium mb-2">
                      Master Volume: {Math.round(audioSettings.masterVolume * 100)}%
                    </label>
                    <input
                      id="volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={audioSettings.masterVolume}
                      onChange={(e) =>
                        setAudioSettings((prev) => ({ ...prev, masterVolume: Number.parseFloat(e.target.value) }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      id="spatial"
                      type="checkbox"
                      checked={audioSettings.spatialAudioEnabled}
                      onChange={(e) => setAudioSettings((prev) => ({ ...prev, spatialAudioEnabled: e.target.checked }))}
                    />
                    <label htmlFor="spatial" className="text-sm">
                      Enable 3D Spatial Audio
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      id="voice"
                      type="checkbox"
                      checked={audioSettings.voiceNarrationEnabled}
                      onChange={(e) =>
                        setAudioSettings((prev) => ({ ...prev, voiceNarrationEnabled: e.target.checked }))
                      }
                    />
                    <label htmlFor="voice" className="text-sm">
                      Enable Voice Narration
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      id="autoNarration"
                      type="checkbox"
                      checked={audioSettings.autoNarration}
                      onChange={(e) => setAudioSettings((prev) => ({ ...prev, autoNarration: e.target.checked }))}
                    />
                    <label htmlFor="autoNarration" className="text-sm">
                      Auto Story Narration
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      id="environmental"
                      type="checkbox"
                      checked={audioSettings.environmentalSoundsEnabled}
                      onChange={(e) =>
                        setAudioSettings((prev) => ({ ...prev, environmentalSoundsEnabled: e.target.checked }))
                      }
                    />
                    <label htmlFor="environmental" className="text-sm">
                      Environmental Sounds
                    </label>
                  </div>

                  <Button onClick={() => setShowSettings(false)} variant="outline" className="w-full">
                    Close Settings
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Current Dialogue Display */}
            {currentDialogue && (
              <Card className="bg-indigo-50 border-indigo-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-indigo-800">
                    <MessageCircle className="w-5 h-5" />
                    Character Speaking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-indigo-700 italic">"{currentDialogue}"</p>
                </CardContent>
              </Card>
            )}

            {/* Game Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{currentLevelData.name}</CardTitle>
                    <CardDescription>{currentLevelData.intro}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Trophy className="w-4 h-4" />
                      {gameState.itemsCollected}/{gameState.totalItems}
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      Level {gameState.currentLevel + 1}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {gameState.charactersEncountered.length} Characters Met
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Game Grid with Characters */}
            <Card>
              <CardHeader>
                <CardTitle>Game Area - {currentLevelData.name}</CardTitle>
                <CardDescription>
                  Position: Row {gameState.playerPosition.y + 1}, Col {gameState.playerPosition.x + 1}
                  {audioSettings.voiceNarrationEnabled && " • Voice Narration Active"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
                  {Array.from({ length: 25 }, (_, i) => {
                    const x = i % 5
                    const y = Math.floor(i / 5)
                    const isPlayer = x === gameState.playerPosition.x && y === gameState.playerPosition.y
                    const hasItem = currentItems.some((item) => item.x === x && item.y === y && !item.collected)
                    const hasCollectedItem = currentItems.some((item) => item.x === x && item.y === y && item.collected)
                    const hasCharacter = currentCharacters.some((char) => char.x === x && char.y === y)
                    const characterMet = currentCharacters.some(
                      (char) => char.x === x && char.y === y && char.encountered,
                    )

                    return (
                      <div
                        key={i}
                        className={`
                          w-12 h-12 border-2 rounded-lg flex items-center justify-center text-lg relative
                          ${isPlayer ? "bg-blue-500 border-blue-600 text-white" : "bg-gray-100 border-gray-300"}
                          ${hasItem ? "bg-yellow-200 border-yellow-400" : ""}
                          ${hasCollectedItem ? "bg-green-200 border-green-400" : ""}
                          ${hasCharacter && !characterMet ? "bg-purple-200 border-purple-400" : ""}
                          ${characterMet ? "bg-pink-200 border-pink-400" : ""}
                        `}
                        aria-label={`Grid position ${x + 1}, ${y + 1}${isPlayer ? " - Your location" : ""}${hasItem ? " - Item here" : ""}${hasCollectedItem ? " - Item collected" : ""}${hasCharacter ? " - Character here" : ""}`}
                      >
                        {isPlayer && "🧭"}
                        {hasItem && "🔊"}
                        {hasCollectedItem && "✅"}
                        {hasCharacter && !characterMet && "👤"}
                        {characterMet && "💬"}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 text-center">
                  <div className="flex flex-wrap gap-2 justify-center text-xs">
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>You
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-yellow-200 border border-yellow-400 rounded"></div>Items
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-purple-200 border border-purple-400 rounded"></div>Characters
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-pink-200 border border-pink-400 rounded"></div>Met Characters
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button onClick={() => movePlayer("up")} disabled={!gameState.isPlaying || gameState.levelComplete}>
                    ↑ Up
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => movePlayer("left")}
                      disabled={!gameState.isPlaying || gameState.levelComplete}
                    >
                      ← Left
                    </Button>
                    <Button
                      onClick={searchArea}
                      disabled={!gameState.isPlaying || gameState.levelComplete}
                      variant="secondary"
                    >
                      🔍 Search
                    </Button>
                    <Button
                      onClick={() => movePlayer("right")}
                      disabled={!gameState.isPlaying || gameState.levelComplete}
                    >
                      → Right
                    </Button>
                  </div>
                  <Button onClick={() => movePlayer("down")} disabled={!gameState.isPlaying || gameState.levelComplete}>
                    ↓ Down
                  </Button>
                </div>

                <div className="flex justify-center gap-4 mt-4">
                  <Button
                    onClick={interactWithCharacter}
                    disabled={!gameState.isPlaying || gameState.levelComplete}
                    variant="outline"
                    className="flex items-center gap-2 bg-transparent"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Talk (C)
                  </Button>
                  <Button
                    onClick={() => setShowSettings(!showSettings)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                  <Button onClick={resetGame} variant="outline" className="flex items-center gap-2 bg-transparent">
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Characters & Items Lists */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Characters in {currentLevelData.name}</CardTitle>
                  <CardDescription>Press C near characters to interact</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {currentCharacters.map((character) => (
                      <div
                        key={character.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          character.encountered
                            ? "bg-pink-100 text-pink-800 border-pink-200"
                            : "bg-purple-100 text-purple-800 border-purple-200"
                        }`}
                      >
                        <span className="text-lg">{character.encountered ? "💬" : "👤"}</span>
                        <div className="flex-1">
                          <span className="font-medium">{character.name}</span>
                          <div className="text-sm opacity-75">{character.personality}</div>
                          <div className="text-xs mt-1">
                            Position: {character.x + 1}, {character.y + 1}
                          </div>
                        </div>
                        <Badge variant={character.encountered ? "default" : "outline"} className="text-xs">
                          {character.encountered ? "Met" : "Unknown"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Treasures to Find</CardTitle>
                  <CardDescription>Listen for their unique sounds and stories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {currentItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          item.collected ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <span className="text-lg">{item.collected ? "✅" : "🔊"}</span>
                        <div className="flex-1">
                          <span className={item.collected ? "line-through font-medium" : "font-medium"}>
                            {item.name}
                          </span>
                          {item.story && (
                            <div className="text-sm opacity-75 mt-1 italic">{item.story.substring(0, 60)}...</div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge
                              variant={
                                item.category === "nature"
                                  ? "default"
                                  : item.category === "magical"
                                    ? "secondary"
                                    : item.category === "environmental"
                                      ? "outline"
                                      : "destructive"
                              }
                              className="text-xs"
                            >
                              {item.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Position: {item.x + 1}, {item.y + 1}
                            </Badge>
                          </div>
                        </div>
                        {!item.collected && audioSettings.spatialAudioEnabled && (
                          <Badge variant="outline" className="text-xs">
                            3D Audio
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {gameState.gameComplete && (
              <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-2xl text-center text-yellow-800">🎉 Epic Adventure Complete! 🎉</CardTitle>
                  <CardDescription className="text-center text-lg">
                    You've become a true Guardian of Sound Safari! The magical realms sing your praises!
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Characters Met: {gameState.charactersEncountered.length} | Total Items Found:{" "}
                      {storyContent.levels.reduce((sum, level) => sum + level.items.length, 0)}
                    </p>
                  </div>
                  <Button onClick={resetGame} className="mt-4">
                    Begin a New Adventure
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Instructions Footer */}
        <footer className="mt-8 text-center text-sm text-gray-600">
          <p>
            Enhanced with character voices, story narration, and 3D spatial audio positioning.
            <br />
            Meet magical characters, discover ancient treasures, and immerse yourself in the story.
            <br />
            All interactions work with keyboard navigation and screen readers.
            <br />
            Use headphones for the best 3D audio and voice experience.
          </p>
        </footer>
      </div>
    </div>
  )
}
