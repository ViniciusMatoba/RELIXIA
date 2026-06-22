import { DUNGEONS } from '../data/dungeons.js';
import { HEROES } from '../data/heroes.js';
import { FORGE_RECIPES } from '../data/forge.js';
import { rollGacha } from '../data/pets.js';
import { state, save } from '../game/state.js';
import { showToast } from './toast.js';
import { updateHUD } from './hud.js';
import { startCombat } from '../game/combat.js';

// ── Modal open/close ──────────────────────────────────────────────────────────
export function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'modal-dungeon')   renderDungeons();
  if (id === 'modal-tavern')    renderTavern();
  if (id === 'modal-forge')     renderForge();
  if (id === 'modal-sanctuary') renderSanctuary();
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

export function closeModalOutside(event, id) {
  if (event.target.id === id) closeModal(id);
}

// ── Dungeons ─────────────────────────────────────────────────────────────────
function renderDungeons() {
  const el = document.getElementById('dungeon-list');
  el.innerHTML = DUNGEONS.map(d => {
    const unlocked = state.bossKills >= d.bossKillsRequired;
    const isActive = state.activeDungeon === d.id;

    return `
    <div class="dungeon-card ${unlocked ? 'unlocked' : 'locked'} ${isActive ? 'active-dungeon' : ''}">
      <span class="dungeon-icon">${d.icon}</span>
      <div class="dungeon-info">
        <div class="dungeon-tier">Tier ${d.tier} · ${d.universe || d.hero}</div>
        <h3>${d.name}</h3>
        <p>${d.description}</p>
        <p style="margin-top:4px;font-size:0.72rem;color:#7a70a0">
          Boss: ${d.boss} · Drops: ${d.drops.slice(0,2).join(', ')}
        </p>
      </div>
      ${unlocked
        ? `<button class="dungeon-action ${isActive ? 'active' : 'enter'}" onclick="enterDungeon('${d.id}')">
            ${isActive ? '✅ Ativo' : '▶ Entrar'}
           </button>`
        : `<button class="dungeon-action locked-btn" disabled>🔒 ${d.bossKillsRequired} kills</button>`
      }
    </div>`;
  }).join('');
}

window.enterDungeon = function(id) {
  state.activeDungeon = id;
  save();
  updateHUD();
  closeModal('modal-dungeon');
  startCombat(id);
};

// ── Taverna ───────────────────────────────────────────────────────────────────
function renderTavern() {
  const el = document.getElementById('tavern-list');
  const baseHireCost = (heroData) => Math.floor(heroData.hireCost * (1 + state.heroes.filter(h => h.id === heroData.id).length * 0.5));

  el.innerHTML = HEROES.map(h => {
    const owned = state.heroes.filter(x => x.id === h.id).length;
    const cost  = baseHireCost(h);
    const canAfford = state.gold >= cost;

    return `
    <div class="hero-card">
      <span class="hero-icon">${h.icon}</span>
      <div class="hero-info">
        <h3>${h.name}</h3>
        <p>${h.universe} · ${h.description.slice(0,55)}…</p>
        <div class="hero-stats">⚔️ ATK ${h.stats.atk}  🛡️ DEF ${h.stats.def}  ❤️ HP ${h.stats.hp}  🌀 ${h.ability.name}</div>
      </div>
      ${owned > 0 ? `<span class="hero-owned">×${owned}</span>` : ''}
      <button class="btn-hire" onclick="hireHero('${h.id}')" ${canAfford ? '' : 'disabled'}>
        💰 ${cost}
      </button>
    </div>`;
  }).join('');
}

window.hireHero = function(id) {
  const heroData = HEROES.find(h => h.id === id);
  if (!heroData) return;
  const owned = state.heroes.filter(h => h.id === id).length;
  const cost = Math.floor(heroData.hireCost * (1 + owned * 0.5));
  if (state.gold < cost) { showToast('Ouro insuficiente!', 'error'); return; }
  state.gold -= cost;
  state.heroes.push({ id, hp: heroData.stats.hp, maxHp: heroData.stats.hp, cooldown: 0 });
  save();
  updateHUD();
  showToast(`${heroData.name} recrutado!`, 'success');
  renderTavern();
};

// ── Forja ─────────────────────────────────────────────────────────────────────
function renderForge() {
  const el = document.getElementById('forge-list');
  const unlockedDungeons = DUNGEONS.filter(d => state.bossKills >= d.bossKillsRequired).map(d => d.id);

  el.innerHTML = FORGE_RECIPES.map(r => {
    const unlocked = unlockedDungeons.includes(r.dungeon);
    const costStr = Object.entries(r.cost)
      .map(([k, v]) => `${v}× ${k === 'gold' ? '💰 Ouro' : k}`)
      .join(', ');
    const statsStr = Object.entries(r.stats)
      .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
      .join(' · ');
    const canCraft = unlocked && canAffordRecipe(r);
    const owned = state.inventory.filter(i => i === r.id).length;

    return `
    <div class="forge-card ${unlocked ? '' : 'locked-forge'}">
      <h3>${r.icon} ${r.name} ${owned > 0 ? `<span style="color:#4caf50">×${owned}</span>` : ''}</h3>
      <div class="recipe">📦 ${costStr}</div>
      <div class="forge-stats">✨ ${statsStr}</div>
      <button class="btn-craft" onclick="craftItem('${r.id}')" ${canCraft ? '' : 'disabled'}>
        ${unlocked ? '🔨 Forjar' : '🔒 Bloqueado'}
      </button>
    </div>`;
  }).join('');
}

function canAffordRecipe(recipe) {
  for (const [mat, qty] of Object.entries(recipe.cost)) {
    if (mat === 'gold') { if (state.gold < qty) return false; }
    else { if ((state.materials[mat] || 0) < qty) return false; }
  }
  return true;
}

window.craftItem = function(id) {
  const recipe = FORGE_RECIPES.find(r => r.id === id);
  if (!recipe || !canAffordRecipe(recipe)) return;
  for (const [mat, qty] of Object.entries(recipe.cost)) {
    if (mat === 'gold') state.gold -= qty;
    else state.materials[mat] = (state.materials[mat] || 0) - qty;
  }
  state.inventory.push(recipe.id);
  save();
  updateHUD();
  showToast(`${recipe.name} forjado!`, 'success');
  renderForge();
};

// ── Santuário (Gacha) ─────────────────────────────────────────────────────────
function renderSanctuary() {
  renderPetCollection();
  document.getElementById('btn-summon').onclick = summonPet;
}

function summonPet() {
  if (state.gold < 500) { showToast('Ouro insuficiente! Precisa de 500 💰', 'error'); return; }
  state.gold -= 500;

  const pet = rollGacha();
  state.pets.push(pet.id);
  save();
  updateHUD();

  const display = document.getElementById('gacha-display');
  display.textContent = pet.icon;
  display.className = 'gacha-display';
  if (pet.rarity === 'legendary') display.classList.add('legendary-glow');
  if (pet.rarity === 'rare')      display.classList.add('rare-glow');

  const msg = pet.rarity === 'legendary'
    ? `🌟 LENDÁRIO! ${pet.name} (${pet.universe})`
    : `${pet.icon} ${pet.name} invocado!`;
  showToast(msg, pet.rarity === 'legendary' ? 'legendary-toast' : 'success');

  renderPetCollection();
}

function renderPetCollection() {
  const el = document.getElementById('pet-collection');
  if (!state.pets.length) { el.innerHTML = '<p style="color:#7a70a0;font-size:0.8rem">Nenhum pet ainda</p>'; return; }

  const counts = {};
  state.pets.forEach(id => counts[id] = (counts[id] || 0) + 1);

  import('../data/pets.js').then(({ PETS }) => {
    el.innerHTML = Object.entries(counts).map(([id, count]) => {
      const p = PETS.find(x => x.id === id);
      if (!p) return '';
      return `<div class="pet-chip ${p.rarity}">${p.icon} ${p.name}${count > 1 ? ` ×${count}` : ''}</div>`;
    }).join('');
  });
}
