import { useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';

function formatWIB(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' WIB';
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-amber-500',
  medium: 'bg-cyan-500',
  low: 'bg-green-500',
};

// === Pixel art: Person and cat sleeping on sofa (empty state) ===
const PX = 3;
function pxDraw(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, PX * s, PX * s);
}
function rectDraw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, w * PX, h * PX);
}

function drawSleepScene(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);
  rectDraw(ctx, 0, 0, pw, ph, '#0a0a1a');

  const groundY = ph - 4;
  const sofaX = Math.floor(pw / 2) - 20;
  const sofaY = groundY - 10;

  // Floor
  for (let x = 0; x < pw; x += 2) {
    pxDraw(ctx, x, groundY, '#1a1d27');
  }

  // Sofa back
  rectDraw(ctx, sofaX - 2, sofaY - 6, 44, 3, '#5b3a1a');
  rectDraw(ctx, sofaX - 3, sofaY - 6, 1, 10, '#5b3a1a'); // left arm
  rectDraw(ctx, sofaX + 42, sofaY - 6, 1, 10, '#5b3a1a'); // right arm

  // Sofa seat
  rectDraw(ctx, sofaX - 2, sofaY - 3, 44, 4, '#7a4f2a');

  // Sofa cushions
  rectDraw(ctx, sofaX, sofaY - 2, 12, 3, '#8b5e3c');
  rectDraw(ctx, sofaX + 14, sofaY - 2, 12, 3, '#8b5e3c');
  rectDraw(ctx, sofaX + 28, sofaY - 2, 12, 3, '#8b5e3c');

  // Sofa legs
  rectDraw(ctx, sofaX - 1, sofaY + 1, 2, 3, '#4a3018');
  rectDraw(ctx, sofaX + 39, sofaY + 1, 2, 3, '#4a3018');

  // === Person sleeping on sofa ===
  const personX = sofaX + 6;
  const personY = sofaY - 6;

  // Body (lying down)
  rectDraw(ctx, personX, personY, 12, 3, '#3b82f6'); // shirt/body
  // Head (pillow side)
  rectDraw(ctx, personX - 3, personY - 1, 3, 3, '#fbbf24'); // head
  // Pillow
  rectDraw(ctx, personX - 5, personY, 4, 2, '#e2e8f0');
  // Eyes closed
  pxDraw(ctx, personX - 2, personY, '#0a0a1a');
  // Legs
  rectDraw(ctx, personX + 12, personY + 1, 4, 2, '#1e3a5f');
  // Blanket
  rectDraw(ctx, personX + 2, personY - 1, 8, 2, '#6366f1');
  // Arm draped
  pxDraw(ctx, personX + 1, personY + 2, '#fbbf24');

  // === Cat curled up on person's legs ===
  const catX = personX + 14;
  const catY = personY - 2;

  // Cat body (curled)
  rectDraw(ctx, catX, catY, 4, 3, '#f97316');
  pxDraw(ctx, catX + 4, catY + 1, '#f97316');
  // Cat head
  rectDraw(ctx, catX - 1, catY, 2, 2, '#f97316');
  // Cat ears
  pxDraw(ctx, catX - 1, catY - 1, '#f97316');
  pxDraw(ctx, catX, catY - 1, '#f97316');
  // Cat eyes closed
  pxDraw(ctx, catX - 1, catY + 1, '#0a0a1a');
  // Cat tail
  pxDraw(ctx, catX + 4, catY, '#f97316');
  pxDraw(ctx, catX + 5, catY - 1, '#f97316');

  // === ZZZ floating ===
  const zBase = personX - 6;
  const zBaseY = personY - 4;

  // Small z
  const z1y = zBaseY - Math.floor((f * 0.02) % 6);
  const z1alpha = Math.sin(f * 0.04);
  if (z1alpha > -0.3) {
    pxDraw(ctx, zBase, z1y, '#64748b');
    pxDraw(ctx, zBase + 1, z1y, '#64748b');
    pxDraw(ctx, zBase, z1y + 1, '#64748b');
    pxDraw(ctx, zBase, z1y + 2, '#64748b');
    pxDraw(ctx, zBase + 1, z1y + 2, '#64748b');
  }

  // Medium z
  const z2y = zBaseY - 4 - Math.floor((f * 0.025) % 5);
  const z2alpha = Math.sin(f * 0.035 + 1);
  if (z2alpha > -0.3) {
    pxDraw(ctx, zBase - 3, z2y, '#94a3b8');
    pxDraw(ctx, zBase - 2, z2y, '#94a3b8');
    pxDraw(ctx, zBase - 1, z2y, '#94a3b8');
    pxDraw(ctx, zBase - 2, z2y + 1, '#94a3b8');
    pxDraw(ctx, zBase - 3, z2y + 2, '#94a3b8');
    pxDraw(ctx, zBase - 2, z2y + 2, '#94a3b8');
    pxDraw(ctx, zBase - 1, z2y + 2, '#94a3b8');
  }

  // Large Z
  const z3y = zBaseY - 9 - Math.floor((f * 0.018) % 4);
  const z3alpha = Math.sin(f * 0.03 + 2);
  if (z3alpha > -0.3) {
    pxDraw(ctx, zBase - 7, z3y, '#cbd5e1');
    pxDraw(ctx, zBase - 6, z3y, '#cbd5e1');
    pxDraw(ctx, zBase - 5, z3y, '#cbd5e1');
    pxDraw(ctx, zBase - 4, z3y, '#cbd5e1');
    pxDraw(ctx, zBase - 5, z3y + 1, '#cbd5e1');
    pxDraw(ctx, zBase - 6, z3y + 2, '#cbd5e1');
    pxDraw(ctx, zBase - 7, z3y + 3, '#cbd5e1');
    pxDraw(ctx, zBase - 6, z3y + 3, '#cbd5e1');
    pxDraw(ctx, zBase - 5, z3y + 3, '#cbd5e1');
    pxDraw(ctx, zBase - 4, z3y + 3, '#cbd5e1');
  }

  // Cat's zzz (smaller)
  const czY = catY - 3 - Math.floor((f * 0.03) % 4);
  if (Math.sin(f * 0.05) > 0) {
    pxDraw(ctx, catX + 2, czY, '#f97316');
    pxDraw(ctx, catX + 3, czY, '#f97316');
    pxDraw(ctx, catX + 2, czY + 1, '#f97316');
    pxDraw(ctx, catX + 2, czY + 2, '#f97316');
    pxDraw(ctx, catX + 3, czY + 2, '#f97316');
  }

  // === Stars / moon ===
  // Moon
  rectDraw(ctx, pw - 12, 3, 4, 4, '#fbbf24');
  rectDraw(ctx, pw - 11, 3, 2, 1, '#0a0a1a'); // crescent cut

  // Stars
  const stars = [[8, 3], [20, 6], [pw - 20, 5], [pw - 30, 3], [35, 4], [pw / 2, 2]];
  stars.forEach(([sx, sy], i) => {
    const twinkle = Math.sin(f * 0.04 + i * 1.2);
    if (twinkle > 0.1) {
      pxDraw(ctx, sx as number, sy as number, twinkle > 0.6 ? '#fbbf24' : '#4b5563');
    }
  });

  // Lamp on side table
  const lampX = sofaX + 44;
  const lampY = sofaY - 8;
  rectDraw(ctx, lampX + 2, lampY + 2, 2, 6, '#64748b'); // stand
  rectDraw(ctx, lampX, lampY, 6, 3, '#fbbf24'); // shade
  // Warm glow
  if (Math.sin(f * 0.03) > -0.5) {
    pxDraw(ctx, lampX + 2, lampY + 3, '#fbbf24');
    pxDraw(ctx, lampX + 3, lampY + 3, '#fbbf24');
  }
}

function SleepingPixelCanvas() {
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
      drawSleepScene(ctx!, frameRef.current, canvas!.width, canvas!.height);
      frameRef.current++;
      animId = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={ref}
      width={600}
      height={120}
      className="w-full max-w-lg rounded-xl"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export default function Gallery() {
  const { gallery, loadFromGallery, deleteFromGallery, setView, exitGalleryMode } = useStore();

  if (gallery.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-fade-in">
        {/* FIX: Pixel art of person and cat sleeping on sofa */}
        <SleepingPixelCanvas />
        <h2 className="text-2xl font-bold">No Saved Analyses</h2>
        <p className="text-reflex-muted text-center max-w-md">
          Nothing here yet... even the cat fell asleep waiting. 😴
          <br />
          Analyze some code first — each analysis will be automatically saved here.
        </p>
        <button onClick={() => setView('editor')} className="btn-primary mt-2">
          ⚡ Analyze Code
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">📂 Analysis Gallery</h2>
          <p className="text-reflex-muted text-sm">{gallery.length} saved {gallery.length === 1 ? 'analysis' : 'analyses'} — click to reload</p>
        </div>
        <div className="flex gap-2">
          {gallery.length >= 2 && (
            <button onClick={() => setView('diff')} className="text-sm font-medium text-reflex-text/60 border border-reflex-border hover:border-reflex-accent hover:text-reflex-accent px-4 py-2 rounded-lg transition-all">
              📊 Compare
            </button>
          )}
          <button onClick={() => setView('editor')} className="text-sm font-medium text-reflex-accent border border-reflex-accent/40 hover:border-reflex-accent hover:bg-reflex-accent/15 px-4 py-2 rounded-lg transition-all">
            ⚡ Start New Analysis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gallery.map((item) => {
          // FIX: Use the saved filename from analyzedCode, not just service_name
          const displayName = item.analyzedCode?.filename || item.analysis.service_name || 'Untitled Analysis';
          const displayLang = item.analyzedCode?.language || '';

          return (
            <div
              key={item.id}
              className="card hover-card group cursor-pointer"
              onClick={() => { loadFromGallery(item.id); setView('dashboard'); }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  {/* FIX: Show the actual saved filename */}
                  <h3 className="font-semibold truncate flex items-center gap-2">
                    <span className="font-mono text-reflex-accent">{displayName}</span>
                    {displayLang && (
                      <span className="text-xs text-reflex-text/40 bg-reflex-border/30 px-1.5 py-0.5 rounded">
                        {displayLang}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-reflex-muted mt-0.5">
                    🕐 {formatWIB(item.createdAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFromGallery(item.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10"
                  title="Delete this analysis"
                >
                  🗑️
                </button>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-xs text-reflex-muted mb-3">
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[item.analysis.overall_risk] || 'bg-gray-500'}`} />
                  {item.analysis.overall_risk?.toUpperCase()} Risk
                </span>
                <span>📋 {item.analysis.runbooks.length} runbooks</span>
                <span>⚠️ {item.analysis.scenarios.length} scenarios</span>
              </div>

              {/* Top scenarios preview */}
              <div className="space-y-1">
                {item.analysis.scenarios.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[s.severity] || 'bg-gray-500'}`} />
                    <span className="text-reflex-muted truncate">{s.title}</span>
                  </div>
                ))}
                {item.analysis.scenarios.length > 3 && (
                  <p className="text-xs text-reflex-muted/60 pl-3.5">
                    +{item.analysis.scenarios.length - 3} more...
                  </p>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-reflex-border flex items-center justify-between">
                <span className="text-xs text-reflex-muted">
                  {item.analysis.files_analyzed} file(s) analyzed
                </span>
                <span className="text-xs text-reflex-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to view →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
