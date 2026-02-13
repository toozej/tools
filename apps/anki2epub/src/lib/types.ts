// E-ink device presets with optimal settings
export interface EinkDevice {
  id: string;
  name: string;
  screenWidth: number;
  screenHeight: number;
  fontSize: number;
  lineHeight: number;
  margins: number;
  fontFamily: string;
}

export const EINK_DEVICES: EinkDevice[] = [
  {
    id: 'xteink-x4',
    name: 'Xteink X4',
    screenWidth: 480,
    screenHeight: 800,
    fontSize: 14,
    lineHeight: 1.4,
    margins: 10,
    fontFamily: 'Georgia, serif',
  },
  {
    id: 'onyx-boox-page',
    name: 'Onyx Boox Page',
    screenWidth: 1264,
    screenHeight: 1680,
    fontSize: 18,
    lineHeight: 1.6,
    margins: 24,
    fontFamily: 'Georgia, serif',
  },
  {
    id: 'kindle',
    name: 'Kindle',
    screenWidth: 1264,
    screenHeight: 1680,
    fontSize: 18,
    lineHeight: 1.6,
    margins: 24,
    fontFamily: 'Georgia, serif',
  },
  {
    id: 'kobo-clara-reader',
    name: 'Kobo Clara Reader',
    screenWidth: 1072,
    screenHeight: 1448,
    fontSize: 16,
    lineHeight: 1.5,
    margins: 20,
    fontFamily: 'Georgia, serif',
  },
];

// Anki flashcard structure
export interface AnkiCard {
  id: number;
  front: string;
  back: string;
}

// Anki deck structure
export interface AnkiDeck {
  name: string;
  cards: AnkiCard[];
}

// Conversion options
export interface ConversionOptions {
  device: EinkDevice;
  deckName: string;
}
