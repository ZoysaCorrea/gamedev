'use client';

import { useEffect, useRef, useState } from 'react';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function getDeviceIsMobile() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const ua = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return Boolean(coarse && (touch || ua) || ua);
}

export default function GameShell() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const pausedRef = useRef(false);
  const manualFireRef = useRef(false);
  const isMobileRef = useRef(false);

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
    const savedBest = Number(localStorage.getItem('drunkenLegendBest') || 215);
    setBest(savedBest);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const state = {
      w: 1,
      h: 1,
      last: performance.now(),
      elapsed: 0,
      move: { x: 0, y: 0 },
      pointer: { x: 0, y: 0, active: false },
      fireHeld: false,
      fireCooldown: 0,
      spawnCooldown: 0.65,
      score: 0,
      health: 100,
      gameOver: false,
      player: { x: 0, y: 0, r: 22, angle: 0, speed: 270 },
      bullets: [],
      enemies: [],
      particles: [],
      keys: new Set(),
      syncCooldown: 0,
    };
    stateRef.current = state;

    const rand = (a, b) => a + Math.random() * (b - a);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      state.w = Math.max(1, rect.width);
      state.h = Math.max(1, rect.height);
      canvas.width = Math.floor(state.w * dpr);
      canvas.height = Math.floor(state.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!state.player.x) {
        state.player.x = state.w * 0.5;
        state.player.y = state.h * 0.55;
      } else {
        state.player.x = clamp(state.player.x, state.player.r + 2, state.w - state.player.r - 2);
        state.player.y = clamp(state.player.y, 78 + state.player.r * 0.2, state.h - state.player.r - 2);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const spawnEnemy = () => {
      const edge = Math.floor(Math.random() * 4);
      const margin = 45;
      let x = 0;
      let y = 0;
      if (edge === 0) { x = rand(0, state.w); y = -margin; }
      if (edge === 1) { x = state.w + margin; y = rand(70, state.h); }
      if (edge === 2) { x = rand(0, state.w); y = state.h + margin; }
      if (edge === 3) { x = -margin; y = rand(70, state.h); }
      state.enemies.push({
        x,
        y,
        r: rand(16, 20),
        speed: rand(52, 80) + Math.min(32, state.elapsed * 0.55),
        angle: 0,
        wobble: rand(0, Math.PI * 2),
        kind: Math.random() > 0.82 ? 'heavy' : 'normal',
      });
    };

    for (let i = 0; i < 5; i += 1) spawnEnemy();

    const shoot = (angle = state.player.angle) => {
      if (state.gameOver || pausedRef.current) return;
      const p = state.player;
      state.bullets.push({
        x: p.x + Math.cos(angle) * (p.r + 4),
        y: p.y + Math.sin(angle) * (p.r + 4),
        vx: Math.cos(angle) * 720,
        vy: Math.sin(angle) * 720,
        life: 0.9,
      });
      for (let i = 0; i < 3; i += 1) {
        state.particles.push({
          x: p.x + Math.cos(angle) * (p.r + 2),
          y: p.y + Math.sin(angle) * (p.r + 2),
          vx: rand(-45, 45) + Math.cos(angle) * 65,
          vy: rand(-45, 45) + Math.sin(angle) * 65,
          life: 0.18,
          size: rand(1.5, 3),
        });
      }
    };

    const update = (dt) => {
      if (pausedRef.current || state.gameOver) return;
      state.elapsed += dt;

      const keyboardX = (state.keys.has('d') || state.keys.has('arrowright') ? 1 : 0)
        - (state.keys.has('a') || state.keys.has('arrowleft') ? 1 : 0);
      const keyboardY = (state.keys.has('s') || state.keys.has('arrowdown') ? 1 : 0)
        - (state.keys.has('w') || state.keys.has('arrowup') ? 1 : 0);

      let mx = isMobileRef.current ? state.move.x : keyboardX;
      let my = isMobileRef.current ? state.move.y : keyboardY;
      const moveMagnitude = Math.hypot(mx, my);
      if (moveMagnitude > 1) {
        mx /= moveMagnitude;
        my /= moveMagnitude;
      }

      const p = state.player;
      p.x = clamp(p.x + mx * p.speed * dt, p.r + 2, state.w - p.r - 2);
      p.y = clamp(p.y + my * p.speed * dt, 74 + p.r * 0.25, state.h - p.r - 2);

      // PC: mouse is always the aim direction. This gives full 360-degree aiming.
      if (!isMobileRef.current && state.pointer.active) {
        p.angle = Math.atan2(state.pointer.y - p.y, state.pointer.x - p.x);
      } else if (moveMagnitude > 0.08) {
        p.angle = Math.atan2(my, mx);
      }

      state.fireCooldown -= dt;
      const fireAllowed = isMobileRef.current
        ? (!manualFireRef.current || state.fireHeld)
        : state.fireHeld;

      if (fireAllowed && state.fireCooldown <= 0) {
        shoot();
        state.fireCooldown = 0.16;
      }

      state.spawnCooldown -= dt;
      if (state.spawnCooldown <= 0) {
        spawnEnemy();
        state.spawnCooldown = Math.max(0.38, 1.05 - state.elapsed * 0.011);
      }

      for (const b of state.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
      }
      state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < state.w + 40 && b.y > -40 && b.y < state.h + 40);

      for (const e of state.enemies) {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const distance = Math.hypot(dx, dy) || 1;
        e.angle = Math.atan2(dy, dx);
        e.wobble += dt * 3.5;
        e.x += (dx / distance) * e.speed * dt;
        e.y += (dy / distance) * e.speed * dt + Math.sin(e.wobble) * 5 * dt;

        if (distance < p.r + e.r - 2) {
          state.health = Math.max(0, state.health - (e.kind === 'heavy' ? 25 : 32) * dt);
          // Push enemy back slightly to stop it sitting inside player.
          e.x -= (dx / distance) * 20 * dt;
          e.y -= (dy / distance) * 20 * dt;
        }
      }

      for (const b of state.bullets) {
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 4) {
            e.dead = true;
            b.life = 0;
            state.score += e.kind === 'heavy' ? 2 : 1;
            for (let i = 0; i < 5; i += 1) {
              state.particles.push({
                x: e.x,
                y: e.y,
                vx: rand(-110, 110),
                vy: rand(-110, 110),
                life: 0.28,
                size: rand(1, 4),
              });
            }
            break;
          }
        }
      }
      state.enemies = state.enemies.filter((e) => !e.dead);

      for (const q of state.particles) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.life -= dt;
      }
      state.particles = state.particles.filter((q) => q.life > 0);

      if (state.health <= 0) {
        state.health = 0;
        state.gameOver = true;
        pausedRef.current = false;
        setPausedState(false);
        setGameOver(true);
        setScore(state.score);
        setHealth(0);
        setBest((current) => {
          const next = Math.max(current, state.score);
          localStorage.setItem('drunkenLegendBest', String(next));
          return next;
        });
      }

      state.syncCooldown -= dt;
      if (state.syncCooldown <= 0) {
        state.syncCooldown = 0.06;
        setScore(state.score);
        setHealth(Math.round(state.health * 10) / 10);
      }
    };

    const drawCharacter = (x, y, r, bodyColor, faceColor, angle, enemy = false) => {
      ctx.save();
      ctx.translate(x, y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.76, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body: simple solid circle, matching the supplied Godot look.
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Small face/head element.
      ctx.fillStyle = faceColor;
      ctx.beginPath();
      ctx.arc(0, -r * 0.14, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      if (enemy) {
        ctx.fillStyle = '#191d1e';
        ctx.beginPath(); ctx.arc(-r * 0.16, -r * 0.17, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.16, -r * 0.17, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = Math.max(1.5, r * 0.07);
        ctx.strokeStyle = '#8f2e2e';
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, r * 0.08);
        ctx.lineTo(r * 0.18, r * 0.08);
        ctx.stroke();
      } else {
        // Player body/face in the same simple circular style.
        ctx.fillStyle = '#8c5b3b';
        ctx.beginPath(); ctx.arc(-r * 0.13, -r * 0.18, r * 0.055, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.13, -r * 0.18, r * 0.055, 0, Math.PI * 2); ctx.fill();

        // Simple gun aimed at mouse direction.
        ctx.rotate(angle);
        ctx.strokeStyle = '#ead9a2';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.32, 0);
        ctx.lineTo(r * 1.2, 0);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, state.w, state.h);
      ctx.fillStyle = '#213c3e';
      ctx.fillRect(0, 0, state.w, state.h);

      // Simple Godot-style grid.
      ctx.strokeStyle = 'rgba(126, 168, 170, 0.11)';
      ctx.lineWidth = 1;
      const grid = isMobileRef.current ? 72 : 108;
      for (let x = 0; x <= state.w; x += grid) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, state.h); ctx.stroke();
      }
      for (let y = 0; y <= state.h; y += grid) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.w, y); ctx.stroke();
      }

      for (const e of state.enemies) {
        drawCharacter(e.x, e.y, e.r, '#e14e4c', '#f4eee2', e.angle, true);
      }

      for (const b of state.bullets) {
        ctx.fillStyle = '#f2eddd';
        ctx.beginPath(); ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2); ctx.fill();
      }

      for (const q of state.particles) {
        ctx.globalAlpha = Math.max(0, q.life / 0.28);
        ctx.fillStyle = '#e8dfc7';
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      drawCharacter(state.player.x, state.player.y, state.player.r, '#4ca7d5', '#f1bb8e', state.player.angle, false);
    };

    const keydown = (e) => {
      const key = e.key.toLowerCase();
      state.keys.add(key);

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();

      if (!isMobileRef.current && key === 'escape') {
        setPaused((v) => !v);
        return;
      }

      if (!isMobileRef.current && (key === ' ' || key === 'enter')) {
        state.fireHeld = true;
      }
    };

    const keyup = (e) => {
      const key = e.key.toLowerCase();
      state.keys.delete(key);
      if (key === ' ' || key === 'enter') state.fireHeld = false;
    };

    const pointerMove = (e) => {
      if (isMobileRef.current) return;
      const rect = canvas.getBoundingClientRect();
      state.pointer.x = e.clientX - rect.left;
      state.pointer.y = e.clientY - rect.top;
      state.pointer.active = true;
    };

    const pointerDown = (e) => {
      if (isMobileRef.current) return;
      e.preventDefault();
      pointerMove(e);
      state.fireHeld = true;
    };

    const pointerUp = () => {
      if (!isMobileRef.current) state.fireHeld = false;
    };

    window.addEventListener('keydown', keydown, { passive: false });
    window.addEventListener('keyup', keyup);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointerup', pointerUp);

    let raf = 0;
    const loop = (now) => {
      const dt = Math.min(0.033, Math.max(0, (now - state.last) / 1000));
      state.last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
    };
  }, []);

  const setMove = (x, y) => {
    if (stateRef.current) stateRef.current.move = { x, y };
  };

  const handleStickStart = (e) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    const rect = el.getBoundingClientRect();

    const move = (ev) => {
      const dx = ev.clientX - (rect.left + rect.width / 2);
      const dy = ev.clientY - (rect.top + rect.height / 2);
      const max = rect.width * 0.32;
      setMove(clamp(dx / max, -1, 1), clamp(dy / max, -1, 1));
    };

    const end = () => {
      setMove(0, 0);
      el.onpointermove = null;
      el.onpointerup = null;
      el.onpointercancel = null;
    };

    el.onpointermove = move;
    el.onpointerup = end;
    el.onpointercancel = end;
    move(e);
  };

  const handleShootDown = (e) => {
    e.preventDefault();
    const state = stateRef.current;
    if (!state || state.gameOver || pausedRef.current) return;
    state.fireHeld = true;
  };

  const handleShootUp = () => {
    if (stateRef.current) stateRef.current.fireHeld = false;
  };

  const restart = () => window.location.reload();

  return (
    <main className="game-page">
      <div className="game-root">
        <canvas ref={canvasRef} className="game-canvas" />

        <div className="hud hud-top-left">
          <div>SCORE: {score}</div>
          <div className="hud-small">BEST: {best}</div>
          <div className="weapon-label">PISTOL AMMO: ∞</div>
        </div>

        <div className="hud hud-top-right">
          <div className="health-label">HEALTH</div>
          <div className="health-bar"><div style={{ width: `${health}%` }} /></div>
          <button className="pause-button" onClick={() => setPaused((v) => !v)} aria-label="Pause game">
            {paused ? '▶' : 'Ⅱ'}
          </button>
        </div>

        {isMobile && (
          <>
            {!oneHand && (
              <div className="joystick" onPointerDown={handleStickStart} aria-label="Move">
                <div className="joystick-ring"><div className="joystick-knob" /></div>
              </div>
            )}
            {manualFire && !oneHand && (
              <button className="fire-button" onPointerDown={handleShootDown} onPointerUp={handleShootUp} onPointerCancel={handleShootUp}>FIRE</button>
            )}
            {oneHand && (
              <div className="one-hand-controls">
                <div className="joystick one-hand-stick" onPointerDown={handleStickStart} aria-label="Move">
                  <div className="joystick-ring"><div className="joystick-knob" /></div>
                </div>
                {manualFire && <button className="fire-button compact" onPointerDown={handleShootDown} onPointerUp={handleShootUp} onPointerCancel={handleShootUp}>FIRE</button>}
              </div>
            )}
          </>
        )}

        <div className="bottom-hint">
          {isMobile
            ? 'Mobile: drag the joystick to move'
            : 'PC: WASD / Arrow Keys to move · Mouse to aim 360° · Hold left click or Space to fire'}
        </div>

        {paused && !gameOver && (
          <div className="modal-backdrop">
            <div className="simple-modal">
              <div className="modal-title">GAME PAUSED</div>
              <button onClick={() => setPaused(false)}>RESUME</button>
              <button onClick={() => setSettingsOpen(true)}>SETTINGS</button>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="modal-backdrop">
            <div className="simple-modal settings-modal">
              <div className="modal-row"><span>SETTINGS</span><button className="close-button" onClick={() => setSettingsOpen(false)}>×</button></div>
              <label className="setting-row"><span>ONE HAND MODE</span><input type="checkbox" checked={oneHand} onChange={(e) => setOneHand(e.target.checked)} /></label>
              <label className="setting-row"><span>MANUAL FIRE</span><input type="checkbox" checked={manualFire} onChange={(e) => setManualFire(e.target.checked)} /></label>
              <label className="setting-row"><span>SOUND</span><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /></label>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="modal-backdrop">
            <div className="simple-modal gameover-modal">
              <div className="modal-title">GAME OVER</div>
              <div className="gameover-score">SCORE: {score}</div>
              <button onClick={restart}>PLAY AGAIN</button>
              <button onClick={() => setSettingsOpen(true)}>SETTINGS</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
