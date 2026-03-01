import { useState, useEffect, useRef } from 'react';
import { useStore, AnalysisResult, Severity } from '../hooks/useStore';

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_COLORS: Record<Severity, { text: string; bg: string; border: string }> = {
  critical: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  high: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  medium: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  low: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
};

// ── Pixel border animation CSS ──
const diffPixelCSS = `
@keyframes diff-border-cycle {
  0%   { border-color: rgba(249,115,22,0.4); box-shadow: 0 0 12px rgba(249,115,22,0.08), inset 0 0 12px rgba(249,115,22,0.03); }
  16%  { border-color: rgba(236,72,153,0.4); box-shadow: 0 0 12px rgba(236,72,153,0.08), inset 0 0 12px rgba(236,72,153,0.03); }
  33%  { border-color: rgba(168,85,247,0.4); box-shadow: 0 0 12px rgba(168,85,247,0.08), inset 0 0 12px rgba(168,85,247,0.03); }
  50%  { border-color: rgba(59,130,246,0.4); box-shadow: 0 0 12px rgba(59,130,246,0.08), inset 0 0 12px rgba(59,130,246,0.03); }
  66%  { border-color: rgba(34,197,94,0.4); box-shadow: 0 0 12px rgba(34,197,94,0.08), inset 0 0 12px rgba(34,197,94,0.03); }
  83%  { border-color: rgba(6,182,212,0.4); box-shadow: 0 0 12px rgba(6,182,212,0.08), inset 0 0 12px rgba(6,182,212,0.03); }
  100% { border-color: rgba(249,115,22,0.4); box-shadow: 0 0 12px rgba(249,115,22,0.08), inset 0 0 12px rgba(249,115,22,0.03); }
}
@keyframes diff-border-subtle {
  0%   { border-color: rgba(249,115,22,0.2); }
  16%  { border-color: rgba(236,72,153,0.2); }
  33%  { border-color: rgba(168,85,247,0.2); }
  50%  { border-color: rgba(59,130,246,0.2); }
  66%  { border-color: rgba(34,197,94,0.2); }
  83%  { border-color: rgba(6,182,212,0.2); }
  100% { border-color: rgba(249,115,22,0.2); }
}
.diff-card {
  border: 1px solid rgba(255,255,255,0.06);
  transition: all 0.3s ease;
}
.diff-card:hover {
  animation: diff-border-cycle 3s linear infinite;
  border-width: 1.5px;
}
.diff-item {
  border: 1px solid rgba(255,255,255,0.04);
  transition: all 0.3s ease;
}
.diff-item:hover {
  animation: diff-border-subtle 3s linear infinite;
}
`;

function InjectDiffCSS() {
  useEffect(() => {
    const id = 'diff-pixel-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = diffPixelCSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);
  return null;
}

// ── Pixel Canvas for Diff header ──
const PX = 3;
function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, PX * s, PX * s);
}
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x) * PX, Math.floor(y) * PX, w * PX, h * PX);
}

function drawDiffScene(ctx: CanvasRenderingContext2D, f: number, W: number, H: number) {
  ctx.clearRect(0, 0, W, H);
  const pw = Math.floor(W / PX), ph = Math.floor(H / PX);
  rect(ctx, 0, 0, pw, ph, '#0a0a1a');

  const midX = Math.floor(pw / 2);
  const groundY = ph - 5;

  // ── LEFT: Worried person at desk with red doc ──
  const lx = Math.floor(pw * 0.2);
  const ly = groundY - 16;

  // Desk
  rect(ctx, lx - 8, ly + 10, 16, 2, '#4a3728');
  rect(ctx, lx - 7, ly + 12, 2, 4, '#3d2e21');
  rect(ctx, lx + 5, ly + 12, 2, 4, '#3d2e21');

  // Red document on desk
  rect(ctx, lx - 4, ly + 7, 8, 3, '#1e293b');
  rect(ctx, lx - 3, ly + 8, 3, 1, '#ef4444');
  rect(ctx, lx + 1, ly + 8, 2, 1, '#ef4444');

  // Red X marks on document
  if (Math.sin(f * 0.06) > -0.3) {
    px(ctx, lx - 2, ly + 7, '#ef4444');
    px(ctx, lx + 3, ly + 7, '#ef4444');
  }

  // Person body (sitting)
  rect(ctx, lx - 1, ly + 3, 3, 4, '#3b82f6'); // shirt
  rect(ctx, lx - 2, ly + 5, 1, 3, '#3b82f6'); // left arm reaching to doc
  rect(ctx, lx + 2, ly + 5, 1, 3, '#3b82f6'); // right arm

  // Head
  rect(ctx, lx - 1, ly, 3, 3, '#fbbf24'); // face
  px(ctx, lx - 1, ly + 1, '#1a1a2e'); // eye left
  px(ctx, lx + 1, ly + 1, '#1a1a2e'); // eye right
  // Frown - animated
  if (Math.sin(f * 0.04) > 0) {
    px(ctx, lx, ly + 2, '#ef4444'); // worried mouth
  }

  // Sweat drop
  if (Math.sin(f * 0.05) > 0.3) {
    px(ctx, lx + 2, ly - 1, '#60a5fa');
  }

  // Red warning bubble
  const bubbleY = ly - 5 + Math.sin(f * 0.04) * 0.8;
  px(ctx, lx + 5, Math.floor(bubbleY), '#ef4444');
  px(ctx, lx + 6, Math.floor(bubbleY) - 1, '#ef4444');
  px(ctx, lx + 6, Math.floor(bubbleY), '#ef4444');
  px(ctx, lx + 7, Math.floor(bubbleY), '#ef4444');

  // ── CENTER: Sparkle transformation ──
  // Arrow made of particles
  for (let p = 0; p < 5; p++) {
    const t = ((f * 0.04 + p * 1.8) % 10) / 10;
    const sx = midX - 8 + t * 16;
    const sy = ph / 2 + Math.sin(t * Math.PI) * -3;
    const colors = ['#f97316', '#fbbf24', '#22c55e', '#60a5fa', '#a855f7'];
    px(ctx, Math.floor(sx), Math.floor(sy), colors[p]);
  }

  // Center sparkle burst
  const sparkR = 2 + Math.sin(f * 0.06) * 1;
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * Math.PI * 2 + f * 0.03;
    const spx = midX + Math.cos(angle) * sparkR;
    const spy = ph / 2 + Math.sin(angle) * sparkR;
    px(ctx, Math.floor(spx), Math.floor(spy), '#fbbf24');
  }

  // ── RIGHT: Happy person at desk with green doc ──
  const rx = Math.floor(pw * 0.8);
  const ry = groundY - 16;

  // Desk
  rect(ctx, rx - 8, ry + 10, 16, 2, '#4a3728');
  rect(ctx, rx - 7, ry + 12, 2, 4, '#3d2e21');
  rect(ctx, rx + 5, ry + 12, 2, 4, '#3d2e21');

  // Green document on desk
  rect(ctx, rx - 4, ry + 7, 8, 3, '#1e293b');
  rect(ctx, rx - 3, ry + 8, 3, 1, '#22c55e');
  rect(ctx, rx + 1, ry + 8, 2, 1, '#22c55e');

  // Green checkmarks on document
  px(ctx, rx - 2, ry + 7, '#22c55e');
  px(ctx, rx + 3, ry + 7, '#22c55e');

  // Person body (sitting, arms up celebrating)
  rect(ctx, rx - 1, ry + 3, 3, 4, '#22c55e'); // shirt green = success!
  // Arms raised in celebration
  const armUp = Math.sin(f * 0.08) > 0 ? -1 : 0;
  px(ctx, rx - 2, ry + 3 + armUp, '#22c55e');
  px(ctx, rx - 2, ry + 2 + armUp, '#fbbf24');
  px(ctx, rx + 2, ry + 3 + armUp, '#22c55e');
  px(ctx, rx + 2, ry + 2 + armUp, '#fbbf24');

  // Head
  rect(ctx, rx - 1, ry, 3, 3, '#fbbf24');
  px(ctx, rx - 1, ry + 1, '#1a1a2e');
  px(ctx, rx + 1, ry + 1, '#1a1a2e');
  // Smile
  px(ctx, rx - 1, ry + 2, '#22c55e');
  px(ctx, rx, ry + 2, '#22c55e');
  px(ctx, rx + 1, ry + 2, '#22c55e');

  // Floating hearts
  for (let h = 0; h < 3; h++) {
    const hy = ry - 3 - ((f * 0.03 + h * 3) % 8);
    const hx = rx - 2 + h * 3 + Math.sin(f * 0.04 + h) * 1;
    if (hy > ry - 8) {
      px(ctx, Math.floor(hx), Math.floor(hy), '#ec4899');
      px(ctx, Math.floor(hx) + 1, Math.floor(hy), '#ec4899');
    }
  }

  // ── Floating stars everywhere ──
  const stars = [
    [8, 5, 0], [pw - 10, 4, 1], [15, ph - 8, 2],
    [pw - 15, ph - 7, 3], [midX - 18, 6, 4], [midX + 18, 4, 5],
    [midX, 3, 6], [25, 10, 7], [pw - 25, 10, 8],
  ];
  stars.forEach(([sx, sy, d]) => {
    const twinkle = Math.sin(f * 0.05 + (d as number) * 1.5);
    if (twinkle > 0.2) {
      const col = twinkle > 0.7 ? '#fbbf24' : '#6b7280';
      px(ctx, sx as number, sy as number, col);
    }
  });

  // Ground line
  for (let x = 0; x < pw; x += 3) {
    px(ctx, x, groundY, '#1e293b');
  }
}

function PixelCanvas({ draw, width = 800, height = 120 }: { draw: (ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => void; width?: number; height?: number }) {
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

// ── Utility functions ──
function sevCount(a: AnalysisResult, sev: Severity): number {
  return a.scenarios.filter(s => s.severity === sev).length;
}

function riskScore(a: AnalysisResult): number {
  return a.scenarios.reduce((sum, s) => sum + ({ critical: 10, high: 5, medium: 2, low: 1 }[s.severity] || 0), 0);
}

function DiffBadge({ before, after, label }: { before: number; after: number; label: string }) {
  const diff = after - before;
  const better = diff < 0;
  const worse = diff > 0;
  const colorMap: Record<string, string> = {
    'Total Issues': 'from-blue-500/20 via-blue-600/5 to-transparent border-blue-500/40 shadow-blue-500/10',
    'Critical': 'from-red-500/20 via-red-600/5 to-transparent border-red-500/40 shadow-red-500/10',
    'High': 'from-orange-500/20 via-orange-600/5 to-transparent border-orange-500/40 shadow-orange-500/10',
    'Medium': 'from-yellow-500/20 via-yellow-600/5 to-transparent border-yellow-500/40 shadow-yellow-500/10',
    'Runbooks': 'from-purple-500/20 via-purple-600/5 to-transparent border-purple-500/40 shadow-purple-500/10',
  };
  const topBarMap: Record<string, string> = {
    'Total Issues': 'bg-blue-500', 'Critical': 'bg-red-500', 'High': 'bg-orange-500', 'Medium': 'bg-yellow-500', 'Runbooks': 'bg-purple-500',
  };
  const textMap: Record<string, string> = {
    'Total Issues': 'text-blue-300/80', 'Critical': 'text-red-300/80', 'High': 'text-orange-300/80', 'Medium': 'text-yellow-300/80', 'Runbooks': 'text-purple-300/80',
  };
  const afterColorMap: Record<string, string> = {
    'Total Issues': 'group-hover:text-blue-400', 'Critical': 'group-hover:text-red-400', 'High': 'group-hover:text-orange-400', 'Medium': 'group-hover:text-yellow-400', 'Runbooks': 'group-hover:text-purple-400',
  };
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colorMap[label] || colorMap['Total Issues']} shadow-lg text-center py-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl cursor-default group`}>
      <div className={`absolute top-0 left-0 w-full h-0.5 ${topBarMap[label] || 'bg-blue-500'} group-hover:h-1 transition-all duration-300`} />
      <p className={`text-xs ${textMap[label] || 'text-blue-300/80'} uppercase tracking-wider mb-1.5 font-bold`}>{label}</p>
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg text-reflex-text/40 font-mono">{before}</span>
        <span className="text-pink-300/30 font-bold">→</span>
        <span className={`text-lg font-bold font-mono transition-all duration-300 group-hover:text-2xl ${better ? 'text-green-400' : worse ? 'text-red-400' : 'text-reflex-text/60'} ${afterColorMap[label] || ''}`}>{after}</span>
      </div>
      {diff !== 0 && (
        <p className={`text-xs mt-1.5 font-medium ${better ? 'text-green-400' : 'text-red-400'}`}>
          {better ? '↓' : '↑'} {Math.abs(diff)} {better ? 'fewer' : 'more'}
        </p>
      )}
    </div>
  );
}

export default function AnalysisDiff() {
  const { gallery, setView } = useStore();
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);

  const before = gallery.find(g => g.id === beforeId)?.analysis;
  const after = gallery.find(g => g.id === afterId)?.analysis;
  const hasBoth = before && after;

  const scoreBefore = before ? riskScore(before) : 0;
  const scoreAfter = after ? riskScore(after) : 0;
  const improvement = scoreBefore > 0 ? Math.round(((scoreBefore - scoreAfter) / scoreBefore) * 100) : 0;

  const afterTitles = after ? new Set(after.scenarios.map(s => s.title.toLowerCase())) : new Set<string>();
  const beforeTitles = before ? new Set(before.scenarios.map(s => s.title.toLowerCase())) : new Set<string>();
  const fixed = before?.scenarios.filter(s => !afterTitles.has(s.title.toLowerCase())) || [];
  const newIssues = after?.scenarios.filter(s => !beforeTitles.has(s.title.toLowerCase())) || [];
  const persistent = after?.scenarios.filter(s => beforeTitles.has(s.title.toLowerCase())) || [];

  return (
    <div className="space-y-4 animate-fade-in">
      <InjectDiffCSS />

      {/* Header with pixel art */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📊 Analysis Diff</h2>
          <p className="text-reflex-muted text-sm">Compare two analyses to track improvement</p>
        </div>
        <button onClick={() => setView('gallery')} className="btn-ghost text-sm border border-reflex-border diff-item">← Gallery</button>
      </div>

      {/* Pixel art banner */}
      <div className="diff-card rounded-xl overflow-hidden">
        <PixelCanvas draw={drawDiffScene} height={120} />
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        {(['Before (older)', 'After (newer)'] as const).map((label, i) => {
          const val = i === 0 ? beforeId : afterId;
          const set = i === 0 ? setBeforeId : setAfterId;
          const other = i === 0 ? afterId : beforeId;
          return (
            <div key={label}>
              <label className="text-sm text-pink-300/90 font-bold uppercase tracking-wider mb-1.5 block">{label}</label>
              <select
                value={val || ''}
                onChange={e => set(e.target.value || null)}
                className="w-full bg-reflex-surface border border-reflex-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400/60 transition-colors diff-item"
              >
                <option value="">Select analysis...</option>
                {gallery.map(g => (
                  <option key={g.id} value={g.id} disabled={g.id === other}>
                    {g.analysis.service_name} — {new Date(g.createdAt).toLocaleString('id-ID')} ({g.analysis.scenarios.length} issues)
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {!hasBoth && (
        <div className="card text-center py-12 text-reflex-muted diff-card">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm">Select two analyses from the Gallery to compare.</p>
          <p className="text-xs mt-1 text-reflex-text/30">Tip: Analyze code → fix issues → re-analyze → compare here</p>
        </div>
      )}

      {hasBoth && (
        <>
          {/* Improvement banner */}
          <div className={`card border text-center py-5 transition-all duration-300 hover:scale-[1.01] diff-card ${
            improvement > 0 ? 'bg-green-500/10 border-green-500/30'
            : improvement < 0 ? 'bg-red-500/10 border-red-500/30'
            : 'bg-reflex-border/20 border-reflex-border/30'
          }`}>
            <p className={`text-3xl font-bold ${
              improvement > 0 ? 'text-green-400' : improvement < 0 ? 'text-red-400' : 'text-reflex-text/50'
            }`}>
              {improvement > 0 ? '↓' : improvement < 0 ? '↑' : '='} {Math.abs(improvement)}% Risk {improvement > 0 ? 'Reduction' : improvement < 0 ? 'Increase' : 'Unchanged'}
            </p>
            <p className="text-sm text-pink-300/70 font-bold mt-2">
              Risk score: <span className="text-pink-300">{scoreBefore}</span> → <span className="text-pink-300">{scoreAfter}</span>
              <span className="text-reflex-text/30 font-normal ml-2">(critical=10, high=5, medium=2, low=1)</span>
            </p>
          </div>

          {/* Stat diffs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <DiffBadge before={before.scenarios.length} after={after.scenarios.length} label="Total Issues" />
            <DiffBadge before={sevCount(before, 'critical')} after={sevCount(after, 'critical')} label="Critical" />
            <DiffBadge before={sevCount(before, 'high')} after={sevCount(after, 'high')} label="High" />
            <DiffBadge before={sevCount(before, 'medium')} after={sevCount(after, 'medium')} label="Medium" />
            <DiffBadge before={before.runbooks.length} after={after.runbooks.length} label="Runbooks" />
          </div>

          {/* Severity bars comparison */}
          <div className="card transition-all duration-300 diff-card">
            <h3 className="font-semibold mb-3 text-sm text-pink-300/90">Severity Distribution</h3>
            {(['Before', 'After'] as const).map((label) => {
              const a = label === 'Before' ? before : after;
              return (
                <div key={label} className="mb-3 group">
                  <p className="text-sm text-pink-300/80 font-bold mb-1">{label}</p>
                  <div className="flex gap-1 h-6 rounded-full overflow-hidden bg-reflex-border transition-all duration-300 group-hover:shadow-md group-hover:shadow-pink-500/10">
                    {(['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => {
                      const count = sevCount(a, sev);
                      if (count === 0) return null;
                      const bg = { critical: 'bg-red-600', high: 'bg-amber-500', medium: 'bg-cyan-500', low: 'bg-green-500' }[sev];
                      return (
                        <div
                          key={sev}
                          className={`${bg} flex items-center justify-center transition-all duration-500 group-hover:brightness-125`}
                          style={{ width: `${(count / a.scenarios.length) * 100}%` }}
                        >
                          <span className="text-[10px] font-bold text-black">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scenario changes */}
          <div className="card transition-all duration-300 diff-card">
            <h3 className="font-semibold mb-3 text-sm">Scenario Changes</h3>
            <div className="space-y-4">
              {/* Fixed */}
              {fixed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-400 mb-2">✅ Fixed ({fixed.length})</h4>
                  <div className="space-y-1.5">
                    {fixed.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).map(s => (
                      <div key={s.id} className="group flex items-center gap-3 p-2.5 rounded-lg bg-green-500/5 border border-green-500/15 transition-all duration-200 hover:bg-green-500/10 hover:border-green-500/30 diff-item">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border} line-through opacity-60`}>{s.severity}</span>
                        <span className="text-xs text-reflex-text/50 line-through flex-1 group-hover:text-reflex-text/70 transition-colors">{s.title}</span>
                        <span className="text-green-400 text-xs shrink-0 font-bold">RESOLVED</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* New */}
              {newIssues.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-400 mb-2">🆕 New Issues ({newIssues.length})</h4>
                  <div className="space-y-1.5">
                    {newIssues.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).map(s => (
                      <div key={s.id} className={`group flex items-center gap-3 p-2.5 rounded-lg ${SEV_COLORS[s.severity].bg} border ${SEV_COLORS[s.severity].border} transition-all duration-200 hover:brightness-125 diff-item`}>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border}`}>{s.severity}</span>
                        <span className="text-xs text-reflex-text/80 flex-1 group-hover:text-white/85 transition-colors">{s.title}</span>
                        <span className="text-red-400 text-xs shrink-0 font-bold">NEW</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Persistent */}
              {persistent.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-reflex-text/50 mb-2">🔄 Still Present ({persistent.length})</h4>
                  <div className="space-y-1.5">
                    {persistent.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).map(s => {
                      const prev = before.scenarios.find(bs => bs.title.toLowerCase() === s.title.toLowerCase());
                      const changed = prev && prev.severity !== s.severity;
                      return (
                        <div key={s.id} className="group flex items-center gap-3 p-2.5 rounded-lg bg-reflex-border/20 border border-reflex-border/30 transition-all duration-200 hover:bg-reflex-border/35 hover:border-reflex-border/50 diff-item">
                          {changed ? (
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] font-bold uppercase ${SEV_COLORS[prev!.severity].text} line-through opacity-50`}>{prev!.severity}</span>
                              <span className="text-reflex-text/20 text-xs">→</span>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border}`}>{s.severity}</span>
                            </div>
                          ) : (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border}`}>{s.severity}</span>
                          )}
                          <span className="text-xs text-reflex-text/60 flex-1 group-hover:text-white/75 transition-colors">{s.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
