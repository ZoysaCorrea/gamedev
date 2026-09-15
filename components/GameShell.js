'use client';

import { useEffect, useRef, useState } from 'react';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function getDeviceIsMobile() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const ua = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return Boolean(ua || (coarse && touch));
}

const bossDefs = [
  { level: 5, name: 'THE BOUNCER', color: '#c84d4a', r: 48, hp: 420, speed: 42, damage: 40, score: 50, special: 'charge' },
  { level: 10, name: 'THE CHUCKER', color: '#d65e47', r: 52, hp: 620, speed: 35, damage: 46, score: 80, special: 'summon' },
  { level: 15, name: 'THE TANK', color: '#b94a49', r: 58, hp: 900, speed: 28, damage: 55, score: 120, special: 'burst' },
  { level: 20, name: 'THE RUNNER', color: '#df524e', r: 50, hp: 1150, speed: 62, damage: 60, score: 170, special: 'dash' },
  { level: 25, name: 'THE LEGEND', color: '#a94242', r: 68, hp: 1700, speed: 38, damage: 70, score: 260, special: 'rage' },
];

const weapons = {
  pistol: { label: 'PISTOL', cooldown: 0.18, bulletSpeed: 760, damage: 28, radius: 3.2, pellets: 1, spread: 0 },
  ak: { label: 'AK-47', cooldown: 0.085, bulletSpeed: 820, damage: 18, radius: 3.1, pellets: 1, spread: 0.035 },
  rpg: { label: 'RPG', cooldown: 0.55, bulletSpeed: 520, damage: 90, radius: 5, pellets: 1, spread: 0 },
};

export default function GameShell() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const pausedRef = useRef(false);
  const isMobileRef = useRef(false);
  const manualFireRef = useRef(false);
  const rewardShowRef = useRef(null);
  const adBreakActiveRef = useRef(false);

  const [isMobile, setIsMobile] = useState(false);
  const [paused, setPausedState] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [oneHand, setOneHand] = useState(false);
  const [manualFire, setManualFireState] = useState(false);
  const [sound, setSound] = useState(true);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(215);
  const [health, setHealth] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const [rewardReady, setRewardReady] = useState(false);
  const [rewardPrompt, setRewardPrompt] = useState(false);
  const [dialogue, setDialogue] = useState(null);
  const [weapon, setWeapon] = useState('pistol');
  const [wave, setWave] = useState(1);
  const [boss, setBoss] = useState(null);

  const setPaused = (value) => {
    setPausedState((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      pausedRef.current = next;
      return next;
    });
  };

  const setManualFire = (value) => {
    setManualFireState((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      manualFireRef.current = next;
      return next;
    });
  };

  const speakDialogue = (title, text, duration = 2200) => {
    setDialogue({ title, text });
    window.setTimeout(() => setDialogue(null), duration);
  };

  useEffect(() => {
    const detect = () => {
      const mobile = getDeviceIsMobile();
      isMobileRef.current = mobile;
      setIsMobile(mobile);
    };
    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, []);

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem('drunkenLegendBest') || 215));
    } catch (_) {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const state = {
      w: 1, h: 1, last: performance.now(), elapsed: 0,
      move: { x: 0, y: 0 }, pointer: { x: 0, y: 0, active: false }, fireHeld: false,
      fireCooldown: 0, spawnCooldown: 0.7, powerupCooldown: 8,
      score: 0, health: 100, gameOver: false, wave: 1, kills: 0,
      player: { x: 0, y: 0, r: 22, angle: 0, speed: 270, invuln: 0 },
      bullets: [], enemies: [], powerups: [], particles: [], keys: new Set(), boss: null,
      bossActive: false, bossIndex: -1, bossTimer: 0, nextBossLevel: 5, damageFlash: 0,
      weapon: 'pistol', revived: false,
    };
    stateRef.current = state;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      state.w = Math.max(1, rect.width); state.h = Math.max(1, rect.height);
      canvas.width = Math.floor(state.w * dpr); canvas.height = Math.floor(state.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!state.player.x) {
        state.player.x = state.w * 0.5; state.player.y = state.h * 0.55;
      } else {
        state.player.x = clamp(state.player.x, state.player.r + 2, state.w - state.player.r - 2);
        state.player.y = clamp(state.player.y, 74 + state.player.r * .25, state.h - state.player.r - 2);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnEnemy = (kind = 'normal') => {
      const edge = Math.floor(Math.random() * 4); const margin = 55;
      let x = 0, y = 0;
      if (edge === 0) { x = rand(0, state.w); y = -margin; }
      if (edge === 1) { x = state.w + margin; y = rand(75, state.h); }
      if (edge === 2) { x = rand(0, state.w); y = state.h + margin; }
      if (edge === 3) { x = -margin; y = rand(75, state.h); }
      state.enemies.push({
        x, y, r: kind === 'heavy' ? rand(20, 24) : rand(16, 20),
        speed: (kind === 'heavy' ? rand(35, 48) : rand(55, 82)) + Math.min(40, state.wave * 1.7),
        kind, wobble: rand(0, Math.PI * 2), dead: false,
      });
    };

    const spawnPowerup = () => {
      const types = ['ak', 'rpg', 'health'];
      const type = types[Math.floor(Math.random() * types.length)];
      state.powerups.push({ x: rand(70, Math.max(90, state.w - 70)), y: rand(120, Math.max(150, state.h - 80)), r: 14, type, life: 14, pulse: rand(0, 6.2) });
    };

    const spawnBoss = () => {
      const def = bossDefs[state.bossIndex + 1] || bossDefs[bossDefs.length - 1];
      if (!def) return;
      state.bossIndex += 1;
      state.bossActive = true;
      state.bossTimer = 0;
      state.enemies = [];
      state.boss = { ...def, x: state.w * .5, y: 105, hp: def.hp, maxHp: def.hp, dead: false, cooldown: 2.3, dashCooldown: 3 };
      speakDialogue(def.name, `BOSS LEVEL ${def.level} — GET READY`, 2400);
      setBoss({ name: def.name, hp: def.hp, maxHp: def.hp, level: def.level });
    };

    const addParticles = (x, y, count, speed = 100) => {
      for (let i = 0; i < count; i += 1) {
        const a = rand(0, Math.PI * 2), s = rand(speed * .3, speed);
        state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .3, size: rand(1, 4) });
      }
    };

    const shoot = (angle = state.player.angle) => {
      if (state.gameOver || pausedRef.current) return;
      const w = weapons[state.weapon]; const p = state.player;
      for (let i = 0; i < w.pellets; i += 1) {
        const a = angle + rand(-w.spread, w.spread);
        state.bullets.push({ x: p.x + Math.cos(a) * (p.r + 5), y: p.y + Math.sin(a) * (p.r + 5), vx: Math.cos(a) * w.bulletSpeed, vy: Math.sin(a) * w.bulletSpeed, life: 1.15, damage: w.damage, radius: w.radius, type: state.weapon });
      }
      if (state.weapon === 'rpg') addParticles(p.x + Math.cos(angle) * p.r, p.y + Math.sin(angle) * p.r, 8, 130);
    };

    const explode = (x, y, damage, radius = 62) => {
      addParticles(x, y, 14, 160);
      for (const e of state.enemies) {
        if (Math.hypot(e.x - x, e.y - y) <= radius) e.hp = (e.hp ?? 1) - damage;
      }
      if (state.boss && Math.hypot(state.boss.x - x, state.boss.y - y) <= radius) state.boss.hp -= damage;
    };

    const hitEnemy = (e, damage, bullet) => {
      e.hp = (e.hp ?? 1) - damage;
      if (bullet.type === 'rpg') explode(bullet.x, bullet.y, Math.round(damage * .55), 72);
      if (e.hp <= 0) {
        e.dead = true; state.score += e.kind === 'heavy' ? 2 : 1; state.kills += 1; addParticles(e.x, e.y, 8, 120);
        if (Math.random() < .085) spawnPowerup();
      }
    };

    for (let i = 0; i < 5; i += 1) spawnEnemy(i === 4 ? 'heavy' : 'normal');

    const handleBossHit = (b) => {
      if (!state.boss || state.boss.dead) return false;
      if (Math.hypot(b.x - state.boss.x, b.y - state.boss.y) < state.boss.r + b.radius) {
        state.boss.hp -= b.damage;
        if (b.type === 'rpg') explode(b.x, b.y, 60, 86);
        b.life = 0;
        addParticles(b.x, b.y, 4, 90);
        return true;
      }
      return false;
    };

    const updateBoss = (dt) => {
      const b = state.boss; if (!b) return;
      state.bossTimer += dt;
      b.cooldown -= dt; b.dashCooldown -= dt;
      const dx = state.player.x - b.x, dy = state.player.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      b.x += (dx / dist) * b.speed * dt; b.y += (dy / dist) * b.speed * dt;
      if (b.special === 'charge' && b.dashCooldown <= 0) { b.x += (dx / dist) * 120; b.y += (dy / dist) * 120; b.dashCooldown = 3.4; }
      if (b.special === 'dash' && b.dashCooldown <= 0) { b.x += (dx / dist) * 190; b.y += (dy / dist) * 190; b.dashCooldown = 2.4; }
      if (b.special === 'summon' && b.cooldown <= 0) { spawnEnemy('normal'); spawnEnemy(Math.random() > .6 ? 'heavy' : 'normal'); b.cooldown = 3; }
      if (b.special === 'burst' && b.cooldown <= 0) { for (let i = 0; i < 6; i++) spawnEnemy(i > 4 ? 'heavy' : 'normal'); b.cooldown = 4.5; }
      if (b.special === 'rage') { b.speed = b.hp < b.maxHp * .5 ? b.speed + 20 * dt : b.speed; }
      if (dist < state.player.r + b.r - 8 && state.player.invuln <= 0) {
        state.health = Math.max(0, state.health - b.damage * dt); state.player.invuln = .55; state.damageFlash = .2;
      }
      if (b.hp <= 0) {
        state.score += b.score; state.wave += 1; state.bossActive = false; state.boss = null; state.nextBossLevel = (bossDefs[state.bossIndex + 1]?.level) || 999;
        addParticles(b.x, b.y, 36, 220); spawnPowerup();
        speakDialogue('BOSS DEFEATED', `WAVE ${state.wave} — KEEP GOING`, 1800);
        setBoss(null); setWave(state.wave);
      }
    };

    const update = (dt) => {
      if (pausedRef.current || state.gameOver) return;
      state.elapsed += dt; state.player.invuln = Math.max(0, state.player.invuln - dt); state.damageFlash = Math.max(0, state.damageFlash - dt);
      const keyX = (state.keys.has('d') || state.keys.has('arrowright') ? 1 : 0) - (state.keys.has('a') || state.keys.has('arrowleft') ? 1 : 0);
      const keyY = (state.keys.has('s') || state.keys.has('arrowdown') ? 1 : 0) - (state.keys.has('w') || state.keys.has('arrowup') ? 1 : 0);
      let mx = isMobileRef.current ? state.move.x : keyX, my = isMobileRef.current ? state.move.y : keyY;
      const mag = Math.hypot(mx, my); if (mag > 1) { mx /= mag; my /= mag; }
      const p = state.player;
      p.x = clamp(p.x + mx * p.speed * dt, p.r + 2, state.w - p.r - 2);
      p.y = clamp(p.y + my * p.speed * dt, 74 + p.r * .25, state.h - p.r - 2);
      if (!isMobileRef.current && state.pointer.active) p.angle = Math.atan2(state.pointer.y - p.y, state.pointer.x - p.x);
      else if (mag > .08) p.angle = Math.atan2(my, mx);

      state.fireCooldown -= dt;
      const allowed = isMobileRef.current ? (!manualFireRef.current || state.fireHeld) : state.fireHeld;
      if (allowed && state.fireCooldown <= 0) { shoot(); state.fireCooldown = weapons[state.weapon].cooldown; }

      if (!state.bossActive) {
        state.spawnCooldown -= dt;
        if (state.spawnCooldown <= 0) { spawnEnemy(Math.random() > .84 ? 'heavy' : 'normal'); state.spawnCooldown = Math.max(.25, .95 - state.wave * .028); }
        if (state.kills >= state.wave * 8) { state.wave += 1; state.kills = 0; setWave(state.wave); }
        if (state.wave >= state.nextBossLevel) spawnBoss();
      } else {
        updateBoss(dt);
      }

      state.powerupCooldown -= dt;
      if (state.powerupCooldown <= 0) { if (Math.random() < .65) spawnPowerup(); state.powerupCooldown = rand(12, 18); }

      for (const b of state.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
      state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -60 && b.x < state.w + 60 && b.y > -60 && b.y < state.h + 60);

      for (const e of state.enemies) {
        const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
        e.wobble += dt * 3.5; e.x += (dx / dist) * e.speed * dt; e.y += (dy / dist) * e.speed * dt + Math.sin(e.wobble) * 5 * dt;
        if (dist < p.r + e.r - 3 && p.invuln <= 0) { state.health = Math.max(0, state.health - (e.kind === 'heavy' ? 28 : 22) * dt); p.invuln = .18; state.damageFlash = .08; }
      }

      for (const b of state.bullets) {
        if (handleBossHit(b)) continue;
        for (const e of state.enemies) if (!e.dead && Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.radius) { hitEnemy(e, b.damage, b); b.life = 0; break; }
      }
      state.enemies = state.enemies.filter((e) => !e.dead);

      for (const pu of state.powerups) {
        pu.life -= dt; pu.pulse += dt * 4;
        if (Math.hypot(p.x - pu.x, p.y - pu.y) < p.r + pu.r) {
          if (pu.type === 'health') state.health = Math.min(100, state.health + 30);
          else state.weapon = pu.type;
          setWeapon(state.weapon); addParticles(pu.x, pu.y, 12, 140); pu.life = 0;
          speakDialogue('POWER UP', pu.type === 'health' ? '+30 HEALTH' : `${weapons[pu.type].label} EQUIPPED`, 1200);
        }
      }
      state.powerups = state.powerups.filter((pup) => pup.life > 0);

      for (const q of state.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
      state.particles = state.particles.filter((q) => q.life > 0);

      if (state.health <= 0) {
        state.health = 0; state.gameOver = true; pausedRef.current = false; setPausedState(false); setGameOver(true); setRewardReady(false); setRewardPrompt(false); setScore(state.score); setHealth(0);
        setBest((current) => { const next = Math.max(current, state.score); try { localStorage.setItem('drunkenLegendBest', String(next)); } catch (_) {} return next; });
      }

      if (state.boss) setBoss({ name: state.boss.name, hp: Math.max(0, state.boss.hp), maxHp: state.boss.maxHp, level: state.boss.level });
      setScore(state.score); setHealth(Math.round(state.health * 10) / 10);
    };

    const circleFace = (x, y, r, body, face, angle, enemy = false, boss = false) => {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, r * .78, r * .9, r * .24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = face; ctx.beginPath(); ctx.arc(0, -r * .12, r * .43, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b2020'; ctx.beginPath(); ctx.arc(-r*.14, -r*.16, Math.max(1.5, r*.06), 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(r*.14, -r*.16, Math.max(1.5, r*.06), 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = enemy ? '#8f3030' : '#8b5d40'; ctx.lineWidth = Math.max(1.5, r*.07); ctx.beginPath(); ctx.moveTo(-r*.17, r*.08); ctx.lineTo(r*.17, r*.08); ctx.stroke();
      if (!enemy) { ctx.rotate(angle); ctx.strokeStyle = '#ead9a2'; ctx.lineWidth = boss ? 7 : 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r*.28, 0); ctx.lineTo(r*(boss ? 1.08 : 1.18), 0); ctx.stroke(); }
      if (boss) { ctx.strokeStyle = 'rgba(255,230,170,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,r+5,0,Math.PI*2); ctx.stroke(); }
      ctx.restore();
    };

    const drawPowerup = (pu) => {
      const alpha = pu.life < 2 ? .45 + Math.sin(pu.pulse) * .25 : 1; ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = pu.type === 'health' ? '#79c88e' : pu.type === 'ak' ? '#d8b45a' : '#d77c4e'; ctx.beginPath(); ctx.arc(pu.x, pu.y, pu.r + Math.sin(pu.pulse)*2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#1f2928'; ctx.font = 'bold 11px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(pu.type === 'health' ? '+' : pu.type === 'ak' ? 'AK' : 'RPG', pu.x, pu.y+1); ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, state.w, state.h); ctx.fillStyle = '#213c3e'; ctx.fillRect(0,0,state.w,state.h);
      ctx.strokeStyle = 'rgba(126,168,170,.11)'; ctx.lineWidth = 1; const grid = isMobileRef.current ? 72 : 108;
      for (let x=0;x<=state.w;x+=grid) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,state.h);ctx.stroke(); }
      for (let y=0;y<=state.h;y+=grid) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(state.w,y);ctx.stroke(); }
      for (const pu of state.powerups) drawPowerup(pu);
      for (const e of state.enemies) circleFace(e.x,e.y,e.r,e.kind==='heavy'?'#d65a4f':'#e14e4c','#f3ede2',0,true,false);
      if (state.boss) circleFace(state.boss.x,state.boss.y,state.boss.r,state.boss.color,'#f0e9da',0,true,true);
      for (const b of state.bullets) { ctx.fillStyle='#f2eddd';ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fill(); }
      for (const q of state.particles) { ctx.globalAlpha=Math.max(0,q.life/.3);ctx.fillStyle='#e7ddc3';ctx.beginPath();ctx.arc(q.x,q.y,q.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1; }
      if (state.player.invuln > 0 && Math.floor(state.player.invuln*24)%2===0) ctx.globalAlpha=.45;
      circleFace(state.player.x,state.player.y,state.player.r,'#4ca7d5','#f1bb8e',state.player.angle,false,false); ctx.globalAlpha=1;
      if (state.damageFlash > 0) { ctx.fillStyle='rgba(220,65,55,.10)';ctx.fillRect(0,0,state.w,state.h); }
    };

    const keydown = (e) => {
      const key = e.key.toLowerCase(); state.keys.add(key);
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
      if (!isMobileRef.current && key==='escape') { setPaused((v)=>!v); return; }
      if (!isMobileRef.current && (key===' ' || key==='enter')) state.fireHeld=true;
      if (!isMobileRef.current && key==='1') { state.weapon='pistol'; setWeapon('pistol'); }
      if (!isMobileRef.current && key==='2') { state.weapon='ak'; setWeapon('ak'); }
      if (!isMobileRef.current && key==='3') { state.weapon='rpg'; setWeapon('rpg'); }
    };
    const keyup = (e) => { const key=e.key.toLowerCase();state.keys.delete(key);if(key===' '||key==='enter')state.fireHeld=false; };
    const pointerMove = (e) => { if(isMobileRef.current)return; const rect=canvas.getBoundingClientRect();state.pointer.x=e.clientX-rect.left;state.pointer.y=e.clientY-rect.top;state.pointer.active=true; };
    const pointerDown = (e) => { if(isMobileRef.current)return;e.preventDefault();pointerMove(e);state.fireHeld=true; };
    const pointerUp = () => { if(!isMobileRef.current)state.fireHeld=false; };

    window.addEventListener('keydown',keydown,{passive:false}); window.addEventListener('keyup',keyup); canvas.addEventListener('pointermove',pointerMove); canvas.addEventListener('pointerdown',pointerDown); window.addEventListener('pointerup',pointerUp);
    let raf=0; const loop=(now)=>{const dt=Math.min(.033,Math.max(0,(now-state.last)/1000));state.last=now;update(dt);draw();raf=requestAnimationFrame(loop);}; raf=requestAnimationFrame(loop);
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerdown',pointerDown);window.removeEventListener('pointerup',pointerUp);};
  }, []);

  const setMove = (x,y) => { if(stateRef.current) stateRef.current.move={x,y}; };
  const handleStickStart = (e) => { e.preventDefault(); const el=e.currentTarget; el.setPointerCapture?.(e.pointerId); const rect=el.getBoundingClientRect(); const move=(ev)=>{const dx=ev.clientX-(rect.left+rect.width/2),dy=ev.clientY-(rect.top+rect.height/2),max=rect.width*.32;setMove(clamp(dx/max,-1,1),clamp(dy/max,-1,1));};const end=()=>{setMove(0,0);el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;};el.onpointermove=move;el.onpointerup=end;el.onpointercancel=end;move(e); };
  const handleShootDown=(e)=>{e.preventDefault();const s=stateRef.current;if(!s||s.gameOver||pausedRef.current)return;s.fireHeld=true;};
  const handleShootUp=()=>{if(stateRef.current)stateRef.current.fireHeld=false;};

  const startNewGame = () => window.location.reload();

  const requestRevive = () => {
    if (adBreakActiveRef.current) return;
    adBreakActiveRef.current = true;
    const fallbackTimer = window.setTimeout(() => { adBreakActiveRef.current = false; }, 3000);
    if (typeof window !== 'undefined' && typeof window.adBreak === 'function' && process.env.NEXT_PUBLIC_ADSENSE_CLIENT) {
      window.adBreak({
        type: 'reward', name: 'revive-after-death',
        beforeAd: () => { pausedRef.current = true; setRewardPrompt(false); },
        beforeReward: (showAdFn) => { window.clearTimeout(fallbackTimer); rewardShowRef.current = showAdFn; setRewardReady(true); setRewardPrompt(true); },
        adDismissed: () => { rewardShowRef.current = null; setRewardReady(false); setRewardPrompt(false); },
        adViewed: () => { rewardShowRef.current = null; setRewardReady(false); setRewardPrompt(false); setGameOver(false); pausedRef.current = false; const s=stateRef.current; if(s){s.gameOver=false;s.health=50;s.player.invuln=2;s.revived=true;s.enemies=[];s.bossActive=false;s.boss=null;} setHealth(50); },
        afterAd: () => { adBreakActiveRef.current = false; },
        adBreakDone: () => { adBreakActiveRef.current = false; },
      });
    } else {
      window.clearTimeout(fallbackTimer); adBreakActiveRef.current = false; setRewardReady(false); setRewardPrompt(false); setDialogue({title:'ADS NOT CONFIGURED',text:'Add your AdSense publisher ID and enable H5 Games Ads to use Revive.'}); window.setTimeout(()=>setDialogue(null),2800);
    }
  };

  const confirmReward = () => { if (rewardShowRef.current) rewardShowRef.current(); };

  return (
    <main className="game-page">
      <div className="game-root">
        <canvas ref={canvasRef} className="game-canvas" />
        <div className="hud hud-top-left"><div>SCORE: {score}</div><div className="hud-small">BEST: {best}</div><div className="weapon-label">{weapon === 'pistol' ? 'PISTOL AMMO: ∞' : `${weapons[weapon].label}: ACTIVE`}</div><div className="hud-small">WAVE: {wave}</div></div>
        <div className="hud hud-top-right"><div className="health-label">HEALTH</div><div className="health-bar"><div style={{width:`${health}%`}} /></div><button className="pause-button" onClick={()=>setPaused((v)=>!v)} aria-label="Pause game">{paused?'▶':'Ⅱ'}</button></div>
        {boss && <div className="boss-hud"><div className="boss-name">{boss.name} · LEVEL {boss.level}</div><div className="boss-bar"><div style={{width:`${clamp((boss.hp/boss.maxHp)*100,0,100)}%`}} /></div></div>}
        {isMobile && <><div className="joystick" onPointerDown={handleStickStart} aria-label="Move"><div className="joystick-ring"><div className="joystick-knob"/></div></div>{manualFire&&<button className="fire-button" onPointerDown={handleShootDown} onPointerUp={handleShootUp} onPointerCancel={handleShootUp}>FIRE</button>}</>}
        <div className="bottom-hint">{isMobile?'Mobile: drag joystick to move · use FIRE for manual mode':'PC: WASD / Arrow Keys to move · Mouse to aim 360° · Hold left click or Space to fire · 1/2/3 switch weapons'}</div>

        {dialogue && <div className="dialogue-box"><strong>{dialogue.title}</strong><span>{dialogue.text}</span></div>}

        {paused&&!gameOver&&<div className="modal-backdrop"><div className="simple-modal"><div className="modal-title">GAME PAUSED</div><button onClick={()=>setPaused(false)}>RESUME</button><button onClick={()=>setSettingsOpen(true)}>SETTINGS</button></div></div>}
        {settingsOpen&&<div className="modal-backdrop"><div className="simple-modal settings-modal"><div className="modal-row"><span>SETTINGS</span><button className="close-button" onClick={()=>setSettingsOpen(false)}>×</button></div><label className="setting-row"><span>ONE HAND MODE</span><input type="checkbox" checked={oneHand} onChange={(e)=>setOneHand(e.target.checked)}/></label><label className="setting-row"><span>MANUAL FIRE</span><input type="checkbox" checked={manualFire} onChange={(e)=>setManualFire(e.target.checked)}/></label><label className="setting-row"><span>SOUND</span><input type="checkbox" checked={sound} onChange={(e)=>setSound(e.target.checked)}/></label></div></div>}

        {gameOver&&<div className="modal-backdrop"><div className="simple-modal gameover-modal"><div className="modal-title">YOU DIED</div><div className="gameover-score">SCORE: {score}</div>{!rewardPrompt&&!rewardReady&&<><button onClick={requestRevive}>PLAY TO REVIVE</button><button onClick={startNewGame}>NEW GAME</button></>}{rewardReady&&<><div className="ad-reward-copy">Watch a short ad to get 50 health and continue from this run.</div><button onClick={confirmReward}>WATCH AD & REVIVE</button><button onClick={()=>{setRewardReady(false);setRewardPrompt(false);rewardShowRef.current=null;}}>CANCEL</button></>}</div></div>}
      </div>
    </main>
  );
}
