import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { useAnalysis } from '../hooks/useAnalysis';
import { DEMO_CODE } from '../data/demo';
import { DEMO_SNIPPETS } from '../data/demoSnippets';

const LANG_OPTIONS = DEMO_SNIPPETS.map(s => ({
  key: s.language,
  icon: s.language === 'python' ? '🐍' : s.language === 'go' ? '🔵' : s.language === 'rust' ? '🦀' : s.language === 'java' ? '☕' : s.language === 'typescript' ? '🔷' : '🐳',
  label: s.language.charAt(0).toUpperCase() + s.language.slice(1),
  filename: s.filename,
}));

// Map language → default file extension
const LANG_EXT: Record<string, string> = {
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  go: '.go',
  rust: '.rs',
  java: '.java',
  yaml: '.yml',
};

// === Triage Wizard Questions ===
const TRIAGE_QUESTIONS = [
  {
    id: 'runtime',
    label: 'Runtime environment',
    icon: '🖥️',
    options: ['Kubernetes', 'Docker / VM', 'Serverless (Lambda/Cloud Run)', 'Bare metal', 'Not sure'],
  },
  {
    id: 'database',
    label: 'Primary database',
    icon: '🗄️',
    options: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB', 'SQLite', 'None', 'Other'],
  },
  {
    id: 'observability',
    label: 'Observability stack',
    icon: '📊',
    options: ['Prometheus + Grafana', 'Datadog', 'New Relic', 'CloudWatch', 'ELK Stack', 'None / Logs only'],
  },
  {
    id: 'queue',
    label: 'Message queue',
    icon: '📨',
    options: ['Kafka', 'RabbitMQ', 'SQS', 'Redis Pub/Sub', 'NATS', 'None'],
  },
  {
    id: 'slo',
    label: 'Availability target',
    icon: '🎯',
    options: ['99.99% (< 1 min/week)', '99.9% (< 10 min/week)', '99.5% (< 30 min/week)', '99% (best effort)', 'Not defined'],
  },
];

function TriageWizard({ triage, setTriage, visible }: {
  triage: Record<string, string>;
  setTriage: (t: Record<string, string>) => void;
  visible: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const answeredCount = Object.values(triage).filter(v => v).length;

  if (!visible) return null;

  return (
    <div className="relative rounded-xl border border-teal-500/25 bg-gradient-to-br from-teal-500/[0.04] to-transparent overflow-visible">
      {/* Accent line at top */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/25 text-base">🤖</span>
          <div>
            <span className="font-semibold text-sm text-teal-400">Agent Triage</span>
            <span className="text-xs text-reflex-text/40 ml-2">
              {answeredCount === 0
                ? 'Optional — helps generate environment-specific commands'
                : `${answeredCount}/${TRIAGE_QUESTIONS.length} answered`}
            </span>
          </div>
          {answeredCount > 0 && (
            <div className="flex gap-0.5 ml-2">
              {Array.from({ length: TRIAGE_QUESTIONS.length }).map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < answeredCount ? 'bg-teal-400' : 'bg-reflex-border/50'}`} />
              ))}
            </div>
          )}
        </div>
        <svg className={`w-4 h-4 text-reflex-text/30 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {TRIAGE_QUESTIONS.map(q => (
              <div key={q.id} className="group">
                <label className="text-xs text-reflex-text/50 font-medium flex items-center gap-1.5 mb-1.5">
                  <span>{q.icon}</span> {q.label}
                </label>
                <select
                  value={triage[q.id] || ''}
                  onChange={(e) => setTriage({ ...triage, [q.id]: e.target.value })}
                  className={`w-full bg-reflex-surface/80 border rounded-lg px-2.5 py-2 text-xs focus:outline-none transition-all duration-200 text-reflex-text/80 ${
                    triage[q.id]
                      ? 'border-teal-500/40 bg-teal-500/[0.04]'
                      : 'border-reflex-border/50 hover:border-reflex-border focus:border-teal-500/50'
                  }`}
              >
                <option value="">— Skip —</option>
                {q.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        </div>
      )}

      {expanded && answeredCount > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-teal-400/60">
          <span className="w-4 h-4 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-[8px]">✓</span>
          <span>
            Agent will generate environment-specific commands (e.g. kubectl for Kubernetes, aws for Lambda).
          </span>
        </div>
      )}
    </div>
  );
}

export default function CodeEditor() {
  const { loading, error, setView, galleryMode, analyzedCode: prefilled } = useStore();
  const { analyze } = useAnalysis();

  // FIX: Initialize state from prefilled analyzedCode (set by demo or gallery)
  const [code, setCode] = useState(prefilled?.code || '');
  const [filename, setFilename] = useState(prefilled?.filename || 'service.py');
  const [language, setLanguage] = useState(prefilled?.language || 'python');
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [triage, setTriage] = useState<Record<string, string>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // FIX: When prefilled data changes (e.g. demo loaded), update local state
  useEffect(() => {
    if (prefilled && prefilled.code && !initializedRef.current) {
      setCode(prefilled.code);
      setFilename(prefilled.filename);
      setLanguage(prefilled.language);
      initializedRef.current = true;
    }
  }, [prefilled]);

  // Also update when navigating back to editor with new demo
  useEffect(() => {
    if (prefilled && prefilled.code) {
      setCode(prefilled.code);
      setFilename(prefilled.filename);
      setLanguage(prefilled.language);
    }
  }, [prefilled?.filename]); // trigger on filename change = new demo loaded

  // Close menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowDemoMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // FIX: Auto-update filename extension when language changes
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    // Auto-rename extension if filename still has old extension
    const oldExt = LANG_EXT[language] || '.py';
    const newExt = LANG_EXT[newLang] || '.py';
    if (filename.endsWith(oldExt)) {
      setFilename(filename.replace(new RegExp(`\\${oldExt}$`), newExt));
    }
  };

  // Build context string from triage answers
  const buildTriageContext = (): string | undefined => {
    const parts: string[] = [];
    if (triage.runtime) parts.push(`Runtime: ${triage.runtime}`);
    if (triage.database) parts.push(`Database: ${triage.database}`);
    if (triage.observability) parts.push(`Observability: ${triage.observability}`);
    if (triage.queue) parts.push(`Message queue: ${triage.queue}`);
    if (triage.slo) parts.push(`SLO target: ${triage.slo}`);
    return parts.length > 0 ? parts.join('. ') + '.' : undefined;
  };

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    const context = buildTriageContext();
    await analyze(code, filename, language, context);
    setView('dashboard');
  };

  const handleLoadDemo = async (lang: string) => {
    setShowDemoMenu(false);
    const snippet = DEMO_SNIPPETS.find(s => s.language === lang);
    if (snippet) {
      setCode(snippet.code);
      setFilename(snippet.filename);
      setLanguage(snippet.language);
    }
  };

  const handleReset = () => {
    setCode('');
    setFilename('service.py');
    setLanguage('python');
    setTriage({});
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analyze Code</h2>
          <p className="text-reflex-muted text-sm mt-1">Paste your infrastructure code. REFLEX finds failure modes and generates runbooks.</p>
        </div>
        <div className="flex gap-2">
          {galleryMode && (
            <button onClick={() => setView('gallery')} className="btn-ghost text-sm border border-amber-500/30 text-amber-400">
              📂 Back to Gallery
            </button>
          )}
          {code.trim() && (
            /* FIX: Clear button — brighter, softer color (light gray with subtle hover) */
            <button
              onClick={handleReset}
              className="btn-ghost text-sm border border-reflex-text/20 text-reflex-text/50 hover:text-reflex-text/80 hover:border-reflex-text/35 hover:bg-reflex-text/5 transition-all"
            >
              ✕ Clear
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowDemoMenu(!showDemoMenu)}
              className="btn-ghost text-sm border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 flex items-center gap-1.5"
            >
              🎮 Try Demo
              <svg className={`w-3 h-3 transition-transform ${showDemoMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDemoMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-reflex-surface border border-reflex-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-fade-in">
                <div className="px-3 py-2 text-xs text-reflex-muted border-b border-reflex-border">Choose a language:</div>
                {LANG_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => handleLoadDemo(opt.key)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-teal-500/10 transition-colors text-left"
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <div>
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-xs text-reflex-muted font-mono">{opt.filename}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File info */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-pink-400/80 font-bold uppercase tracking-wider mb-1 block">Filename</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full bg-reflex-surface border border-reflex-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-400/60 focus:shadow-[0_0_12px_rgba(244,114,182,0.15)] transition-all duration-300"
            placeholder="service.py"
          />
        </div>
        <div className="w-40">
          <label className="text-xs text-pink-400/80 font-bold uppercase tracking-wider mb-1 block">Language</label>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full bg-reflex-surface border border-reflex-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-400/60 focus:shadow-[0_0_12px_rgba(244,114,182,0.15)] transition-all duration-300"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="java">Java</option>
            <option value="yaml">YAML</option>
          </select>
        </div>
      </div>

      {/* Code textarea */}
      <div className="card p-0 overflow-hidden border border-reflex-border focus-within:border-pink-400/40 focus-within:shadow-[0_0_20px_rgba(244,114,182,0.1)] transition-all duration-500">
        <div className="flex items-center justify-between px-4 py-2 bg-reflex-border/30 border-b border-reflex-border">
          <span className="text-xs text-reflex-muted font-mono">{filename}</span>
          <span className="text-xs text-reflex-muted">{code.split('\n').length} lines</span>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full h-80 bg-reflex-surface p-4 font-mono text-sm text-reflex-text resize-none focus:outline-none leading-6"
          placeholder="// Paste your code here...&#10;// REFLEX will analyze every possible failure scenario&#10;// and generate production-ready runbooks."
          spellCheck={false}
        />
      </div>

      {/* Agent Triage Wizard - appears when code is pasted */}
      <TriageWizard triage={triage} setTriage={setTriage} visible={code.trim().length > 0} />

      {/* Error */}
      {error && (
        <div className="card bg-red-500/10 border-red-500/30 border text-red-400 text-sm">
          ⚠️ {error} — Using demo data as fallback.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 items-center justify-between flex-wrap">
        <div className="flex gap-3 items-center">
          <button
            onClick={handleAnalyze}
            disabled={loading || !code.trim()}
            className="btn-primary flex items-center gap-2 text-base"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Analyzing with Mistral AI...
              </>
            ) : (
              <>⚡ Analyze for Failures</>
            )}
          </button>
          {loading && (
            <p className="text-reflex-muted text-sm">
              This may take 15-30 seconds. Mistral is analyzing every line...
            </p>
          )}
          {!loading && Object.values(triage).some(v => v) && (
            <span className="text-xs text-teal-400/50">🤖 Agent context included</span>
          )}
        </div>
        <div className="text-xs text-reflex-text/40 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-reflex-border/30 bg-reflex-border/10">
          <span className="font-mono text-reflex-text/60">{code.split('\n').length} lines</span>
          <span className="w-1 h-1 rounded-full bg-reflex-text/20" />
          <span>Best: ~500 lines · Max: ~1,000 lines</span>
        </div>
      </div>
    </div>
  );
}
