/**
 * Text → Phoneme Converter
 * Converts text to phoneme sequence for animation
 */

class PhonemeConverter {
  constructor() {
    // Simple phoneme mappings based on common English phonemes
    // Maps characters/digraphs to avatar phonemes: ai, e, o, closed, mbp, ldt, fv, wq
    
    this.phonemeMap = {
      // Vowels
      'a': 'ai',    // cat, apple
      'ai': 'ai',   // said, pain
      'ay': 'ai',   // say, play
      'eigh': 'ai', // eight, weight
      'ei': 'ai',   // their, vein
      
      'e': 'e',     // bed, met
      'ea': 'e',    // bread, head
      'ie': 'e',    // friend, cookies
      'y': 'e',     // happy, silly
      
      'i': 'e',     // sit, bit
      'u': 'e',     // sit, bit (sometimes)
      
      'o': 'o',     // go, boat
      'oa': 'o',    // coat, boat
      'ow': 'o',    // know, grow
      'oe': 'o',    // toe, hoe
      
      'oo': 'o',    // moon, book
      'ou': 'o',    // you, your
      
      // Consonants - silence/closed
      'silent': 'closed',
      
      // M, B, P (bilabial - lips)
      'm': 'mbp',
      'b': 'mbp',
      'p': 'mbp',
      'mm': 'mbp',
      'bb': 'mbp',
      'pp': 'mbp',
      
      // L, D, T (tongue up)
      'l': 'ldt',
      'd': 'ldt',
      't': 'ldt',
      'll': 'ldt',
      'dd': 'ldt',
      'tt': 'ldt',
      'n': 'ldt',
      'ng': 'ldt',
      
      // F, V (teeth)
      'f': 'fv',
      'v': 'fv',
      'ff': 'fv',
      'ph': 'fv',
      
      // W, Q (round lips)
      'w': 'wq',
      'wh': 'wq',
      'qu': 'wq',
      'kw': 'wq',
      
      // Glottal stop / silence
      'h': 'closed',
      'th': 'ldt', // Approximation
      'sh': 'e',   // Approximation
      's': 'e',    // Approximation
      'z': 'e',    // Approximation
      'ch': 'e',   // Approximation
      'j': 'e',    // Approximation
      'g': 'ldt',  // Approximation
      'k': 'closed',
      'x': 'closed',
      'r': 'o',    // Approximation
    };
  }

  /**
   * Convert text to phoneme sequence
   */
  textToPhonemes(text) {
    if (!text || text.trim().length === 0) {
      return ['closed'];
    }

    text = text.toLowerCase();
    const phonemes = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // Skip spaces and punctuation
      if (/[\s\-.,!?;:'"()[\]{}]/.test(char)) {
        i++;
        continue;
      }

      // Try longer combinations first (digraphs, trigraphs)
      let matched = false;
      for (let length = Math.min(3, text.length - i); length > 0; length--) {
        const chunk = text.substring(i, i + length);
        if (this.phonemeMap[chunk]) {
          const phoneme = this.phonemeMap[chunk];
          if (phoneme !== 'silent') {
            phonemes.push(phoneme);
          }
          i += length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Unknown character, skip it
        i++;
      }
    }

    // Ensure at least one phoneme
    return phonemes.length > 0 ? phonemes : ['closed'];
  }

  /**
   * Convert audio to phonemes (requires transcription first)
   */
  audioToPhonemes(transcription) {
    return this.textToPhonemes(transcription);
  }

  /**
   * Get phoneme duration (in ms) for rendering
   * Adjust based on speech rate
   */
  getPhonemeSequenceWithTiming(text, speechRateMs = 150) {
    const phonemes = this.textToPhonemes(text);
    return phonemes.map(phoneme => ({
      phoneme,
      duration: speechRateMs
    }));
  }

  /**
   * Test conversion
   */
  test() {
    const testPhrases = [
      'Hello',
      'How are you',
      'I am Novo',
      'Welcome to the avatar portal',
    ];

    console.log('=== Phoneme Conversion Test ===');
    testPhrases.forEach(phrase => {
      const phonemes = this.textToPhonemes(phrase);
      console.log(`"${phrase}" → ${phonemes.join(' → ')}`);
    });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PhonemeConverter;
}
