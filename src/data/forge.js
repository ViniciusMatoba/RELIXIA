export const FORGE_RECIPES = [
  // T1 — Vila da Folha
  { id: 'kunai',        name: 'Kunai',              icon: '🗡️',  tier: 1, dungeon: 'leaf-village', cost: { gold: 50,  'Bandana Velha': 2 },                    stats: { atk: 5 } },
  { id: 'shuriken',     name: 'Shuriken',            icon: '⭐',  tier: 1, dungeon: 'leaf-village', cost: { gold: 80,  'Pergaminho': 2 },                        stats: { atk: 8 } },
  { id: 'chunin-vest',  name: 'Colete Chunin',       icon: '🥋',  tier: 1, dungeon: 'leaf-village', cost: { gold: 120, 'Linhas de Chakra': 3, 'Bandana Velha': 1 }, stats: { def: 10 } },

  // T2 — Namekusei
  { id: 'magic-staff',  name: 'Bastão Mágico',       icon: '🪄',  tier: 2, dungeon: 'namekusei',    cost: { gold: 200, 'Minério Katchin': 2 },                   stats: { atk: 15 } },
  { id: 'saiyan-armor', name: 'Armadura Saiyajin',   icon: '🛡️',  tier: 2, dungeon: 'namekusei',    cost: { gold: 300, 'Esfera de Ki': 3, 'Cauda Saiyajin': 1 }, stats: { def: 20, hp: 30 } },

  // T3 — Estrela da Morte
  { id: 'lightsaber',   name: 'Sabre de Luz',        icon: '💚',  tier: 3, dungeon: 'death-star',   cost: { gold: 500, 'Cristal Kyber': 3 },                     stats: { atk: 30 } },
  { id: 'dl44-blaster', name: 'Blaster DL-44',       icon: '🔫',  tier: 3, dungeon: 'death-star',   cost: { gold: 400, 'Sucata Imperial': 4 },                   stats: { atk: 22, speed: 0.2 } },
  { id: 'mando-helmet', name: 'Elmo Mandaloriano',   icon: '⛑️',  tier: 3, dungeon: 'death-star',   cost: { gold: 600, 'Placa de Beskar': 5 },                   stats: { def: 35 } },

  // T4 — Castelo da Magia
  { id: 'elder-wand',   name: 'Varinha das Varinhas', icon: '🪄', tier: 4, dungeon: 'magic-castle',  cost: { gold: 900,  'Pena de Fênix': 3, 'Madeira de Varinhagem': 5 }, stats: { atk: 45, def: 15 } },
  { id: 'invisib-cloak', name: 'Capa da Invisibilidade', icon: '🫥', tier: 4, dungeon: 'magic-castle', cost: { gold: 1200, 'Caldeirão': 2, 'Pena de Fênix': 2 },   stats: { def: 40, speed: 0.3 } },

  // T5 — Terra Média
  { id: 'sting',        name: 'Ferroada (Sting)',    icon: '🗡️',  tier: 5, dungeon: 'middle-earth',  cost: { gold: 1500, 'Minério de Mithril': 4 },               stats: { atk: 60 } },
  { id: 'elven-cloak',  name: 'Manto Élfico',        icon: '🧥',  tier: 5, dungeon: 'middle-earth',  cost: { gold: 2000, 'Folha de Elbas': 5, 'Fragmento do Anel': 1 }, stats: { def: 55, speed: 0.4 } },
];
