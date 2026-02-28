import { create } from 'zustand';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type View = 'dashboard' | 'editor' | 'runbooks' | 'graph' | 'blast' | 'gallery' | 'about' | 'code-view' | 'diff';

export interface FailureScenario {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  trigger: string;
  impact: string;
  affected_code: string;
  likelihood: string;
  severity_reasoning?: string;
}

export interface RunbookStep {
  order: number;
  action: string;
  command?: string;
  expected_output?: string;
  warning?: string;
  estimated_time: string;
  access_required?: string;
}

export interface Runbook {
  id: string;
  title: string;
  scenario: FailureScenario;
  detection: RunbookStep[];
  diagnosis: RunbookStep[];
  fix: RunbookStep[];
  rollback: RunbookStep[];
  prevention: string[];
  estimated_resolution: string;
  on_call_level: string;
}

export interface DepNode {
  name: string;
  type: string;
  failure_modes: string[];
}

export interface DepEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface AnalysisResult {
  service_name: string;
  files_analyzed: number;
  scenarios: FailureScenario[];
  runbooks: Runbook[];
  dependency_graph: { nodes: DepNode[]; edges: DepEdge[] };
  overall_risk: Severity;
  summary: string;
}

export interface GalleryItem {
  id: string;
  createdAt: string;
  analysis: AnalysisResult;
  analyzedCode?: AnalyzedCode | null;
}

export interface AnalyzedCode {
  code: string;
  filename: string;
  language: string;
}

function loadGallery(): GalleryItem[] {
  try {
    return JSON.parse(localStorage.getItem('reflex-gallery') || '[]');
  } catch {
    return [];
  }
}

function saveGallery(items: GalleryItem[]) {
  localStorage.setItem('reflex-gallery', JSON.stringify(items));
}

interface AppState {
  view: View;
  setView: (v: View) => void;
  analysis: AnalysisResult | null;
  setAnalysis: (a: AnalysisResult) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
  selectedRunbook: Runbook | null;
  setSelectedRunbook: (r: Runbook | null) => void;
  selectedNode: string | null;
  setSelectedNode: (n: string | null) => void;
  // View history for back navigation
  prevView: View | null;
  goBack: () => void;
  // Analyzed code (for code-view highlighting)
  analyzedCode: AnalyzedCode | null;
  setAnalyzedCode: (c: AnalyzedCode | null) => void;
  // Gallery
  gallery: GalleryItem[];
  galleryMode: boolean;
  addToGallery: (analysis: AnalysisResult) => void;
  loadFromGallery: (id: string) => void;
  deleteFromGallery: (id: string) => void;
  exitGalleryMode: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  view: 'dashboard',
  setView: (v) => {
    const current = get().view;
    if (current !== v) set({ prevView: current, view: v });
  },
  prevView: null,
  goBack: () => {
    const prev = get().prevView;
    if (prev) set({ view: prev, prevView: null });
  },
  analysis: null,
  setAnalysis: (a) => set({ analysis: a, galleryMode: false }),
  loading: false,
  setLoading: (l) => set({ loading: l }),
  error: null,
  setError: (e) => set({ error: e }),
  selectedRunbook: null,
  setSelectedRunbook: (r) => set({ selectedRunbook: r }),
  selectedNode: null,
  setSelectedNode: (n) => set({ selectedNode: n }),

  // Analyzed code
  analyzedCode: null,
  setAnalyzedCode: (c) => set({ analyzedCode: c }),

  // Gallery
  gallery: loadGallery(),
  galleryMode: false,

  addToGallery: (analysis) => {
    const item: GalleryItem = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      analysis,
      analyzedCode: get().analyzedCode,
    };
    const updated = [item, ...get().gallery].slice(0, 50);
    saveGallery(updated);
    set({ gallery: updated });
  },

  loadFromGallery: (id) => {
    const item = get().gallery.find((g) => g.id === id);
    if (item) {
      set({
        analysis: item.analysis,
        analyzedCode: item.analyzedCode || null,
        selectedRunbook: null,
        selectedNode: null,
        galleryMode: true,
      });
    }
  },

  exitGalleryMode: () => {
    set({ galleryMode: false, analysis: null, analyzedCode: null, selectedRunbook: null, selectedNode: null, view: 'gallery' });
  },

  deleteFromGallery: (id) => {
    const updated = get().gallery.filter((g) => g.id !== id);
    saveGallery(updated);
    set({ gallery: updated });
  },
}));
