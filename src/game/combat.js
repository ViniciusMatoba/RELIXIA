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

  // Back button registrado imediatamente — não depende do Phaser carregar
  document.getElementById('btn-back-hub').onclick = () => {
    if (game) { game.destroy(true); game = null; }
    showHub();
  };

  if (game) { game.destroy(true); game = null; }

  const sprites = DUNGEON_SPRITES[dungeonId];

  // Dimensões fixas de design — Scale Manager ajusta para caber no container
  const W = 480;
  const H = Math.max(window.innerHeight - 122, 350);

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: W,
    height: H,
    backgroundColor: '#1a0f30',
    parent: 'phaser-container',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    render: { preserveDrawingBuffer: true, antialias: false },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      parent: 'phaser-container',
      width: W,
      height: H,
    },
    scene: buildScene(dungeonId, dungeon, sprites, W, H),
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
    // Escuta erros de carregamento e exibe no console e via toast
    this.load.on('loaderror', (file) => {
      console.error('[Phaser Load Error]', file.key, file.url);
      showToast(`Erro ao carregar asset: ${file.key} (${file.url})`, 'error');
    });

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
    // Animações: só cria se a textura foi carregada com sucesso
    Object.entries(MANIFEST.sprites).forEach(([key, def]) => {
      if (!this.textures.exists(key)) return;
      Object.entries(def.animations).forEach(([animName, cfg]) => {
        const fullKey = `${key}-${animName}`;
        if (!this.anims.exists(fullKey)) {
          try {
            this.anims.create({
              key: fullKey,
              frames: this.anims.generateFrameNumbers(key, { start: cfg.start, end: cfg.end }),
              frameRate: cfg.frameRate,
              repeat: cfg.repeat,
            });
          } catch (_) {}
        }
      });
    });

    const groundY = H - 60;

    // ── Fundo: gradiente sempre desenhado primeiro (camada 0) ──
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(0x050210, 0x050210, 0x1a0a38, 0x1a0a38, 1);
    g.fillRect(0, 0, W, H);

    // ── Parallax por cima se os assets carregaram (camada 1) ──
    if (spriteConfig?.parallax) {
      spriteConfig.parallax.forEach(bg => {
        if (!this.textures.exists(bg.key)) return;
        const tile = this.add.tileSprite(0, 0, W, H, bg.key).setOrigin(0, 0).setDepth(1);
        bgs.push({ tile, speed: bg.speed });
      });
    }

    // ── Chão ──
    this.add.rectangle(W / 2, groundY + 30, W, 60, 0x0d0820).setDepth(2);

    // Todos os heróis espaçados no terço esquerdo da tela
    const heroY = groundY;          // pés no chão
    const heroStartX = 60;
    const heroGap    = 100;
    Object.keys(LEAF_HERO_DATA).forEach((id, i) => {
      const hd = LEAF_HERO_DATA[id];
      if (!hd) return;
      spawnHero.call(this, hd, heroStartX + i * heroGap, heroY);
    });

    // HUD textos
    killText = this.add.text(12, 12, 'Kills: 0',        { fontSize: '13px', color: '#e1dbec', fontFamily: 'Outfit, sans-serif' }).setDepth(10);
    goldText = this.add.text(12, 30, `💰 ${Math.floor(state.gold)}`, { fontSize: '13px', color: '#ffca28', fontFamily: 'Outfit, sans-serif' }).setDepth(10);

  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────
  function update(time, delta) {
    const dt = delta / 1000;

    // Scroll parallax
    bgs.forEach(bg => { bg.tile.tilePositionX += bg.speed * delta * 0.05; });

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy.call(this, W);
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
        // Sem alvo: walk até o targetX individual de cada herói
        if (h.x < h.targetX) {
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
    const hasAnim   = MANIFEST.sprites[spriteKey] && this.textures.exists(spriteKey);

    let sprite = null;
    if (hasAnim) {
      try {
        sprite = this.add.sprite(x, y, spriteKey).setOrigin(0.5, 1).setScale(2).setDepth(5);
        sprite.play(`${spriteKey}-idle`);
      } catch (_) { sprite = null; }
    }
    if (!sprite) {
      sprite = this.add.rectangle(x, y, 36, 64, HERO_COLORS[spriteKey] || 0x7e57c2).setOrigin(0.5, 1).setDepth(5);
    }

    // Barra HP acima do herói
    const barY  = y - 100;
    const hpBg  = this.add.rectangle(x, barY, 44, 6, 0x111111).setDepth(8);
    const hpBar = this.add.rectangle(x - 22, barY, 44, 6, 0x44ee66).setOrigin(0, 0.5).setDepth(9);

    // Label do nome
    this.add.text(x, barY - 10, (hd.name || id).split(' ')[0], {
      fontSize: '9px', color: '#e1dbec', fontFamily: 'Outfit'
    }).setOrigin(0.5, 1).setDepth(9);

    heroes.push({
      id: hd.id,
      spriteKey,
      data: hd,
      sprite, hpBg, hpBar,
      x, y,
      hp: hd.stats.hp,
      maxHp: hd.stats.hp,
      cooldown: 0,
      targetX: x + 60,   // cada herói avança até seu próprio ponto de parada
    });
  }

  function spawnEnemy(x) {
    const tier    = dungeon.tier;
    const isBoss  = killCount > 0 && killCount % 20 === 0;
    const spriteConf = spriteConfig || {};
    const enemyKey   = isBoss ? spriteConf.boss : (spriteConf.enemies?.[Math.floor(Math.random() * spriteConf.enemies.length)] || null);
    const hasAnim    = enemyKey && MANIFEST.sprites[enemyKey] && this.textures.exists(enemyKey);

    const hp  = (isBoss ? 80 : 20) + killCount * 2 + tier * 10;
    const atk = 3 + Math.floor(killCount * 0.1) + tier;

    const ey = H - 60;   // pés no mesmo chão

    let sprite = null;
    if (hasAnim) {
      try {
        sprite = this.add.sprite(x, ey, enemyKey).setOrigin(0.5, 1).setScale(isBoss ? 2.5 : 2).setFlipX(true).setDepth(5);
        sprite.play(`${enemyKey}-walk`);
      } catch (_) { sprite = null; }
    }
    if (!sprite) {
      sprite = this.add.rectangle(x, ey, isBoss ? 48 : 32, isBoss ? 64 : 48, isBoss ? 0xcc0000 : 0x664444).setOrigin(0.5, 1).setDepth(5);
    }

    const barY  = ey - 90;
    const label = this.add.text(x, barY - 10, isBoss ? `💀 ${dungeon.boss}` : dungeon.enemies[0],
      { fontSize: isBoss ? '10px' : '8px', color: isBoss ? '#ff4444' : '#ffaaaa', fontFamily: 'Outfit' }).setOrigin(0.5, 1).setDepth(9);

    const hpBg  = this.add.rectangle(x, barY, isBoss ? 52 : 36, 6, 0x111111).setDepth(8);
    const hpBar = this.add.rectangle(x - (isBoss ? 26 : 18), barY, isBoss ? 52 : 36, 6, 0xff3333).setOrigin(0, 0.5).setDepth(9);

    enemies.push({
      sprite, nameTag: label, hpBg, hpBar,
      x, y: ey,
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
