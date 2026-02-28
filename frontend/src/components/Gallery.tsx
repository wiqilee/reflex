import { useStore } from '../hooks/useStore';

function formatWIB(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' WIB';
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-amber-500',
  medium: 'bg-cyan-500',
  low: 'bg-green-500',
};

export default function Gallery() {
  const { gallery, loadFromGallery, deleteFromGallery, setView, exitGalleryMode } = useStore();

  if (gallery.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-fade-in">
        <span className="text-5xl">📂</span>
        <h2 className="text-2xl font-bold">No Saved Analyses</h2>
        <p className="text-reflex-muted text-center max-w-md">
          Analyze some code first. Each analysis will be automatically saved here
          with a timestamp so you can review or compare results later.
        </p>
        <button onClick={() => setView('editor')} className="btn-primary mt-2">
          ⚡ Analyze Code
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">📂 Analysis Gallery</h2>
          <p className="text-reflex-muted text-sm">{gallery.length} saved {gallery.length === 1 ? 'analysis' : 'analyses'} — click to reload</p>
        </div>
        <div className="flex gap-2">
          {gallery.length >= 2 && (
            <button onClick={() => setView('diff')} className="text-sm font-medium text-reflex-text/60 border border-reflex-border hover:border-reflex-accent hover:text-reflex-accent px-4 py-2 rounded-lg transition-all">
              📊 Compare
            </button>
          )}
          <button onClick={() => setView('editor')} className="text-sm font-medium text-reflex-accent border border-reflex-accent/40 hover:border-reflex-accent hover:bg-reflex-accent/15 px-4 py-2 rounded-lg transition-all">
            ⚡ Start New Analysis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gallery.map((item) => (
          <div
            key={item.id}
            className="card hover-card group cursor-pointer"
            onClick={() => { loadFromGallery(item.id); setView('dashboard'); }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{item.analysis.service_name || 'Untitled Analysis'}</h3>
                <p className="text-xs text-reflex-muted mt-0.5">
                  🕐 {formatWIB(item.createdAt)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteFromGallery(item.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10"
                title="Delete this analysis"
              >
                🗑️
              </button>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-xs text-reflex-muted mb-3">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[item.analysis.overall_risk] || 'bg-gray-500'}`} />
                {item.analysis.overall_risk?.toUpperCase()} Risk
              </span>
              <span>📋 {item.analysis.runbooks.length} runbooks</span>
              <span>⚠️ {item.analysis.scenarios.length} scenarios</span>
            </div>

            {/* Top scenarios preview */}
            <div className="space-y-1">
              {item.analysis.scenarios.slice(0, 3).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[s.severity] || 'bg-gray-500'}`} />
                  <span className="text-reflex-muted truncate">{s.title}</span>
                </div>
              ))}
              {item.analysis.scenarios.length > 3 && (
                <p className="text-xs text-reflex-muted/60 pl-3.5">
                  +{item.analysis.scenarios.length - 3} more...
                </p>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-reflex-border flex items-center justify-between">
              <span className="text-xs text-reflex-muted">
                {item.analysis.files_analyzed} file(s) analyzed
              </span>
              <span className="text-xs text-reflex-accent opacity-0 group-hover:opacity-100 transition-opacity">
                Click to view →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
