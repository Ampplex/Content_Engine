import { useState, useCallback } from 'react';
import { API_BASE, PIPELINE_STEPS } from '../constants/pipeline';

/**
 * Custom hook that encapsulates all pipeline generation state and SSE stream parsing.
 * Eliminates the duplicated SSE logic between handleGenerate and handleRefine.
 */
export function usePipeline() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [partialScores, setPartialScores] = useState(null);
  const [partialCritiques, setPartialCritiques] = useState(null);
  const [currentIteration, setCurrentIteration] = useState(1);
  const [reflexionHistory, setReflexionHistory] = useState([]);
  const [searchData, setSearchData] = useState(null);

  // ── Shared SSE stream reader ────────────────────────────────────────────
  const parseSSEStream = useCallback(async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      let eventType = null;
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ') && eventType) {
          try {
            const data = JSON.parse(line.slice(6));

            if (eventType === 'node_done') {
              setCompletedSteps(prev => new Set([...prev, data.step]));
              setActiveStep(data.step + 1);
            }
            if (eventType === 'reflexion') {
              setCurrentIteration(data.iteration);
              setReflexionHistory(prev => [...prev, {
                iteration: data.iteration,
                previous_score: data.previous_score,
                reason: data.reason,
              }]);
              setCompletedSteps(new Set());
              setActiveStep(0);
              setPartialScores(null);
              setPartialCritiques(null);
              setSearchData(null);
            }
            if (eventType === 'search_results') setSearchData(data);
            if (eventType === 'hook') setResult(prev => prev ? { ...prev, hook: data.hook } : { hook: data.hook });
            if (eventType === 'scores') setPartialScores(data);
            if (eventType === 'critiques') setPartialCritiques(data.critiques);
            if (eventType === 'complete') {
              setResult(data);
              setActiveStep(PIPELINE_STEPS.length);
              setCompletedSteps(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
              if (data.search_queries) {
                setSearchData(prev => prev || {
                  queries: data.search_queries,
                  results: data.search_results || [],
                  insights: data.trend_insights || '',
                });
              }
            }
            if (eventType === 'error') {
              setError(data.error);
              setActiveStep(-1);
            }
          } catch (e) { /* ignore partial JSON */ }
          eventType = null;
        }
      }
    }
  }, []);

  // ── Reset all state for a fresh run ─────────────────────────────────────
  const resetPipeline = useCallback(() => {
    setResult(null);
    setError(null);
    setActiveStep(0);
    setCompletedSteps(new Set());
    setPartialScores(null);
    setPartialCritiques(null);
    setSearchData(null);
  }, []);

  // ── Generate (fresh run) ────────────────────────────────────────────────
  const handleGenerate = useCallback(async (topic, language) => {
    setLoading(true);
    resetPipeline();
    setCurrentIteration(1);
    setReflexionHistory([]);

    try {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, target_language: language }),
      });
      await parseSSEStream(response);
    } catch (err) {
      console.error('API Error:', err);
      setError('Failed to connect to backend. Is the server running?');
      setActiveStep(-1);
    }
    setLoading(false);
  }, [parseSSEStream, resetPipeline]);

  // ── Refine (manual reflexion) ───────────────────────────────────────────
  const handleRefine = useCallback(async (topic, language) => {
    if (!result || loading) return;
    const prevDraft = result.final_post || '';
    const prevCritiques = result.critiques || [];
    const prevScore = result.scores?.final || 0;

    setLoading(true);
    resetPipeline();
    setCurrentIteration(prev => prev + 1);
    setReflexionHistory(prev => [...prev, {
      iteration: currentIteration + 1,
      previous_score: prevScore,
      reason: 'Manual refinement triggered by user',
      manual: true,
    }]);

    try {
      const response = await fetch(`${API_BASE}/api/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          target_language: language,
          previous_draft: prevDraft,
          previous_critiques: prevCritiques,
        }),
      });
      await parseSSEStream(response);
    } catch (err) {
      console.error('Refine API Error:', err);
      setError('Failed to connect to backend for refinement.');
      setActiveStep(-1);
    }
    setLoading(false);
  }, [result, loading, currentIteration, parseSSEStream, resetPipeline]);

  // ── Derived helpers ─────────────────────────────────────────────────────
  const getStepStatus = useCallback((index) => {
    if (completedSteps.has(index)) return 'done';
    if (index === activeStep && loading) return 'active';
    return 'pending';
  }, [completedSteps, activeStep, loading]);

  const getStepDetail = useCallback((index, language) => {
    const critiques = result?.critiques || partialCritiques;
    const scores = result?.scores || partialScores;
    if (index === 3 && critiques?.[0]) return critiques[0];
    if (index === 4 && critiques?.[0]) return critiques[0];
    if (index === 5 && critiques?.[1]) return critiques[1];
    if (index === 6 && critiques?.[2]) return critiques[2];
    if (index === 7 && scores) return `Final Score: ${(scores.final * 100).toFixed(1)}%`;
    if (index === 8 && result?.image_prompt) return result.image_prompt.slice(0, 120) + '...';
    if (index === 0 && completedSteps.has(0)) return 'Concise English draft generated.';
    if (index === 1 && completedSteps.has(1)) return `Web search complete — ${searchData?.results?.length || 0} sources found.`;
    if (index === 2 && completedSteps.has(2)) return result?.hook || 'Hook generated.';
    if (index === 3 && completedSteps.has(3)) return `Localized to ${language} for Indian professionals.`;
    return null;
  }, [result, partialCritiques, partialScores, completedSteps, searchData]);

  return {
    // State
    result, loading, error, activeStep, completedSteps,
    partialScores, partialCritiques, currentIteration,
    reflexionHistory, searchData,
    // Actions
    handleGenerate, handleRefine,
    // Helpers
    getStepStatus, getStepDetail,
    // Setters (for external error clearing)
    setError,
  };
}
