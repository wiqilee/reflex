import { useState } from 'react';
import { useStore, AnalysisResult, Severity } from '../hooks/useStore';

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_COLORS: Record<Severity, { text: string; bg: string; border: string }> = {
  critical: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  high: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  medium: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  low: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
};

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
    <div className="card text-center py-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:shadow-pink-500/5 hover:border-pink-400/20 group">
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📊 Analysis Diff</h2>
          <p className="text-reflex-muted text-sm">Compare two analyses to track improvement</p>
        </div>
        <button onClick={() => setView('gallery')} className="btn-ghost text-sm border border-reflex-border">← Gallery</button>
      </div>

      {/* Selectors - bold readable labels */}
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
                className="w-full bg-reflex-surface border border-reflex-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-pink-400/60 transition-colors"
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
        <div className="card text-center py-12 text-reflex-muted">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm">Select two analyses from the Gallery to compare.</p>
          <p className="text-xs mt-1 text-reflex-text/30">Tip: Analyze code → fix issues → re-analyze → compare here</p>
        </div>
      )}

      {hasBoth && (
        <>
          {/* Improvement banner */}
          <div className={`card border text-center py-5 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl ${
            improvement > 0 ? 'bg-green-500/10 border-green-500/30 hover:shadow-green-500/10'
            : improvement < 0 ? 'bg-red-500/10 border-red-500/30 hover:shadow-red-500/10'
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
          <div className="card transition-all duration-300 hover:border-pink-400/20 hover:shadow-lg hover:shadow-pink-500/5">
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
          <div className="card transition-all duration-300 hover:border-pink-400/20 hover:shadow-lg hover:shadow-pink-500/5">
            <h3 className="font-semibold mb-3 text-sm">Scenario Changes</h3>
            <div className="space-y-4">
              {/* Fixed */}
              {fixed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-400 mb-2">✅ Fixed ({fixed.length})</h4>
                  <div className="space-y-1.5">
                    {fixed.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-green-500/5 border border-green-500/15 transition-all duration-200 hover:bg-green-500/10 hover:border-green-500/25 hover:scale-[1.01]">
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
                      <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${SEV_COLORS[s.severity].bg} border ${SEV_COLORS[s.severity].border} transition-all duration-200 hover:brightness-125 hover:scale-[1.01]`}>
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
                        <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-reflex-border/20 border border-reflex-border/30 transition-all duration-200 hover:bg-reflex-border/35 hover:border-reflex-border/50 hover:scale-[1.01]">
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
