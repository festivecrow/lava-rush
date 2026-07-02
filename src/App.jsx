import React, { useRef, useEffect, useState, useCallback } from 'react';

// ---- Visual theme: Molten Core ----
const COLORS = {
  skyTop: '#1a0e0a',
  skyBottom: '#3d1a0f',
  lavaCore: '#FF3D00',
  lavaGlow: '#FF7A29',
  lavaHot: '#FFD54A',
  platform: '#2B2420',
  platformEdge: '#4A3B2E',
  platformCracked: '#6B2F1A',
  player: '#F1EDE4',
  playerTrail: '#FF7A29',
  ember: '#FFB347',
  chalk: '#F1EDE4',
  chalkDim: '#C9A98F',
};

const GRAVITY = 0.52;
const JUMP_VELOCITY = -12;
const BASE_SCROLL_SPEED = 3.0;
const PLAYER_SIZE = 26;
const GROUND_Y_RATIO = 0.72;

function rand(min, max) { return Math.random() * (max - min) + min; }

function loadFont() {
  if (document.getElementById('lr-fonts')) return;
  const link = document.createElement('link');
  link.id = 'lr-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@500;700;800&display=swap';
  document.head.appendChild(link);
}

const DISPLAY_FONT = "'Bebas Neue', sans-serif";
const BODY_FONT = "'Inter', sans-serif";

export default function LavaRush() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const [phase, setPhase] = useState('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [, forceRender] = useState(0);

  useEffect(() => {
    loadFont();
    try {
      const saved = localStorage.getItem('lavarush-highscore');
      if (saved) setHighScore(parseInt(saved, 10) || 0);
    } catch (e) { /* ignore */ }
  }, []);

  const initGame = useCallback((width, height) => {
    const groundY = height * GROUND_Y_RATIO;
    const platforms = [];
    platforms.push({ x: 0, width: 260, y: groundY, cracked: false });
    let cursorX = 260;
    while (cursorX < width + 400) {
      const gap = rand(55, 100);
      const pw = rand(100, 190);
      cursorX += gap;
      platforms.push({ x: cursorX, width: pw, y: groundY + rand(-14, 14), cracked: Math.random() < 0.1 });
      cursorX += pw;
    }

    stateRef.current = {
      width, height, groundY,
      player: { x: 60, y: groundY - PLAYER_SIZE, vy: 0, onGround: true, rot: 0 },
      platforms,
      particles: [],
      embers: Array.from({ length: 40 }, () => ({
        x: rand(0, width), y: rand(0, height), r: rand(1, 3), speed: rand(0.3, 1.1), drift: rand(-0.3, 0.3),
      })),
      scrollSpeed: BASE_SCROLL_SPEED,
      distance: 0,
      lavaY: height * 0.97,
      lavaChasePressure: 0,
      shake: 0,
      elapsed: 0,
      lastPlatformRight: cursorX,
    };
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (phase === 'menu' || phase === 'dead') return;
    if (s.player.onGround) {
      s.player.vy = JUMP_VELOCITY;
      s.player.onGround = false;
      for (let i = 0; i < 6; i++) {
        s.particles.push({
          x: s.player.x + PLAYER_SIZE / 2, y: s.player.y + PLAYER_SIZE,
          vx: rand(-1.5, 1.5), vy: rand(0.5, 2), life: 1, color: COLORS.chalkDim, size: rand(2, 4),
        });
      }
    }
  }, [phase]);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initGame(canvas.width, canvas.height);
    setScore(0);
    setPhase('playing');
  }, [initGame]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const loop = () => {
      const s = stateRef.current;
      if (!s) return;
      s.elapsed += 1;
      s.scrollSpeed = BASE_SCROLL_SPEED + Math.min(s.elapsed / 1000, 2.8);
      s.distance += s.scrollSpeed;

      for (const p of s.platforms) p.x -= s.scrollSpeed;
      s.lastPlatformRight -= s.scrollSpeed;
      for (const e of s.embers) {
        e.x -= s.scrollSpeed * 0.4;
        e.y -= e.speed;
        e.x += e.drift;
        if (e.y < -10) { e.y = s.height + 10; e.x = rand(0, s.width); }
        if (e.x < -10) e.x = s.width + 10;
      }

      s.platforms = s.platforms.filter((p) => p.x + p.width > -20);
      // Max horizontal distance the current jump arc can cross, with a safety
      // margin — this makes it mathematically impossible to generate a gap
      // the player can't clear, no matter how far the difficulty has ramped.
      const airTime = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;
      const maxSafeGap = airTime * s.scrollSpeed * 0.72;
      while (s.lastPlatformRight < s.width + 400) {
        const rawGap = rand(60, 105) + Math.min(s.elapsed / 450, 40);
        const gap = Math.min(rawGap, maxSafeGap);
        const pw = rand(95, 185);
        const x = s.lastPlatformRight + gap;
        s.platforms.push({ x, width: pw, y: s.groundY + rand(-16, 16), cracked: Math.random() < 0.13 });
        s.lastPlatformRight = x + pw;
      }

      const player = s.player;
      player.vy += GRAVITY;
      player.y += player.vy;
      player.rot = player.onGround ? 0 : Math.min(player.rot + 0.09, 0.5);

      let landed = false;
      for (const p of s.platforms) {
        const withinX = player.x + PLAYER_SIZE * 0.7 > p.x && player.x + PLAYER_SIZE * 0.3 < p.x + p.width;
        const platformTop = p.y;
        if (withinX && player.vy >= 0 && player.y + PLAYER_SIZE >= platformTop && player.y + PLAYER_SIZE <= platformTop + 30) {
          player.y = platformTop - PLAYER_SIZE;
          player.vy = 0;
          player.onGround = true;
          player.rot = 0;
          landed = true;
          if (p.cracked && !p.cracking) {
            p.cracking = true;
            p.crackTimer = 14;
          }
          break;
        }
      }
      if (!landed) player.onGround = false;

      for (const p of s.platforms) {
        if (p.cracking) {
          p.crackTimer -= 1;
          if (p.crackTimer <= 0) p.collapsed = true;
        }
      }
      s.platforms = s.platforms.filter((p) => !p.collapsed || p.x > s.width);

      const playerLowRatio = player.y / s.height;
      if (playerLowRatio > 0.62) {
        s.lavaChasePressure = Math.min(s.lavaChasePressure + 0.025, 1.1);
      } else {
        s.lavaChasePressure = Math.max(s.lavaChasePressure - 0.025, 0.08);
      }
      s.lavaY -= (0.16 + s.lavaChasePressure * 0.35);
      const lavaFloor = s.height * 0.985;
      if (s.lavaY > lavaFloor) s.lavaY = lavaFloor;

      const dead = player.y + PLAYER_SIZE > s.lavaY || player.y > s.height + 100;

      s.particles = s.particles.filter((pt) => pt.life > 0);
      for (const pt of s.particles) {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life -= 0.04;
      }

      if (s.shake > 0) s.shake *= 0.85;

      if (dead) {
        s.shake = 14;
        for (let i = 0; i < 26; i++) {
          s.particles.push({
            x: player.x + PLAYER_SIZE / 2, y: player.y + PLAYER_SIZE / 2,
            vx: rand(-4, 4), vy: rand(-6, -1), life: 1,
            color: Math.random() < 0.5 ? COLORS.lavaCore : COLORS.lavaHot, size: rand(3, 7),
          });
        }
        const finalScore = Math.floor(s.distance / 10);
        setScore(finalScore);
        setHighScore((prev) => {
          const next = Math.max(prev, finalScore);
          try { localStorage.setItem('lavarush-highscore', String(next)); } catch (e) { /* ignore */ }
          return next;
        });
        setPhase('dead');
        return;
      }

      setScore(Math.floor(s.distance / 10));
      render(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  function render(ctx, s) {
    const { width, height } = s;
    ctx.save();
    if (s.shake > 0.5) {
      ctx.translate(rand(-s.shake, s.shake), rand(-s.shake, s.shake));
    }

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, COLORS.skyTop);
    sky.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, width + 40, height + 40);

    for (const e of s.embers) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const p of s.platforms) {
      const wobble = p.cracking ? Math.sin(p.crackTimer * 2) * 2 : 0;
      ctx.fillStyle = p.cracking ? COLORS.platformCracked : COLORS.platform;
      ctx.fillRect(p.x, p.y + wobble, p.width, height - (p.y + wobble));
      ctx.fillStyle = p.cracking ? COLORS.lavaCore : COLORS.platformEdge;
      ctx.fillRect(p.x, p.y + wobble, p.width, 6);
    }

    const pl = s.player;
    ctx.save();
    ctx.translate(pl.x + PLAYER_SIZE / 2, pl.y + PLAYER_SIZE / 2);
    ctx.rotate(pl.rot);
    ctx.fillStyle = COLORS.player;
    const r = PLAYER_SIZE / 2;
    ctx.beginPath();
    ctx.roundRect(-r, -r, PLAYER_SIZE, PLAYER_SIZE, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.lavaGlow;
    ctx.beginPath();
    ctx.roundRect(-r, r - 6, PLAYER_SIZE, 6, 3);
    ctx.fill();
    ctx.restore();

    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(pt.life, 0);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const lavaGrad = ctx.createLinearGradient(0, s.lavaY, 0, height);
    lavaGrad.addColorStop(0, COLORS.lavaHot);
    lavaGrad.addColorStop(0.15, COLORS.lavaCore);
    lavaGrad.addColorStop(1, '#7A1200');
    ctx.fillStyle = lavaGrad;
    ctx.beginPath();
    ctx.moveTo(0, s.lavaY);
    const waveOffset = s.elapsed * 0.08;
    for (let x = 0; x <= width; x += 20) {
      ctx.lineTo(x, s.lavaY + Math.sin((x + waveOffset * 20) * 0.02) * 5);
    }
    ctx.lineTo(width, height + 20);
    ctx.lineTo(0, height + 20);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.35;
    const glow = ctx.createLinearGradient(0, s.lavaY - 40, 0, s.lavaY + 10);
    glow.addColorStop(0, 'rgba(255,122,41,0)');
    glow.addColorStop(1, 'rgba(255,122,41,0.6)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, s.lavaY - 40, width, 50);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    function resize() {
      const parent = canvas.parentElement;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w;
      canvas.height = h;
      if (stateRef.current) {
        stateRef.current.width = w;
        stateRef.current.height = h;
      }
      forceRender((n) => n + 1);
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [jump]);

  const handlePointer = () => {
    if (phase === 'playing') jump();
  };

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100vh', background: COLORS.skyTop,
        overflow: 'hidden', touchAction: 'none', userSelect: 'none',
      }}
      onPointerDown={handlePointer}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {phase === 'playing' && (
        <div style={{
          position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
          fontFamily: DISPLAY_FONT, fontSize: 40, color: COLORS.chalk, letterSpacing: 1,
          textShadow: '0 2px 8px rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>
          {score}
        </div>
      )}

      {phase === 'menu' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'rgba(10,5,3,0.55)',
        }}>
          <div style={{ fontFamily: BODY_FONT, fontSize: 13, letterSpacing: 3, color: COLORS.lavaGlow, textTransform: 'uppercase', marginBottom: 6 }}>
            The floor is lava
          </div>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 64, color: COLORS.chalk, margin: '0 0 8px', textAlign: 'center', lineHeight: 0.95 }}>
            LAVA RUSH
          </h1>
          <div style={{ fontFamily: BODY_FONT, fontSize: 14, color: COLORS.chalkDim, marginBottom: 28, textAlign: 'center', maxWidth: 280 }}>
            Tap or press Space to jump. Don't fall behind — it's rising.
          </div>
          {highScore > 0 && (
            <div style={{ fontFamily: BODY_FONT, fontSize: 13, color: COLORS.chalkDim, marginBottom: 20 }}>
              Best: <strong style={{ color: COLORS.chalk }}>{highScore}</strong>
            </div>
          )}
          <button
            onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
            style={{
              background: COLORS.lavaCore, border: 'none', color: COLORS.chalk,
              fontFamily: DISPLAY_FONT, fontSize: 26, letterSpacing: 1,
              padding: '14px 48px', borderRadius: 10, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(255,61,0,0.4)',
            }}
          >
            START
          </button>
        </div>
      )}

      {phase === 'dead' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'rgba(10,5,3,0.65)',
        }}>
          <div style={{ fontFamily: BODY_FONT, fontSize: 13, letterSpacing: 3, color: COLORS.lavaGlow, textTransform: 'uppercase', marginBottom: 6 }}>
            Consumed
          </div>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 54, color: COLORS.chalk, margin: '0 0 4px' }}>
            {score}
          </h1>
          <div style={{ fontFamily: BODY_FONT, fontSize: 13, color: COLORS.chalkDim, marginBottom: 24 }}>
            {score >= highScore && score > 0 ? 'New best!' : `Best: ${highScore}`}
          </div>
          <button
            onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
            style={{
              background: COLORS.lavaCore, border: 'none', color: COLORS.chalk,
              fontFamily: DISPLAY_FONT, fontSize: 24, letterSpacing: 1,
              padding: '13px 44px', borderRadius: 10, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(255,61,0,0.4)',
            }}
          >
            TRY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
