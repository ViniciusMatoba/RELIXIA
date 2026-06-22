import Phaser from 'phaser';
import { state, save } from './state.js';
import { DUNGEONS } from '../data/dungeons.js';
import { HEROES } from '../data/heroes.js';
import { updateHUD } from '../ui/hud.js';
import { showToast } from '../ui/toast.js';
import MANIFEST from '../../public/assets/sprites/manifest.json';

let game = null;

// ─── Mapa de sprites por dungeon ─────────────────────────────────────────────
const DUNGEON_SPRITES = {
  'leaf-village': {
    heroes:  ['naruto', 'sasuke', 'sakura'],
    enemies: ['nukenin'],
    boss:    'zabuza',
    parallax: [
      { key: 'bg-sky',    file: 'assets/backgrounds/leaf_sky.png',    speed: 0.1 },
      { key: 'bg-mid',    file: 'assets/backgrounds/leaf_mid.png',    speed: 0.3 },
      { key: 'bg-ground', file: 'assets/backgrounds/leaf_ground.png', speed: 0.6 },
    ],
  },
};

// ─── Fallback: rect colorido quando não há sprite ────────────────────────────
const HERO_COLORS   = { naruto: 0xff8c00, sasuke: 0x3a1f8f, sakura: 0xff6b9d };
const ENEMY_COLORS  = { nukenin: 0x444466, zabuza: 0x880000 };

// ─── Dados dos heróis desta fase ─────────────────────────────────────────────
const LEAF_HERO_DATA = {
  naruto: { ...HEROES.find(h => h.id === 'naruto'), spriteKey: 'naruto' },
  sasuke: { id: 'sasuke', name: 'Sasuke Uchiha',   icon: '⚡', stats: { atk: 14, def: 8, hp: 85, speed: 1.3 }, ability: { name: 'Chidori', icon: '⚡', damage: 50, cooldown: 5 }, spriteKey: 'sasuke', rarity: 'rare' },
  sakura: { id: 'sakura', name: 'Sakura Haruno',   icon: '🌸', stats: { atk: 8,  def: 6, hp: 70, speed: 1.0 }, ability: { name: 'Cura',    icon: '💚', damage: 0,  cooldown: 6 }, spriteKey: 'sakura', rarity: 'common' },
};

export function startCombat(dungeonId) {
  showScreen('combat-screen');

  const dungeon = DUNGEONS.find(d => d.id === dungeonId);
  document.getElementById('combat-dungeon-name').textContent = dungeon.name;

  if (game) { game.destroy(true); game = null; }

  // Double-RAF: garante que o flex layout terminou antes de ler as dimensões
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const container = document.getElementById('phaser-container');
      const W = container.clientWidth  || 480;
      const H = Math.max(container.clientHeight || 0, 300);

      const sprites = DUNGEON_SPRITES[dungeonId];

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: W,
        height: H,
        backgroundColor: '#0a0612',
        parent: 'phaser-container',
        physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
        scene: buildScene(dungeonId, dungeon, sprites, W, H),
      });
    });
  });
}

function buildScene(dungeonId, dungeon, spriteConfig, W, H) {
  return { preload, create, update };

  // ─── state ───────────────────────────────────────────────────────────────
  let heroes = [], enemies = [], projectiles = [];
  let killCount = 0, spawnTimer = 0;
  let bgs = [], killText, goldText;
  let hasSprites = false;

  // ─── PRELOAD ─────────────────────────────────────────────────────────────
  function preload() {
    // Sprites dos personagens
    Object.entries(MANIFEST.sprites).forEach(([key, def]) => {
      this.load.spritesheet(key, def.file, {
        frameWidth:  MANIFEST.frameWidth,
        frameHeight: MANIFEST.frameHeight,
      });
    });

    // Backgrounds parallax
    if (spriteConfig?.parallax) {
      spriteConfig.parallax.forEach(bg => {
        this.load.image(bg.key, bg.file);
      });
    }

    this.load.on('complete', () => { hasSprites = true; });
  }

  // ─── CREATE ──────────────────────────────────────────────────────────────
  function create() {
    // Animações globais (uma vez por chave)
    Object.entries(MANIFEST.sprites).forEach(([key, def]) => {
      Object.entries(def.animations).forEach(([animName, cfg]) => {
        const fullKey = `${key}-${animName}`;
        if (!this.anims.exists(fullKey)) {
          this.anims.create({
            key: fullKey,
            frames: this.anims.generateFrameNumbers(key, { start: cfg.start, end: cfg.end }),
            frameRate: cfg.frameRate,
            repeat: cfg.repeat,
          });
        }
      });
    });

    // Parallax
    const groundY = H - 40;
    if (spriteConfig?.parallax && hasSprites) {
      spriteConfig.parallax.forEach(bg => {
        const tile = this.add.tileSprite(0, 0, W, H, bg.key).setOrigin(0, 0);
        tile.setScrollFactor(0);
        bgs.push({ tile, speed: bg.speed });
      });
    } else {
      // Fallback degradê
      const g = this.add.graphics();
      g.fillGradientStyle(0x0a0510, 0x0a0510, 0x1a1040, 0x1a1040, 1);
      g.fillRect(0, 0, W, H);
    }

    // Chão
    const groundLine = this.add.rectangle(W / 2, groundY + 20, W, 40, 0x1a0f30);

    // Heróis ativos da guilda que são desta masmorra
    const heroY = groundY - 24;
    const activeHeroIds = state.heroes.map(h => h.id);
    const leafHeroIds   = Object.keys(LEAF_HERO_DATA);
    const heroesToSpawn = activeHeroIds.length > 0
      ? activeHeroIds.filter(id => leafHeroIds.includes(id)).slice(0, 4)
      : leafHeroIds.slice(0, 2);  // default para demo sem guilda

    if (heroesToSpawn.length === 0 && dungeonId === 'leaf-village') {
      heroesToSpawn.push('naruto'); // sempre tem ao menos 1 para demo
    }

    heroesToSpawn.forEach((id, i) => {
      const hd = LEAF_HERO_DATA[id] || HEROES.find(h => h.id === id);
      if (!hd) return;
      const x = 60 + i * 80;
      spawnHero.call(this, hd, x, heroY);
    });

    // HUD textos
    killText = this.add.text(12, 12, 'Kills: 0',        { fontSize: '13px', color: '#e1dbec', fontFamily: 'Outfit, sans-serif' }).setDepth(10);
    goldText = this.add.text(12, 30, `💰 ${Math.floor(state.gold)}`, { fontSize: '13px', color: '#ffca28', fontFamily: 'Outfit, sans-serif' }).setDepth(10);

    document.getElementById('btn-back-hub').onclick = () => {
      if (game) { game.destroy(true); game = null; }
      showHub();
    };
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────
  function update(time, delta) {
    const dt = delta / 1000;

    // Scroll parallax
    bgs.forEach(bg => { bg.tile.tilePositionX += bg.speed * delta * 0.05; });

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy.call(this, W, H - 64);
      spawnTimer = Math.max(0.8, 2.5 - killCount * 0.015);
    }

    // Move inimigos
    enemies.forEach(e => {
      if (!e.alive) return;
      e.x -= e.speed * delta;
      if (e.sprite) { e.sprite.x = e.x; e.sprite.setFlipX(false); }
      if (e.nameTag) e.nameTag.x = e.x;
      updateEntityHP(e);
    });

    // Heróis: idle walk / attack
    heroes.forEach(h => {
      if (h.hp <= 0) return;
      h.cooldown = Math.max(0, h.cooldown - dt);

      const nearest = enemies
        .filter(e => e.alive && e.x < h.x + 220 && e.x > h.x - 30)
        .sort((a, b) => a.x - b.x)[0];

      if (nearest) {
        if (h.sprite) {
          if (!h.sprite.anims.isPlaying || h.sprite.anims.currentAnim?.key !== `${h.spriteKey}-attack`) {
            h.sprite.play(`${h.spriteKey}-attack`, true);
          }
        }
        if (h.cooldown <= 0) {
          fireProjectile.call(this, h, nearest);
          h.cooldown = 1 / (h.data.stats.speed || 1.0);
        }
      } else {
        // Sem alvo: walk suavemente para a direita até limite
        const maxX = W * 0.55;
        if (h.x < maxX) {
          h.x += 40 * dt;
          if (h.sprite) { h.sprite.x = h.x; h.sprite.play(`${h.spriteKey}-walk`, true); }
        } else {
          if (h.sprite) h.sprite.play(`${h.spriteKey}-idle`, true);
        }
      }

      updateEntityHP(h);
    });

    // Inimigos batem nos heróis em contato
    enemies.forEach(e => {
      if (!e.alive) return;
      heroes.forEach(h => {
        if (h.hp <= 0) return;
        if (Math.abs(e.x - h.x) < 40) {
          e.attackTimer = (e.attackTimer || 0) - dt;
          if (e.attackTimer <= 0) {
            h.hp = Math.max(0, h.hp - e.atk);
            e.attackTimer = 1.2;
            flashRed.call(this, h.sprite);
            if (h.hp <= 0) killHero(h);
          }
        }
      });
    });

    // Move projéteis
    projectiles.forEach(p => {
      if (!p.active) return;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      if (p.sprite) { p.sprite.x = p.x; p.sprite.y = p.y; }

      if (p.target?.alive) {
        const dx = p.x - p.target.x;
        const dy = p.y - p.target.y;
        if (Math.sqrt(dx*dx + dy*dy) < 32) {
          hitEnemy.call(this, p.target, p.damage);
          destroyProjectile(p);
        }
      }
      if (p.x > W + 60 || p.x < -60) destroyProjectile(p);
    });

    // Limpa mortos
    enemies = enemies.filter(e => e.alive || e._dying);
    projectiles = projectiles.filter(p => p.active);

    // HUD
    killText.setText(`Kills: ${killCount}`);
    goldText.setText(`💰 ${Math.floor(state.gold)}`);
    document.getElementById('combat-kills').textContent = killCount;
    updateHeroesFooter(heroes);
  }

  // ─── helpers ─────────────────────────────────────────────────────────────
  function spawnHero(hd, x, y) {
    const spriteKey = hd.spriteKey || hd.id;
    const hasAnim   = MANIFEST.sprites[spriteKey];

    let sprite = null;
    if (hasAnim) {
      sprite = this.add.sprite(x, y, spriteKey).setOrigin(0.5, 1).setScale(2.5).setDepth(5);
      sprite.play(`${spriteKey}-idle`);
    } else {
      sprite = this.add.rectangle(x, y, 36, 48, HERO_COLORS[spriteKey] || 0x7e57c2).setOrigin(0.5, 1).setDepth(5);
    }

    // Barra HP
    const hpBg  = this.add.rectangle(x, y + 6, 40, 5, 0x222222).setDepth(6);
    const hpBar = this.add.rectangle(x, y + 6, 40, 5, 0x66bb6a).setOrigin(0, 0.5).setDepth(7);
    hpBar.setX(x - 20);

    heroes.push({
      id: hd.id,
      spriteKey,
      data: hd,
      sprite, hpBg, hpBar,
      x, y,
      hp: hd.stats.hp,
      maxHp: hd.stats.hp,
      cooldown: 0,
    });
  }

  function spawnEnemy(x, y) {
    const tier    = dungeon.tier;
    const isBoss  = killCount > 0 && killCount % 20 === 0;
    const spriteConf = spriteConfig || {};
    const enemyKey   = isBoss ? spriteConf.boss : (spriteConf.enemies?.[Math.floor(Math.random() * spriteConf.enemies.length)] || null);
    const hasAnim    = enemyKey && MANIFEST.sprites[enemyKey];

    const hp  = (isBoss ? 80 : 20) + killCount * 2 + tier * 10;
    const atk = 3 + Math.floor(killCount * 0.1) + tier;

    let sprite = null;
    if (hasAnim) {
      sprite = this.add.sprite(x, y, enemyKey).setOrigin(0.5, 1).setScale(isBoss ? 3 : 2.5).setFlipX(true).setDepth(5);
      sprite.play(`${enemyKey}-walk`);
    } else {
      sprite = this.add.rectangle(x, y, isBoss ? 52 : 36, isBoss ? 64 : 48, isBoss ? 0xcc0000 : 0x664444).setOrigin(0.5, 1).setDepth(5);
    }

    const label = this.add.text(x, y - (isBoss ? 80 : 60), isBoss ? `💀 ${dungeon.boss}` : dungeon.enemies[0],
      { fontSize: isBoss ? '10px' : '8px', color: isBoss ? '#ff4444' : '#ffaaaa', fontFamily: 'Outfit' }).setOrigin(0.5).setDepth(6);

    const hpBg  = this.add.rectangle(x, y + 8, isBoss ? 52 : 36, 5, 0x222222).setDepth(6);
    const hpBar = this.add.rectangle(x - (isBoss ? 26 : 18), y + 8, isBoss ? 52 : 36, 5, 0xff4444).setOrigin(0, 0.5).setDepth(7);

    enemies.push({
      sprite, nameTag: label, hpBg, hpBar,
      x, y,
      hp, maxHp: hp,
      atk,
      alive: true,
      speed: isBoss ? 0.04 : 0.05 + Math.random() * 0.025,
      isBoss,
      spriteKey: enemyKey,
    });
  }

  function hitEnemy(enemy, dmg) {
    enemy.hp = Math.max(0, enemy.hp - dmg);
    flashRed.call(this, enemy.sprite);

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy._dying = true;
      killCount++;
      state.totalKills++;

      const gold = (5 + Math.floor(Math.random() * 10)) * dungeon.tier;
      state.gold += gold;

      if (Math.random() < 0.3) {
        const mat = dungeon.drops[Math.floor(Math.random() * dungeon.drops.length)];
        state.materials[mat] = (state.materials[mat] || 0) + 1;
      }

      if (enemy.isBoss) {
        state.bossKills++;
        showToast(`💀 ${dungeon.boss} derrotado! +100 💰`, 'success');
        state.gold += 100;
      }

      save();
      updateHUD();

      // Animação de morte
      const targets = [enemy.sprite, enemy.nameTag, enemy.hpBg, enemy.hpBar].filter(Boolean);
      this.tweens.add({
        targets,
        alpha: 0,
        y: `+=${enemy.isBoss ? 30 : 20}`,
        angle: enemy.isBoss ? 0 : 45,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          targets.forEach(t => t?.destroy?.());
          enemies = enemies.filter(e => e !== enemy);
        },
      });
    }
  }

  function fireProjectile(hero, target) {
    const dx   = target.x - hero.x;
    const dy   = (target.y - 24) - hero.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const spd  = 0.45;

    const color = hero.id === 'naruto'  ? 0xff8c00
                : hero.id === 'sasuke'  ? 0x3a8fff
                : 0xff69b4;

    const circle = this.add.circle(hero.x, hero.y - 20, hero.id === 'naruto' ? 8 : 6, color).setDepth(8);
    this.tweens.add({ targets: circle, alpha: { from: 1, to: 0.6 }, yoyo: true, repeat: -1, duration: 100 });

    projectiles.push({
      x: hero.x, y: hero.y - 20,
      vx: (dx / dist) * spd,
      vy: (dy / dist) * spd,
      sprite: circle,
      target,
      damage: hero.data.stats.atk + (hero.data.ability?.damage || 0) * 0.4,
      active: true,
    });
  }

  function flashRed(sprite) {
    if (!sprite) return;
    if (sprite.setTint) {
      sprite.setTint(0xff0000);
      this.time.delayedCall(100, () => sprite.clearTint?.());
    } else if (sprite.setFillStyle) {
      const orig = sprite.fillColor;
      sprite.setFillStyle(0xff0000);
      this.time.delayedCall(100, () => sprite.setFillStyle(orig));
    }
  }

  function destroyProjectile(p) {
    p.active = false;
    p.sprite?.destroy();
  }

  function killHero(h) {
    if (h.sprite?.setAlpha) h.sprite.setAlpha(0.25);
    else if (h.sprite) h.sprite.setAlpha(0.25);
    if (h.sprite?.stop) h.sprite.stop();
  }

  function updateEntityHP(e) {
    if (!e.hpBar) return;
    const pct = Math.max(0, e.hp / e.maxHp);
    const maxW = e.hpBg?.width || 40;
    e.hpBar.width = maxW * pct;
    if (e.hpBg) { e.hpBg.x = e.x; e.hpBg.y = e.y + 8; }
    if (e.hpBar) { e.hpBar.x = e.x - maxW / 2; e.hpBar.y = e.y + 8; }
  }
}

function updateHeroesFooter(heroes) {
  const el = document.getElementById('heroes-status');
  if (!el) return;
  el.innerHTML = heroes.map(h => `
    <div class="hero-status-chip">
      <span>${h.data.icon || '⚔️'}</span>
      <span>${(h.data.name || h.id).split(' ')[0]}</span>
      <div class="hp-bar"><div class="hp-bar-fill" style="width:${Math.max(0, h.hp / h.maxHp * 100)}%"></div></div>
    </div>
  `).join('');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

export function showHub() {
  showScreen('hub-screen');
}
