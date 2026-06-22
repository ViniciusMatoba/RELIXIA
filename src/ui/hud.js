import { state } from '../game/state.js';
import { DUNGEONS } from '../data/dungeons.js';

export function updateHUD() {
  document.getElementById('res-gold').textContent    = Math.floor(state.gold).toLocaleString('pt-BR');
  document.getElementById('res-heroes').textContent  = state.heroes.length;
  document.getElementById('res-mats').textContent    = Object.values(state.materials).reduce((a, b) => a + b, 0);
  document.getElementById('total-kills').textContent = state.totalKills.toLocaleString('pt-BR');

  const dungeon = DUNGEONS.find(d => d.id === state.activeDungeon);
  if (dungeon) document.getElementById('active-dungeon-name').textContent = dungeon.name;
}
