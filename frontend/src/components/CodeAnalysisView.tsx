import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore, FailureScenario, Severity } from '../hooks/useStore';

const SEV_COLORS: Record<Severity, { bg: string; border: string; gutter: string; text: string; hover: string }> = {
  critical: { bg: 'bg-red-500/15', border: 'border-red-500/40', gutter: 'bg-red-500', text: 'text-red-400', hover: 'hover:bg-red-500/25' },
  high:     { bg: 'bg-orange-500/12', border: 'border-orange-500/35', gutter: 'bg-orange-500', text: 'text-orange-400', hover: 'hover:bg-orange-500/20' },
  medium:   { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', gutter: 'bg-yellow-500', text: 'text-yellow-400', hover: 'hover:bg-yellow-500/18' },
  low:      { bg: 'bg-green-500/8', border: 'border-green-500/25', gutter: 'bg-green-500', text: 'text-green-400', hover: 'hover:bg-green-500/15' },
};

/** Parse affected_code to extract line numbers or function names */
function parseAffectedCode(affected: string, codeLines: string[]): number[] {
  const lines: number[] = [];

  // Pattern: "file.py:L25" or "file.py:L25-L40" or "file:L25-40"
  const lineMatch = affected.match(/:L?(\d+)(?:\s*-\s*L?(\d+))?/i);
  if (lineMatch) {
    const start = parseInt(lineMatch[1]);
    const end = lineMatch[2] ? parseInt(lineMatch[2]) : start;
    for (let i = start; i <= end; i++) lines.push(i);
    return lines;
  }

  // Pattern: "file.py:function_name" — search for function/def/fn/func/class in code
  const funcMatch = affected.match(/:([a-zA-Z_]\w+)\s*$/);
  if (funcMatch) {
    const funcName = funcMatch[1];
    const patterns = [
      new RegExp(`\\b(?:def|function|func|fn|pub\\s+fn|async\\s+fn|pub\\s+async\\s+fn|class|public|private|protected)\\s+${funcName}\\b`),
      new RegExp(`\\b${funcName}\\s*[=(]`),
      new RegExp(`\\.${funcName}\\s*\\(`),
    ];

    for (let i = 0; i < codeLines.length; i++) {
      for (const pat of patterns) {
        if (pat.test(codeLines[i])) {
          // Include function definition + body (next ~15 lines or until next function)
          lines.push(i + 1); // 1-indexed
          for (let j = i + 1; j < Math.min(i + 20, codeLines.length); j++) {
            // Stop at next function definition (heuristic)
            if (j > i + 1 && /^\s{0,4}(?:def |function |func |fn |pub fn |class |@app\.|@router\.)/.test(codeLines[j])) break;
            lines.push(j + 1);
          }
          return lines;
        }
      }
    }

    // Fallback: fuzzy search for the function name anywhere
    for (let i = 0; i < codeLines.length; i++) {
      if (codeLines[i].includes(funcName)) {
        lines.push(i + 1);
      }
    }
  }

  return lines;
}

/** Build a map: lineNumber → [scenarios affecting this line] */
function buildLineMap(scenarios: FailureScenario[], codeLines: string[]): Map<number, FailureScenario[]> {
  const map = new Map<number, FailureScenario[]>();
  for (const scenario of scenarios) {
    const affectedLines = parseAffectedCode(scenario.affected_code, codeLines);
    for (const line of affectedLines) {
      if (!map.has(line)) map.set(line, []);
      map.get(line)!.push(scenario);
    }
  }
  return map;
}

/** Get the highest severity from a list of scenarios */
function getHighestSeverity(scenarios: FailureScenario[]): Severity {
  const order: Severity[] = ['critical', 'high', 'medium', 'low'];
  for (const sev of order) {
    if (scenarios.some(s => s.severity === sev)) return sev;
  }
  return 'low';
}

interface TooltipData {
  scenarios: FailureScenario[];
  x: number;
  y: number;
  line: number;
}

export default function CodeAnalysisView() {
  const { analysis, setView, setSelectedRunbook, analyzedCode } = useStore();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!analysis || !analyzedCode) return null;

  const codeLines = analyzedCode.code.split('\n');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const lineMap = useMemo(
    () => buildLineMap(analysis.scenarios, codeLines),
    [analysis.scenarios, analyzedCode.code]
  );

  // Stats for summary
  const affectedLineCount = lineMap.size;
  const totalLines = codeLines.length;
  const criticalLines = [...lineMap.entries()].filter(([_, s]) => getHighestSeverity(s) === 'critical').length;

  const handleLineClick = (line: number) => {
    const scenarios = lineMap.get(line);
    if (!scenarios?.length) return;

    // Jump to the first (highest severity) scenario's runbook
    const sorted = [...scenarios].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });

    const targetScenario = sorted[0];
    const rb = analysis.runbooks.find(r => r.scenario.id === targetScenario.id);
    if (rb) {
      setSelectedRunbook(rb);
      setView('runbooks');
    }
  };

  const handleLineHover = (e: React.MouseEvent, line: number) => {
    const scenarios = lineMap.get(line);
    if (!scenarios?.length) {
      setTooltip(null);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setTooltip({
      scenarios,
      x: Math.min(e.clientX - rect.left, rect.width - 320),
      y: e.clientY - rect.top - 40,
      line,
    });
    setHighlightLine(line);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🔍 Code Analysis View
            <span className="text-xs font-mono bg-reflex-border/40 px-2 py-0.5 rounded-md text-reflex-muted">
              {analyzedCode.filename} · {analyzedCode.language}
            </span>
          </h2>
          <p className="text-reflex-muted text-sm">
            {affectedLineCount} lines with issues out of {totalLines} total
            {criticalLines > 0 && <span className="text-red-400 font-medium"> · {criticalLines} critical</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('dashboard')}
            className="btn-ghost text-sm border border-reflex-border"
          >
            ← Dashboard
          </button>
          <button
            onClick={() => setView('runbooks')}
            className="btn-ghost text-sm border border-reflex-accent/40 text-reflex-accent"
          >
            View Runbooks →
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-reflex-text/50">Click highlighted lines to jump to runbook:</span>
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => (
          <span key={sev} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${SEV_COLORS[sev].gutter}`} />
            <span className={SEV_COLORS[sev].text}>{sev}</span>
          </span>
        ))}
      </div>

      {/* Code Viewer */}
      <div
        ref={containerRef}
        className="card p-0 overflow-hidden relative"
      >
        {/* File header */}
        <div className="flex items-center justify-between px-4 py-2 bg-reflex-border/30 border-b border-reflex-border">
          <span className="text-xs text-reflex-muted font-mono flex items-center gap-2">
            📁 {analyzedCode.filename}
            <span className="text-reflex-text/30">·</span>
            <span className="text-reflex-text/40">{analyzedCode.language}</span>
          </span>
          <span className="text-xs text-reflex-muted">
            {totalLines} lines · {affectedLineCount} flagged
          </span>
        </div>

        {/* Code with line numbers + gutter */}
        <div className="overflow-auto max-h-[600px] relative font-mono text-sm leading-6">
          {codeLines.map((line, idx) => {
            const lineNum = idx + 1;
            const scenarios = lineMap.get(lineNum);
            const hasSeverity = scenarios && scenarios.length > 0;
            const severity = hasSeverity ? getHighestSeverity(scenarios) : null;
            const colors = severity ? SEV_COLORS[severity] : null;
            const isHighlighted = highlightLine === lineNum;

            return (
              <div
                key={lineNum}
                className={`flex group transition-colors duration-150 ${
                  hasSeverity
                    ? `${colors!.bg} ${colors!.hover} cursor-pointer border-l-2 ${colors!.border}`
                    : 'border-l-2 border-transparent hover:bg-white/[0.02]'
                } ${isHighlighted ? 'ring-1 ring-inset ring-reflex-accent/30' : ''}`}
                onMouseEnter={(e) => handleLineHover(e, lineNum)}
                onMouseLeave={() => { setTooltip(null); setHighlightLine(null); }}
                onClick={() => handleLineClick(lineNum)}
              >
                {/* Line number */}
                <span className="w-12 flex-shrink-0 text-right pr-2 text-reflex-text/25 select-none text-xs leading-6 py-0">
                  {lineNum}
                </span>

                {/* Severity gutter dot */}
                <span className="w-6 flex-shrink-0 flex items-center justify-center">
                  {hasSeverity && (
                    <span
                      className={`w-2 h-2 rounded-full ${colors!.gutter} ${
                        severity === 'critical' ? 'animate-pulse' : ''
                      }`}
                    />
                  )}
                </span>

                {/* Code content */}
                <span className="flex-1 pr-4 whitespace-pre overflow-x-auto text-reflex-text/85">
                  {line || '\u00A0'}
                </span>

                {/* Inline scenario count badge */}
                {hasSeverity && scenarios.length > 0 && (
                  <span className={`flex-shrink-0 self-center mr-3 text-xs px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${colors!.bg} ${colors!.text} border ${colors!.border}`}>
                    {scenarios.length} {scenarios.length === 1 ? 'issue' : 'issues'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="bg-reflex-surface/95 backdrop-blur-xl border border-reflex-border rounded-xl shadow-2xl shadow-black/40 p-3 w-80">
              <div className="text-xs text-reflex-text/40 mb-2 flex items-center justify-between">
                <span>Line {tooltip.line}</span>
                <span>{tooltip.scenarios.length} {tooltip.scenarios.length === 1 ? 'issue' : 'issues'}</span>
              </div>
              <div className="space-y-2">
                {tooltip.scenarios
                  .sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 };
                    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
                  })
                  .map((s) => {
                    const c = SEV_COLORS[s.severity];
                    return (
                      <div key={s.id} className={`${c.bg} ${c.border} border rounded-lg p-2`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${c.gutter}`} />
                          <span className={`text-xs font-bold uppercase ${c.text}`}>{s.severity}</span>
                          <span className="text-xs text-reflex-text/40 font-mono">{s.id}</span>
                        </div>
                        <p className="text-xs font-medium text-reflex-text/90">{s.title}</p>
                        <p className="text-xs text-reflex-text/50 mt-0.5 line-clamp-2">{s.trigger}</p>
                        {s.severity_reasoning && (
                          <p className="text-xs text-reflex-text/40 mt-1 line-clamp-2 italic">💡 {s.severity_reasoning}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
              <p className="text-xs text-center mt-2.5"><span className="inline-block px-3 py-1 rounded-full bg-reflex-accent/15 text-reflex-accent font-medium border border-reflex-accent/25 hover:bg-reflex-accent/25 transition-colors">View Runbook</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Summary panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => {
          const count = analysis.scenarios.filter(s => s.severity === sev).length;
          const c = SEV_COLORS[sev];
          const gradients: Record<string, string> = {
            critical: 'from-red-500/20 via-red-600/5 to-transparent border-red-500/40 shadow-red-500/10',
            high: 'from-orange-500/20 via-orange-600/5 to-transparent border-orange-500/40 shadow-orange-500/10',
            medium: 'from-yellow-500/20 via-yellow-600/5 to-transparent border-yellow-500/40 shadow-yellow-500/10',
            low: 'from-green-500/20 via-green-600/5 to-transparent border-green-500/40 shadow-green-500/10',
          };
          return (
            <div key={sev} className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradients[sev]} shadow-lg text-center py-4 transition-all duration-300 hover:scale-[1.03] cursor-default`}>
              <p className={`text-3xl font-black ${c.text}`}>{count}</p>
              <p className="text-xs text-reflex-text/50 uppercase tracking-wider mt-1 font-bold">{sev}</p>
              {count > 0 && <div className={`absolute top-0 left-0 w-full h-0.5 ${c.gutter}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
