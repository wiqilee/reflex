import { useEffect, useRef } from 'react';

const PX = 3;

const C = {
  sky: ['#0a0a1a', '#0e0e24', '#12122e'],
  star: '#fbbf24',
  moon: '#fde68a',
  moonDark: '#fcd34d',
  bldg: ['#1a1a2e', '#16213e', '#1e2a4a'],
  winOff: '#0f1729',
  winOn: ['#f97316', '#fbbf24', '#22c55e', '#3b82f6'],
  ground: '#0d1117',
  grass: ['#14532d', '#166534', '#15803d'],
  server: '#374151',
  serverIn: '#4b5563',
  ledOk: '#22c55e',
  ledBad: '#ef4444',
  ledOff: '#1f2937',
  terminal: '#0f172a',
  termGreen: '#22c55e',
  termOrange: '#f97316',
  termRed: '#ef4444',
  termYellow: '#fbbf24',
  personHead: '#fcd34d',
  personBody: '#3b82f6',
  personLeg: '#1e3a5f',
  laptop: '#6b7280',
  alertBg: '#7f1d1d',
  alert: '#ef4444',
  bubbleBg: '#1e293b',
  white: '#ffffff',
  tree: ['#14532d', '#166534', '#15803d'],
  trunk: '#78350f',
  orange: '#f97316',
};

const LOOP = 820;

export default function PixelScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const W = canvas.width;
    const H = canvas.height;
    const pw = Math.floor(W / PX);
    const ph = Math.floor(H / PX);
    const groundY = ph - 16;
    ctx.imageSmoothingEnabled = false;

    function px(x: number, y: number, color: string, s = 1) {
      ctx!.fillStyle = color;
      ctx!.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, PX * s, PX * s);
    }
    function rect(x: number, y: number, w: number, h: number, color: string) {
      ctx!.fillStyle = color;
      ctx!.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, w * PX, h * PX);
    }
    function text(str: string, x: number, y: number, color: string) {
      for (let i = 0; i < str.length; i++) px(x + i, y, color);
    }

    function draw() {
      const f = frameRef.current;
      const phase = f % LOOP;
      ctx!.clearRect(0, 0, W, H);

      // Sky
      for (let y = 0; y < groundY; y++) {
        const idx = Math.min(Math.floor((y / groundY) * C.sky.length), C.sky.length - 1);
        for (let x = 0; x < pw; x++) px(x, y, C.sky[idx]);
      }

      // Stars
      const stars = [[12,5],[35,8],[58,4],[82,10],[108,6],[135,9],[162,5],[188,11],[215,7],[242,4],[268,10],[295,6],[25,18],[55,22],[85,16],[115,24],[145,14],[175,20],[205,18],[235,22],[265,15],[295,20],[310,8],[42,30],[72,28],[102,34],[142,26],[172,32],[202,28],[252,34]];
      stars.forEach(([sx, sy], i) => {
        if (sx < pw && sy < groundY && Math.sin(f * 0.04 + i * 2.3) > 0.2) px(sx, sy, C.star);
      });

      // Moon
      const mx = pw - 35, my = 10;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (dx * dx + dy * dy <= 9) px(mx + dx, my + dy, C.moon);
      px(mx - 1, my - 1, C.moonDark);
      px(mx + 1, my + 1, C.moonDark);

      // Ground + grass
      rect(0, groundY, pw, ph - groundY, C.ground);
      for (let x = 0; x < pw; x++) {
        px(x, groundY, C.grass[x % 3]);
        if ((x * 7 + 3) % 5 === 0) px(x, groundY - 1, C.grass[1]);
      }

      // Building 1
      const b1x = 8, b1y = groundY - 32;
      rect(b1x, b1y, 18, 32, C.bldg[0]);
      rect(b1x + 1, b1y - 2, 16, 2, C.bldg[1]);
      for (let wy = 0; wy < 5; wy++)
        for (let wx = 0; wx < 3; wx++) {
          const lit = ((wx + wy + Math.floor(f * 0.01)) % 4) !== 0;
          rect(b1x + 2 + wx * 5, b1y + 4 + wy * 5, 3, 3, lit ? C.winOn[(wx + wy) % 4] : C.winOff);
        }

      // Building 2 (tall)
      const b2x = 32, b2y = groundY - 42;
      rect(b2x, b2y, 16, 42, C.bldg[1]);
      rect(b2x + 2, b2y - 3, 12, 3, C.bldg[2]);
      rect(b2x + 7, b2y - 7, 2, 4, '#6b7280');
      px(b2x + 7, b2y - 8, Math.sin(f * 0.12) > 0.5 ? C.ledBad : C.ledOff, 2);
      for (let wy = 0; wy < 7; wy++)
        for (let wx = 0; wx < 2; wx++) {
          const lit = ((wx + wy * 2 + Math.floor(f * 0.009)) % 3) !== 0;
          rect(b2x + 2 + wx * 7, b2y + 4 + wy * 5, 4, 2, lit ? C.winOn[(wx + wy + 1) % 4] : C.winOff);
        }

      // Building 3
      const b3x = 54, b3y = groundY - 20;
      rect(b3x, b3y, 16, 20, C.bldg[2]);
      rect(b3x, b3y - 1, 16, 1, C.bldg[0]);
      for (let wy = 0; wy < 3; wy++)
        for (let wx = 0; wx < 3; wx++) {
          const lit = ((wx + wy + Math.floor(f * 0.013)) % 3) !== 0;
          rect(b3x + 2 + wx * 4, b3y + 3 + wy * 5, 2, 3, lit ? C.winOn[(wx + wy + 2) % 4] : C.winOff);
        }

      // Server rack
      const sx = pw - 55, sy = groundY - 28;
      rect(sx, sy, 22, 28, C.server);
      rect(sx + 1, sy + 1, 20, 26, C.serverIn);
      const isAlert = phase >= 120 && phase < 550;
      const isFix = phase >= 550 && phase < 700;
      for (let i = 0; i < 5; i++) {
        rect(sx + 3, sy + 3 + i * 5, 16, 3, C.server);
        let led: string;
        if (isAlert) { led = Math.sin(f * 0.15 + i) > 0 ? C.ledBad : C.ledOff; }
        else if (isFix) { led = i <= Math.floor((phase - 550) / 30) ? C.ledOk : C.ledBad; }
        else { led = C.ledOk; }
        px(sx + 5, sy + 4 + i * 5, led, 2);
        if (Math.sin(f * 0.08 + i * 1.5) > 0.3) px(sx + 9, sy + 4 + i * 5, isAlert ? C.ledBad : C.ledOk);
        rect(sx + 12, sy + 4 + i * 5, 5, 1, '#374151');
      }

      // Alert / All Clear bubble
      if (isAlert) {
        const b = Math.sin(f * 0.08) * 2;
        const ax = sx + 5, ay = sy - 10 + b;
        rect(Math.floor(ax), Math.floor(ay), 14, 7, C.alertBg);
        rect(Math.floor(ax) + 1, Math.floor(ay) + 1, 12, 5, C.alert);
        text('ALERT!', Math.floor(ax) + 2, Math.floor(ay) + 2, C.white);
      }
      if (phase >= 700 && phase < LOOP) {
        const b = Math.sin(f * 0.05) * 1;
        const ax = sx + 2, ay = sy - 10 + b;
        rect(Math.floor(ax), Math.floor(ay), 18, 7, '#14532d');
        rect(Math.floor(ax) + 1, Math.floor(ay) + 1, 16, 5, C.ledOk);
        text('ALL CLEAR!', Math.floor(ax) + 2, Math.floor(ay) + 2, C.white);
      }

      // Terminal
      const tx = pw - 100, ty = groundY - 20;
      rect(tx, ty, 28, 18, C.bubbleBg);
      rect(tx + 1, ty + 1, 26, 14, C.terminal);
      rect(tx + 11, ty + 16, 6, 2, '#374151');
      rect(tx + 9, ty + 18, 10, 1, '#4b5563');

      if (phase < 120) {
        text('$ _', tx + 3, ty + 3, C.termGreen);
        text('ready', tx + 3, ty + 6, C.termGreen);
      } else if (phase < 180) {
        text('!! ALERT !!', tx + 3, ty + 3, C.termRed);
        text('SRV DOWN', tx + 3, ty + 6, C.termRed);
        text('PAGER: P1', tx + 3, ty + 9, C.termOrange);
      } else if (phase < 380) {
        text('!! ALERT !!', tx + 3, ty + 3, C.termRed);
        if (Math.sin(f * 0.1) > 0) text('WAITING..', tx + 3, ty + 6, C.termYellow);
      } else if (phase < 440) {
        const typed = Math.floor((phase - 380) / 4);
        const cmd = '$ reflex analyze';
        text(cmd.substring(0, Math.min(typed, cmd.length)), tx + 3, ty + 3, C.termGreen);
        if (Math.sin(f * 0.15) > 0 && typed < cmd.length) px(tx + 3 + Math.min(typed, cmd.length), ty + 3, C.termGreen);
      } else if (phase < 550) {
        text('$ reflex analyze', tx + 3, ty + 3, C.termGreen);
        text('Analyzing..', tx + 3, ty + 6, C.termOrange);
        const prog = Math.min(Math.floor((phase - 440) / 5), 20);
        for (let i = 0; i < 20; i++) px(tx + 3 + i, ty + 9, i < prog ? C.termOrange : '#1e293b');
        text(`${Math.min(prog * 5, 100)}%`, tx + 3, ty + 11, C.termYellow);
      } else if (phase < 700) {
        text('5 runbooks OK', tx + 3, ty + 3, C.termGreen);
        text('Fixing', tx + 3, ty + 6, C.termGreen);
        text('.'.repeat((Math.floor(f * 0.05) % 3) + 1), tx + 10, ty + 6, C.termGreen);
        const fixed = Math.min(Math.floor((phase - 550) / 30) + 1, 5);
        text(`Srv: ${fixed}/5`, tx + 3, ty + 9, fixed >= 5 ? C.termGreen : C.termYellow);
      } else {
        text('All systems', tx + 3, ty + 3, C.termGreen);
        text('nominal', tx + 3, ty + 6, C.termGreen);
        text('Incidents: 0', tx + 3, ty + 9, C.termGreen);
      }

      // Trees
      function drawTree(bx: number, by: number, sz: number) {
        rect(bx, by, 2, sz * 2, C.trunk);
        for (let l = 0; l < 3; l++) {
          const w = (3 - l) * sz;
          rect(bx + 1 - Math.floor(w / 2), by - (l + 1) * sz, w, sz, C.tree[l]);
        }
      }
      drawTree(78, groundY - 3, 2);
      drawTree(pw - 22, groundY - 3, 2);
      drawTree(pw - 12, groundY - 4, 3);

      // SRE Engineer
      let personX = 0;
      let show = true, running = false, hasLaptop = true;
      if (phase < 120) { show = false; }
      else if (phase < 180) { personX = -5 + (phase - 120) * 0.3; hasLaptop = false; }
      else if (phase < 350) { personX = 13 + (phase - 180) * 0.7; running = true; }
      else { personX = tx - 5; }

      if (show) {
        const py = groundY - 7;
        const wf = Math.floor(f * 0.12) % 4;
        px(personX + 1, py, C.personHead, 2);
        rect(personX, py + 2, 4, 3, C.personBody);
        if (running) {
          if (wf < 2) { px(personX, py + 5, C.personLeg); px(personX + 3, py + 5, C.personLeg); px(personX - 1, py + 6, C.personLeg); px(personX + 4, py + 6, C.personLeg); }
          else { px(personX + 1, py + 5, C.personLeg); px(personX + 2, py + 5, C.personLeg); px(personX + 1, py + 6, C.personLeg); px(personX + 2, py + 6, C.personLeg); }
        } else {
          px(personX + 1, py + 5, C.personLeg); px(personX + 2, py + 5, C.personLeg);
          px(personX + 1, py + 6, C.personLeg); px(personX + 2, py + 6, C.personLeg);
        }
        if (hasLaptop) { rect(personX + 4, py + 3, 3, 2, C.laptop); px(personX + 5, py + 3, phase >= 380 ? C.termGreen : C.termOrange); }
        if (phase >= 120 && phase < 150) { text('z', Math.floor(personX + 3), Math.floor(py - 3 + Math.sin(f * 0.05)), '#6b7280'); }
        if (running && Math.sin(f * 0.2) > 0.5) px(personX + 4, py - 1, '#60a5fa');
        if (phase >= 700 && phase < LOOP) {
          const bounce = Math.abs(Math.sin(f * 0.08)) * 2;
          px(personX + 1, py - 2 - bounce, C.star);
          px(personX + 3, py - 3 - bounce, C.orange);
        }
      }

      // Alert screen flash
      if (phase >= 120 && phase < 180 && Math.sin(f * 0.2) > 0) {
        ctx!.fillStyle = 'rgba(239, 68, 68, 0.04)';
        ctx!.fillRect(0, 0, W, H);
      }

      // === CAPTION BAR (readable) ===
      const barH = 22;
      ctx!.fillStyle = 'rgba(10, 10, 26, 0.85)';
      ctx!.fillRect(0, H - barH, W, barH);
      // Top line of bar
      ctx!.fillStyle = 'rgba(249, 115, 22, 0.3)';
      ctx!.fillRect(0, H - barH, W, 1);

      let caption = '';
      let captionColor = C.termGreen;
      if (phase < 120) { caption = '3:00 AM — All systems nominal'; captionColor = C.termGreen; }
      else if (phase < 180) { caption = '3:00 AM — INCIDENT! Servers are down!'; captionColor = C.termRed; }
      else if (phase < 350) { caption = 'SRE engineer responds to pager alert...'; captionColor = C.termYellow; }
      else if (phase < 440) { caption = 'Running REFLEX to analyze the code...'; captionColor = C.termOrange; }
      else if (phase < 550) { caption = 'Mistral AI generating incident runbooks...'; captionColor = C.termOrange; }
      else if (phase < 700) { caption = 'Applying runbook fixes — servers recovering...'; captionColor = C.termYellow; }
      else { caption = 'All clear! Crisis resolved with REFLEX ⚡'; captionColor = C.termGreen; }

      ctx!.font = 'bold 12px "JetBrains Mono", "Fira Code", "Courier New", monospace';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillStyle = captionColor;
      ctx!.fillText(caption, W / 2, H - barH / 2);

      frameRef.current++;
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={240}
      className="w-full max-w-4xl mx-auto rounded-xl border border-reflex-border/30 mt-3 mb-1"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
