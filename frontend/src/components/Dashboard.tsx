import { useState, useEffect, useRef } from 'react';
import { useStore } from '../hooks/useStore';
import { useAnalysis } from '../hooks/useAnalysis';
import { DEMO_SNIPPETS } from '../data/demoSnippets';
import PixelScene from './PixelScene';

const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-600/10', border: 'border-red-600/30', text: 'text-red-400', dot: 'bg-red-600', bar: 'bg-red-600' },
  high: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  medium: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500', bar: 'bg-cyan-500' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500', bar: 'bg-green-500' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.low;
  return (
    <span className={`${c.bg} ${c.border} ${c.text} border px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide`}>
      {severity}
    </span>
  );
}

function StatCard({ label, value, sub, color, variant }: { label: string; value: string | number; sub?: string; color?: string; variant?: string }) {
  return (
    <div className={`card stat-card ${variant || 'stat-card-accent'}`}>
      <p className="text-reflex-muted text-[10px] font-bold uppercase tracking-widest mb-1.5">{label}</p>
      <p className={`text-3xl font-black counter-value ${color || 'text-reflex-text'}`}>{value}</p>
      {sub && <p className="text-reflex-text/40 text-xs mt-1">{sub}</p>}
    </div>
  );
}

const LOADING_STEPS = [
  { pct: 5, msg: 'Connecting to Mistral AI...' },
  { pct: 12, msg: 'Parsing source code...' },
  { pct: 22, msg: 'Identifying entry points & imports...' },
  { pct: 35, msg: 'Classifying failure scenarios...' },
  { pct: 48, msg: 'Generating incident runbooks...' },
  { pct: 60, msg: 'Assessing impact levels...' },
  { pct: 72, msg: 'Building dependency graph...' },
  { pct: 82, msg: 'Calculating blast radius...' },
  { pct: 90, msg: 'Validating & structuring output...' },
  { pct: 96, msg: 'Almost done...' },
];

function LoadingProgress() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const intervals = [600, 1800, 2500, 3500, 4500, 3500, 3000, 3000, 4000, 6000];
    let timeout: ReturnType<typeof setTimeout>;
    function advance() {
      setStepIdx((prev) => {
        const next = prev + 1;
        if (next < LOADING_STEPS.length) {
          timeout = setTimeout(advance, intervals[next] || 3000);
        }
        return Math.min(next, LOADING_STEPS.length - 1);
      });
    }
    timeout = setTimeout(advance, intervals[0]);
    return () => clearTimeout(timeout);
  }, []);

  const step = LOADING_STEPS[stepIdx];

  return (
    <div className="w-full max-w-md mx-auto mt-5 animate-fade-in">
      <div className="relative h-2 rounded-full bg-reflex-border overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 transition-all duration-1000 ease-out"
          style={{ width: `${step.pct}%` }}
        />
        <div className="absolute inset-0 loading-scan-line" />
        <div
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 blur-md opacity-40 transition-all duration-1000 ease-out"
          style={{ width: `${step.pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-reflex-text/60 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-reflex-accent loading-dot" />
          {step.msg}
        </span>
        <span className="text-sm font-mono text-reflex-accent font-bold">{step.pct}%</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { analysis, setView, setSelectedRunbook, loading, galleryMode, exitGalleryMode, analyzedCode } = useStore();
  const { loadDemoToEditor } = useAnalysis();

  // Close demo dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const dd = document.getElementById('demo-dropdown');
      if (dd && !dd.parentElement?.contains(e.target as Node)) {
        dd.classList.add('hidden');
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] gap-5 animate-fade-in">
        {/* Lightning icon - explicit large size */}
        <span className="lightning-icon" style={{ fontSize: '96px', lineHeight: 1 }}>⚡</span>

        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-center">
          Welcome to <span className="reflex-shimmer">REFLEX</span>
        </h2>
        <p className="text-reflex-text/55 text-center max-w-lg text-base leading-relaxed">
          Your code already knows how it will fail.
          <br />
          <span className="text-reflex-accent font-medium">REFLEX makes it tell you.</span>
        </p>

        {/* Feature pills */}
        {!loading && (
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {['Failure Detection', 'Auto Runbooks', 'Dependency Graph', 'Blast Radius', 'Agent Triage', '18 Languages'].map((f) => (
              <span key={f} className="text-xs px-3 py-1 rounded-full border border-reflex-border text-reflex-text/45 hover:border-reflex-accent/40 hover:text-reflex-accent transition-all cursor-default">
                {f}
              </span>
            ))}
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-4 mt-5">
          <button
            onClick={() => setView('editor')}
            disabled={loading}
            className={`group relative whitespace-nowrap px-10 py-4 rounded-xl font-semibold text-base transition-all duration-300 ${
              loading
                ? 'bg-reflex-border/60 text-reflex-muted/50 cursor-not-allowed'
                : 'text-black bg-gradient-to-r from-orange-400 via-reflex-accent to-amber-500 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105'
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              ⚡ Analyze Code
            </span>
            {!loading && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-400 via-reflex-accent to-amber-500 blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => {
                if (!loading) {
                  const el = document.getElementById('demo-dropdown');
                  if (el) el.classList.toggle('hidden');
                }
              }}
              disabled={loading}
              className={`relative whitespace-nowrap px-10 py-4 rounded-xl font-semibold text-base transition-all duration-300 overflow-hidden ${
                loading
                  ? 'analyzing-btn'
                  : 'border-2 border-white/30 text-reflex-text/80 hover:border-reflex-accent hover:text-reflex-accent hover:shadow-lg hover:shadow-orange-500/20 hover:scale-105'
              }`}
            >
              <span className="relative z-10 whitespace-nowrap flex items-center gap-2">
                {loading ? '⚡ Analyzing...' : '🎮 Try Demo'}
                {!loading && <svg className="w-3.5 h-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
              </span>
              {loading && <div className="analyzing-btn-sweep" />}
            </button>
            {/* Language dropdown — FIX: now redirects to editor with code prefilled */}
            <div
              id="demo-dropdown"
              className="hidden absolute top-full left-0 mt-2 w-56 rounded-xl border border-reflex-border/50 bg-reflex-surface/95 backdrop-blur-xl shadow-2xl shadow-black/50 z-50 overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-reflex-border/30">
                <span className="text-xs text-reflex-text/40 uppercase tracking-wider font-medium">Choose language</span>
              </div>
              {DEMO_SNIPPETS.map((s) => (
                <button
                  key={s.language}
                  onClick={() => {
                    document.getElementById('demo-dropdown')?.classList.add('hidden');
                    // FIX: Navigate to editor with code prefilled instead of auto-analyzing
                    loadDemoToEditor(s.language);
                  }}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-reflex-accent/10 transition-colors text-sm text-reflex-text/70 hover:text-reflex-accent"
                >
                  <span className="text-base">{s.icon}</span>
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-reflex-text/30 ml-auto">{s.filename}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom tech info - between buttons and pixel scene */}
        {!loading && (
          <div className="flex items-center gap-4 mt-3 text-xs text-reflex-text/40">
            <span className="flex items-center gap-1.5">🤖 Powered by Mistral AI</span>
            <span className="w-1 h-1 rounded-full bg-reflex-text/15" />
            <span className="flex items-center gap-1.5">🦀 Rust WebAssembly</span>
            <span className="w-1 h-1 rounded-full bg-reflex-text/15" />
            <span className="flex items-center gap-1.5">📋 21 Features</span>
          </div>
        )}

        {/* Pixel art scene */}
        {!loading && <PixelScene />}

        {/* Loading progress */}
        {loading && (
          <>
            <PixelScene />
            <LoadingProgress />
          </>
        )}
      </div>
    );
  }

  const { scenarios, runbooks, dependency_graph, overall_risk, summary } = analysis;
  const critCount = scenarios.filter(s => s.severity === 'critical').length;
  const highCount = scenarios.filter(s => s.severity === 'high').length;
  const medCount = scenarios.filter(s => s.severity === 'medium').length;
  const lowCount = scenarios.filter(s => s.severity === 'low').length;

  return (
    <div className="space-y-6 view-enter">
      {/* Action bar — FIX: Only New Scan button with orange gradient, no New Analysis when viewing results */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { exitGalleryMode?.(); setView('dashboard'); window.location.reload(); }}
          className="group relative flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-black bg-gradient-to-r from-orange-400 via-reflex-accent to-amber-500 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105 transition-all duration-300 overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-2">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            New Scan
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-reflex-accent to-amber-500 blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
        </button>

        {/* Show current file info if available */}
        {analyzedCode && (
          <div className="flex items-center gap-2 text-xs text-reflex-text/50 bg-reflex-border/20 px-3 py-1.5 rounded-lg border border-reflex-border/30">
            <span className="font-mono text-reflex-accent">{analyzedCode.filename}</span>
            <span className="w-1 h-1 rounded-full bg-reflex-text/20" />
            <span>{analyzedCode.language}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-children">
        <StatCard label="Overall Risk" value={overall_risk.toUpperCase()} color={SEVERITY_COLORS[overall_risk]?.text} variant={`stat-card-${overall_risk}`} />
        <StatCard label="Failure Scenarios" value={scenarios.length} sub={`${critCount} critical`} variant="stat-card-critical" />
        <StatCard label="Runbooks Generated" value={runbooks.length} sub="ready to use" variant="stat-card-accent" />
        <StatCard label="Dependencies" value={dependency_graph.nodes.length} sub={`${dependency_graph.edges.length} connections`} variant="stat-card-blue" />
        <StatCard label="Files Analyzed" value={analysis.files_analyzed} sub={analysis.service_name} variant="stat-card-accent" />
      </div>

      <div className={`card ${SEVERITY_COLORS[overall_risk]?.bg} ${SEVERITY_COLORS[overall_risk]?.border} border glow transition-all duration-300 hover:scale-[1.01] hover:shadow-lg cursor-default`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <h3 className="font-semibold mb-1">Analysis Summary</h3>
            <p className="text-sm text-reflex-text/85 leading-relaxed">{summary}</p>
          </div>
        </div>
      </div>

      <div className="card transition-all duration-300 hover:border-reflex-accent/30 hover:shadow-lg hover:shadow-orange-500/5 cursor-default">
        <h3 className="font-semibold mb-4">Severity Breakdown</h3>
        <div className="flex gap-1 h-7 rounded-full overflow-hidden bg-reflex-border/50">
          {critCount > 0 && <div className="sev-bar-critical bar-animated flex items-center justify-center" style={{ width: `${(critCount / scenarios.length) * 100}%` }}><span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{critCount}</span></div>}
          {highCount > 0 && <div className="sev-bar-high bar-animated flex items-center justify-center" style={{ width: `${(highCount / scenarios.length) * 100}%`, animationDelay: '0.1s' }}><span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{highCount}</span></div>}
          {medCount > 0 && <div className="sev-bar-medium bar-animated flex items-center justify-center" style={{ width: `${(medCount / scenarios.length) * 100}%`, animationDelay: '0.2s' }}><span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{medCount}</span></div>}
          {lowCount > 0 && <div className="sev-bar-low bar-animated flex items-center justify-center" style={{ width: `${(lowCount / scenarios.length) * 100}%`, animationDelay: '0.3s' }}><span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{lowCount}</span></div>}
        </div>
        <div className="flex gap-6 mt-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" /> Critical: {critCount}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]" /> High: {highCount}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]" /> Medium: {medCount}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" /> Low: {lowCount}</span>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Failure Scenarios</h3>
          <div className="flex items-center gap-3">
            {useStore.getState().analyzedCode && (
              <button onClick={() => setView('code-view')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all">🔍 View in Code</button>
            )}
            <button onClick={() => setView('runbooks')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-reflex-accent/30 text-reflex-accent hover:bg-reflex-accent/10 hover:border-reflex-accent/50 transition-all">📋 View All Runbooks</button>
          </div>
        </div>
        <div className="space-y-3 stagger-children">
          {scenarios.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer scenario-hover ${SEVERITY_COLORS[s.severity]?.bg} ${SEVERITY_COLORS[s.severity]?.border}`}
              onClick={() => {
                const rb = runbooks.find(r => r.scenario.id === s.id) || runbooks[i];
                if (rb) { setSelectedRunbook(rb); setView('runbooks'); }
              }}
            >
              <span className="text-reflex-accent text-xs font-mono w-12 shrink-0">{s.id}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.title}</p>
                <p className="text-xs text-reflex-muted truncate">{s.trigger}</p>
                {s.severity_reasoning && (
                  <p className="text-xs text-reflex-text/40 mt-0.5 truncate" title={s.severity_reasoning}>
                    💡 {s.severity_reasoning}
                  </p>
                )}
              </div>
              <span className="text-xs text-reflex-muted font-mono">{s.affected_code}</span>
              <SeverityBadge severity={s.severity} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
