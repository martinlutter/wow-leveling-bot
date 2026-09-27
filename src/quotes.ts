export interface Quote {
  text: string;
  source: string;
}

// Curated by hand: no public API serves game quotes
export const quotes: readonly Quote[] = [
  { text: "Lok'tar ogar!", source: 'Orc battle cry' },
  { text: 'For the Horde!', source: 'Horde battle cry' },
  { text: 'For the Alliance!', source: 'Alliance battle cry' },
  { text: 'Work, work.', source: 'Orc peon' },
  { text: 'Zug zug.', source: 'Orc peon' },
  { text: 'Me not that kind of orc!', source: 'Orc peon' },
  { text: "Job's done!", source: 'Human peasant' },
  { text: 'More work?', source: 'Human peasant' },
  { text: 'Time is money, friend!', source: 'Goblin merchant' },
  { text: 'Grrr… fresh meat!', source: 'Hogger' },
  { text: 'None may challenge the Brotherhood!', source: 'Edwin VanCleef' },
  {
    text: "We're under attack! A vast, ye swabs! Repel the invaders!",
    source: 'Mr. Smite',
  },
  {
    text: 'Too soon! You have awakened me too soon, Executus!',
    source: 'Ragnaros',
  },
  { text: 'BY FIRE BE PURGED!', source: 'Ragnaros' },
  {
    text: 'How fortuitous. Usually, I must leave my lair in order to feed.',
    source: 'Onyxia',
  },
  {
    text: 'Pride heralds the end of your world. Come, mortals! Face the wrath of the Soulflayer!',
    source: 'Hakkar',
  },
  { text: 'Death is close…', source: "C'Thun" },
  { text: 'Aaaaaughibbrgubugbugrguburgle!', source: 'A murloc' },
  { text: 'Leeroy Jenkins!', source: 'Leeroy Jenkins' },
  { text: 'At least I have chicken.', source: 'Leeroy Jenkins' },
  { text: "Where is Mankrik's wife?", source: 'Barrens chat' },
  { text: 'You are not prepared!', source: 'Illidan Stormrage' },
  { text: 'Frostmourne hungers.', source: 'Arthas Menethil' },
];

export const randomQuote = (): Quote =>
  quotes[Math.floor(Math.random() * quotes.length)];
