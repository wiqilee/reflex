import { useStore, View } from './hooks/useStore';
import Dashboard from './components/Dashboard';
import CodeEditor from './components/CodeEditor';
import RunbookViewer from './components/RunbookViewer';
import DependencyGraph from './components/DependencyGraph';
import BlastRadiusView from './components/BlastRadiusView';
import CodeAnalysisView from './components/CodeAnalysisView';
import AnalysisDiff from './components/AnalysisDiff';
import Gallery from './components/Gallery';
import About from './components/About';
import LightningBg from './components/LightningBg';

const NAV_ITEMS: { id: View; label: string; icon: string; needsAnalysis?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'editor', label: 'Analyze Code', icon: '⚡' },
  { id: 'code-view', label: 'Code View', icon: '🔍', needsAnalysis: true },
  { id: 'runbooks', label: 'Runbooks', icon: '📋', needsAnalysis: true },
  { id: 'graph', label: 'Dependencies', icon: '🕸️', needsAnalysis: true },
  { id: 'blast', label: 'Blast Radius', icon: '💥', needsAnalysis: true },
  { id: 'gallery', label: 'Gallery', icon: '📂' },
  { id: 'diff', label: 'Diff', icon: '📊' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

export default function App() {
  const { view, setView, analysis, analyzedCode, galleryMode, exitGalleryMode, prevView, goBack } = useStore();

  return (
    <div className="min-h-screen bg-reflex-bg relative">
      {/* Animated lightning background */}
      <LightningBg />

      {/* Header */}
      <header className="nav-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back button */}
            {prevView && (
              <button
                onClick={goBack}
                className="text-reflex-muted hover:text-reflex-text text-sm px-2 py-1.5 rounded-lg hover:bg-reflex-border/50 transition-all"
                title="Go back"
              >
                ←
              </button>
            )}
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setView('dashboard')}
            >
              <span className="text-2xl lightning-icon">⚡</span>
              <div>
                <h1 className="text-lg font-bold tracking-tight">REFLEX</h1>
                <p className="text-xs text-reflex-muted -mt-0.5">AI Incident Runbook Generator</p>
              </div>
            </div>
          </div>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => {
              if (item.id === 'code-view' && !analyzedCode) return null;
              const blocked = galleryMode && item.id === 'editor';

              return (
                <button
                  key={item.id}
                  onClick={() => !blocked && setView(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                    view === item.id
                      ? 'bg-reflex-accent/15 text-reflex-accent font-medium'
                      : 'text-reflex-muted hover:text-reflex-text hover:bg-reflex-border/50'
                  } ${!analysis && item.needsAnalysis ? 'opacity-40 pointer-events-none' : ''} ${blocked ? 'opacity-30 cursor-not-allowed' : ''}`}
                  title={blocked ? 'Exit gallery mode to analyze new code' : undefined}
                >
                  <span className="text-sm">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Gallery mode banner — global, all pages except gallery */}
      {galleryMode && view !== 'gallery' && (
        <div className="sticky top-[57px] z-40 border-b border-amber-500/20">
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between bg-amber-500/[0.06] backdrop-blur-sm">
            <span className="text-sm text-amber-400 flex items-center gap-2">📂 <strong>Gallery Mode</strong> — viewing saved analysis</span>
            <div className="flex items-center gap-2">
              <button onClick={exitGalleryMode} className="text-xs text-amber-400 font-medium hover:text-amber-300 transition-colors border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/10">
                ← Back to Gallery
              </button>
              <button onClick={() => { exitGalleryMode(); setTimeout(() => useStore.getState().setView('editor'), 50); }} className="text-xs text-reflex-accent font-medium hover:text-orange-300 transition-colors border border-reflex-accent/30 px-3 py-1 rounded-lg hover:bg-reflex-accent/10">
                ⚡ New Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 relative z-10" key={view}>
        <div className="view-enter">
        {view === 'dashboard' && <Dashboard />}
        {view === 'editor' && <CodeEditor />}
        {view === 'code-view' && <CodeAnalysisView />}
        {view === 'runbooks' && <RunbookViewer />}
        {view === 'graph' && <DependencyGraph />}
        {view === 'blast' && <BlastRadiusView />}
        {view === 'gallery' && <Gallery />}
        {view === 'diff' && <AnalysisDiff />}
        {view === 'about' && <About />}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-16 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-reflex-text/30">
            <span className="text-base lightning-icon">⚡</span>
            <span>REFLEX</span>
            <span className="text-reflex-text/10">·</span>
            <span>© 2026 Wiqi Lee</span>
          </div>
          <div className="text-xs text-reflex-text/25">
            Built for the <span className="text-reflex-accent/50">Mistral Worldwide Hackathon 2026</span> · Powered by Mistral AI + Rust WASM
          </div>
        </div>
      </footer>
    </div>
  );
}
