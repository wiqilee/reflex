import { useStore } from './useStore';
import { DEMO_RESULT, DEMO_CODE } from '../data/demo';
import { getDemoSnippet, DEMO_SNIPPETS } from '../data/demoSnippets';

const API_BASE = '/api/v1';

export function useAnalysis() {
  const { setAnalysis, setLoading, setError, setAnalyzedCode, setView } = useStore();

  const analyze = async (code: string, filename: string, language: string, context?: string) => {
    setLoading(true);
    setError(null);
    // Save the code being analyzed (for code-view highlighting)
    setAnalyzedCode({ code, filename, language });
    try {
      const body: Record<string, string> = { code, filename, language };
      if (context) body.context = context;

      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setAnalysis(data);
      useStore.getState().addToGallery(data);
    } catch (err: any) {
      setError(err.message);
      console.warn('Backend unavailable, using demo data:', err.message);
      setAnalysis(DEMO_RESULT);
      useStore.getState().addToGallery(DEMO_RESULT);
    } finally {
      setLoading(false);
    }
  };

  /** Load a demo snippet into the CodeEditor page (does NOT auto-analyze).
   *  The user can review the code, tweak filename, then click Analyze manually.
   */
  const loadDemoToEditor = (language: string) => {
    const snippet = getDemoSnippet(language);
    if (snippet) {
      // Pre-fill the editor state — user will see the code filled in on the editor page
      useStore.getState().setAnalyzedCode({
        code: snippet.code,
        filename: snippet.filename,
        language: snippet.language,
      });
      // Navigate to editor page — CodeEditor will pick up the prefilled code
      setView('editor');
      return snippet;
    }
    return null;
  };

  const loadDemo = async (language?: string) => {
    setLoading(true);
    setError(null);

    // If a specific language is requested, use the snippet and analyze via API
    if (language) {
      const snippet = getDemoSnippet(language);
      if (snippet) {
        // FIX: Save the CORRECT demo code for this language (not always Python)
        setAnalyzedCode({ code: snippet.code, filename: snippet.filename, language: snippet.language });
        try {
          const res = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: snippet.code,
              filename: snippet.filename,
              language: snippet.language,
            }),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const data = await res.json();
          setAnalysis(data);
          useStore.getState().addToGallery(data);
          setLoading(false);
          return;
        } catch {
          // Fall through to default demo
        }
      }
    }

    // Default: use /demo endpoint or fallback to local demo data
    // Save default demo code for code-view
    setAnalyzedCode({ code: DEMO_CODE, filename: 'payment_service.py', language: 'python' });
    try {
      const res = await fetch(`${API_BASE}/demo`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setAnalysis(data);
      useStore.getState().addToGallery(data);
    } catch {
      setAnalysis(DEMO_RESULT);
      useStore.getState().addToGallery(DEMO_RESULT);
    } finally {
      setLoading(false);
    }
  };

  return { analyze, loadDemo, loadDemoToEditor };
}
