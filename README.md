# ⚔️ KotlinQuest Arena — Mundo Compartilhado de POO

Ambiente 2D multiplayer onde alunos implementam POO em Kotlin e
veem seus personagens ganhando vida em tempo real numa arena medieval compartilhada.

---

## 🚀 Instalação (2 minutos)

```bash
# 1. Instalar dependências
npm install

# 2. Rodar o servidor
node server.js

# 3. Abrir no navegador
# http://localhost:3000
# Cada aluno abre no seu computador (mesma rede)
```

---

## 🗺️ Fluxo Pedagógico — 5 Etapas

| Etapa | Conceito POO | O que acontece no jogo |
|-------|-------------|----------------------|
| 1 | **Herança** | Personagem fantasma aparece no cenário |
| 2 | **Encapsulamento** | Personagem ganha cor, forma e HUD de HP |
| 3 | **Polimorfismo** — mover() | WASD ativa, personagem se move |
| 4 | **Polimorfismo** — atacar() | Combate PvP liberado |
| 5 | **Interface** | Aura especial + bônus máximo de XP |

---

## 🎮 Controles
- `WASD` — Mover (requer passo 3)
- `SPACE` — Atacar (requer passo 4)
- `E` — Emote / chat rápido

---

## 🧠 Princípios POO Validados Automaticamente

O servidor valida o código Kotlin do aluno em tempo real:

```
✅ Herança          → class X : Personagem(nome)
✅ Encapsulamento   → val/var com tipos
✅ Private          → private var _atributo
✅ Polimorfismo 1   → override fun mover()
✅ Polimorfismo 2   → override fun atacar()
✅ Interface        → : Personagem(nome), Aventureiro
```

---

## 💡 Dica para o Professor

1. **Projete** a arena no telão para todos verem o mundo se populando
2. **Cada aluno** abre `http://IP_DO_SERVIDOR:3000` no seu computador
3. Conforme implementam, os personagens **aparecem gradativamente**
4. A ausência de movement/ataque torna o personagem **estático visualmente**
5. Use o **placar de XP** como gamificação — quem completa mais etapas sobe
6. O **combate PvP** incentiva completar o passo 4 rapidamente

---

## 📦 Estrutura do Projeto

```
kotlinquest-arena/
├── server.js     ← Servidor Node.js + Socket.io + validação POO
├── game.html     ← Cliente: editor guiado + canvas 2D + HUD
├── package.json
└── README.md
```

---

## 🔧 Personalização para o Professor

Em `server.js`, ajuste as constantes:
```js
const XP_REWARDS = {
  class_defined:    50,   // Etapa 1
  attributes_added: 75,   // Etapa 2
  move_implemented: 100,  // Etapa 3
  attack_implemented: 125,// Etapa 4
  poly_implemented: 150,  // Etapa 5
  kill_enemy: 40,         // Abate PvP
};
```
