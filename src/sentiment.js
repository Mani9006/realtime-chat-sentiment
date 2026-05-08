/**
 * Sentiment Analysis Engine
 * Lexicon-based approach using AFINN-165 word list subset
 * Scores range from -5 (very negative) to +5 (very positive)
 */

'use strict';

// Embedded sentiment lexicon - no external API calls required
const SENTIMENT_LEXICON = {
  // Very positive (+5 to +4)
  excellent: 5, amazing: 5, awesome: 5, fantastic: 5, wonderful: 5,
  perfect: 5, love: 4, happy: 4, great: 4, best: 4, brilliant: 4,
  outstanding: 5, superb: 5, delighted: 4, thrilled: 4, fabulous: 4,
  incredible: 4, marvelous: 4, spectacular: 5, terrific: 4,
  // Positive (+3 to +2)
  good: 3, nice: 3, glad: 3, pretty: 2, fun: 3, pleasant: 3,
  friendly: 3, helpful: 3, cheerful: 3, excited: 3, cool: 2,
  sweet: 2, beautiful: 3, lovely: 3, bright: 2, smart: 2,
  // Slightly positive (+1)
  ok: 1, okay: 1, fine: 1, decent: 1, fair: 1, sure: 1,
  yes: 1, thanks: 1, thank: 1, welcome: 1, well: 1,
  // Negative (-1 to -2)
  bad: -2, sad: -2, sorry: -1, boring: -2, lame: -2, dull: -2,
  poor: -2, ugly: -2, weak: -2, weird: -1, odd: -1, awkward: -1,
  confusing: -2, slow: -1, small: -1, old: -1,
  // More negative (-3 to -4)
  terrible: -4, awful: -4, horrible: -4, hate: -4, angry: -3,
  frustrated: -3, annoying: -3, disgusting: -4, nasty: -3,
  pathetic: -4, miserable: -4, depressing: -3, upset: -3,
  worried: -3, disappointing: -3,
  // Very negative (-5)
  worst: -5, disgusting: -5, atrocious: -5, abysmal: -5,
  appalling: -5, dreadful: -5, vile: -5, repulsive: -5,
  // Negation words (flip sentiment)
  not: 0, no: 0, never: 0, none: 0, nobody: 0, nothing: 0,
  neither: 0, nowhere: 0, hardly: 0, barely: 0, scarcely: 0,
  // Intensifiers (multiply sentiment)
  very: 0, really: 0, extremely: 0, incredibly: 0, absolutely: 0,
  totally: 0, completely: 0, utterly: 0, quite: 0, pretty: 0,
  fairly: 0, rather: 0, somewhat: 0, slightly: 0,
  // Positive intensifier contexts
  super: 0, ultra: 0, mega: 0, extra: 0, highly: 0, so: 0
};

// Negation scope: how many words after a negator to flip
const NEGATION_SCOPE = 3;

// Intensifier multipliers
const INTENSIFIERS = {
  very: 1.5, really: 1.4, extremely: 2.0, incredibly: 2.0,
  absolutely: 2.0, totally: 1.8, completely: 1.8, utterly: 1.8,
  quite: 1.3, fairly: 1.2, rather: 1.3, somewhat: 0.8,
  slightly: 0.6, super: 1.6, ultra: 1.8, mega: 1.7,
  extra: 1.4, highly: 1.5, so: 1.4
};

/**
 * Tokenize text into lowercase words
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Calculate sentiment score and label for given text
 * @param {string} text
 * @returns {object} { score, comparative, label, confidence, tokens }
 */
function analyze(text) {
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return {
      score: 0,
      comparative: 0,
      label: 'neutral',
      confidence: 0,
      tokens: []
    };
  }

  let totalScore = 0;
  const analyzedTokens = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const wordScore = SENTIMENT_LEXICON[token] || 0;

    // Skip if not in lexicon
    if (wordScore === 0 && !SENTIMENT_LEXICON.hasOwnProperty(token)) {
      continue;
    }

    // Check for intensifier before this word
    let multiplier = 1;
    if (i > 0 && INTENSIFIERS[tokens[i - 1]]) {
      multiplier = INTENSIFIERS[tokens[i - 1]];
    }

    // Check for negation
    let isNegated = false;
    const lookbackStart = Math.max(0, i - NEGATION_SCOPE);
    for (let j = lookbackStart; j < i; j++) {
      if (tokens[j] === 'not' || tokens[j] === 'no' || tokens[j] === 'never' ||
          tokens[j] === "n't" || tokens[j] === 'none') {
        isNegated = !isNegated; // flip
      }
    }

    let finalScore = wordScore * multiplier;
    if (isNegated) {
      finalScore = -finalScore;
    }

    totalScore += finalScore;

    analyzedTokens.push({
      word: token,
      score: wordScore,
      final: finalScore,
      negated: isNegated,
      intensified: multiplier !== 1
    });
  }

  // Comparative score normalizes by token count
  const comparative = totalScore / tokens.length;

  // Determine label and confidence
  let label;
  let confidence;

  const absScore = Math.abs(totalScore);
  if (absScore === 0) {
    label = 'neutral';
    confidence = 0.5;
  } else {
    if (totalScore >= 3) {
      label = 'very-positive';
      confidence = Math.min(1, 0.7 + (totalScore / 10));
    } else if (totalScore >= 1) {
      label = 'positive';
      confidence = Math.min(1, 0.6 + (totalScore / 6));
    } else if (totalScore <= -3) {
      label = 'very-negative';
      confidence = Math.min(1, 0.7 + (absScore / 10));
    } else if (totalScore <= -1) {
      label = 'negative';
      confidence = Math.min(1, 0.6 + (absScore / 6));
    } else {
      label = 'neutral';
      confidence = 0.5 + (absScore / 4);
    }
  }

  return {
    score: totalScore,
    comparative: parseFloat(comparative.toFixed(3)),
    label,
    confidence: parseFloat(confidence.toFixed(3)),
    tokens: analyzedTokens
  };
}

/**
 * Get emoji for sentiment label
 * @param {string} label
 * @returns {string}
 */
function getEmoji(label) {
  const emojis = {
    'very-positive': '🤩',
    'positive': '😊',
    'neutral': '😐',
    'negative': '😞',
    'very-negative': '😠'
  };
  return emojis[label] || '😐';
}

/**
 * Get CSS class for sentiment label
 * @param {string} label
 * @returns {string}
 */
function getCssClass(label) {
  return `sentiment-${label}`;
}

module.exports = {
  analyze,
  getEmoji,
  getCssClass,
  tokenize,
  // Exposed for testing
  SENTIMENT_LEXICON,
  INTENSIFIERS,
  NEGATION_SCOPE
};
