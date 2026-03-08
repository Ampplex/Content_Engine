import { useState, useCallback } from 'react';
import { IG_API_BASE, IG_PIPELINE_STEPS } from '../constants/ig_pipeline';

export function useIGPipeline() {
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
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedTone, setSelectedTone] = useState('');
  const [hashtags, setHashtags] = useState(null);

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
              setCompletedSteps((prev) => new Set([...prev, data.step]));
              setActiveStep(data.step + 1);
            }
            if (eventType === 'format_selected') {
              setSelectedFormat(data.format || '');
              setSelectedTone(data.tone || '');
            }
            if (eventType === 'search_results') setSearchData(data);
            if (eventType === 'hook') setResult((prev) => ({ ...(prev || {}), hook: data.hook }));
            if (eventType === 'hashtags') setHashtags(data.hashtags);
            if (eventType === 'scores') setPartialScores(data);
            if (eventType === 'critiques') setPartialCritiques(data.critiques);

            if (eventType === 'reflexion') {
              setCurrentIteration(data.iteration);
              setReflexionHistory((prev) => [...prev, data]);
              setCompletedSteps(new Set());
              setActiveStep(0);
              setPartialScores(null);
              setPartialCritiques(null);
            }

            if (eventType === 'complete') {
              setResult(data);
              setSelectedFormat(data.format || selectedFormat);
              setSelectedTone(data.tone || selectedTone);
              if (data.hashtags) setHashtags(data.hashtags);
              setActiveStep(IG_PIPELINE_STEPS.length);
              setCompletedSteps(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
            }

            if (eventType === 'error') {
              setError(data.error);
              setActiveStep(-1);
            }
          } catch {
            // ignore partial json chunks
          }
          eventType = null;
        }
      }
    }
  }, [selectedFormat, selectedTone]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setActiveStep(0);
    setCompletedSteps(new Set());
    setPartialScores(null);
    setPartialCritiques(null);
    setSearchData(null);
    setHashtags(null);
    setSelectedFormat('');
    setSelectedTone('');
  }, []);

  const handleGenerate = useCallback(async (topic, language) => {
    setLoading(true);
    reset();
    setCurrentIteration(1);
    setReflexionHistory([]);

    try {
      const res = await fetch(`${IG_API_BASE}/api/ig/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, target_language: language }),
      });
      await parseSSEStream(res);
    } catch {
      setError('Cannot connect to Instagram API. Start backend/main.py on :8000 and retry.');
      setActiveStep(-1);
    }
    setLoading(false);
  }, [parseSSEStream, reset]);

  const handleRefine = useCallback(async (topic, language) => {
    if (!result || loading) return;

    const prevCaption = result.caption || '';
    const prevCritiques = result.critiques || [];
    const prevScore = result.scores?.final || 0;

    setLoading(true);
    reset();
    setCurrentIteration((prev) => prev + 1);
    setReflexionHistory((prev) => [...prev, {
      iteration: currentIteration + 1,
      previous_score: prevScore,
      reason: 'Manual refinement by user',
      manual: true,
    }]);

    try {
      const res = await fetch(`${IG_API_BASE}/api/ig/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          target_language: language,
          previous_caption: prevCaption,
          previous_critiques: prevCritiques,
        }),
      });
      await parseSSEStream(res);
    } catch {
      setError('Refinement failed. Verify backend/main.py on :8000 and retry.');
      setActiveStep(-1);
    }
    setLoading(false);
  }, [result, loading, currentIteration, parseSSEStream, reset]);

  const getStepStatus = useCallback((index) => {
    if (completedSteps.has(index)) return 'done';
    if (index === activeStep && loading) return 'active';
    return 'pending';
  }, [completedSteps, activeStep, loading]);

  const getStepDetail = useCallback((index) => {
    const scores = result?.scores || partialScores;
    const critiques = result?.critiques || partialCritiques;

    if (index === 0 && completedSteps.has(0)) return 'Competitor intel loaded.';
    if (index === 1 && selectedFormat) return `${selectedFormat} | ${selectedTone}`;
    if (index === 2 && searchData) return `${searchData.results?.length || 0} sources found.`;
    if (index === 4 && completedSteps.has(4)) return result?.hook || 'Hook generated.';
    if (index === 5 && hashtags) return `${hashtags.total || 0} hashtags generated.`;
    if (index === 6 && critiques?.[0]) return `${critiques[0].slice(0, 80)}...`;
    if (index === 7 && scores) return `Score: ${(scores.final * 100).toFixed(1)}%`;
    if (index === 8 && result?.image_prompt) return `${result.image_prompt.slice(0, 80)}...`;

    return null;
  }, [result, partialScores, partialCritiques, completedSteps, selectedFormat, selectedTone, searchData, hashtags]);

  return {
    result,
    loading,
    error,
    activeStep,
    completedSteps,
    partialScores,
    partialCritiques,
    currentIteration,
    reflexionHistory,
    searchData,
    selectedFormat,
    selectedTone,
    hashtags,
    handleGenerate,
    handleRefine,
    getStepStatus,
    getStepDetail,
    setError,
  };
}
