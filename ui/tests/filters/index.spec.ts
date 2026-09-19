import { short, dateTime, date, registerGlobalProperties } from '@/filters/index';

describe('Filters', () => {
  describe('short', () => {
    it('should truncate string to specified length', () => {
      expect(short('abcdefghijk', 5)).toBe('abcde');
    });

    it('should return empty string for null/undefined input', () => {
      expect(short(null, 5)).toBe('');
      expect(short(undefined, 5)).toBe('');
    });

    it('should return original string if shorter than length', () => {
      expect(short('abc', 5)).toBe('abc');
    });
  });

  describe('dateTime', () => {
    it('should format date string to datetime', () => {
      const result = dateTime('2023-01-15T10:30:45Z');
      // dateTime() is locale-aware on purpose (Intl with the default locale),
      // so a hard-coded US-style pattern only holds on en-US machines.
      // Compare against the very same formatter instead.
      const expected = new Intl.DateTimeFormat([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date('2023-01-15T10:30:45Z'));
      expect(result).toBe(expected);
      // ...and make sure it really is the filled date, not a pass-through
      expect(result).toContain('2023');
      expect(result).toContain('15');
    });
  });

  describe('date', () => {
    it('should format date string to date only', () => {
      const result = date('2023-01-15T10:30:45Z');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
    });
  });

  describe('registerGlobalProperties', () => {
    it('should register filters as global properties', () => {
      const mockApp = {
        config: {
          globalProperties: {}
        }
      };
      
      registerGlobalProperties(mockApp);
      
      expect(mockApp.config.globalProperties.$filters).toBeDefined();
      expect(mockApp.config.globalProperties.$filters.short).toBe(short);
      expect(mockApp.config.globalProperties.$filters.dateTime).toBe(dateTime);
      expect(mockApp.config.globalProperties.$filters.date).toBe(date);
    });
  });
});