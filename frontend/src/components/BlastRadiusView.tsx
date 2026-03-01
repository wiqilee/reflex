import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';

interface BlastResult {
  origin: string;
  affected: string[];
  depth: number;
  users: number;
  severity: string;
}

export default function BlastRadiusView() {
  const { analysis, selectedNode, setSelectedNode } = useStore();

  if (!analysis) return null;

  const { nodes, edges } = analysis.dependency_graph;

  const blastResults = useMemo<BlastResult[]>(() => {
    return nodes.map(node => {
      const visited = new Set<string>([node.name]);
      const queue = [node.name];
      let depth = 0;

      while (queue.length > 0) {
        const batch = [...queue];
        queue.length = 0;
        for (const current of batch) {
          for (const edge of edges) {
            if (edge.source === current && !visited.has(edge.target)) {
              visited.add(edge.target);
              queue.push(edge.target);
            }
          }
        }
        if (queue.length > 0) depth++;
      }

      const affected = [...visited].filter(n => n !== node.name);
      const users = affected.length * 15000 + 10000;
      const severity = affected.length >= 3 ? 'critical'
        : affected.length >= 2 ? 'high'
        : affected.length >= 1 ? 'medium' : 'low';

      return { origin: node.name, affected, depth, users, severity };
    }).sort((a, b) => b.affected.length - a.affected.length);
  }, [nodes, edges]);

  const selected = selectedNode
    ? blastResults.find(b => b.origin === selectedNode)
    : null;

  const sevColors: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    low: 'text-green-400 bg-green-500/10 border-green-500/30',
  };

  const ringColors: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
  };

  // Find the most dangerous node for interpretation
  const mostDangerous = blastResults[0];
  const totalNodes = nodes.length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => useStore.getState().goBack()} className="text-reflex-muted hover:text-reflex-text text-sm transition-colors">← Back</button>
            <h2 className="text-xl font-bold">💥 Blast Radius Calculator</h2>
          </div>
          <p className="text-reflex-muted text-sm mt-1">
            What happens when a node goes down? Select a service to see the cascade impact.
          </p>
        </div>
      </div>

      {/* Node selector grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {blastResults.map((b) => (
          <button
            key={b.origin}
            onClick={() => setSelectedNode(b.origin)}
            className={`card text-left hover-card ${
              selectedNode === b.origin ? 'ring-2 ring-reflex-accent glow' : ''
            }`}
          >
            <p className="font-medium text-sm truncate" title={b.origin}>{b.origin}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${sevColors[b.severity]}`}>
                {b.severity}
              </span>
            </div>
            <div className="flex justify-between mt-2 text-xs text-reflex-muted">
              <span>{b.affected.length} nodes hit</span>
              <span>depth {b.depth}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Blast visualization */}
      {selected && (
        <div className="card animate-fade-in">
          {/* FIXED: full text, no truncation, word-wrap */}
          <div className="flex items-start justify-between mb-4 gap-4">
            <h3 className="font-bold text-lg leading-snug">
              If <span className="text-reflex-accent break-all">{selected.origin}</span> goes down...
            </h3>
            <span className={`text-xs px-3 py-1 rounded-full border font-medium uppercase whitespace-nowrap shrink-0 ${sevColors[selected.severity]}`}>
              {selected.severity} impact
            </span>
          </div>

          {/* SVG */}
          <div className="flex justify-center py-6">
            <svg viewBox="0 0 600 600" className="w-full max-w-[560px] h-auto" style={{ minHeight: '420px' }}>
              <defs>
                <radialGradient id="blastGrad" cx="50%" cy="50%">
                  <stop offset="0%" stopColor={ringColors[selected.severity]} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={ringColors[selected.severity]} stopOpacity="0" />
                </radialGradient>
              </defs>

              <circle cx="300" cy="300" r={Math.min(selected.depth + 1, 3) * 80 + 20} fill="url(#blastGrad)" />

              {[3, 2, 1].map(ring => (
                <circle key={ring} cx="300" cy="300" r={ring * 80} fill="none" stroke={ringColors[selected.severity]} strokeWidth="1" opacity={0.15 + (3 - ring) * 0.05} strokeDasharray="6 4" />
              ))}

              {selected.affected.map((name, i) => {
                const total = selected.affected.length;
                const angle = (2 * Math.PI * i) / Math.max(total, 1) - Math.PI / 2;
                const ringLevel = Math.floor(i / Math.max(Math.ceil(total / 2), 1));
                const dist = 130 + ringLevel * 70;
                const x = 300 + dist * Math.cos(angle);
                const y = 300 + dist * Math.sin(angle);
                return <line key={`line-${name}`} x1="300" y1="300" x2={x} y2={y} stroke={ringColors[selected.severity]} strokeWidth="1.5" opacity="0.3" strokeDasharray="5 4" />;
              })}

              <circle cx="300" cy="300" r="50" fill="#1a1d27" stroke={ringColors[selected.severity]} strokeWidth="3" />
              <text x="300" y="288" textAnchor="middle" fontSize="20" className="pointer-events-none">💥</text>
              <text x="300" y="308" textAnchor="middle" fontSize={selected.origin.length > 14 ? '8' : '10'} fill="#f1f5f9" fontWeight="bold" className="pointer-events-none">
                {selected.origin.length > 14 ? selected.origin.slice(0, 14) + '..' : selected.origin}
              </text>

              {selected.affected.map((name, i) => {
                const total = selected.affected.length;
                const angle = (2 * Math.PI * i) / Math.max(total, 1) - Math.PI / 2;
                const ringLevel = Math.floor(i / Math.max(Math.ceil(total / 2), 1));
                const dist = 130 + ringLevel * 70;
                const x = 300 + dist * Math.cos(angle);
                const y = 300 + dist * Math.sin(angle);
                return (
                  <g key={name}>
                    <circle cx={x} cy={y} r="40" fill="#1a1d27" stroke="#ef4444" strokeWidth="2" opacity="0.9" />
                    <text x={x} y={y - 6} textAnchor="middle" fontSize="14" className="pointer-events-none">💀</text>
                    <text x={x} y={y + 12} textAnchor="middle" fontSize={name.length > 12 ? '8' : '9'} fill="#cbd5e1" fontWeight="600" className="pointer-events-none">
                      {name.length > 12 ? name.slice(0, 12) + '..' : name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Impact stats */}
          <div className="grid grid-cols-4 gap-4 mt-2">
            <div className="text-center card py-4 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 hover:scale-[1.03]">
              <p className="text-3xl font-black text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{selected.affected.length}</p>
              <p className="text-xs text-red-300/60 font-bold uppercase tracking-wider mt-1">Nodes affected</p>
            </div>
            <div className="text-center card py-4 border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 hover:scale-[1.03]">
              <p className="text-3xl font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]">{selected.depth}</p>
              <p className="text-xs text-orange-300/60 font-bold uppercase tracking-wider mt-1">Cascade depth</p>
            </div>
            <div className="text-center card py-4 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:shadow-lg hover:shadow-yellow-500/10 transition-all duration-300 hover:scale-[1.03]">
              <p className="text-3xl font-black text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]">{(selected.users / 1000).toFixed(0)}k</p>
              <p className="text-xs text-yellow-300/60 font-bold uppercase tracking-wider mt-1">Users impacted</p>
            </div>
            <div className="text-center card py-4 border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10 hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10 transition-all duration-300 hover:scale-[1.03]">
              <p className="text-3xl font-black text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]">
                {((selected.affected.length / Math.max(totalNodes - 1, 1)) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-pink-300/60 font-bold uppercase tracking-wider mt-1">System affected</p>
            </div>
          </div>

          {/* Interpretation */}
          <div className="mt-4 p-4 rounded-lg bg-reflex-border/20 border border-reflex-border hover:border-reflex-accent/30 hover:bg-reflex-accent/5 transition-all cursor-default">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">📊 Interpretation</h4>
            <p className="text-sm text-reflex-text/70 leading-relaxed">
              {selected.severity === 'critical' && (
                <>Taking down <strong className="text-red-400">{selected.origin}</strong> would cascade to <strong className="text-red-400">{selected.affected.length}</strong> other services, affecting approximately <strong className="text-red-400">{(selected.users / 1000).toFixed(0)}k users</strong>. This is a <strong className="text-red-400">critical single point of failure</strong> that requires immediate redundancy and failover mechanisms. At {((selected.affected.length / Math.max(totalNodes - 1, 1)) * 100).toFixed(0)}% system impact, this node should be the highest priority for resilience engineering.</>
              )}
              {selected.severity === 'high' && (
                <>Failure of <strong className="text-orange-400">{selected.origin}</strong> impacts <strong className="text-orange-400">{selected.affected.length}</strong> downstream services. While not the most critical node, it still represents a significant risk. Consider adding circuit breakers and health checks to minimize cascade propagation.</>
              )}
              {selected.severity === 'medium' && (
                <>If <strong className="text-yellow-400">{selected.origin}</strong> fails, <strong className="text-yellow-400">{selected.affected.length}</strong> service(s) would be affected. This is a moderate risk. Ensure proper error handling and graceful degradation are in place for dependent services.</>
              )}
              {selected.severity === 'low' && (
                <>Node <strong className="text-green-400">{selected.origin}</strong> has minimal downstream impact. {selected.affected.length === 0 ? 'No other services depend on it directly.' : `Only ${selected.affected.length} service(s) affected.`} This is a leaf node with low blast radius.</>
              )}
            </p>
          </div>

          {/* Cascade chain */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2 text-reflex-text/70">Cascade chain:</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-reflex-accent/20 text-reflex-accent px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-reflex-accent/30 hover:scale-105 transition-all cursor-default">
                {selected.origin}
              </span>
              {selected.affected.map((name, idx) => (
                <span key={name} className="flex items-center gap-2" style={{ animationDelay: `${idx * 150}ms` }}>
                  <span className="text-white/70 font-bold text-lg animate-pulse">→</span>
                  <span className="bg-red-500/15 text-red-400 px-3 py-1.5 rounded-lg text-sm hover:bg-red-500/25 hover:scale-105 transition-all cursor-default">
                    {name}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="card">
        <h3 className="font-semibold mb-3">Impact Heatmap</h3>
        <p className="text-xs text-reflex-muted mb-4">Nodes sorted by blast radius size — bigger = more dangerous</p>
        <div className="space-y-2">
          {blastResults.map((b) => {
            const pct = (b.affected.length / Math.max(totalNodes - 1, 1)) * 100;
            const barColor = b.severity === 'critical' ? 'heatmap-bar-critical'
              : b.severity === 'high' ? 'heatmap-bar-high'
              : b.severity === 'medium' ? 'heatmap-bar-medium' : 'heatmap-bar-low';

            return (
              <div
                key={b.origin}
                className="flex items-center gap-3 cursor-pointer hover:bg-reflex-accent/5 rounded-lg p-2 transition-all scenario-hover"
                onClick={() => setSelectedNode(b.origin)}
              >
                <span className="text-sm w-44 truncate font-mono" title={b.origin}>{b.origin}</span>
                <div className="flex-1 h-6 bg-reflex-border rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor} flex items-center justify-end pr-2`}
                    style={{ width: `${Math.max(pct, 5)}%`, minWidth: pct > 0 ? '48px' : '24px' }}
                  >
                    <span className="text-[10px] font-bold text-gray-900/80 drop-shadow-sm">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <span className="text-xs text-reflex-muted w-20 text-right">
                  {b.affected.length} nodes
                </span>
                <span className={`text-xs w-16 text-right font-medium ${
                  b.severity === 'critical' ? 'text-red-400'
                  : b.severity === 'high' ? 'text-orange-400'
                  : b.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {b.severity}
                </span>
              </div>
            );
          })}
        </div>

        {/* Heatmap interpretation */}
        {mostDangerous && mostDangerous.affected.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-reflex-border/20 border border-reflex-border transition-all duration-300 hover:border-red-500/30 hover:bg-red-500/[0.04] hover:shadow-lg hover:shadow-red-500/5 cursor-default">
            <p className="text-xs text-reflex-text/65">
              <strong className="text-reflex-accent">{mostDangerous.origin}</strong> has the largest blast radius at{' '}
              <strong>{((mostDangerous.affected.length / Math.max(totalNodes - 1, 1)) * 100).toFixed(0)}%</strong> system coverage.
              {mostDangerous.affected.length >= 3 && ' This is a critical single point of failure that should be prioritized for redundancy.'}
              {mostDangerous.affected.length >= 1 && mostDangerous.affected.length < 3 && ' Consider adding failover mechanisms to reduce cascade risk.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
