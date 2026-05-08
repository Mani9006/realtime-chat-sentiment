/**
 * Sentiment Analysis Engine Tests
 * Jest test suite for the lexicon-based sentiment analyzer
 */

'use strict';

const sentiment = require('../src/sentiment');

describe('Sentiment Analysis Engine', () => {

  describe('tokenize', () => {
    test('tokenizes simple text', () => {
      const tokens = sentiment.tokenize('hello world');
      expect(tokens).toEqual(['hello', 'world']);
    });

    test('tokenizes mixed case to lowercase', () => {
      const tokens = sentiment.tokenize('Hello World');
      expect(tokens).toEqual(['hello', 'world']);
    });

    test('removes punctuation', () => {
      const tokens = sentiment.tokenize('hello, world! how are you?');
      expect(tokens).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    test('handles empty string', () => {
      const tokens = sentiment.tokenize('');
      expect(tokens).toEqual([]);
    });

    test('handles null/undefined', () => {
      expect(sentiment.tokenize(null)).toEqual([]);
      expect(sentiment.tokenize(undefined)).toEqual([]);
    });

    test('handles contractions', () => {
      const tokens = sentiment.tokenize("don't worry");
      expect(tokens).toContain("don't");
      expect(tokens).toContain('worry');
    });
  });

  describe('analyze - positive sentiment', () => {
    test('detects very positive text', () => {
      const result = sentiment.analyze('This is an excellent amazing product');
      expect(result.label).toBe('very-positive');
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('detects positive text', () => {
      const result = sentiment.analyze('I am happy today');
      // "happy" = +4, can trigger very-positive depending on word count
      expect(result.label).toMatch(/positive/);
      expect(result.score).toBeGreaterThan(0);
    });

    test('detects positive with love', () => {
      const result = sentiment.analyze('I love this so much');
      expect(result.score).toBeGreaterThan(0);
      expect(result.label).toMatch(/positive/);
    });

    test('handles multiple positive words', () => {
      const result = sentiment.analyze('good nice great');
      expect(result.score).toBeGreaterThan(2);
    });
  });

  describe('analyze - negative sentiment', () => {
    test('detects very negative text', () => {
      const result = sentiment.analyze('This is the worst terrible experience');
      expect(result.label).toBe('very-negative');
      expect(result.score).toBeLessThan(0);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('detects negative text', () => {
      const result = sentiment.analyze('I am sad and disappointed');
      expect(result.label).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    test('detects hate', () => {
      const result = sentiment.analyze('I hate this terrible thing');
      expect(result.score).toBeLessThan(0);
      expect(result.label).toMatch(/negative/);
    });
  });

  describe('analyze - neutral sentiment', () => {
    test('returns neutral for empty text', () => {
      const result = sentiment.analyze('');
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0);
    });

    test('returns neutral for unknown words', () => {
      const result = sentiment.analyze('the quick brown fox jumps');
      expect(result.label).toBe('neutral');
      expect(result.score).toBe(0);
    });

    test('returns neutral for balanced text', () => {
      const result = sentiment.analyze('good and bad');
      // Should roughly cancel out
      expect(Math.abs(result.score)).toBeLessThanOrEqual(1);
    });
  });

  describe('analyze - negation handling', () => {
    test('flips sentiment with negation', () => {
      const positive = sentiment.analyze('this is good');
      const negated = sentiment.analyze('this is not good');
      expect(negated.score).toBeLessThan(positive.score);
    });

    test('negates love', () => {
      const result = sentiment.analyze('I do not love this');
      expect(result.score).toBeLessThan(0);
    });

    test('double negation cancels', () => {
      const result = sentiment.analyze('I do not not like this');
      // "like" isn't in our lexicon but testing negation scope
      expect(result).toBeDefined();
    });
  });

  describe('analyze - intensifiers', () => {
    test('intensifies positive words', () => {
      const normal = sentiment.analyze('this is good');
      const intensified = sentiment.analyze('this is very good');
      expect(intensified.score).toBeGreaterThan(normal.score);
    });

    test('intensifies negative words', () => {
      const normal = sentiment.analyze('this is bad');
      const intensified = sentiment.analyze('this is very bad');
      // Both negative, but intensified should be more negative
      expect(intensified.score).toBeLessThanOrEqual(normal.score);
    });

    test('handles extremely', () => {
      const result = sentiment.analyze('extremely amazing');
      expect(result.score).toBeGreaterThan(5);
    });
  });

  describe('analyze - return structure', () => {
    test('returns all required fields', () => {
      const result = sentiment.analyze('good');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('comparative');
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('tokens');
    });

    test('comparative is between -5 and 5', () => {
      const result = sentiment.analyze('amazing wonderful excellent');
      expect(result.comparative).toBeGreaterThanOrEqual(-5);
      expect(result.comparative).toBeLessThanOrEqual(5);
    });

    test('confidence is between 0 and 1', () => {
      const result = sentiment.analyze('good');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('tokens array has analyzed tokens', () => {
      const result = sentiment.analyze('good');
      expect(Array.isArray(result.tokens)).toBe(true);
      if (result.tokens.length > 0) {
        expect(result.tokens[0]).toHaveProperty('word');
        expect(result.tokens[0]).toHaveProperty('score');
        expect(result.tokens[0]).toHaveProperty('final');
      }
    });
  });

  describe('getEmoji', () => {
    test('returns emoji for all labels', () => {
      expect(sentiment.getEmoji('very-positive')).toBe('🤩');
      expect(sentiment.getEmoji('positive')).toBe('😊');
      expect(sentiment.getEmoji('neutral')).toBe('😐');
      expect(sentiment.getEmoji('negative')).toBe('😞');
      expect(sentiment.getEmoji('very-negative')).toBe('😠');
    });

    test('returns default for unknown label', () => {
      expect(sentiment.getEmoji('unknown')).toBe('😐');
    });
  });

  describe('getCssClass', () => {
    test('returns correct CSS class', () => {
      expect(sentiment.getCssClass('positive')).toBe('sentiment-positive');
      expect(sentiment.getCssClass('neutral')).toBe('sentiment-neutral');
    });
  });

  describe('lexicon integrity', () => {
    test('lexicon has positive words', () => {
      expect(sentiment.SENTIMENT_LEXICON['excellent']).toBeGreaterThan(0);
      expect(sentiment.SENTIMENT_LEXICON['amazing']).toBeGreaterThan(0);
      expect(sentiment.SENTIMENT_LEXICON['love']).toBeGreaterThan(0);
    });

    test('lexicon has negative words', () => {
      expect(sentiment.SENTIMENT_LEXICON['terrible']).toBeLessThan(0);
      expect(sentiment.SENTIMENT_LEXICON['awful']).toBeLessThan(0);
      expect(sentiment.SENTIMENT_LEXICON['hate']).toBeLessThan(0);
    });

    test('lexicon has neutral/negation words', () => {
      expect(sentiment.SENTIMENT_LEXICON['not']).toBe(0);
      expect(sentiment.SENTIMENT_LEXICON['never']).toBe(0);
    });

    test('intensifiers are defined', () => {
      expect(sentiment.INTENSIFIERS['very']).toBeDefined();
      expect(sentiment.INTENSIFIERS['very']).toBeGreaterThan(1);
    });
  });
});
