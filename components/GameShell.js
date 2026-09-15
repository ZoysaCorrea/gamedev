'use client';

import { useEffect, useRef, useState } from 'react';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function GameShell() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [oneHand, setOneHand] = useState(false);
  const [manualFire, setManualFire] = useState(false);
  const [sound, setSound] = useState(true);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(215);
  const [health, setHealth] = useState(100);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const detect = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const small = Math.min(window.innerWidth, window.innerHeight) <= 820;
      setIsMobile(Boolean(coarse || small));
    };
    detect();
    window.addEventListener('resize', detect);
    return () => window.removeEventListener('resize', detect);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const state = {
      w: 1, h: 1, last: performance.now(), elapsed: 0,
      move: { x: 0, y: 0 }, pointer: { x: 0, y: 0, active: false },
      fireHeld: false, fireCooldown: 0, spawnCooldown: 0.7,
      score: 0, health: 100, gameOver: false,
      player: { x: 0, y: 0, r: 20, angle: -Math.PI / 2, speed: 260 },
      bullets: [], enemies: [], particles: [], keys: new Set(),
      joystickActive: false, syncCooldown: 0,
    };
    stateRef.current = state;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      state.w = rect.width;
      state.h = rect.height;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!state.player.x) {
        state.player.x = state.w * 0.5;
        state.player.y = state.h * 0.55;
      } else {
        state.player.x = clamp(state.player.x, 24, state.w - 24);
        state.player.y = clamp(state.player.y, 70, state.h - 24);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const rand = (a, b) => a + Math.random() * (b - a);

    const spawnEnemy = () => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      const margin = 36;
      if (edge === 0) { x = rand(0, state.w); y = -margin; }
      if (edge === 1) { x = state.w + margin; y = rand(0, state.h); }
      if (edge === 2) { x = rand(0, state.w); y = state.h + margin; }
      if (edge === 3) { x = -margin; y = rand(0, state.h); }
      state.enemies.push({
        x, y,
        r: rand(15, 20),
        speed: rand(48, 78) + Math.min(35, state.elapsed * 0.6),
        angle: 0,
        phase: rand(0, Math.PI * 2),
      });
    };

    for (let i = 0; i < 6; i += 1) spawnEnemy();

    const shoot = (angle = state.player.angle) => {
      if (state.gameOver || paused) return;
      const p = state.player;
      state.bullets.push({
        x: p.x + Math.cos(angle) * 24,
        y: p.y + Math.sin(angle) * 24,
        vx: Math.cos(angle) * 650,
        vy: Math.sin(angle) * 650,
        life: 0.9,
      });
      for (let i = 0; i < 4; i += 1) {
        state.particles.push({
          x: p.x + Math.cos(angle) * 21,
          y: p.y + Math.sin(angle) * 21,
          vx: rand(-55, 55) + Math.cos(angle) * 80,
          vy: rand(-55, 55) + Math.sin(angle) * 80,
          life: 0.22,
          size: rand(1, 2.5),
        });
      }
    };

    const update = (dt) => {
      if (paused || state.gameOver) return;
      state.elapsed += dt;

      const keyboardX = (state.keys.has('d') || state.keys.has('arrowright') ? 1 : 0) - (state.keys.has('a') || state.keys.has('arrowleft') ? 1 : 0);
      const keyboardY = (state.keys.has('s') || state.keys.has('arrowdown') ? 1 : 0) - (state.keys.has('w') || state.keys.has('arrowup') ? 1 : 0);
      let mx = isMobile ? state.move.x : keyboardX;
      let my = isMobile ? state.move.y : keyboardY;
      const mag = Math.hypot(mx, my);
      if (mag > 1) { mx /= mag; my /= mag; }

      const p = state.player;
      const targetVx = mx * p.speed;
      const targetVy = my * p.speed;
      p.x = clamp(p.x + targetVx * dt, p.r + 2, state.w - p.r - 2);
      p.y = clamp(p.y + targetVy * dt, 62 + p.r * 0.3, state.h - p.r - 2);

      if (!isMobile && state.pointer.active) {
        p.angle = Math.atan2(state.pointer.y - p.y, state.pointer.x - p.x);
      } else if (mag > 0.08) {
        p.angle = Math.atan2(my, mx);
      }

      state.fireCooldown -= dt;
      const fireAllowed = !manualFire || state.fireHeld;
      if (fireAllowed && state.fireCooldown <= 0) {
        shoot();
        state.fireCooldown = manualFire ? 0.12 : 0.22;
      }

      state.spawnCooldown -= dt;
      if (state.spawnCooldown <= 0) {
        spawnEnemy();
        state.spawnCooldown = Math.max(0.42, 1.15 - state.elapsed * 0.012);
      }

      for (const b of state.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
      }
      state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -30 && b.x < state.w + 30 && b.y > -30 && b.y < state.h + 30);

      for (const e of state.enemies) {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.angle = Math.atan2(dy, dx);
        e.phase += dt * 4;
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt + Math.sin(e.phase) * 8 * dt;

        if (d < p.r + e.r - 3) {
          state.health = Math.max(0, state.health - 34 * dt);
        }
      }

      for (const b of state.bullets) {
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 5) {
            e.dead = true;
            b.life = 0;
            state.score += 1;
            for (let i = 0; i < 6; i += 1) {
              state.particles.push({ x: e.x, y: e.y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.35, size: rand(1, 4) });
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
        setGameOver(true);
        setPaused(false);
        setScore(state.score);
        setBest((current) => Math.max(current, state.score));
      }

      state.syncCooldown -= dt;
      if (state.syncCooldown <= 0) {
        state.syncCooldown = 0.08;
        setScore(state.score);
        setHealth(state.health);
      }
    };

    const drawPacman = (x, y, r, color, angle, enemy = false) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      const mouth = 0.32 + (Math.sin(state.elapsed * 11 + x * 0.02) + 1) * 0.11;
      const jaw = mouth * Math.PI;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, jaw, Math.PI * 2 - jaw);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff';
      const eyeY = -r * 0.43;
      ctx.beginPath(); ctx.arc(r * 0.18, eyeY, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#202426';
      ctx.beginPath(); ctx.arc(r * 0.25, eyeY, r * 0.075, 0, Math.PI * 2); ctx.fill();

      if (enemy) {
        ctx.fillStyle = '#7f2525';
        ctx.fillRect(r * 0.02, r * 0.38, r * 0.38, 2);
      }
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, state.w, state.h);
      ctx.fillStyle = '#213d3f';
      ctx.fillRect(0, 0, state.w, state.h);

      // Simple Godot-like background grid.
      ctx.strokeStyle = 'rgba(132, 175, 177, 0.10)';
      ctx.lineWidth = 1;
      const grid = isMobile ? 64 : 92;
      for (let x = 0; x <= state.w; x += grid) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, state.h); ctx.stroke();
      }
      for (let y = 0; y <= state.h; y += grid) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.w, y); ctx.stroke();
      }

      for (const e of state.enemies) drawPacman(e.x, e.y, e.r, '#e64b4b', e.angle, true);
      for (const b of state.bullets) {
        ctx.fillStyle = '#f6f0da';
        ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      for (const q of state.particles) {
        ctx.globalAlpha = Math.max(0, q.life / 0.35);
        ctx.fillStyle = '#e8e0c8';
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      drawPacman(state.player.x, state.player.y, state.player.r, '#52a8d8', state.player.angle, false);
    };

    const keydown = (e) => {
      state.keys.add(e.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
      if (!isMobile && e.key === 'Escape') {
        setPaused((v) => !v);
      }
      if (!isMobile && (e.key === ' ' || e.key.toLowerCase() === 'enter')) state.fireHeld = true;
    };
    const keyup = (e) => {
      state.keys.delete(e.key.toLowerCase());
      if (e.key === ' ' || e.key.toLowerCase() === 'enter') state.fireHeld = false;
    };
    const pointerMove = (e) => {
      const r = canvas.getBoundingClientRect();
      state.pointer.x = e.clientX - r.left;
      state.pointer.y = e.clientY - r.top;
      state.pointer.active = true;
    };
    const pointerDown = (e) => {
      if (isMobile) return;
      state.fireHeld = true;
      pointerMove(e);
    };
    const pointerUp = () => { if (!isMobile) state.fireHeld = false; };

    window.addEventListener('keydown', keydown, { passive: false });
    window.addEventListener('keyup', keyup);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointerup', pointerUp);

    let raf = 0;
    const loop = (now) => {
      const dt = Math.min(0.034, Math.max(0, (now - state.last) / 1000));
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
  }, [isMobile, manualFire, paused]);

  const setMove = (x, y) => {
    if (stateRef.current) stateRef.current.move = { x, y };
  };

  const handleStickStart = (e) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect();
    const move = (ev) => {
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      const max = r.width * 0.32;
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
    if (!state || state.gameOver || paused) return;
    state.fireHeld = true;
  };
  const handleShootUp = () => {
    if (stateRef.current) stateRef.current.fireHeld = false;
  };

  const restart = () => {
    window.location.reload();
  };

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
          {isMobile ? 'Mobile: drag the joystick to move' : 'PC: WASD / Arrow Keys to move · Mouse to aim · Click / Space to fire'}
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
