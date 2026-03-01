import React, { useState, useEffect } from 'react';
import { useStore, Runbook, RunbookStep } from '../hooks/useStore';

const PHASE_CONFIG = {
  detection: { icon: '🔍', label: 'Detection', color: 'border-blue-500/30', desc: 'How to detect this incident' },
  diagnosis: { icon: '🔬', label: 'Diagnosis', color: 'border-purple-500/30', desc: 'How to find root cause' },
  fix: { icon: '🔧', label: 'Fix / Mitigate', color: 'border-green-500/30', desc: 'How to resolve the issue' },
  rollback: { icon: '⏪', label: 'Rollback', color: 'border-orange-500/30', desc: 'If the fix makes things worse' },
};

const ON_CALL_TOOLTIPS: Record<string, string> = {
  L1: 'L1 — Front-line support: monitoring dashboards, restart services, follow documented procedures',
  L2: 'L2 — Platform engineer: server SSH access, database queries, config changes, deploy rollbacks',
  L3: 'L3 — Infrastructure lead: database admin, network config, DNS changes, cloud IAM, architecture decisions',
  'codebase access': 'Codebase Access — Requires read access to the source code repository to inspect affected files',
  'database access': 'Database Access — Requires read/write access to production database for queries and migrations',
  'admin access': 'Admin Access — Requires administrative privileges on the target infrastructure',
  'read-only': 'Read-Only — Can be performed with read-only access to monitoring and logging systems',
};

function OnCallBadge({ level }: { level: string }) {
  const [show, setShow] = useState(false);

  const normalizedLevel = level.trim();
  const tooltip = ON_CALL_TOOLTIPS[normalizedLevel]
    || ON_CALL_TOOLTIPS[normalizedLevel.toLowerCase()]
    || (normalizedLevel.match(/^L\d/i) ? `${normalizedLevel} — Access level: ${normalizedLevel}` : `🔑 ${normalizedLevel}`);

  const isOnCall = /^L\d/i.test(normalizedLevel);
  const icon = isOnCall ? '🔑' : '🔐';
  const badgeColor = isOnCall
    ? 'bg-reflex-accent/15 text-reflex-accent border-reflex-accent/20 hover:border-reflex-accent/50'
    : 'bg-purple-500/15 text-purple-400 border-purple-500/20 hover:border-purple-500/50';

  // Close tooltip on click anywhere
  useEffect(() => {
    if (!show) return;
    const handler = () => setShow(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [show]);

  return (
    <span className="relative inline-flex items-center">
      <span
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className={`text-xs ${badgeColor} px-2 py-0.5 rounded-full border transition-colors cursor-pointer select-none`}
      >
        {icon} {normalizedLevel}
      </span>
      {show && (
        <span className="absolute left-0 top-full mt-1 px-3 py-2 bg-reflex-surface/95 backdrop-blur-sm border border-white/15 rounded-lg shadow-2xl shadow-black/50 text-xs text-reflex-text/80 w-72 z-[100]">
          {tooltip}
        </span>
      )}
    </span>
  );
}

function StepCard({ step, phase }: { step: RunbookStep; phase: string }) {
  const [copied, setCopied] = useState(false);
  const copyCmd = () => {
    if (step.command) {
      navigator.clipboard.writeText(step.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border-l-2 border-reflex-border pl-4 py-2 ml-3 hover:border-reflex-accent transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs bg-reflex-accent/20 text-reflex-accent px-2.5 py-0.5 rounded-full font-mono font-bold">Step {step.order}</span>
            {step.estimated_time && <span className="text-xs text-reflex-text/50">⏱ {step.estimated_time}</span>}
            {step.access_required && <OnCallBadge level={step.access_required} />}
          </div>
          <p className="text-sm text-reflex-text/90">{step.action}</p>
        </div>
      </div>

      {step.command && (
        <div className="mt-2 relative group">
          <pre className="bg-black/40 rounded-lg p-3 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap">{step.command}</pre>
          <button
            onClick={copyCmd}
            className="absolute top-2 right-2 text-xs bg-reflex-border hover:bg-reflex-accent/30 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copied ? '✅ Copied' : '📋 Copy'}
          </button>
        </div>
      )}

      {step.expected_output && (
        <p className="text-xs text-reflex-text/60 mt-1.5">
          <span className="text-green-400/70">Expected:</span> {step.expected_output}
        </p>
      )}

      {step.warning && (
        <p className="text-xs text-yellow-400 mt-1.5 flex items-center gap-1">
          ⚠️ {step.warning}
        </p>
      )}
    </div>
  );
}

function RunbookDetail({ runbook }: { runbook: Runbook }) {
  const [activePhase, setActivePhase] = useState<keyof typeof PHASE_CONFIG>('detection');
  const [exporting, setExporting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showLangs, setShowLangs] = useState(false);
  const steps = runbook[activePhase] as RunbookStep[];

  const LANGUAGES: Record<string, string> = {
    id: '🇮🇩 Indonesian', es: '🇪🇸 Spanish', fr: '🇫🇷 French', de: '🇩🇪 German',
    pt: '🇧🇷 Portuguese', ja: '🇯🇵 Japanese', ko: '🇰🇷 Korean', zh: '🇨🇳 Chinese',
  };

  // Close language dropdown on click outside
  useEffect(() => {
    if (!showLangs) return;
    const handler = () => setShowLangs(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showLangs]);

  const exportMarkdown = () => {
    const s = runbook.scenario;
    let md = `# 🚨 ${s.title}\n\n`;
    md += `> **Severity:** ${s.severity.toUpperCase()} | **On-Call:** ${runbook.on_call_level} | **Est:** ${runbook.estimated_resolution}\n\n`;
    md += `**What:** ${s.description}\n\n**Trigger:** ${s.trigger}\n\n**Impact:** ${s.impact}\n\n---\n\n`;

    const phases = { detection: '🔍 Detection', diagnosis: '🔬 Diagnosis', fix: '🔧 Fix', rollback: '⏪ Rollback' };
    for (const [key, label] of Object.entries(phases)) {
      const steps = (runbook as any)[key] as RunbookStep[];
      md += `## ${label}\n\n`;
      for (const step of steps) {
        md += `**Step ${step.order}** ${step.estimated_time ? `(⏱ ${step.estimated_time})` : ''}\n\n`;
        md += `${step.action}\n\n`;
        if (step.command) md += `\`\`\`bash\n${step.command}\n\`\`\`\n\n`;
        if (step.expected_output) md += `✅ **Expected:** ${step.expected_output}\n\n`;
        if (step.warning) md += `⚠️ **Warning:** ${step.warning}\n\n`;
      }
      md += '---\n\n';
    }

    md += `## 🛡️ Prevention\n\n`;
    runbook.prevention.forEach((p, i) => { md += `${i + 1}. ${p}\n`; });
    md += `\n\n*Generated by REFLEX — AI Incident Runbook Generator · © 2026 Wiqi Lee*\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runbook-${s.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(true);
    setTimeout(() => setExporting(false), 2000);
  };

  const translateRunbook = async (lang: string) => {
    setTranslating(true);
    setShowLangs(false);
    try {
      const res = await fetch(`/api/v1/translate?lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '', filename: 'translated.py', language: 'python' }),
      });
      if (res.ok) {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `runbook-${lang}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error(e); }
    setTranslating(false);
  };

  const sevColor = {
    critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-green-400'
  }[runbook.scenario.severity] || 'text-reflex-muted';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="card border-l-4 border-l-reflex-accent transition-all duration-300 hover:border-reflex-accent/40 hover:bg-reflex-accent/5 cursor-default">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">{runbook.scenario.title}</h3>
            <p className="text-sm text-reflex-text/65 mt-1">{runbook.scenario.description}</p>
            {runbook.scenario.severity_reasoning && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-reflex-text/50 bg-reflex-border/20 rounded-lg px-3 py-2">
                <span className="shrink-0 mt-0.5">💡</span>
                <span><strong className="text-reflex-text/70">Why {runbook.scenario.severity}:</strong> {runbook.scenario.severity_reasoning}</span>
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <span className={`text-lg font-bold ${sevColor} uppercase`}>{runbook.scenario.severity}</span>
            <div className="text-xs text-reflex-muted mt-1 space-y-0.5">
              <p>⏱ {runbook.estimated_resolution}</p>
              <div className="flex items-center justify-end gap-1">
                <span>👤</span>
                <OnCallBadge level={runbook.on_call_level} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-4 text-xs text-reflex-text/50">
            <span>📁 {runbook.scenario.affected_code}</span>
            <span><strong className="text-reflex-text/70">Trigger:</strong> {runbook.scenario.trigger}</span>
          </div>
          <div className="flex gap-2 relative">
            <button onClick={exportMarkdown} className="btn-ghost text-xs border border-reflex-border">
              {exporting ? '✅ Saved!' : '📥 Export .md'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowLangs(!showLangs); }} disabled={translating} className="btn-ghost text-xs border border-reflex-border">
              {translating ? '⏳ Translating...' : '🌐 Translate'}
            </button>
            {showLangs && (
              <div className="absolute top-full right-0 mt-1 bg-reflex-surface border border-reflex-border rounded-lg shadow-xl z-50 p-2 grid grid-cols-2 gap-1 min-w-[250px]" onClick={(e) => e.stopPropagation()}>
                {Object.entries(LANGUAGES).map(([code, label]) => (
                  <button key={code} onClick={() => translateRunbook(code)} className="text-left text-xs px-2 py-1.5 rounded hover:bg-reflex-border transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase Tabs */}
      <div className="flex gap-2 p-1 bg-reflex-border/20 rounded-xl border border-reflex-border/40">
        {(Object.keys(PHASE_CONFIG) as Array<keyof typeof PHASE_CONFIG>).map(phase => {
          const conf = PHASE_CONFIG[phase];
          const count = (runbook[phase] as RunbookStep[]).length;
          const phaseColors: Record<string, string> = {
            detection: 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-blue-500/10',
            diagnosis: 'border-purple-500/50 bg-purple-500/10 text-purple-400 shadow-purple-500/10',
            fix: 'border-green-500/50 bg-green-500/10 text-green-400 shadow-green-500/10',
            rollback: 'border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-orange-500/10',
          };
          return (
            <button
              key={phase}
              onClick={() => setActivePhase(phase)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                activePhase === phase
                  ? `border ${phaseColors[phase]} shadow-lg`
                  : 'text-reflex-text/40 hover:text-reflex-text/70 hover:bg-white/[0.03]'
              }`}
            >
              {conf.icon} {conf.label} <span className="text-xs opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Steps */}
      <div className="card">
        <p className="text-xs text-reflex-text/70 mb-4 font-bold">{PHASE_CONFIG[activePhase].desc}</p>
        <div className="space-y-4">
          {steps.map((step) => (
            <StepCard key={step.order} step={step} phase={activePhase} />
          ))}
        </div>
      </div>

      {/* Prevention */}
      {runbook.prevention.length > 0 && (
        <div className="card">
          <h4 className="font-semibold mb-3 flex items-center gap-2">🛡️ Long-term Prevention</h4>
          <div className="space-y-1">
            {runbook.prevention.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-reflex-text/75 prevention-hover">
                <span className="text-reflex-accent mt-0.5 shrink-0">→</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RunbookViewer() {
  const { analysis, selectedRunbook, setSelectedRunbook, setView, prevView } = useStore();
  if (!analysis) return null;

  const { runbooks } = analysis;

  if (selectedRunbook) {
    const currentIdx = runbooks.findIndex(r => r.id === selectedRunbook.id);
    const hasPrev = currentIdx > 0;
    const hasNext = currentIdx < runbooks.length - 1;

    // Check if user came from dependencies page
    const cameFromGraph = prevView === 'graph';

    return (
      <div className="space-y-4">
        {/* Navigation bar — top: back button only */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (cameFromGraph) {
                // Go back to dependencies
                setSelectedRunbook(null);
                setView('graph');
              } else {
                setSelectedRunbook(null);
              }
            }}
            className="group flex items-center gap-2 px-4 py-2.5 rounded-xl border border-reflex-accent/40 text-reflex-accent font-medium hover:bg-reflex-accent/10 hover:border-reflex-accent hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {cameFromGraph ? '← Back to Dependencies' : 'All Runbooks'}
          </button>
        </div>

        <RunbookDetail runbook={selectedRunbook} />

        {/* Navigation — bottom: "1 of N" with prev/next */}
        <div className="flex items-center justify-center gap-3 pt-2 pb-4">
          <button
            onClick={() => hasPrev && setSelectedRunbook(runbooks[currentIdx - 1])}
            disabled={!hasPrev}
            className={`p-2 rounded-lg border transition-all ${hasPrev ? 'border-reflex-border/50 text-reflex-text/60 hover:border-reflex-accent/50 hover:text-reflex-accent hover:bg-reflex-accent/5' : 'border-reflex-border/20 text-reflex-text/15 cursor-not-allowed'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-xs text-reflex-text/40">{currentIdx + 1} of {runbooks.length}</span>
          <button
            onClick={() => hasNext && setSelectedRunbook(runbooks[currentIdx + 1])}
            disabled={!hasNext}
            className={`p-2 rounded-lg border transition-all ${hasNext ? 'border-reflex-border/50 text-reflex-text/60 hover:border-reflex-accent/50 hover:text-reflex-accent hover:bg-reflex-accent/5' : 'border-reflex-border/20 text-reflex-text/15 cursor-not-allowed'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold">Incident Runbooks</h2>
        <p className="text-reflex-muted text-sm">{runbooks.length} runbooks generated — click to view details</p>
      </div>

      <div className="grid gap-3">
        {runbooks.map((rb) => {
          const sevColor = {
            critical: 'border-l-red-500 bg-red-500/5',
            high: 'border-l-orange-500 bg-orange-500/5',
            medium: 'border-l-yellow-500 bg-yellow-500/5',
            low: 'border-l-green-500 bg-green-500/5',
          }[rb.scenario.severity] || '';

          return (
            <div
              key={rb.id}
              onClick={() => setSelectedRunbook(rb)}
              className={`card border-l-4 cursor-pointer runbook-card-hover ${sevColor}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{rb.scenario.title}</h3>
                  <p className="text-xs text-reflex-muted mt-1">{rb.scenario.trigger}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-reflex-muted">
                  <span>⏱ {rb.estimated_resolution}</span>
                  <OnCallBadge level={rb.on_call_level} />
                  <span className="text-reflex-accent">View →</span>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-reflex-muted">
                <span>🔍 {rb.detection.length} detection steps</span>
                <span>🔧 {rb.fix.length} fix steps</span>
                <span>⏪ {rb.rollback.length} rollback steps</span>
                <span>🛡️ {rb.prevention.length} preventions</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
