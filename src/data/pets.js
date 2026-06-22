export const PETS = [
  // Comum (60%)
  { id: 'meowth',    name: 'Meowth',    icon: '🐱', rarity: 'common',    bonus: '+2% Ouro',     universe: 'Pokémon' },
  { id: 'piglet',    name: 'Leitão',    icon: '🐷', rarity: 'common',    bonus: '+1% Defesa',   universe: 'Clássicos' },
  { id: 'hedgehog',  name: 'Ouriço',    icon: '🦔', rarity: 'common',    bonus: '+2% Velocidade', universe: 'Sonic' },
  { id: 'cat',       name: 'Gatinho',   icon: '😺', rarity: 'common',    bonus: '+1% HP',       universe: 'Genérico' },

  // Incomum (25%)
  { id: 'toothless', name: 'Banguela',  icon: '🐉', rarity: 'uncommon',  bonus: '+5% Ataque',   universe: 'Como Treinar Dragão' },
  { id: 'stitch',    name: 'Stitch',    icon: '👽', rarity: 'uncommon',  bonus: '+4% Defesa',   universe: 'Disney' },
  { id: 'totoro',    name: 'Totoro',    icon: '🐻', rarity: 'uncommon',  bonus: '+6% HP',       universe: 'Studio Ghibli' },

  // Raro (12%)
  { id: 'pikachu',   name: 'Pikachu',   icon: '⚡', rarity: 'rare',      bonus: '+10% Ataque',  universe: 'Pokémon' },
  { id: 'chopper',   name: 'Chopper',   icon: '🦌', rarity: 'rare',      bonus: '+15% HP',      universe: 'One Piece' },
  { id: 'kirby',     name: 'Kirby',     icon: '🌸', rarity: 'rare',      bonus: '+10% Defesa',  universe: 'Kirby' },

  // Lendário (3%)
  { id: 'kurama',    name: 'Kurama',    icon: '🦊', rarity: 'legendary', bonus: '+25% Ataque + +10% HP', universe: 'Naruto' },
  { id: 'grogu',     name: 'Grogu',     icon: '🌿', rarity: 'legendary', bonus: '+20% Ouro + Cura',      universe: 'Star Wars' },
];

export const GACHA_WEIGHTS = {
  common:    60,
  uncommon:  25,
  rare:      12,
  legendary:  3,
};

export function rollGacha() {
  const roll = Math.random() * 100;
  let rarity;
  if (roll < 3)        rarity = 'legendary';
  else if (roll < 15)  rarity = 'rare';
  else if (roll < 40)  rarity = 'uncommon';
  else                 rarity = 'common';

  const pool = PETS.filter(p => p.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
