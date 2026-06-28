// src/utils/ProfanityFilter.js

// ===============================
// LISTĂ BAZĂ DE CUVINTE INTERZISE
// (fără țintirea unor grupuri protejate, doar limbaj vulgar/jignitor)
// ===============================
const BASE_PROFANITY_LIST = [
  // română – jigniri / vulgar
  'prost',
  'proasta',
  'prosti',
  'idiot',
  'idioata',
  'bou',
  'boi',
  'handicapat',
  'nesimtit',
  'nesimtita',
  'jegos',
  'jeg',
  'jegosi',
  'jignire',
  'jigniri',
  'obscen',
  'obscena',
  'obscenitati',
  'rahat',
  'cacat',
  'kkt',
  'pula',
  'pizda',
  'muie',
  'labagiu',
  'labar',
  'dracu',
  'dracului',
  'naibii',
  'porcarie',
  'mizerie',
  'hate',
  'injuratura',
  'injuraturi',

  // engleză – câteva de bază, în caz că scriu așa
  'idiot',
  'stupid',
  'dumb',
  'moron',
  'asshole',
  'bastard',
];

// ===============================
// HELPER: normalizare text
// - litere mici
// - fără diacritice
// - unele leetspeak simple (0 -> o, 1 -> i etc.)
// - spații multiple reduse
// ===============================
const normalizeText = (input) => {
  if (!input) return '';

  let text = String(input)
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');

  // leetspeak simplu
  text = text
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't');

  // scoatem caractere non-alfanumerice, dar păstrăm spațiile
  text = text.replace(/[^a-z0-9\s]/g, ' ');

  // comprimăm spațiile
  text = text.replace(/\s+/g, ' ').trim();

  return text;
};

// ===============================
// HELPER: împarte textul în cuvinte
// ===============================
const tokenize = (text) => {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm.split(' ').filter(Boolean);
};

// ===============================
// containsProfanity(text): boolean
// ===============================
export function containsProfanity(text) {
  if (!text) return false;

  const tokens = tokenize(text);
  if (tokens.length === 0) return false;

  const tokenSet = new Set(tokens);
  return BASE_PROFANITY_LIST.some((w) => tokenSet.has(w));
}

// ===============================
// checkForProfanity(text)
// -> { hasProfanity, foundWords, message }
// ===============================
export function checkForProfanity(text) {
  if (!text || !text.trim()) {
    return {
      hasProfanity: false,
      foundWords: [],
      message: '✅ Text gol sau necompletat.',
    };
  }

  const tokens = tokenize(text);
  const found = [];

  BASE_PROFANITY_LIST.forEach((w) => {
    if (tokens.includes(w)) {
      if (!found.includes(w)) {
        found.push(w);
      }
    }
  });

  if (found.length === 0) {
    return {
      hasProfanity: false,
      foundWords: [],
      message: '✅ Textul este în regulă.',
    };
  }

  return {
    hasProfanity: true,
    foundWords: found,
    message: `⚠️ Text neadecvat! Conține: ${found.join(', ')}`,
  };
}

// ===============================
// censorText(text)
// înlocuiește cu ***** cuvintele găsite
// ===============================
export function censorText(text) {
  if (!text) return '';

  const norm = normalizeText(text);
  const tokensOrig = String(text).split(/(\s+)/); // păstrăm spațiile originale

  // map pentru cuvinte interzise normalizate
  const bannedSet = new Set(BASE_PROFANITY_LIST);

  const censoredTokens = tokensOrig.map((piece) => {
    // dacă e spațiu, îl păstrăm
    if (/^\s+$/.test(piece)) return piece;

    const normPiece = normalizeText(piece);
    if (bannedSet.has(normPiece)) {
      return '*'.repeat(piece.length);
    }
    return piece;
  });

  return censoredTokens.join('');
}

// ===============================
// validateForm(fieldsObj)
// fieldsObj = { title, location, description, organizerName, ... }
// ===============================
export function validateForm(fieldsObj) {
  const errors = [];

  if (!fieldsObj || typeof fieldsObj !== 'object') {
    return {
      isValid: true,
      errors: [],
      message: '',
    };
  }

  Object.entries(fieldsObj).forEach(([key, value]) => {
    const text = value == null ? '' : String(value);
    const { hasProfanity, foundWords } = checkForProfanity(text);

    if (hasProfanity) {
      errors.push({
        field: key,
        message: `Câmpul "${key}" conține cuvinte neadecvate: ${foundWords.join(', ')}`,
      });
    }
  });

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      message:
        '⚠️ Unele câmpuri conțin limbaj neadecvat. Te rugăm să reformulezi textele fără jigniri sau vulgarități.',
    };
  }

  return {
    isValid: true,
    errors: [],
    message: '✅ Conținut valid.',
  };
}
