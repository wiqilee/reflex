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

  // ── LEFT: "Before" document with red issues ──
  const leftX = Math.floor(pw * 0.22);
  const docY = 4;

  // Document frame
  rect(ctx, leftX - 10, docY, 20, 22, '#1e293b');
  rect(ctx, leftX - 9, docY + 1, 18, 20, '#0a0a1a');

  // Title bar
  rect(ctx, leftX - 9, docY + 1, 18, 2, '#ef4444' + '44');

  // Code lines with red markers
  for (let i = 0; i < 6; i++) {
    const lw = 6 + ((i * 5 + 3) % 10);
    const ly = docY + 5 + i * 3;
    const isBad = i === 1 || i === 3 || i === 5;
    // Severity dot
    if (isBad) {
      px(ctx, leftX - 8, ly, '#ef4444');
      rect(ctx, leftX - 6, ly, lw, 1, '#ef4444' + '55');
    } else {
      rect(ctx, leftX - 6, ly, lw, 1, '#374151');
    }
  }

  // "BEFORE" label
  const beforeLabel = 'BEFORE';
  for (let c = 0; c < beforeLabel.length; c++) {
    px(ctx, leftX - Math.floor(beforeLabel.length / 2) + c, docY + 25, '#ef4444');
  }

  // ── CENTER: Arrow with transformation effect ──
  const arrowPhase = Math.sin(f * 0.04);
  const arrowColor = arrowPhase > 0 ? '#f97316' : '#22c55e';
  rect(ctx, midX - 4, ph / 2 - 1, 8, 2, arrowColor);
  px(ctx, midX + 4, ph / 2 - 2, arrowColor);
  px(ctx, midX + 4, ph / 2 + 1, arrowColor);
  px(ctx, midX + 5, ph / 2 - 1, arrowColor);
  px(ctx, midX + 5, ph / 2, arrowColor);

  // Sparkle particles moving along arrow
  for (let p = 0; p < 3; p++) {
    const t = ((f * 0.05 + p * 2.5) % 8) / 8;
    const sx = midX - 4 + t * 10;
    const sy = ph / 2 - 1 + Math.sin(t * Math.PI * 2) * 1.5;
    px(ctx, Math.floor(sx), Math.floor(sy), '#fbbf24');
  }

  // ── RIGHT: "After" document with green checks ──
  const rightX = Math.floor(pw * 0.78);

  // Document frame
  rect(ctx, rightX - 10, docY, 20, 22, '#1e293b');
  rect(ctx, rightX - 9, docY + 1, 18, 20, '#0a0a1a');

  // Title bar
  rect(ctx, rightX - 9, docY + 1, 18, 2, '#22c55e' + '44');

  // Code lines with green checks
  for (let i = 0; i < 6; i++) {
    const lw = 6 + ((i * 5 + 3) % 10);
    const ly = docY + 5 + i * 3;
    const wasFixed = i === 1 || i === 3 || i === 5;
    if (wasFixed) {
      px(ctx, rightX - 8, ly, '#22c55e');
      rect(ctx, rightX - 6, ly, lw, 1, '#22c55e' + '55');
      // Checkmark
      const checkAppear = (f * 0.02) % 6 > i;
      if (checkAppear) {
        px(ctx, rightX + lw - 4, ly, '#22c55e');
        px(ctx, rightX + lw - 3, ly - 1, '#22c55e');
      }
    } else {
      rect(ctx, rightX - 6, ly, lw, 1, '#374151');
    }
  }

  // "AFTER" label
  const afterLabel = 'AFTER';
  for (let c = 0; c < afterLabel.length; c++) {
    px(ctx, rightX - Math.floor(afterLabel.length / 2) + c, docY + 25, '#22c55e');
  }

  // ── Floating metrics ──
  // Risk score going down
  const riskY = 3 + Math.sin(f * 0.03) * 1;
  const downArrow = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
  downArrow.forEach(([dx, dy]) => {
    px(ctx, midX - 1 + dx, Math.floor(riskY) + dy + ph / 2 + 4, '#22c55e');
  });

  // Percentage floating
  if (Math.sin(f * 0.035) > 0) {
    const pctDots = [[0,0],[1,0],[2,0],[3,0]]; // "38%"
    pctDots.forEach(([dx]) => {
      px(ctx, midX - 2 + dx, Math.floor(riskY) + ph / 2 + 8, '#22c55e');
    });
  }

  // Stars
  const stars = [
    [6, 4, 0], [pw - 8, 6, 1], [12, ph - 6, 2],
    [pw - 12, ph - 5, 3], [midX - 15, 3, 4], [midX + 15, 5, 5],
  ];
  stars.forEach(([sx, sy, d]) => {
    if (Math.sin(f * 0.04 + (d as number) * 1.3) > 0.4)
      px(ctx, sx as number, sy as number, '#fbbf24');
  });

  // Bottom label
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('Track Risk Reduction Over Time', W / 2, H - 5);
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
  return (
    <div className="card text-center py-4 transition-all duration-300 hover:scale-[1.03] diff-card group">
      <p className="text-xs text-pink-300/80 uppercase tracking-wider mb-1.5 font-bold">{label}</p>
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg text-reflex-text/40 font-mono">{before}</span>
        <span className="text-pink-300/30 font-bold">→</span>
        <span className={`text-lg font-bold font-mono ${better ? 'text-green-400' : worse ? 'text-red-400' : 'text-reflex-text/60'}`}>{after}</span>
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
                      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-green-500/5 border border-green-500/15 transition-all duration-200 hover:bg-green-500/10 hover:border-green-500/25 hover:scale-[1.01] diff-item">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border} line-through opacity-60`}>{s.severity}</span>
                        <span className="text-xs text-reflex-text/50 line-through flex-1">{s.title}</span>
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
                      <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${SEV_COLORS[s.severity].bg} border ${SEV_COLORS[s.severity].border} transition-all duration-200 hover:brightness-125 hover:scale-[1.01] diff-item`}>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border}`}>{s.severity}</span>
                        <span className="text-xs text-reflex-text/80 flex-1">{s.title}</span>
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
                        <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-reflex-border/20 border border-reflex-border/30 transition-all duration-200 hover:bg-reflex-border/35 hover:border-reflex-border/50 hover:scale-[1.01] diff-item">
                          {changed ? (
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] font-bold uppercase ${SEV_COLORS[prev!.severity].text} line-through opacity-50`}>{prev!.severity}</span>
                              <span className="text-reflex-text/20 text-xs">→</span>
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border}`}>{s.severity}</span>
                            </div>
                          ) : (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_COLORS[s.severity].bg} ${SEV_COLORS[s.severity].text} border ${SEV_COLORS[s.severity].border}`}>{s.severity}</span>
                          )}
                          <span className="text-xs text-reflex-text/60 flex-1">{s.title}</span>
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
