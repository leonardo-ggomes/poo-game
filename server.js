// ============================================================
// KotlinQuest Arena — Servidor Multiplayer
// Node.js + Socket.io
// npm install express socket.io
// node server.js
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static('.'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'game.html')));

// ============================================================
// GAME STATE
// ============================================================
const players = {};   // socketId → playerData
const XP_REWARDS = {
  class_defined:    50,
  attributes_added: 75,
  move_implemented: 100,
  attack_implemented: 125,
  poly_implemented: 150,
  kill_enemy: 40,
  survive_hit: 10,
};

// Spawn no centro do mapa Perlin (TW=120, TH=120, TS=16 → centro = 960,960)
// Espalhados em volta do centro para não sobrepor
const SPAWN_POINTS = [
  {x:900, y:900}, {x:1020, y:900}, {x:960, y:840},
  {x:900, y:1020},{x:1020, y:1020},{x:840, y:960},
  {x:1080, y:960},{x:960, y:1080},{x:840, y:840},
];
let spawnIdx = 0;

// ============================================================
// POO VALIDATION ENGINE
// Valida se o código Kotlin do aluno está correto
// ============================================================
function validateKotlinCode(code) {
  const result = {
    step: 0,
    errors: [],
    warnings: [],
    pooChecks: {},
    passed: [],
    // Stats sempre têm valores padrão — nunca serão undefined
    stats: { forca: 20, defesa: 15, velocidade: 3, hp: 100 },
    className: 'Herói',
    customColor: null,
    sprite: null,
  };

  const c = code.replace(/\/\/.*/g, '').replace(/\s+/g, ' ');

  // ── Extrai stats numéricos ANTES dos early-returns ──────────
  // (assim sempre temos valores mesmo que o código esteja incompleto)
  const forcaMatch  = code.match(/(?:forca|forca|força|strength|atk|dano)\s*[:=]\s*(\d+)/i);
  const defesaMatch = code.match(/(?:defesa|defense|def|armor)\s*[:=]\s*(\d+)/i);
  const velMatch    = code.match(/(?:\bvel\b|velocidade|speed|spd)\s*[:=]\s*(\d+)/i);
  const hpMatch     = code.match(/(?:\bhp\b|vida|health|maxHp)\s*[:=]\s*(\d+)/i);

  if (forcaMatch)  result.stats.forca      = Math.min(parseInt(forcaMatch[1]),  80);
  if (defesaMatch) result.stats.defesa     = Math.min(parseInt(defesaMatch[1]), 80);
  if (velMatch)    result.stats.velocidade = Math.min(parseInt(velMatch[1]),      8);
  if (hpMatch)     result.stats.hp         = Math.min(Math.max(parseInt(hpMatch[1]), 20), 200);

  // Cor e sprite customizados
  const colorMatch  = code.match(/(?:\bcor\b|color)\s*[:=]\s*["']?(#[0-9a-fA-F]{3,6})["']?/i);
  const spriteMatch = code.match(/(?:sprite|icone|icon)\s*[:=]\s*["']([^"']+)["']/i);
  if (colorMatch)  result.customColor = colorMatch[1];
  if (spriteMatch) result.sprite = spriteMatch[1];

  // ── STEP 1: Herança ─────────────────────────────────────────
  const classRegex = /class\s+(\w+)\s*(?:\([^)]*\))?\s*:\s*Personagem\s*\(/i;
  const classMatch = c.match(classRegex);
  if (classMatch) {
    result.passed.push('class_defined');
    result.pooChecks.heranca = true;
    result.className = classMatch[1];
    result.step = Math.max(result.step, 1);
  } else {
    result.errors.push(
      'Sua classe precisa herdar de Personagem.\n' +
      'Exemplo: class Guerreiro(nome: String) : Personagem(nome) { }'
    );
    result.pooChecks.heranca = false;
    return result;   // early-return seguro — stats já definido acima
  }

  // ── STEP 2: Atributos (val/var) ─────────────────────────────
  const attrMatches = c.match(/(?:val|var)\s+\w+\s*[:=]/g) || [];

  if (attrMatches.length >= 2) {
    result.passed.push('attributes_added');
    result.pooChecks.encapsulamento = true;
    result.step = Math.max(result.step, 2);
    if (c.includes('private')) result.pooChecks.encapsulamentoPrivate = true;
  } else {
    result.errors.push(
      'Adicione pelo menos 2 atributos à sua classe.\n' +
      'Exemplo: val forca: Int = 30'
    );
    result.pooChecks.encapsulamento = false;
    return result;   // early-return seguro
  }

  // ── STEP 3: mover() ─────────────────────────────────────────
  if (/(?:override\s+)?fun\s+mover\s*\(/i.test(c)) {
    result.passed.push('move_implemented');
    result.pooChecks.polimorfismoMover = true;
    result.step = Math.max(result.step, 3);
  } else {
    result.warnings.push('Implemente fun mover(dx: Int, dy: Int) para o personagem se movimentar!');
    return result;
  }

  // ── STEP 4: atacar() ────────────────────────────────────────
  if (/(?:override\s+)?fun\s+atacar\s*\(/i.test(c)) {
    result.passed.push('attack_implemented');
    result.pooChecks.polimorfismoAtacar = true;
    result.step = Math.max(result.step, 4);
  } else {
    result.warnings.push('Implemente fun atacar(): Int para habilitar o combate!');
    return result;
  }

  // ── STEP 5: Interface + múltiplos overrides ─────────────────
  const overrideCount = (c.match(/override/gi) || []).length;
  const hasInterface  = /,\s*Aventureiro/i.test(c);
  const hasHabilidade = /fun\s+habilidadeEspecial/i.test(c);

  if (overrideCount >= 2 && hasInterface && hasHabilidade) {
    result.passed.push('poly_implemented');
    result.pooChecks.polimorfismo = true;
    result.pooChecks.interface    = true;
    result.step = Math.max(result.step, 5);
  } else if (hasInterface) {
    // Tem a interface mas falta implementar os métodos
    result.pooChecks.interface = true;
    result.warnings.push(
      'Ótimo! Interface detectada. Agora implemente habilidadeEspecial() e descricao() para completar o passo 5.'
    );
  }

  return result;
}

// ============================================================
// SOCKET EVENTS
// ============================================================
io.on('connection', (socket) => {
  console.log(`[+] Aluno conectado: ${socket.id}`);

  // Send existing players to newcomer
  socket.emit('init', { players, xpRewards: XP_REWARDS });

  // ── Submit Kotlin code ──────────────────────────────────────
  socket.on('submit_code', ({ code, playerName }) => {
    const validation = validateKotlinCode(code);

    if (validation.errors.length > 0) {
      socket.emit('code_error', { errors: validation.errors, pooChecks: validation.pooChecks });
      return;
    }

    // New steps unlocked?
    const existing = players[socket.id];
    const prevStep = existing ? existing.step : 0;
    const newSteps = validation.passed.filter(s => !existing?.completedSteps?.includes(s));

    const spawn = SPAWN_POINTS[spawnIdx % SPAWN_POINTS.length];
    if (!existing) spawnIdx++;

    const safeStats = validation.stats; // sempre definido agora

    players[socket.id] = {
      id:             socket.id,
      name:           playerName || validation.className || 'Herói',
      className:      validation.className,
      x:              existing?.x ?? spawn.x,
      y:              existing?.y ?? spawn.y,
      step:           validation.step,
      pooChecks:      validation.pooChecks,
      stats:          safeStats,
      color:          validation.customColor || classColor(validation.className),
      sprite:         validation.sprite      || classSprite(validation.className),
      // Preserva HP atual se o jogador já existia e o maxHp não mudou
      maxHp:          safeStats.hp,
      hp:             existing
                        ? Math.min(existing.hp, safeStats.hp)   // não deixa hp > novo maxHp
                        : safeStats.hp,
      xp:             existing?.xp || 0,
      completedSteps: [...(existing?.completedSteps || []), ...newSteps],
      alive:          existing ? (existing.alive ?? true) : true,
      facing:         existing?.facing ?? 1,
      attacking:      false,
    };

    // Award XP for new steps
    let xpGained = 0;
    newSteps.forEach(s => { xpGained += XP_REWARDS[s] || 0; });
    players[socket.id].xp += xpGained;

    socket.emit('code_ok', {
      validation,
      player: players[socket.id],
      newSteps,
      xpGained,
    });

    io.emit('player_update', players[socket.id]);

    if (newSteps.length > 0) {
      io.emit('achievement', {
        playerId: socket.id,
        name: playerName,
        steps: newSteps,
        xpGained
      });
    }
  });

  // ── Player movement ─────────────────────────────────────────
  socket.on('move', ({ dx, dy }) => {
    const p = players[socket.id];
    if (!p || p.step < 3 || !p.alive) return;

    const spd = p.stats?.velocidade ?? 3;
    // Mundo: TW=120, TH=120, TS=16 → 1920x1920 px; margem de 24px nas bordas
    const MARGIN = 24;
    const WORLD_MAX_X = 120 * 16 - MARGIN;
    const WORLD_MAX_Y = 120 * 16 - MARGIN;
    p.x = Math.max(MARGIN, Math.min(WORLD_MAX_X, p.x + dx * spd));
    p.y = Math.max(MARGIN, Math.min(WORLD_MAX_Y, p.y + dy * spd));
    if (dx !== 0) p.facing = dx > 0 ? 1 : -1;

    io.emit('player_moved', { id: socket.id, x: p.x, y: p.y, facing: p.facing });
  });

  // ── Attack ──────────────────────────────────────────────────
  socket.on('attack', () => {
    const p = players[socket.id];
    if (!p || p.step < 4 || !p.alive) return;

    p.attacking = true;
    const atkRange = 80;
    const hits = [];

    // Hit other players
    Object.values(players).forEach(target => {
      if (target.id === socket.id || !target.alive) return;
      const dist = Math.hypot(target.x - p.x, target.y - p.y);
      if (dist < atkRange) {
        const rawDmg  = p.stats?.forca  ?? 20;
        const defense = target.stats?.defesa ?? 15;
        const reduction = Math.min(defense / 100, 0.8); // cap 80% redução
        const dmg = Math.max(1, Math.floor(rawDmg * (1 - reduction)));
        target.hp = Math.max(0, target.hp - dmg);

        if (target.hp <= 0) {
          target.alive = false;
          target.hp = 0;
          p.xp += XP_REWARDS.kill_enemy;
          hits.push({ targetId: target.id, dmg, killed: true });
          io.emit('player_died', { id: target.id, killedBy: socket.id });
          // Respawn after 5s
          setTimeout(() => {
            if (players[target.id]) {
              players[target.id].alive = true;
              players[target.id].hp = players[target.id].maxHp;
              io.emit('player_respawn', players[target.id]);
            }
          }, 5000);
        } else {
          hits.push({ targetId: target.id, dmg, killed: false });
        }

        io.emit('player_update', target);
        io.to(target.id).emit('took_damage', { from: p.name, dmg });
      }
    });

    io.emit('attack_event', {
      attackerId: socket.id,
      hits,
      x: p.x, y: p.y,
      facing: p.facing
    });

    io.emit('player_update', p);

    setTimeout(() => {
      if (players[socket.id]) players[socket.id].attacking = false;
    }, 400);
  });

  // ── Chat / emote ─────────────────────────────────────────────
  socket.on('emote', ({ msg }) => {
    const p = players[socket.id];
    if (!p) return;
    io.emit('emote_event', { id: socket.id, name: p.name, msg: msg.slice(0, 50) });
  });

  // ── Disconnect ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Aluno desconectado: ${socket.id}`);
    delete players[socket.id];
    io.emit('player_left', socket.id);
  });
});

// ============================================================
// HELPERS
// ============================================================
function classColor(name = '') {
  const n = name.toLowerCase();
  if (n.includes('guerr') || n.includes('knight')) return '#ff8c42';
  if (n.includes('mago') || n.includes('mage') || n.includes('wiz')) return '#b06bff';
  if (n.includes('arqu') || n.includes('ranger') || n.includes('elf')) return '#6bffb8';
  if (n.includes('druid') || n.includes('natur')) return '#7fba00';
  if (n.includes('assassin') || n.includes('rogue')) return '#ff4466';
  // Hash from name
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffffff;
  return '#' + (h | 0x404040).toString(16).padStart(6,'0').slice(-6);
}

function classSprite(name = '') {
  const n = name.toLowerCase();
  if (n.includes('guerr') || n.includes('knight')) return '⚔️';
  if (n.includes('mago') || n.includes('mage') || n.includes('wiz')) return '🔮';
  if (n.includes('arqu') || n.includes('ranger')) return '🏹';
  if (n.includes('druid')) return '🌿';
  if (n.includes('assassin') || n.includes('rogue')) return '🗡️';
  if (n.includes('paladin')) return '🛡️';
  if (n.includes('bardo') || n.includes('bard')) return '🎵';
  return '🧙';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n⚔️  KotlinQuest Arena rodando em http://localhost:${PORT}\n`));