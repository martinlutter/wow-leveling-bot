import {
  formatCharacterName,
  isValidCharacterName,
  normalizeCharacterName,
} from '../src/characterName';

describe('character name', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeCharacterName('  Grom \t  Hellscream ')).toBe(
      'Grom Hellscream',
    );
  });

  it.each([
    ['Grom', true],
    ['Grom Hellscream', true],
    ['Grom Hell scream', false],
    ['', false],
  ])('validates "%s" as %s', (name, valid) => {
    expect(isValidCharacterName(name)).toBe(valid);
  });

  it('formats a name in bold with markdown escaped', () => {
    expect(formatCharacterName('xX_Grom_Xx')).toBe('**xX\\_Grom\\_Xx**');
  });
});
