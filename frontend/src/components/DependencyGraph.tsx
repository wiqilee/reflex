import { useState, useMemo } from 'react';
import { useStore, Runbook } from '../hooks/useStore';

const TYPE_COLORS: Record<string, { fill: string; stroke: string; icon: string }> = {
  service: { fill: '#1e3a5f', stroke: '#3b82f6', icon: '⚙️' },
  database: { fill: '#3b1f2b', stroke: '#ef4444', icon: '🗄️' },
  api: { fill: '#2d1f3b', stroke: '#a855f7', icon: '🌐' },
  cache: { fill: '#1f3b2d', stroke: '#22c55e', icon: '⚡' },
  queue: { fill: '#3b2d1f', stroke: '#f97316', icon: '📨' },
  config: { fill: '#2d2d1f', stroke: '#eab308', icon: '⚙️' },
  file: { fill: '#1f2d3b', stroke: '#64748b', icon: '📁' },
};

const REL_COLORS: Record<string, string> = {
  calls: '#3b82f6',
  reads: '#22c55e',
  writes: '#ef4444',
  depends_on: '#f97316',
  publishes: '#a855f7',
  subscribes: '#eab308',
};

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-red-500/15 border-red-500/40 text-red-400',
  high: 'bg-orange-500/12 border-orange-500/35 text-orange-400',
  medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  low: 'bg-green-500/8 border-green-500/25 text-green-400',
};

interface NodePos { x: number; y: number; name: string; type: string; failureModes: string[] }

function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/[\s_\-./]+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.length > 0 ? lines : [text];
}

/** Find runbooks related to a node by matching node name against affected_code, scenario title, description, trigger */
function findRelatedRunbooks(nodeName: string, runbooks: Runbook[]): Runbook[] {
  const name = nodeName.toLowerCase().replace(/[\s_\-./]/g, '');
  return runbooks.filter(rb => {
    const fields = [
      rb.scenario.affected_code,
      rb.scenario.title,
      rb.scenario.description,
      rb.scenario.trigger,
      rb.scenario.impact,
    ].map(f => f.toLowerCase().replace(/[\s_\-./]/g, ''));
    return fields.some(f => f.includes(name) || name.includes(f.split(':')[0]));
  });
}

export default function DependencyGraph() {
  const { analysis, setView, setSelectedNode, setSelectedRunbook } = useStore();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [clickedNode, setClickedNode] = useState<string | null>(null);
  if (!analysis) return null;

  const { nodes, edges } = analysis.dependency_graph;
  const { runbooks } = analysis;

  const positions = useMemo<NodePos[]>(() => {
    const cx = 400, cy = 250;
    const radius = Math.min(180, 60 * nodes.length);
    return nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        name: node.name,
        type: node.type,
        failureModes: node.failure_modes,
      };
    });
  }, [nodes]);

  const getPos = (name: string) => positions.find(p => p.name === name) || { x: 400, y: 250 };

  const hoveredEdges = edges.filter(
    e => e.source === hoveredNode || e.target === hoveredNode
  );

  // Related runbooks for clicked node
  const relatedRunbooks = clickedNode ? findRelatedRunbooks(clickedNode, runbooks) : [];
  const clickedNodeData = clickedNode ? positions.find(p => p.name === clickedNode) : null;

  // Interpretation stats
  const connectionCounts = nodes.map(n => ({
    name: n.name,
    type: n.type,
    outgoing: edges.filter(e => e.source === n.name).length,
    incoming: edges.filter(e => e.target === n.name).length,
    total: edges.filter(e => e.source === n.name || e.target === n.name).length,
  })).sort((a, b) => b.total - a.total);

  const mostConnected = connectionCounts[0];
  const leastConnected = connectionCounts[connectionCounts.length - 1];
  const apiNodes = nodes.filter(n => n.type === 'api').length;
  const serviceNodes = nodes.filter(n => n.type === 'service').length;
  const dbNodes = nodes.filter(n => n.type === 'database').length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => useStore.getState().goBack()} className="text-reflex-muted hover:text-reflex-text text-sm transition-colors">← Back</button>
            <h2 className="text-xl font-bold">Dependency Graph</h2>
          </div>
          <p className="text-reflex-muted text-sm">
            {nodes.length} nodes, {edges.length} connections — hover to explore, click to see related runbooks
          </p>
        </div>
        <button
          onClick={() => setView('blast')}
          className="btn-ghost text-sm border border-reflex-border"
        >
          💥 View Blast Radius →
        </button>
      </div>

      <div className="flex gap-4">
        {/* Graph */}
        <div className={`card p-0 overflow-hidden ${clickedNode ? 'flex-1' : 'w-full'} transition-all duration-300`}>
          <svg viewBox="0 0 800 500" className="w-full h-[500px]">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
              </marker>
              {Object.entries(REL_COLORS).map(([rel, color]) => (
                <marker key={rel} id={`arrow-${rel}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={color} />
                </marker>
              ))}
            </defs>

            {/* Click outside to deselect */}
            <rect width="800" height="500" fill="transparent" onClick={() => setClickedNode(null)} />

            {/* Edges */}
            {edges.map((edge, i) => {
              const from = getPos(edge.source);
              const to = getPos(edge.target);
              const activeNode = hoveredNode || clickedNode;
              const isHovered = activeNode && (edge.source === activeNode || edge.target === activeNode);
              const color = REL_COLORS[edge.relationship] || '#64748b';
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const nx = dx / dist;
              const ny = dy / dist;
              const x1 = from.x + nx * 30;
              const y1 = from.y + ny * 30;
              const x2 = to.x - nx * 40;
              const y2 = to.y - ny * 40;

              return (
                <g key={i}>
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={isHovered ? color : '#2e2e3e'}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    opacity={activeNode ? (isHovered ? 1 : 0.15) : 0.5}
                    markerEnd={`url(#arrow-${edge.relationship})`}
                    className="transition-all duration-200"
                  />
                  {isHovered && (
                    <>
                      <rect
                        x={(x1 + x2) / 2 - 28}
                        y={(y1 + y2) / 2 - 24}
                        width="56" height="14" rx="4"
                        fill="#0a0a12" stroke={color} strokeWidth="0.5" opacity="0.95"
                      />
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 14}
                        fontSize="8"
                        fill={color}
                        textAnchor="middle"
                        className="pointer-events-none"
                        fontWeight="bold"
                        letterSpacing="0.5"
                      >
                        {edge.relationship}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {positions.map((node) => {
              const tc = TYPE_COLORS[node.type] || TYPE_COLORS.service;
              const activeNode = hoveredNode || clickedNode;
              const isActive = activeNode === node.name;
              const activeEdges = edges.filter(e => e.source === activeNode || e.target === activeNode);
              const isConnected = activeNode && activeEdges.some(
                e => e.source === node.name || e.target === node.name
              );
              const opacity = activeNode ? (isActive || isConnected ? 1 : 0.25) : 1;
              const isClicked = clickedNode === node.name;
              const nodeRunbooks = findRelatedRunbooks(node.name, runbooks);
              const hasRunbooks = nodeRunbooks.length > 0;

              return (
                <g
                  key={node.name}
                  className="cursor-pointer transition-all duration-200"
                  style={{ opacity }}
                  onMouseEnter={() => setHoveredNode(node.name)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={(e) => { e.stopPropagation(); setClickedNode(isClicked ? null : node.name); }}
                >
                  {/* Selection ring */}
                  {isClicked && (
                    <circle
                      cx={node.x} cy={node.y} r={36}
                      fill="none" stroke="#f97316" strokeWidth="2"
                      strokeDasharray="4 2" className="animate-spin-slow"
                      style={{ transformOrigin: `${node.x}px ${node.y}px`, animation: 'spin 8s linear infinite' }}
                    />
                  )}
                  {/* Runbook indicator ring */}
                  {hasRunbooks && !isClicked && (
                    <circle
                      cx={node.x} cy={node.y} r={33}
                      fill="none" stroke="#f97316" strokeWidth="1" opacity="0.3"
                      strokeDasharray="3 3"
                    />
                  )}
                  <circle
                    cx={node.x} cy={node.y} r={isActive ? 32 : 28}
                    fill={tc.fill}
                    stroke={isClicked ? '#f97316' : tc.stroke}
                    strokeWidth={isClicked ? 3 : isActive ? 3 : 1.5}
                    className="transition-all duration-200"
                  />
                  <text x={node.x} y={node.y - 2} textAnchor="middle" fontSize="16" className="pointer-events-none">
                    {tc.icon}
                  </text>
                  <text x={node.x} y={node.y + 45} textAnchor="middle" fontSize="10" fill="#94a3b8" className="pointer-events-none">
                    {node.name.length > 22 ? node.name.slice(0, 22) + '...' : node.name}
                  </text>
                  <text x={node.x} y={node.y + 57} textAnchor="middle" fontSize="8" fill="#64748b" className="pointer-events-none">
                    {node.type}{hasRunbooks ? ` · ${nodeRunbooks.length} runbook${nodeRunbooks.length > 1 ? 's' : ''}` : ''}
                  </text>
                </g>
              );
            })}

            {/* Tooltip - only when hovering and NOT the clicked node (clicked node shows side panel) */}
            {hoveredNode && hoveredNode !== clickedNode && (() => {
              const node = positions.find(p => p.name === hoveredNode);
              if (!node) return null;

              const titleLines = wrapText(node.name, 28);
              const fmLines = node.failureModes.map(fm => wrapText(fm, 32)).flat();
              const lineCount = titleLines.length + 1 + fmLines.length;
              const boxH = 26 + lineCount * 14;
              const boxW = 220;

              const connectedDirs: { dx: number; dy: number }[] = [];
              edges.forEach(e => {
                const isConnected = e.source === node.name || e.target === node.name;
                if (!isConnected) return;
                const other = e.source === node.name ? e.target : e.source;
                const otherPos = positions.find(p => p.name === other);
                if (otherPos) connectedDirs.push({ dx: otherPos.x - node.x, dy: otherPos.y - node.y });
              });

              const candidates = [
                { tx: node.x - boxW - 45, ty: node.y - boxH / 2, label: 'left' },
                { tx: node.x + 45, ty: node.y - boxH / 2, label: 'right' },
                { tx: node.x - boxW / 2, ty: node.y - boxH - 55, label: 'top' },
                { tx: node.x - boxW / 2, ty: node.y + 55, label: 'bottom' },
              ];

              const scored = candidates.map(c => {
                const cx = c.tx + boxW / 2;
                const cy = c.ty + boxH / 2;
                const dirFromNode = { dx: cx - node.x, dy: cy - node.y };
                let score = 0;
                connectedDirs.forEach(ed => {
                  const dot = dirFromNode.dx * ed.dx + dirFromNode.dy * ed.dy;
                  const mag1 = Math.sqrt(dirFromNode.dx ** 2 + dirFromNode.dy ** 2);
                  const mag2 = Math.sqrt(ed.dx ** 2 + ed.dy ** 2);
                  if (mag1 > 0 && mag2 > 0) {
                    const cos = dot / (mag1 * mag2);
                    score += (1 - cos);
                  }
                });
                return { ...c, score };
              }).sort((a, b) => b.score - a.score);

              let tx = scored[0].tx;
              let ty = scored[0].ty;
              if (tx + boxW > 790) tx = 790 - boxW;
              if (tx < 5) tx = 5;
              if (ty < 5) ty = 5;
              if (ty + boxH > 495) ty = 495 - boxH;

              let yOffset = 0;

              return (
                <g className="pointer-events-none">
                  <rect x={tx} y={ty} width={boxW} height={boxH} rx="6" fill="#12121a" stroke="#2e2e3e" strokeWidth="1" opacity="0.97" />
                  {titleLines.map((line, i) => (
                    <text key={`t-${i}`} x={tx + 10} y={ty + 16 + i * 13} fontSize="10" fill="#e2e8f0" fontWeight="bold">{line}</text>
                  ))}
                  <text x={tx + 10} y={ty + 16 + titleLines.length * 13 + 8} fontSize="9" fill="#eab308" fontWeight="bold">Failure modes:</text>
                  {(() => {
                    yOffset = ty + 16 + titleLines.length * 13 + 22;
                    return fmLines.map((fm, i) => (
                      <text key={`fm-${i}`} x={tx + 14} y={yOffset + i * 13} fontSize="9" fill="#ef4444">• {fm}</text>
                    ));
                  })()}
                </g>
              );
            })()}
          </svg>
        </div>

        {/* === RELATED RUNBOOKS SIDE PANEL === */}
        {clickedNode && (
          <div className="w-80 shrink-0 space-y-3 animate-fade-in">
            {/* Node info header */}
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{TYPE_COLORS[clickedNodeData?.type || 'service']?.icon}</span>
                  <div>
                    <h3 className="font-bold text-sm">{clickedNode}</h3>
                    <p className="text-xs text-reflex-muted capitalize">{clickedNodeData?.type}</p>
                  </div>
                </div>
                <button onClick={() => setClickedNode(null)} className="text-reflex-muted hover:text-reflex-text text-sm">✕</button>
              </div>

              {/* Failure modes */}
              {clickedNodeData?.failureModes && clickedNodeData.failureModes.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-yellow-400 font-medium">Failure modes:</p>
                  {clickedNodeData.failureModes.map((fm, i) => (
                    <p key={i} className="text-xs text-red-400/80 pl-2">• {fm}</p>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setSelectedNode(clickedNode); setView('blast'); }}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-reflex-accent/15 text-reflex-accent border border-reflex-accent/30 hover:bg-reflex-accent/25 transition-colors"
                >
                  💥 Blast Radius
                </button>
                {relatedRunbooks.length > 0 && (
                  <button
                    onClick={() => { setSelectedRunbook(relatedRunbooks[0]); setView('runbooks'); }}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-reflex-border/50 text-reflex-text/70 border border-reflex-border hover:bg-reflex-border transition-colors"
                  >
                    📋 Top Runbook
                  </button>
                )}
              </div>
            </div>

            {/* Related runbooks list */}
            <div className="card">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                📋 Related Runbooks
                <span className="text-xs text-reflex-muted font-normal">({relatedRunbooks.length})</span>
              </h4>

              {relatedRunbooks.length === 0 ? (
                <p className="text-xs text-reflex-muted py-2">
                  No runbooks directly reference this node. Try the Blast Radius view to see cascade impacts.
                </p>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {relatedRunbooks
                    .sort((a, b) => {
                      const order = { critical: 0, high: 1, medium: 2, low: 3 };
                      return (order[a.scenario.severity as keyof typeof order] ?? 4) - (order[b.scenario.severity as keyof typeof order] ?? 4);
                    })
                    .map(rb => (
                      <div
                        key={rb.id}
                        onClick={() => { setSelectedRunbook(rb); setView('runbooks'); }}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${SEV_BADGE[rb.scenario.severity] || ''}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEV_BADGE[rb.scenario.severity]}`}>
                            {rb.scenario.severity}
                          </span>
                          <span className="text-xs text-reflex-muted font-mono">{rb.scenario.id}</span>
                        </div>
                        <p className="text-xs font-medium text-reflex-text/90 leading-snug">{rb.scenario.title}</p>
                        <p className="text-[11px] text-reflex-text/50 mt-0.5 line-clamp-2">{rb.scenario.trigger}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-reflex-muted">
                          <span>⏱ {rb.estimated_resolution}</span>
                          <span>👤 {rb.on_call_level}</span>
                          <span className="text-reflex-accent ml-auto">View →</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Connected services */}
            <div className="card">
              <h4 className="font-semibold text-sm mb-2">🔗 Connections</h4>
              <div className="space-y-1">
                {edges
                  .filter(e => e.source === clickedNode || e.target === clickedNode)
                  .map((e, i) => {
                    const other = e.source === clickedNode ? e.target : e.source;
                    const direction = e.source === clickedNode ? '→' : '←';
                    const color = REL_COLORS[e.relationship] || '#64748b';
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-reflex-text/60 hover:text-reflex-text/90 cursor-pointer transition-all duration-200 px-2 py-1 rounded-md hover:bg-white/[0.04] hover:translate-x-1"
                        onClick={() => setClickedNode(other)}
                      >
                        <span>{direction}</span>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-mono">{other}</span>
                        <span className="text-reflex-text/30 ml-auto">{e.relationship}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-reflex-muted">
        <span className="font-medium text-reflex-text">Node types:</span>
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.stroke }} />
            {type}
          </span>
        ))}
        <span className="ml-4 font-medium text-reflex-text">Edges:</span>
        {Object.entries(REL_COLORS).map(([rel, color]) => (
          <span key={rel} className="flex items-center gap-1">
            <span className="w-4 h-0.5" style={{ backgroundColor: color }} />
            {rel}
          </span>
        ))}
      </div>

      {/* Interpretation */}
      <div className="card hover:border-reflex-accent/20 hover:bg-reflex-accent/5 transition-all cursor-default">
        <h3 className="font-semibold mb-3 flex items-center gap-2">📊 Graph Interpretation</h3>
        <div className="space-y-3 text-sm text-reflex-text/70 leading-relaxed">
          <p>
            This service architecture consists of <strong className="text-reflex-text">{nodes.length} components</strong> connected by <strong className="text-reflex-text">{edges.length} dependencies</strong>.
            {serviceNodes > 0 && <> It includes <strong className="text-reflex-text">{serviceNodes}</strong> service(s)</>}
            {apiNodes > 0 && <>, <strong className="text-reflex-text">{apiNodes}</strong> external API(s)</>}
            {dbNodes > 0 && <>, and <strong className="text-reflex-text">{dbNodes}</strong> database(s)</>}
            .
          </p>
          {mostConnected && (
            <p>
              <strong className="text-reflex-accent">{mostConnected.name}</strong> is the most connected node with <strong className="text-reflex-text">{mostConnected.total}</strong> total connections ({mostConnected.outgoing} outgoing, {mostConnected.incoming} incoming).
              {mostConnected.total >= 3 && <> This makes it a potential <strong className="text-yellow-400">single point of failure</strong>. Consider adding redundancy or circuit breakers.</>}
            </p>
          )}
          {leastConnected && leastConnected.name !== mostConnected?.name && leastConnected.total <= 1 && (
            <p>
              <strong className="text-green-400">{leastConnected.name}</strong> has the fewest connections ({leastConnected.total}), making it relatively isolated with low cascade risk.
            </p>
          )}
          <p className="text-xs text-reflex-muted">
            Click any node to see related runbooks and connections. Use the Blast Radius view for cascade simulation.
          </p>
        </div>
      </div>
    </div>
  );
}
