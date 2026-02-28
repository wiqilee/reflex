import { useEffect, useRef } from 'react';

const CODE_SYMBOLS = ['{ }', '//', '=>', 'fn', 'if', 'err', '< >', '&&', '||', '[ ]', '::', 'try', 'run', 'fix', 'log', 'def', 'api', 'sql', 'tcp', '⚡'];

const COLORS = [
  [239, 68, 68],    // red
  [249, 115, 22],   // orange
  [234, 179, 8],    // yellow
  [34, 197, 94],    // green
  [168, 85, 247],   // purple
  [59, 130, 246],   // blue
];

export default function LightningBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;

    interface FallingBlock {
      x: number;
      y: number;
      vy: number;
      text: string;
      r: number; g: number; b: number;
      alpha: number;
      size: number;
      rotation: number;
      rotSpeed: number;
    }

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; size: number;
    }

    interface Bolt {
      points: { x: number; y: number }[];
      alpha: number;
      width: number;
    }

    const blocks: FallingBlock[] = [];
    const particles: Particle[] = [];
    const bolts: Bolt[] = [];

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function spawnBlock() {
      if (blocks.length > 35) return;
      const [r, g, b] = COLORS[Math.floor(Math.random() * COLORS.length)];
      blocks.push({
        x: Math.random() * w,
        y: -30,
        vy: 0.3 + Math.random() * 0.6,
        text: CODE_SYMBOLS[Math.floor(Math.random() * CODE_SYMBOLS.length)],
        r, g, b,
        alpha: 0.2 + Math.random() * 0.25,
        size: 12 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.008,
      });
    }

    function spawnParticle() {
      if (particles.length > 50) return;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.4 - 0.1,
        life: 0,
        maxLife: 120 + Math.random() * 180,
        size: Math.random() * 2 + 0.5,
      });
    }

    function createBolt() {
      const startX = Math.random() * w;
      const pts = [{ x: startX, y: 0 }];
      let x = startX, y = 0;
      const segs = 6 + Math.floor(Math.random() * 10);
      const segH = (h * 0.3 + Math.random() * h * 0.4) / segs;
      for (let i = 0; i < segs; i++) {
        x += (Math.random() - 0.5) * 80;
        y += segH;
        pts.push({ x, y });
      }
      bolts.push({ points: pts, alpha: 0.5 + Math.random() * 0.3, width: 1 + Math.random() * 1.5 });
    }

    let frame = 0;

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      frame++;

      // Spawn more frequently
      if (frame % 20 === 0) spawnBlock();
      if (frame % 4 === 0) spawnParticle();
      if (Math.random() < 0.005) createBolt();

      // Falling code blocks
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        b.y += b.vy;
        b.rotation += b.rotSpeed;
        if (b.y > h + 50) { blocks.splice(i, 1); continue; }

        ctx!.save();
        ctx!.translate(b.x, b.y);
        ctx!.rotate(b.rotation);
        ctx!.font = `bold ${b.size}px "JetBrains Mono", "Fira Code", "Courier New", monospace`;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillStyle = `rgba(${b.r}, ${b.g}, ${b.b}, ${b.alpha})`;
        ctx!.fillText(b.text, 0, 0);
        ctx!.restore();
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const progress = p.life / p.maxLife;
        const alpha = progress < 0.3 ? progress / 0.3 : (1 - progress) / 0.7;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(249, 115, 22, ${alpha * 0.35})`;
        ctx!.fill();

        // Glow
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(249, 115, 22, ${alpha * 0.08})`;
        ctx!.fill();

        if (p.life >= p.maxLife) particles.splice(i, 1);
      }

      // Lightning bolts
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.alpha -= 0.018;
        if (b.alpha <= 0) { bolts.splice(i, 1); continue; }

        ctx!.beginPath();
        ctx!.moveTo(b.points[0].x, b.points[0].y);
        for (let j = 1; j < b.points.length; j++) ctx!.lineTo(b.points[j].x, b.points[j].y);

        // Core line
        ctx!.strokeStyle = `rgba(251, 191, 36, ${b.alpha * 0.6})`;
        ctx!.lineWidth = b.width;
        ctx!.stroke();

        // Glow
        ctx!.strokeStyle = `rgba(249, 115, 22, ${b.alpha * 0.2})`;
        ctx!.lineWidth = b.width * 4;
        ctx!.stroke();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1, opacity: 1 }}
    />
  );
}
