/**
 * Phoneme Converter (Node.js version)
 * Converts text to phoneme sequences for avatar animation
 */

class PhonemeConverter {
  constructor() {
    this.phonemeMap = {
      'a': 'ai', 'ai': 'ai', 'ay': 'ai', 'eigh': 'ai', 'ei': 'ai',
      'e': 'e', 'ea': 'e', 'ie': 'e', 'y': 'e',
      'i': 'e', 'u': 'e',
      'o': 'o', 'oa': 'o', 'ow': 'o', 'oe': 'o', 'oo': 'o', 'ou': 'o',
      'silent': 'closed',
      'm': 'mbp', 'b': 'mbp', 'p': 'mbp', 'mm': 'mbp', 'bb': 'mbp', 'pp': 'mbp',
      'l': 'ldt', 'd': 'ldt', 't': 'ldt', 'll': 'ldt', 'dd': 'ldt', 'tt': 'ldt', 'n': 'ldt', 'ng': 'ldt',
      'f': 'fv', 'v': 'fv', 'ff': 'fv', 'ph': 'fv',
      'w': 'wq', 'wh': 'wq', 'qu': 'wq', 'kw': 'wq',
      'h': 'closed', 'th': 'ldt', 'sh': 'e', 's': 'e', 'z': 'e', 'ch': 'e', 'j': 'e', 'g': 'ldt', 'k': 'closed', 'x': 'closed', 'r': 'o'
    };
  }

  textToPhonemes(text) {
    if (!text || text.trim().length === 0) {
      return ['closed'];
    }

    text = text.toLowerCase();
    const phonemes = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      if (/[\s\-.,!?;:'"()[\]{}]/.test(char)) {
        i++;
        continue;
      }

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
        i++;
      }
    }

    return phonemes.length > 0 ? phonemes : ['closed'];
  }

  audioToPhonemes(transcription) {
    return this.textToPhonemes(transcription);
  }

  getPhonemeSequenceWithTiming(text, speechRateMs = 150) {
    const phonemes = this.textToPhonemes(text);
    return phonemes.map(phoneme => ({
      phoneme,
      duration: speechRateMs
    }));
  }

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

module.exports = PhonemeConverter;
