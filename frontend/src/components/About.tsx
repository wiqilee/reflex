import { useEffect, useRef } from 'react';

const DISCORD_USER_ID = '209385020912173066';
const PX = 2;

// Reusable mini pixel canvas component
function PixelCanvas({ draw, width = 800, height = 60 }: { draw: (ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => void; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let animId: number;
    function tick() {
      draw(ctx!, frameRef.current, canvas!.width, canvas!.height);
      frameRef.current++;
      animId = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(animId);
  }, [draw]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="w-full rounded-lg mb-4"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, PX * s, PX * s);
}
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, w * PX, h * PX);
}

// Scene 1: Code being scanned line by line, failures light up red
function drawCodeScan(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);

  // Dark background
  rect(ctx, 0, 0, pw, ph, '#0a0a1a');

  // Code lines (left side)
  const codeX = 4;
  for (let i = 0; i < 8; i++) {
    const lineW = 20 + ((i * 17 + 7) % 30);
    const y = 3 + i * 3;
    // Line number
    rect(ctx, codeX - 2, y, 1, 1, '#4b5563');
    // Code line
    const scanned = (f * 0.02) % 10 > i;
    rect(ctx, codeX, y, lineW, 1, scanned ? '#22c55e' : '#1e293b');

    // Highlight failures
    if (scanned && (i === 2 || i === 5 || i === 7)) {
      rect(ctx, codeX, y, lineW, 1, '#ef4444');
      // Warning icon
      if (Math.sin(f * 0.1 + i) > 0) px(ctx, codeX + lineW + 2, y, '#ef4444');
    }
  }

  // Scan line moving down
  const scanY = 3 + ((f * 0.06) % 8) * 3;
  rect(ctx, codeX - 1, Math.floor(scanY), 50, 1, 'rgba(249,115,22,0.3)');

  // Arrow in middle
  const midX = pw / 2 - 5;
  const arrowPulse = Math.sin(f * 0.05) > 0;
  rect(ctx, midX, 10, 8, 2, arrowPulse ? '#f97316' : '#7c3aed');
  px(ctx, midX + 8, 10, arrowPulse ? '#f97316' : '#7c3aed');
  px(ctx, midX + 8, 11, arrowPulse ? '#f97316' : '#7c3aed');
  px(ctx, midX + 9, 10, arrowPulse ? '#f97316' : '#7c3aed');

  // Runbook output (right side)
  const rbX = pw / 2 + 10;
  const phases = [
    { label: 'DETECT', color: '#3b82f6' },
    { label: 'DIAGNOS', color: '#a855f7' },
    { label: 'FIX', color: '#22c55e' },
    { label: 'ROLLBCK', color: '#f97316' },
    { label: 'PREVENT', color: '#ef4444' },
  ];
  phases.forEach((p, i) => {
    const y = 2 + i * 5;
    const appear = (f * 0.015) % 6 > i;
    if (appear) {
      rect(ctx, rbX, y, 2, 3, p.color);
      for (let c = 0; c < p.label.length; c++) px(ctx, rbX + 4 + c, y + 1, p.color);
      // Checkmark
      px(ctx, rbX + 4 + p.label.length + 2, y + 1, '#22c55e');
    } else {
      rect(ctx, rbX, y, 2, 3, '#1e293b');
    }
  });

  // Label
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('Source Code', 10, H - 3);
  ctx.textAlign = 'right';
  ctx.fillText('Runbooks', W - 10, H - 3);
}

// Scene 2: 4-step pipeline animation
function drawPipeline(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);
  rect(ctx, 0, 0, pw, ph, '#0a0a1a');

  const steps = [
    { icon: '{ }', label: 'PASTE', color: '#3b82f6' },
    { icon: '⚡', label: 'SCAN', color: '#f97316' },
    { icon: '📋', label: 'RUNBOOK', color: '#22c55e' },
    { icon: '💥', label: 'BLAST', color: '#ef4444' },
  ];

  const stepW = pw / 4;
  const activeStep = Math.floor((f * 0.01) % 5);

  steps.forEach((s, i) => {
    const cx = stepW * i + stepW / 2;
    const cy = ph / 2;
    const isActive = activeStep === i;
    const isPast = activeStep > i;

    // Box
    const boxW = 14, boxH = 10;
    rect(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH,
      isActive ? s.color : isPast ? s.color : '#1e293b');

    // Inner
    if (isActive || isPast) {
      rect(ctx, cx - boxW / 2 + 1, cy - boxH / 2 + 1, boxW - 2, boxH - 2, '#0a0a1a');
      // Icon dots
      for (let c = 0; c < s.icon.length && c < 3; c++) {
        px(ctx, cx - 1 + c, cy - 1, s.color);
      }
      // Checkmark if past
      if (isPast) px(ctx, cx, cy + 1, '#22c55e', 2);
    }

    // Label below
    for (let c = 0; c < s.label.length; c++) {
      px(ctx, cx - Math.floor(s.label.length / 2) + c, cy + boxH / 2 + 2,
        isActive ? s.color : isPast ? '#4b5563' : '#1e293b');
    }

    // Arrow to next
    if (i < steps.length - 1) {
      const arrowX = cx + boxW / 2 + 2;
      const arrowColor = isPast || isActive ? '#f97316' : '#1e293b';
      rect(ctx, arrowX, cy, 4, 1, arrowColor);
      px(ctx, arrowX + 4, cy - 1, arrowColor);
      px(ctx, arrowX + 4, cy + 1, arrowColor);
      px(ctx, arrowX + 5, cy, arrowColor);

      // Data packet moving
      if (isActive) {
        const packetPos = (f * 0.1) % 6;
        px(ctx, arrowX + packetPos, cy, '#ffffff');
      }
    }
  });

  // Step counter
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.fillText(`Step ${Math.min(activeStep + 1, 4)} of 4`, W / 2, H - 3);
}

// Scene 3: Feature constellation
function drawFeatures(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);
  rect(ctx, 0, 0, pw, ph, '#0a0a1a');

  const features = [
    { x: 0.1, y: 0.3, color: '#f97316', label: 'AI' },
    { x: 0.25, y: 0.5, color: '#ef4444', label: 'FN' },
    { x: 0.4, y: 0.25, color: '#22c55e', label: 'WASM' },
    { x: 0.55, y: 0.6, color: '#3b82f6', label: '5PH' },
    { x: 0.7, y: 0.35, color: '#a855f7', label: 'BLST' },
    { x: 0.85, y: 0.5, color: '#eab308', label: '18L' },
  ];

  // Connection lines
  for (let i = 0; i < features.length - 1; i++) {
    const a = features[i], b = features[i + 1];
    const ax = Math.floor(a.x * pw), ay = Math.floor(a.y * ph);
    const bx = Math.floor(b.x * pw), by = Math.floor(b.y * ph);
    const steps = 20;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const lx = ax + (bx - ax) * t, ly = ay + (by - ay) * t;
      const visible = ((s + f * 0.1) % 4) < 2;
      if (visible) px(ctx, lx, ly, '#1e293b');
    }
  }

  // Nodes
  features.forEach((feat, i) => {
    const fx = Math.floor(feat.x * pw);
    const fy = Math.floor(feat.y * ph) + Math.sin(f * 0.03 + i * 1.5) * 1.5;
    const pulse = Math.sin(f * 0.05 + i * 1.2) > 0.3;

    // Glow
    if (pulse) {
      rect(ctx, fx - 3, Math.floor(fy) - 3, 7, 7, feat.color + '22');
    }

    // Node
    rect(ctx, fx - 2, Math.floor(fy) - 2, 5, 5, feat.color);
    rect(ctx, fx - 1, Math.floor(fy) - 1, 3, 3, '#0a0a1a');
    px(ctx, fx, Math.floor(fy), feat.color);

    // Label
    for (let c = 0; c < feat.label.length; c++) {
      px(ctx, fx - Math.floor(feat.label.length / 2) + c, Math.floor(fy) + 4, feat.color);
    }
  });

  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('6 Core Capabilities Connected', W / 2, H - 3);
}

// Scene 4: Tech stack blocks building up
function drawTechStack(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);
  rect(ctx, 0, 0, pw, ph, '#0a0a1a');

  const techs = [
    { label: 'MISTRAL', color: '#f97316' },
    { label: 'PYTHON', color: '#3b82f6' },
    { label: 'RUST', color: '#f97316' },
    { label: 'REACT', color: '#06b6d4' },
    { label: 'TAILWND', color: '#14b8a6' },
    { label: 'VITE', color: '#a855f7' },
    { label: 'PYDNTC', color: '#22c55e' },
    { label: 'ZUSTND', color: '#eab308' },
  ];

  const blockW = 12;
  const gap = 2;
  const totalW = techs.length * (blockW + gap) - gap;
  const startX = (pw - totalW) / 2;

  techs.forEach((t, i) => {
    const bx = startX + i * (blockW + gap);
    const targetY = ph - 22;
    // Stagger build-up animation
    const delay = i * 15;
    const progress = Math.min(Math.max((f - delay) * 0.03, 0), 1);
    const by = ph + 5 - (ph + 5 - targetY) * progress;

    if (progress > 0) {
      // Block
      rect(ctx, bx, Math.floor(by), blockW, 8, t.color);
      rect(ctx, bx + 1, Math.floor(by) + 1, blockW - 2, 6, '#0a0a1a');

      // Inner glow
      const pulse = Math.sin(f * 0.04 + i * 0.8) > 0;
      if (pulse) rect(ctx, bx + 2, Math.floor(by) + 2, blockW - 4, 4, t.color + '33');

      // Label dots
      for (let c = 0; c < Math.min(t.label.length, blockW - 4); c++) {
        px(ctx, bx + 2 + c, Math.floor(by) + 4, t.color);
      }
    }
  });

  // Platform line
  rect(ctx, startX - 2, ph - 13, totalW + 4, 1, '#374151');

  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('8 Technologies, 1 Platform', W / 2, H - 3);
}

// Scene 5: People icons getting helped
function drawPeople(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);
  rect(ctx, 0, 0, pw, ph, '#0a0a1a');

  const people = [
    { x: 0.15, color: '#3b82f6', label: 'SRE', alert: true },
    { x: 0.38, color: '#ef4444', label: 'ONCALL', alert: true },
    { x: 0.62, color: '#a855f7', label: 'MNGR', alert: false },
    { x: 0.85, color: '#22c55e', label: 'STARTUP', alert: false },
  ];

  people.forEach((p, i) => {
    const cx = Math.floor(p.x * pw);
    const cy = ph / 2;

    // Person
    // Head
    px(ctx, cx, cy - 4, '#fcd34d', 2);
    // Body
    rect(ctx, cx - 1, cy - 1, 4, 3, p.color);
    // Legs
    px(ctx, cx, cy + 2, '#374151');
    px(ctx, cx + 1, cy + 2, '#374151');

    // Alert/pager (animated)
    if (p.alert) {
      const alertPhase = Math.floor((f * 0.015 + i * 2) % 4);
      if (alertPhase === 0) {
        // Red alert
        px(ctx, cx + 3, cy - 4, '#ef4444');
        px(ctx, cx + 4, cy - 5, '#ef4444');
      } else if (alertPhase === 1) {
        // REFLEX arrow
        rect(ctx, cx + 3, cy - 2, 5, 1, '#f97316');
        px(ctx, cx + 8, cy - 2, '#f97316');
      } else if (alertPhase >= 2) {
        // Green check
        px(ctx, cx + 3, cy - 3, '#22c55e', 2);
      }
    } else {
      // Happy face
      if (Math.sin(f * 0.04 + i) > 0) {
        px(ctx, cx + 3, cy - 3, '#22c55e');
      }
    }

    // Label
    for (let c = 0; c < p.label.length; c++) {
      px(ctx, cx - Math.floor(p.label.length / 2) + c, cy + 5, p.color);
    }

    // Runbook appearing
    const bookPhase = Math.sin(f * 0.03 + i * 1.5);
    if (bookPhase > 0.5) {
      rect(ctx, cx - 3, cy - 8, 3, 4, '#f97316');
      px(ctx, cx - 2, cy - 7, '#0a0a1a');
      px(ctx, cx - 2, cy - 6, '#0a0a1a');
    }
  });

  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('From Alert to Resolution', W / 2, H - 3);
}

// Scene 6: Feature checkmarks grid appearing one by one
function drawAllFeatures(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);
  rect(ctx, 0, 0, pw, ph, '#0a0a1a');

  const cols = 5, rows = 3;
  const cellW = Math.floor((pw - 20) / cols);
  const cellH = Math.floor((ph - 10) / rows);
  const startX = 10;

  const colors = ['#22c55e', '#f97316', '#3b82f6', '#ef4444', '#a855f7', '#eab308', '#06b6d4', '#ec4899', '#22c55e', '#f97316', '#3b82f6', '#ef4444', '#a855f7', '#eab308', '#06b6d4'];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= 20) break;
      const cx = startX + c * cellW + cellW / 2;
      const cy = 4 + r * cellH + cellH / 2;
      const delay = idx * 8;
      const appear = f > delay;
      const color = colors[idx];

      if (appear) {
        // Box
        rect(ctx, cx - 3, cy - 2, 7, 5, color + '33');
        rect(ctx, cx - 2, cy - 1, 5, 3, '#0a0a1a');
        // Checkmark animation
        const tick = Math.min((f - delay) * 0.1, 1);
        if (tick > 0.3) px(ctx, cx - 1, cy, color);
        if (tick > 0.6) px(ctx, cx, cy + 1, color);
        if (tick > 0.9) { px(ctx, cx + 1, cy, color); px(ctx, cx + 2, cy - 1, color); }

        // Pulse glow
        if (Math.sin(f * 0.04 + idx * 0.7) > 0.7) {
          px(ctx, cx, cy - 3, color);
        }
      } else {
        rect(ctx, cx - 3, cy - 2, 7, 5, '#1e293b');
      }
    }
  }

  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('20 Features, All Production-Ready', W / 2, H - 3);
}

// Scene 7: Big pixel cat next to laptop
function drawBuilder(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);

  // === GAMEBOY SCREEN FRAME ===
  // Outer shell (dark gray, rounded feel)
  rect(ctx, 0, 0, pw, ph, '#1a1a2e');
  // Screen bezel (lighter border)
  rect(ctx, 2, 2, pw - 4, ph - 10, '#252540');
  // Screen area (dark green-tinted like old LCD)
  rect(ctx, 4, 4, pw - 8, ph - 14, '#0a0f0a');
  // Screen inner glow
  rect(ctx, 5, 5, pw - 10, ph - 16, '#0d120d');

  // === BOTTOM PANEL (buttons area) ===
  rect(ctx, 2, ph - 8, pw - 4, 6, '#252540');
  // D-pad (left side)
  const bx = 12;
  const by = ph - 5;
  rect(ctx, bx - 1, by - 2, 3, 5, '#3a3a5c'); // vertical
  rect(ctx, bx - 2, by - 1, 5, 3, '#3a3a5c'); // horizontal
  px(ctx, bx, by, '#4a4a6c'); // center dot
  // A B buttons (right side)
  const abx = pw - 15;
  px(ctx, abx, by - 1, '#ef4444'); px(ctx, abx + 1, by - 1, '#ef4444'); // A
  px(ctx, abx - 3, by, '#3b82f6'); px(ctx, abx - 2, by, '#3b82f6'); // B
  // Button labels
  px(ctx, abx + 3, by - 1, '#6b7280'); // A label dot
  px(ctx, abx - 4, by + 1, '#6b7280'); // B label dot
  // Start/Select (center bottom)
  const sx = Math.floor(pw / 2) - 4;
  rect(ctx, sx, by, 3, 1, '#4a4a6c');     // SELECT
  rect(ctx, sx + 5, by, 3, 1, '#4a4a6c'); // START

  const cx = Math.floor(pw / 2);
  const screenTop = 7;

  // === CHARACTER (pixel person, left side of screen) ===
  const px2 = cx - 20;
  const py = screenTop + 18;
  // Body (orange hoodie)
  rect(ctx, px2 - 1, py - 4, 5, 4, '#f97316');
  // Arms
  px(ctx, px2 - 2, py - 3, '#f97316');
  px(ctx, px2 + 4, py - 3, '#f97316');
  // Waving hand (animated)
  const wave = Math.sin(f * 0.08) > 0;
  if (wave) {
    px(ctx, px2 + 5, py - 4, '#fcd5b0');
    px(ctx, px2 + 5, py - 5, '#fcd5b0');
  } else {
    px(ctx, px2 + 5, py - 3, '#fcd5b0');
  }
  px(ctx, px2 - 3, py - 2, '#fcd5b0'); // left hand
  // Head
  rect(ctx, px2, py - 8, 3, 3, '#fcd5b0');
  // Hair
  rect(ctx, px2 - 1, py - 9, 5, 2, '#1a1a2e');
  px(ctx, px2 - 1, py - 7, '#1a1a2e'); // side hair
  px(ctx, px2 + 3, py - 7, '#1a1a2e');
  // Eyes (blink)
  const blink = Math.sin(f * 0.03) > 0.9;
  if (!blink) {
    px(ctx, px2, py - 6, '#0a0a0a');
    px(ctx, px2 + 2, py - 6, '#0a0a0a');
  }
  // Smile
  px(ctx, px2 + 1, py - 5, '#d4845a');
  // Legs
  rect(ctx, px2, py, 2, 2, '#3b82f6');
  rect(ctx, px2 + 2, py, 2, 2, '#3b82f6');
  // Shoes
  px(ctx, px2, py + 2, '#374151');
  px(ctx, px2 + 3, py + 2, '#374151');

  // === CAT (sitting next to person) ===
  const catX = px2 - 8;
  const catY = py + 2;
  rect(ctx, catX, catY - 4, 5, 3, '#9ca3af'); // body
  rect(ctx, catX + 1, catY - 3, 3, 2, '#d1d5db'); // belly
  rect(ctx, catX + 1, catY - 7, 4, 3, '#9ca3af'); // head
  px(ctx, catX + 1, catY - 8, '#9ca3af'); // ear L
  px(ctx, catX + 4, catY - 8, '#9ca3af'); // ear R
  px(ctx, catX + 1, catY - 7, '#f9a8d4'); // inner ear
  px(ctx, catX + 4, catY - 7, '#f9a8d4');
  // Cat eyes
  const catBlink = Math.sin(f * 0.04) > 0.92;
  if (!catBlink) {
    px(ctx, catX + 2, catY - 5, '#22c55e');
    px(ctx, catX + 3, catY - 5, '#22c55e');
  }
  // Tail (wagging)
  const wag = Math.sin(f * 0.07) * 2;
  px(ctx, catX - 1, catY - 2, '#9ca3af');
  px(ctx, Math.floor(catX - 2 + wag), catY - 3, '#9ca3af');

  // === TEXT DIALOG BOX (right side) ===
  const tbx = cx - 5;
  const tby = screenTop + 4;
  const tbw = cx - 2;
  const tbh = 18;
  // Box background
  rect(ctx, tbx, tby, tbw, tbh, '#1a2a1a');
  // Box border (double line like RPG dialog)
  for (let i = 0; i < tbw; i++) {
    px(ctx, tbx + i, tby, '#4ade80');
    px(ctx, tbx + i, tby + tbh - 1, '#4ade80');
  }
  for (let i = 0; i < tbh; i++) {
    px(ctx, tbx, tby + i, '#4ade80');
    px(ctx, tbx + tbw - 1, tby + i, '#4ade80');
  }
  // Inner border
  for (let i = 0; i < tbw - 2; i++) {
    px(ctx, tbx + 1 + i, tby + 1, '#22c55e');
    px(ctx, tbx + 1 + i, tby + tbh - 2, '#22c55e');
  }
  for (let i = 0; i < tbh - 2; i++) {
    px(ctx, tbx + 1, tby + 1 + i, '#22c55e');
    px(ctx, tbx + tbw - 2, tby + 1 + i, '#22c55e');
  }

  // === TYPEWRITER TEXT ===
  const text1 = 'Hi, I\'m Wiqi Lee!';
  const text2 = 'Data Scientist';
  const text3 = 'AI/ML Researcher';
  const text4 = 'Press START...';

  const charSpeed = 0.12;
  const line1Len = Math.min(Math.floor(f * charSpeed), text1.length);
  const line2Len = Math.min(Math.max(Math.floor((f - text1.length / charSpeed - 8) * charSpeed), 0), text2.length);
  const line3Len = Math.min(Math.max(Math.floor((f - (text1.length + text2.length) / charSpeed - 16) * charSpeed), 0), text3.length);
  const line4Visible = f > (text1.length + text2.length + text3.length) / charSpeed + 24;

  // Render pixel text (using tiny font simulation — 1px per char width)
  const drawText = (str: string, len: number, tx: number, ty: number, color: string) => {
    for (let i = 0; i < len; i++) {
      if (str[i] !== ' ') px(ctx, tx + i, ty, color);
      if (str[i] === 'I' || str[i] === 'i' || str[i] === 'l' || str[i] === '!' || str[i] === '\'') px(ctx, tx + i, ty + 1, color);
      if (str[i] === 'm' || str[i] === 'W' || str[i] === 'M') { px(ctx, tx + i, ty, color); px(ctx, tx + i, ty + 1, color); }
    }
  };

  drawText(text1, line1Len, tbx + 3, tby + 4, '#4ade80');
  drawText(text2, line2Len, tbx + 3, tby + 8, '#f97316');
  drawText(text3, line3Len, tbx + 3, tby + 11, '#f97316');

  // Blinking "Press START..." cursor
  if (line4Visible && Math.sin(f * 0.06) > 0) {
    drawText(text4, text4.length, tbx + 3, tby + 15, '#6b7280');
  }

  // === SPARKLE STARS ===
  [[cx - 28, screenTop + 3, 0], [cx + 25, screenTop + 2, 2], [tbx + tbw + 2, tby + 5, 3]].forEach(([sx2, sy, d]) => {
    if (Math.sin(f * 0.04 + (d as number)) > 0.3) px(ctx, sx2 as number, sy as number, '#fbbf24');
  });

  // === LIGHTNING BOLT (floating) ===
  const ly = screenTop + 2 + Math.sin(f * 0.04) * 1.5;
  [[0,-1],[1,-1],[0,0],[-1,1],[0,1]].forEach(([dx,dy]) => {
    px(ctx, Math.floor(tbx - 4 + dx), Math.floor(ly + dy), '#f97316');
  });
}

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-xl mb-3 flex items-center gap-2">
      <span>{icon}</span>
      <span className="text-pink-300">{children}</span>
    </h3>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="inline-block">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="inline-block">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

export default function About() {
  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-4">
        <span className="lightning-icon inline-block" style={{ fontSize: '72px', lineHeight: 1 }}>⚡</span>
        <h2 className="text-4xl font-bold tracking-tight"><span className="reflex-shimmer">REFLEX</span></h2>
        <p className="text-reflex-accent text-lg font-medium">AI Incident Runbook Generator</p>
        <p className="text-reflex-text/70 max-w-2xl mx-auto leading-relaxed">
          Your code already knows how it will fail. <span className="reflex-shimmer font-semibold">REFLEX</span> makes it tell you.
          Paste your infrastructure code and get production-ready incident runbooks
          in seconds, not weeks.
        </p>
      </div>

      {/* What is REFLEX */}
      <div className="card hover-card">
        <SectionTitle icon="🎯">What is <span className="reflex-shimmer">REFLEX</span>?</SectionTitle>
        <PixelCanvas draw={drawCodeScan} height={60} />
        <p className="text-reflex-text/70 leading-relaxed">
          <span className="reflex-shimmer font-semibold">REFLEX</span> is an AI-powered tool that reads your actual source code and automatically
          generates structured incident runbooks for every failure scenario your system can produce.
          Each runbook follows a rigid five-phase structure: Detection, Diagnosis, Fix, Rollback, and Prevention.
          Every step includes exact terminal commands, expected output, and escalation criteria.
          Written for the engineer who gets woken up at 3 AM: no ambiguity, no hand-waving,
          just copy-pasteable commands and clear decision trees.
        </p>
      </div>

      {/* How to Use */}
      <div className="card hover-card">
        <SectionTitle icon="🚀">How to Use</SectionTitle>
        <PixelCanvas draw={drawPipeline} height={60} />
        <div className="space-y-4 text-reflex-text/70">
          {[
            { num: '1', title: 'Paste Your Code', desc: 'Go to "Analyze Code" and paste any infrastructure code: Python services, Docker configs, YAML, Go, Rust, Java, or TypeScript.', hoverColor: 'hover:bg-blue-500/10 hover:border-blue-400/30' },
            { num: '2', title: 'Mistral Analyzes Every Line', desc: 'Mistral AI uses structured function calling (not free-form text) to classify every failure mode with typed tool outputs.', hoverColor: 'hover:bg-orange-500/10 hover:border-orange-400/30' },
            { num: '3', title: 'Get Production-Ready Runbooks', desc: 'Each failure scenario gets a structured runbook with Detection, Diagnosis, Fix, Rollback, and Prevention steps. Export as Markdown or translate to 18 languages.', hoverColor: 'hover:bg-green-500/10 hover:border-green-400/30' },
            { num: '4', title: 'Explore Dependencies & Blast Radius', desc: 'Visualize service dependencies and simulate cascading failures with the Rust WebAssembly engine at sub-millisecond speed.', hoverColor: 'hover:bg-purple-500/10 hover:border-purple-400/30' },
          ].map((step) => (
            <div key={step.num} className={`flex gap-4 items-start p-3 rounded-lg border border-transparent transition-all duration-300 cursor-default hover:scale-[1.01] ${step.hoverColor}`}>
              <span className="bg-reflex-accent/20 text-reflex-accent rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shrink-0">{step.num}</span>
              <div>
                <p className="font-medium text-reflex-text">{step.title}</p>
                <p className="text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What Makes It Unique */}
      <div className="card hover-card">
        <SectionTitle icon="✨">What Makes REFLEX Unique</SectionTitle>
        <PixelCanvas draw={drawFeatures} height={60} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            { icon: '🤖', title: 'Mistral Function Calling', desc: 'Three distinct tool calls (classify_failure, generate_runbook, assess_impact) with validated typed outputs. Not free-form text.' },
            { icon: '🦀', title: 'Rust WebAssembly Engine', desc: 'Dependency graph and cascading failure simulation run client-side at sub-millisecond speed. No server round trip.' },
            { icon: '📋', title: 'Five-Phase Runbook Structure', desc: 'Detection, Diagnosis, Fix, Rollback, Prevention. Numbered steps with copy-pasteable commands.' },
            { icon: '💥', title: 'Blast Radius Calculator', desc: 'Quantified impact: how many services, users, and revenue affected when any node goes down.' },
            { icon: '🌐', title: '18-Language Translation', desc: 'Translate runbooks while technical terms, commands, and variable names stay intact.' },
            { icon: '📁', title: 'Multi-File Analysis', desc: 'Correlate failure scenarios across service boundaries to find cross-service failure modes.' },
          ].map((item, i) => (
            <div key={i} className="p-3 rounded-lg bg-reflex-border/30 hover:bg-reflex-accent/10 hover:border-reflex-accent/30 border border-transparent transition-all duration-300 hover:scale-[1.02]">
              <p className="font-medium text-reflex-text mb-1">{item.icon} {item.title}</p>
              <p className="text-reflex-text/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All Features */}
      <div className="card hover-card">
        <SectionTitle icon="⚡">All Features</SectionTitle>
        <PixelCanvas draw={drawAllFeatures} height={60} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {[
            'Failure Scenario Detection', 'Severity Reasoning', 'Structured Runbook Generation (5-phase)',
            'Multi-Pass Runbook Validation', 'On-Call Tiering (L1/L2/L3)', '6-Language Demo Mode',
            'Code Line Highlighting', 'Dependency Graph + Runbook Linking', 'Failure Path Simulation (WASM)',
            'Blast Radius Calculator', 'Analysis Diff / Compare', 'Multi-File Analysis',
            'Markdown Export', 'Multilingual Translation (18 langs)', 'Runbook Regeneration',
            'Analysis Gallery & History', 'Interactive API Docs (Swagger)', 'Health Monitoring',
            'Copy-Pasteable Commands', 'Pixel Art Dashboard',
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-reflex-border/20 hover:bg-reflex-accent/10 transition-colors">
              <span className="text-reflex-accent">✓</span>
              <span className="text-reflex-text/65">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card hover-card">
        <SectionTitle icon="🛠️">Tech Stack</SectionTitle>
        <PixelCanvas draw={drawTechStack} height={60} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Mistral AI', desc: 'Function Calling', color: 'text-orange-400', hoverBg: 'hover:bg-orange-500/10', hoverBorder: 'hover:border-orange-500/30' },
            { name: 'Python', desc: 'FastAPI Backend', color: 'text-blue-400', hoverBg: 'hover:bg-blue-500/10', hoverBorder: 'hover:border-blue-500/30' },
            { name: 'Rust', desc: 'WebAssembly Engine', color: 'text-orange-300', hoverBg: 'hover:bg-orange-400/10', hoverBorder: 'hover:border-orange-400/30' },
            { name: 'TypeScript', desc: 'React Frontend', color: 'text-cyan-400', hoverBg: 'hover:bg-cyan-500/10', hoverBorder: 'hover:border-cyan-500/30' },
            { name: 'Tailwind CSS', desc: 'Styling', color: 'text-teal-400', hoverBg: 'hover:bg-teal-500/10', hoverBorder: 'hover:border-teal-500/30' },
            { name: 'Vite', desc: 'Build Tool', color: 'text-purple-400', hoverBg: 'hover:bg-purple-500/10', hoverBorder: 'hover:border-purple-500/30' },
            { name: 'Pydantic', desc: 'Data Models', color: 'text-green-400', hoverBg: 'hover:bg-green-500/10', hoverBorder: 'hover:border-green-500/30' },
            { name: 'Zustand', desc: 'State Management', color: 'text-yellow-400', hoverBg: 'hover:bg-yellow-500/10', hoverBorder: 'hover:border-yellow-500/30' },
          ].map((t, i) => (
            <div key={i} className={`text-center p-3 rounded-lg bg-reflex-border/30 border border-transparent transition-all duration-300 hover:scale-105 ${t.hoverBg} ${t.hoverBorder}`}>
              <p className={`font-bold ${t.color}`}>{t.name}</p>
              <p className="text-xs text-reflex-text/50 mt-1">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Who Benefits */}
      <div className="card hover-card">
        <SectionTitle icon="👥">Who Benefits</SectionTitle>
        <PixelCanvas draw={drawPeople} height={60} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            { title: 'SRE / Platform Engineers', desc: 'Generate and maintain runbooks automatically instead of spending weeks writing them by hand.', hoverColor: 'hover:bg-blue-500/15 hover:border-blue-400/40' },
            { title: 'On-Call Engineers', desc: 'Get step-by-step guidance at 3 AM with exact commands, expected outputs, and escalation paths.', hoverColor: 'hover:bg-red-500/15 hover:border-red-400/40' },
            { title: 'Engineering Managers', desc: 'Reduce MTTR, minimize blast radius, and ensure consistent incident response across the team.', hoverColor: 'hover:bg-purple-500/15 hover:border-purple-400/40' },
            { title: 'Startups & Scale-ups', desc: 'Get enterprise-grade incident documentation without a dedicated SRE team.', hoverColor: 'hover:bg-green-500/15 hover:border-green-400/40' },
          ].map((item, i) => (
            <div key={i} className={`p-4 rounded-lg bg-reflex-border/30 border border-reflex-border/50 transition-all duration-300 cursor-default hover:scale-[1.03] hover:shadow-lg ${item.hoverColor}`}>
              <p className="font-medium text-reflex-text">{item.title}</p>
              <p className="text-reflex-text/60 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Creator */}
      <div className="card hover-card">
        <SectionTitle icon="👩‍💻">Built by</SectionTitle>
        <PixelCanvas draw={drawBuilder} height={140} />
        <div className="flex gap-6 items-center mt-3">
          <div className="shrink-0 w-24 h-24 rounded-2xl overflow-hidden shadow-lg shadow-reflex-accent/10 avatar-float">
            <img
              src="/avatar.png"
              alt="Wiqi Lee"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-reflex-accent/30 to-pink-500/20 flex items-center justify-center text-2xl font-black text-reflex-accent" style="font-family:monospace">W</div>';
              }}
            />
          </div>
          <div>
            <h4 className="text-xl font-bold">Wiqi Lee</h4>
            <p className="text-reflex-accent text-sm font-medium mt-1">Data Scientist · AI/ML Researcher · Software Engineer</p>
            <p className="text-reflex-text/40 text-xs mt-0.5">Python · Java · Rust · Julia · Cellist 🎻</p>
            <div className="flex gap-2 mt-3">
              <a href="https://x.com/wiqi_lee" target="_blank" rel="noopener noreferrer" className="social-btn social-btn-x">
                <XIcon /> <span>@wiqi_lee</span>
              </a>
              <a href="https://discord.com/users/209385020912173066" target="_blank" rel="noopener noreferrer" className="social-btn social-btn-discord">
                <DiscordIcon /> <span>wiqi_lee</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
