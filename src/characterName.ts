import { bold, escapeMarkdown } from '@discordjs/builders';

export const MAX_CHARACTER_NAME_LENGTH = 32;

/** Trims and collapses inner whitespace to one space. */
export const normalizeCharacterName = (name: string) =>
  name.trim().replace(/\s+/g, ' ');

/** One or two words, e.g. `Grom Hellscream`. Expects a normalized name. */
export const isValidCharacterName = (name: string) => /^\S+( \S+)?$/.test(name);

export const formatCharacterName = (name: string) => bold(escapeMarkdown(name));
