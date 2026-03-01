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
    <div className="card border-teal-500/20 bg-teal-500/[0.03] overflow-visible">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <div>
            <span className="font-semibold text-sm text-teal-400">Agent Triage</span>
            <span className="text-xs text-reflex-muted ml-2">
              {answeredCount === 0
                ? 'Optional — helps generate more accurate runbooks'
                : `${answeredCount}/${TRIAGE_QUESTIONS.length} answered`}
            </span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-reflex-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TRIAGE_QUESTIONS.map(q => (
            <div key={q.id}>
              <label className="text-xs text-reflex-muted flex items-center gap-1.5 mb-1.5">
                <span>{q.icon}</span> {q.label}
              </label>
              <select
                value={triage[q.id] || ''}
                onChange={(e) => setTriage({ ...triage, [q.id]: e.target.value })}
                className="w-full bg-reflex-surface border border-reflex-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal-500/50 text-reflex-text/80"
              >
                <option value="">— Skip —</option>
                {q.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {expanded && answeredCount > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-teal-400/60">
          <span>✓</span>
          <span>
            Agent will use this context to generate environment-specific commands (e.g. kubectl for Kubernetes, aws for Lambda).
          </span>
        </div>
      )}
    </div>
  );
}

export default function CodeEditor() {
  const { loading, error, setView, galleryMode } = useStore();
  const { analyze, loadDemo } = useAnalysis();
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('service.py');
  const [language, setLanguage] = useState('python');
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [triage, setTriage] = useState<Record<string, string>>({});
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowDemoMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
            <button onClick={handleReset} className="btn-ghost text-sm border border-reflex-border text-reflex-muted hover:text-white">
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
          <label className="text-xs text-reflex-muted uppercase tracking-wider mb-1 block">Filename</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full bg-reflex-surface border border-reflex-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-reflex-accent"
            placeholder="service.py"
          />
        </div>
        <div className="w-40">
          <label className="text-xs text-reflex-muted uppercase tracking-wider mb-1 block">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full bg-reflex-surface border border-reflex-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-reflex-accent"
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
      <div className="card p-0 overflow-hidden">
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
          <span className="text-xs text-teal-400/50">🤖 Agent context will be included</span>
        )}
      </div>
    </div>
  );
}
