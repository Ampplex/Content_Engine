# Content Engine — System Flow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND  (React 19 + Tailwind)                     │
│                          http://localhost:3000                              │
│                                                                            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Header   │  │ AgentWorkflow│  │ ScoringPanel │  │  FinalPostPanel   │  │
│  │  (Tabs)   │  │ (9 steps)    │  │ (ML/LLM/Heur)│  │ (Post + Copy)    │  │
│  └──────────┘  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌───────────────────────┐  ┌──────────────────────────────────────────┐   │
│  │  GrowthCopilot (Tab2) │  │  usePipeline.js (SSE Stream Parser)     │   │
│  └───────────────────────┘  └──────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ SSE (Server-Sent Events)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKEND  (FastAPI + LangGraph + LightGBM)              │
│                          http://localhost:8000                              │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  main.py      │  │ agent_graph  │  │  ml_model.py │  │  copilot.py  │  │
│  │  (API Routes) │  │ (LangGraph)  │  │  (LightGBM)  │  │  (Growth AI) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ bedrock_llm  │  │ web_search   │  │  config.py   │                    │
│  │ (AWS Mistral)│  │ (Google/DDG) │  │  (.env vars) │                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                 │
│                                                                            │
│  ┌──────────────────┐  ┌────────────────┐  ┌───────────────────────────┐  │
│  │ AWS Bedrock       │  │ Google News    │  │ Google GenAI Imagen 3.0   │  │
│  │ Mistral Large 2   │  │ RSS Feed       │  │ (AI Image Generation)     │  │
│  │ (LLM inference)   │  │ (Web Search)   │  │                           │  │
│  └──────────────────┘  └────────────────┘  └───────────────────────────┘  │
│  ┌──────────────────┐  ┌────────────────────────────────────────────────┐  │
│  │ DuckDuckGo        │  │ Pollinations.ai (fallback image generation)   │  │
│  │ (Fallback Search) │  │                                                │  │
│  └──────────────────┘  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

| Method | Endpoint          | Purpose                                   | Response Type |
|--------|-------------------|-------------------------------------------|---------------|
| POST   | `/api/generate`   | Run full 7-node pipeline from scratch      | SSE stream    |
| POST   | `/api/refine`     | Re-run pipeline with previous draft+critiques | SSE stream |
| GET    | `/api/copilot`    | Growth strategy analysis with ML predictions | JSON         |

---

## SSE Event Types

| Event            | Payload                                    | When Emitted                    |
|------------------|--------------------------------------------|---------------------------------|
| `node_done`      | `{step, node, iteration}`                  | After each pipeline node        |
| `reflexion`      | `{iteration, previous_score, reason}`      | When score < 0.75 triggers loop |
| `search_results` | `{queries, results, insights, iteration}`  | After trend_search node         |
| `hook`           | `{hook, iteration}`                        | After hook_gen node             |
| `scores`         | `{ml, llm, heuristic, final, iteration}`   | After scoring node              |
| `critiques`      | `{critiques[], iteration}`                 | After critique node             |
| `complete`       | Full result object (final_post, hook, etc.)| Pipeline finished               |
| `error`          | `{error}`                                  | On any exception                |

---

## Main Pipeline Flow (LangGraph StateGraph)

```
                    ┌──────────────────────────────────────┐
                    │           USER INPUT                  │
                    │  • topic: "Why RL is revolutionizing  │
                    │    LLMs"                              │
                    │  • target_language: "English"         │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │     POST /api/generate                │
                    │     FastAPI (main.py)                 │
                    │                                      │
                    │  Creates initial_state:               │
                    │  {topic, target_language, iteration:0}│
                    │                                      │
                    │  Calls: app_graph.stream(state)       │
                    │  Returns: SSE StreamingResponse       │
                    └──────────────────┬───────────────────┘
                                       │
            ═══════════════════════════════════════════════
                    LANGGRAPH PIPELINE (7 NODES)
            ═══════════════════════════════════════════════
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NODE 1: DRAFTING  (generate_base_draft)                                │
│  Step Index: 0                                                          │
│                                                                         │
│  Input:  state.topic, state.target_language                             │
│  LLM:    AWS Bedrock Mistral Large 2                                    │
│                                                                         │
│  Logic:                                                                 │
│  ├─ IF previous_draft + previous_critiques exist (refinement mode):     │
│  │   → Prompt includes old draft + critique list                        │
│  │   → "Rewrite the post addressing ALL critiques"                      │
│  ├─ ELSE (fresh draft):                                                 │
│  │   → "Write a punchy LinkedIn post about: {topic}"                    │
│  │                                                                      │
│  Prompt Rules:                                                          │
│  • Target: 1,300-2,000 characters (optimal LinkedIn engagement)         │
│  • Use **bold** markdown for headings & key stats                       │
│  • 1-3 sentence paragraphs with blank lines                             │
│  • Bullet-point section (3-5 items) for key takeaways                   │
│  • 2-3 concrete data points / real examples                             │
│  • CTA or question at end                                               │
│  • 3-5 hashtags after CTA                                               │
│  • No meta-labels, no filler, no hook (handled separately)              │
│                                                                         │
│  Output: {english_draft: str, iteration: int}                           │
│  SSE:    event: node_done {step: 0}                                     │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NODE 2: TREND SEARCH  (trend_search_agent)                             │
│  Step Index: 1                                                          │
│                                                                         │
│  Input:  state.topic, state.english_draft                               │
│                                                                         │
│  Step 2a — QUERY GENERATION (LLM):                                      │
│  ├─ Prompt: "Generate exactly 3 focused web search queries"             │
│  ├─ 1 fact-check query (verify claims/stats in draft)                   │
│  ├─ 1 trend query (latest 2025-2026 data)                               │
│  ├─ 1 audience query (professional discussions)                         │
│  ├─ Output: JSON array of 3 strings                                     │
│  └─ Fallback: hardcoded queries if LLM output invalid                   │
│                                                                         │
│  Step 2b — WEB SEARCH (web_search.py):                                  │
│  ├─ Primary: Google News RSS                                            │
│  │   └─ URL: news.google.com/rss/search?q={query}&hl=en-IN&gl=IN       │
│  │   └─ Parses XML → {title, url, snippet}                             │
│  ├─ Fallback: DuckDuckGo (if Google fails)                              │
│  │   └─ Uses duckduckgo_search library                                  │
│  │   └─ Retries with exponential backoff (3s base, 2 retries)           │
│  ├─ Deduplication: by URL across all queries                            │
│  └─ Max: 3 results per query, 10 total fed to LLM                      │
│                                                                         │
│  Step 2c — SYNTHESIS + ENRICHMENT (LLM):                                │
│  ├─ Input: original draft + search results                              │
│  ├─ Output 1: Trend Insights (2-3 bullet points)                       │
│  │   └─ Relevant trends, stats, fact-checking flags                     │
│  ├─ Output 2: Enriched Draft (OVERWRITES english_draft)                 │
│  │   └─ Incorporates verified facts from search                         │
│  │   └─ Preserves tone, adds authority                                  │
│  └─ Parsing: splits on "ENRICHED_DRAFT:" marker                        │
│                                                                         │
│  Output: {search_queries, search_results, trend_insights,               │
│           english_draft (overwritten)}                                   │
│  SSE:    event: node_done {step: 1}                                     │
│          event: search_results {queries, results, insights}             │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NODE 3: HOOK GENERATOR  (hook_generator)                               │
│  Step Index: 2                                                          │
│                                                                         │
│  Input:  state.english_draft, state.topic, state.target_language        │
│  LLM:    AWS Bedrock Mistral Large 2                                    │
│                                                                         │
│  Prompt:                                                                │
│  • "Generate a single scroll-stopping opening hook"                     │
│  • 1-2 lines max, under 15 words                                       │
│  • Create curiosity, urgency, or a bold claim                           │
│  • Can be: provocative question, surprising stat, contrarian take       │
│  • No emojis                                                            │
│  • Language-aware (writes in target_language)                           │
│                                                                         │
│  Post-processing:                                                       │
│  • Strips surrounding quotes (" and ')                                  │
│                                                                         │
│  Output: {hook: str}                                                    │
│  SSE:    event: node_done {step: 2}                                     │
│          event: hook {hook}                                             │
│                                                                         │
│  NOTE: Hook is stored separately — NOT embedded in draft body           │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NODE 4: INDIC LOCALIZATION  (indic_localization_agent)                  │
│  Step Index: 3                                                          │
│                                                                         │
│  Input:  state.english_draft, state.target_language                     │
│                                                                         │
│  IF language == "English":                                               │
│  ├─ "Culturally adapt for Indian professionals"                         │
│  ├─ Relatable Indian market references                                  │
│  └─ Preserve tone, bold formatting, bullet points, hashtags             │
│                                                                         │
│  IF language != "English" (Hindi, Marathi, Tamil, etc.):                │
│  ├─ "Polish this post which is already in {lang}"                       │
│  ├─ Translate any remaining English parts                               │
│  └─ Ensure natural, culturally appropriate phrasing                     │
│                                                                         │
│  Post-processing (regex):                                               │
│  • Strips leaked labels: "Opening Hook:", "Post:", "Hook:",             │
│    "Headline:", "Title:" (case-insensitive, multiline)                  │
│                                                                         │
│  Output: {localized_draft: str}                                         │
│  SSE:    event: node_done {step: 3}                                     │
│                                                                         │
│  NOTE: Reads english_draft → writes localized_draft                     │
│        From this point, localized_draft is the working copy             │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NODE 5: MULTI-AGENT CRITIQUE  (multi_agent_critique)                   │
│  Step Indices: 4 (SEO), 5 (Brand), 6 (Ethics)                          │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  CHAINED REWRITE PIPELINE                                         │  │
│  │  Each agent CRITIQUES + REWRITES, output feeds into next agent    │  │
│  │                                                                    │  │
│  │  localized_draft                                                   │  │
│  │       │                                                            │  │
│  │       ▼                                                            │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │  AGENT 1: SEO OPTIMIZER  (_run_seo_agent)                   │   │  │
│  │  │  Step Index: 4                                              │   │  │
│  │  │                                                             │   │  │
│  │  │  Critique: keyword gaps, discoverability issues             │   │  │
│  │  │  Rewrite:                                                   │   │  │
│  │  │  • Weave in high-value keywords naturally                   │   │  │
│  │  │  • Improve scannability (bold headings, bullets)            │   │  │
│  │  │  • Add 3-5 relevant hashtags at end                         │   │  │
│  │  │  • Preserve tone, structure, length                         │   │  │
│  │  │                                                             │   │  │
│  │  │  Fallback: if no hashtags in output, appends                │   │  │
│  │  │  #{topic_word1} #{topic_word2} #LinkedIn #Innovation        │   │  │
│  │  │                                                             │   │  │
│  │  │  Output: {critique, revised_draft}                          │   │  │
│  │  │  Parsing: splits on "REVISED_POST:" marker                  │   │  │
│  │  └─────────────────────────┬───────────────────────────────────┘   │  │
│  │                            │ revised_draft                         │  │
│  │                            ▼                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │  AGENT 2: BRAND GUARDIAN  (_run_brand_guardian)              │   │  │
│  │  │  Step Index: 5                                              │   │  │
│  │  │                                                             │   │  │
│  │  │  Critique: tone, professionalism, enterprise alignment      │   │  │
│  │  │  Rewrite:                                                   │   │  │
│  │  │  • Fix tone/professionalism issues                          │   │  │
│  │  │  • Enterprise-ready language (no slang/clickbait)           │   │  │
│  │  │  • Strengthen authority/credibility signals                 │   │  │
│  │  │  • Preserve bold, bullets, hashtags                         │   │  │
│  │  │                                                             │   │  │
│  │  │  Output: {critique, revised_draft}                          │   │  │
│  │  │  Parsing: splits on "REVISED_POST:" marker                  │   │  │
│  │  └─────────────────────────┬───────────────────────────────────┘   │  │
│  │                            │ revised_draft                         │  │
│  │                            ▼                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │  AGENT 3: ETHICS & SAFETY  (_run_ethics_agent)              │   │  │
│  │  │  Step Index: 6                                              │   │  │
│  │  │                                                             │   │  │
│  │  │  Critique: bias, misinformation, stereotypes, compliance    │   │  │
│  │  │  Rewrite:                                                   │   │  │
│  │  │  • Remove/rephrase biased or misleading claims              │   │  │
│  │  │  • Add hedging ("studies suggest" vs assertions)            │   │  │
│  │  │  • Ensure inclusive language                                │   │  │
│  │  │  • If no issues → return unchanged                          │   │  │
│  │  │  • Preserve bold, bullets, hashtags                         │   │  │
│  │  │                                                             │   │  │
│  │  │  Output: {critique, revised_draft}                          │   │  │
│  │  │  Parsing: splits on "REVISED_POST:" marker                  │   │  │
│  │  └─────────────────────────┬───────────────────────────────────┘   │  │
│  │                            │ final revised_draft                   │  │
│  └────────────────────────────┼──────────────────────────────────────┘  │
│                               │                                         │
│  Output: {agent_critiques: [seo, brand, ethics],                       │
│           localized_draft: fully_revised_draft}                         │
│  SSE:    event: node_done {step: 4} (SEO)                              │
│          event: node_done {step: 5} (Brand)                            │
│          event: node_done {step: 6} (Ethics)                           │
│          event: critiques {critiques[]}                                │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  NODE 6: HYBRID SCORING ENGINE  (hybrid_scoring_engine)                 │
│  Step Index: 7                                                          │
│                                                                         │
│  Input:  state.localized_draft (post-critique version)                  │
│                                                                         │
│  Three scoring components:                                              │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  1. ML SCORE (LightGBM) — weight: 0.5                            │  │
│  │                                                                    │  │
│  │  PostEngagementPredictor:                                          │  │
│  │  ├─ Trained on 2000 synthetic samples at startup                   │  │
│  │  ├─ 15 features extracted from text:                               │  │
│  │  │   word_count, sentence_count, paragraph_count,                  │  │
│  │  │   avg_sentence_len, avg_syllables_per_word,                     │  │
│  │  │   hashtag_count, emoji_count, bullet_line_count,                │  │
│  │  │   has_question, has_exclamation, has_url,                       │  │
│  │  │   cta_count, uppercase_ratio, unique_word_ratio, line_count     │  │
│  │  ├─ Engagement heuristics encoded in training data:                │  │
│  │  │   • Optimal word count: 100-300 (+0.12)                         │  │
│  │  │   • Short sentences < 15 words (+0.08)                          │  │
│  │  │   • Bullet points >= 2 (+0.08)                                  │  │
│  │  │   • Questions (+0.10), CTAs (+0.10)                             │  │
│  │  │   • Hashtags 3-5 sweet spot (+0.06)                             │  │
│  │  │   • Emojis 1-4 sweet spot (+0.06)                               │  │
│  │  │   • URLs reduce engagement (-0.05)                              │  │
│  │  └─ Returns: score (0-1), features dict, feature_importances       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  2. LLM SCORE — weight: 0.3                                      │  │
│  │                                                                    │  │
│  │  Prompt: "Rate engagement potential from 0.0 to 1.0"              │  │
│  │  Fallback: 0.75 if parsing fails                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  3. HEURISTIC SCORE — weight: 0.2                                 │  │
│  │                                                                    │  │
│  │  Rule: 0.8 if len > 150 AND has ? or ! → else 0.5                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Formula:                                                               │
│  final_score = (0.5 × ML) + (0.3 × LLM) + (0.2 × Heuristic)          │
│                                                                         │
│  Output: {hybrid_score: {ml, llm, heuristic, final,                    │
│           ml_features, ml_top_importances}}                             │
│  SSE:    event: node_done {step: 7}                                     │
│          event: scores {ml, llm, heuristic, final}                     │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  REFLEXION ROUTER  (reflexion_router)                                   │
│                                                                         │
│  Decision:                                                              │
│  ├─ IF final_score < 0.75 AND iteration < 2:                           │
│  │   → LOOP BACK to Node 1 (drafting)                                  │
│  │   → SSE: event: reflexion {iteration, previous_score, reason}       │
│  │   → Previous draft + critiques become input for refined draft       │
│  │   → All steps reset and re-execute                                  │
│  │                                                                      │
│  └─ ELSE:                                                               │
│      → PROCEED to Node 7 (visuals)                                     │
│                                                                         │
│  Max iterations: 2 (original + 1 refinement)                            │
└───────────────┬──────────────────────────────┬──────────────────────────┘
                │                              │
        score < 0.75                    score >= 0.75
        iteration < 2                   OR iteration >= 2
                │                              │
                ▼                              ▼
    ┌───────────────────┐      ┌───────────────────────────────────────────┐
    │  LOOP BACK TO     │      │  NODE 7: VISUAL STRATEGY  (visual_       │
    │  NODE 1: DRAFTING │      │  strategy_agent)                         │
    │                   │      │  Step Index: 8                            │
    │  state includes:  │      │                                           │
    │  • previous_draft │      │  Input: state.localized_draft             │
    │  • prev_critiques │      │  LLM: "Create a short, descriptive       │
    │  • iteration + 1  │      │       image generation prompt"            │
    └───────────────────┘      │  Image: Google Imagen 3.0 (primary)      │
                               │  Fallback: Pollinations.ai URL           │
                               │  Output: {image_prompt, image_url}       │
                               │  SSE:    event: node_done {step: 8}       │
                               └──────────────────┬────────────────────────┘
                                                   │
                                                   ▼
                               ┌───────────────────────────────────────────┐
                               │  PIPELINE COMPLETE                        │
                               │                                           │
                               │  Image: Generated by Imagen 3.0           │
                               │  Saved to: /generated_images/{uuid}.png   │
                               │  Served via: FastAPI StaticFiles mount     │
                               │  Fallback: Pollinations.ai URL            │
                               │                                           │
                               │  SSE: event: complete                     │
                               │  {                                        │
                               │    final_post: localized_draft,           │
                               │    hook: hook,                            │
                               │    critiques: [seo, brand, ethics],       │
                               │    scores: {ml, llm, heuristic, final},  │
                               │    image_prompt, image_url,               │
                               │    iterations,                            │
                               │    search_queries, search_results,        │
                               │    trend_insights                         │
                               │  }                                        │
                               └──────────────────┬────────────────────────┘
                                                   │
                                                   ▼
                               ┌───────────────────────────────────────────┐
                               │  FRONTEND RECEIVES & RENDERS              │
                               │                                           │
                               │  Left Column:  AgentWorkflow (9 steps)    │
                               │  Center Column: ScoringPanel              │
                               │  Right Column:  FinalPostPanel            │
                               │    • AI-generated image (pollinations)    │
                               │    • Hook (bold, separate)                │
                               │    • Post body (markdown rendered)        │
                               │    • Refine button → POST /api/refine     │
                               │    • Copy button → Unicode bold/italic    │
                               └───────────────────────────────────────────┘
```

---

## State Object (PostState)

```
PostState = {
    topic: str                    # User's input topic
    target_language: str          # "English", "Hindi", "Tamil", etc.
    english_draft: str            # Working draft (Nodes 1-3 write here)
    localized_draft: str          # Final draft (Nodes 4-5 write here, Node 6 reads)
    agent_critiques: List[str]    # [seo_critique, brand_critique, ethics_critique]
    hybrid_score: dict            # {ml, llm, heuristic, final, ml_features, ...}
    iteration: int                # Current iteration (1 = first, 2 = reflexion)
    image_prompt: str             # AI image generation prompt    image_url: str                 # Generated image URL (local or fallback)    search_queries: List[str]     # Web search queries used
    search_results: List[dict]    # [{title, url, snippet, query}, ...]
    trend_insights: str           # Bullet-point trend summary
    hook: str                     # Opening hook / headline
    previous_draft: str           # Draft from last iteration (for refinement)
    previous_critiques: List[str] # Critiques from last iteration
}
```

### State Mutations by Node

| Node            | Reads                          | Writes                                           |
|-----------------|--------------------------------|--------------------------------------------------|
| drafting        | topic, previous_draft/critiques | english_draft, iteration                         |
| trend_search    | topic, english_draft           | english_draft ✏️, search_queries, search_results, trend_insights |
| hook_gen        | english_draft, topic           | hook                                             |
| localization    | english_draft                  | localized_draft                                  |
| critique        | localized_draft, topic         | localized_draft ✏️, agent_critiques              |
| scoring         | localized_draft                | hybrid_score                                     |
| visuals         | localized_draft                | image_prompt, image_url                          |

✏️ = overwrites the field (enriched/revised version replaces original)

---

## Clipboard Copy Flow (LinkedIn-Optimized)

```
User clicks "Copy" button
        │
        ▼
┌─────────────────────────────────────┐
│  1. Get final_post from result      │
│  2. Strip duplicate hook from body  │
│     (plain + **bold** versions)     │
│  3. Prepend hook as Unicode Bold    │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  toLinkedInText() conversion:       │
│                                     │
│  **bold**    → 𝗯𝗼𝗹𝗱  (U+1D5D4)     │
│  __bold__    → 𝗯𝗼𝗹𝗱  (U+1D5D4)     │
│  *italic*    → 𝘪𝘵𝘢𝘭𝘪𝘤 (U+1D608)    │
│  _italic_    → 𝘪𝘵𝘢𝘭𝘪𝘤 (U+1D608)    │
│  # Headers   → 𝗕𝗼𝗹𝗱 𝗛𝗲𝗮𝗱𝗲𝗿       │
│  - bullets   → • bullets            │
│  [text](url) → text                 │
│  ~~strike~~  → plain                 │
│  `code`      → plain                 │
└──────────────────┬──────────────────┘
                   │
                   ▼
        navigator.clipboard.writeText()
        (LinkedIn-ready, no markdown artifacts)
```

---

## Manual Refinement Flow (/api/refine)

```
User clicks "Refine" button
        │
        ▼
POST /api/refine {
    topic,
    target_language,
    previous_draft: result.final_post,
    previous_critiques: result.critiques
}
        │
        ▼
Same 7-node pipeline re-executes,
but Node 1 (drafting) enters REFINEMENT MODE:
• Receives old draft + critique list
• "Rewrite addressing ALL critiques"
• All subsequent nodes process the refined draft
```

---

## Growth Copilot Flow (GET /api/copilot)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 1: Generate Trend Data (LLM)                                     │
│  • LLM generates realistic 14-day LinkedIn engagement history          │
│  • Columns: date, tone (Educational/Promotional/Story/Opinion),        │
│    engagement_rate (1.0-8.0%)                                          │
│  • Pattern: over-posting Promotional → declining engagement            │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 2: ML Predictions (LightGBM TrendEngagementPredictor)            │
│                                                                         │
│  • Trained on 500 synthetic daily engagement records                   │
│  • 6 features: day_of_week, tone_encoded, is_promotional,             │
│    rolling_avg_3d, posts_last_7d, days_since_last_post                 │
│  • Predicts next 7 days: for each day, tests all 4 tones              │
│    and picks the one with highest predicted engagement                 │
│  • Returns: [{day_offset, day_of_week, recommended_tone,              │
│    predicted_engagement}, ...]                                         │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 3: Strategy Generation (LLM + ML predictions)                    │
│                                                                         │
│  • LLM receives: 14-day data + ML predictions for next 7 days         │
│  • Analyzes: tone mix vs engagement patterns                           │
│  • Outputs: quantified analysis, 7-day content plan, specific          │
│    tone/topic recommendations, engagement recovery strategy            │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Response: {                                                           │
│    strategy: "2-3 paragraphs of actionable advice",                    │
│    recent_trend: [{date, tone, engagement_rate}, ...],  // 14 days    │
│    ml_predictions: [{day_offset, recommended_tone,                     │
│                      predicted_engagement}, ...]        // 7 days     │
│  }                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## LLM Configuration

```
Provider:     AWS Bedrock (REST API with Bearer token auth)
Model:        Mistral Large 2 (mistral.mistral-large-2407-v1:0)
Endpoint:     https://bedrock-runtime.{region}.amazonaws.com/model/{model_id}/invoke
Auth:         Bearer {BEDROCK_API_KEY} (long-lived API key / ABSK token)
Temperature:  0.7
Max Tokens:   4096
Timeout:      120 seconds

Implementation: Custom ChatBedrockAPIKey(BaseChatModel) in bedrock_llm.py
• Extends LangChain BaseChatModel
• Converts messages to OpenAI-compatible chat format
• Strips leading </s> tokens (Mistral artifact)
```

---

## Frontend Component Tree

```
App.js
├── Header (tabs: Content Engine | Growth Copilot)
├── [Content Engine Tab]
│   ├── Input Bar (topic input + language select + Orchestrate button)
│   ├── Error Banner (if error)
│   └── Three-Column Layout
│       ├── AgentWorkflow      (col-span-4, left column)
│       │   ├── 9 pipeline steps with status indicators
│       │   ├── Reflexion history log
│       │   ├── Web search results accordion
│       │   └── Agent critiques accordion
│       ├── ScoringPanel       (col-span-3, center column)
│       │   ├── 3 ScoreBar components (ML, LLM, Heuristic)
│       │   ├── Final score display
│       │   └── ML feature importances
│       └── FinalPostPanel     (col-span-5, right column)
│           ├── AI-generated image (pollinations.ai)
│           ├── Hook (bold, deduplicated from body)
│           ├── Post body (ReactMarkdown + remark-gfm)
│           ├── Refine button (manual reflexion)
│           └── Copy button (Unicode bold/italic for LinkedIn)
└── [Growth Copilot Tab]
    └── GrowthCopilot
        ├── Strategy text (LLM analysis)
        ├── 14-day engagement trend chart
        └── 7-day ML prediction table
```

---

## Tech Stack Summary

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React 19, Tailwind CSS, lucide-react, react-markdown, remark-gfm |
| Backend    | FastAPI, Python 3.10, Uvicorn                 |
| LLM        | AWS Bedrock — Mistral Large 2 (via REST API)  |
| ML         | LightGBM (PostEngagementPredictor + TrendEngagementPredictor) |
| Pipeline   | LangGraph StateGraph (7 nodes, conditional edges) |
| Web Search | Google News RSS (primary) + DuckDuckGo (fallback) |
| Images     | Google GenAI Imagen 3.0 (primary) + Pollinations.ai (fallback) |
| Streaming  | Server-Sent Events (SSE)                      |
| Config     | python-dotenv (.env file)                     |

---

## Total LLM Calls Per Generation

| Node            | LLM Calls | Purpose                              |
|-----------------|-----------|--------------------------------------|
| Drafting        | 1         | Generate/refine post draft           |
| Trend Search    | 2         | Query generation + synthesis         |
| Hook Generator  | 1         | Scroll-stopping opening line         |
| Localization    | 1         | Cultural adaptation / translation    |
| SEO Agent       | 1         | Critique + rewrite (keywords, hashtags) |
| Brand Guardian  | 1         | Critique + rewrite (tone, professionalism) |
| Ethics Agent    | 1         | Critique + rewrite (bias, safety)    |
| Scoring (LLM)   | 1         | Engagement rating                   |
| Visual Strategy | 1         | Image prompt generation              |
| Imagen 3.0      | 1 (API)   | Actual image generation (Google)     |
| **Total**       | **10+1**  | Per pipeline run (single iteration)  |

With reflexion loop: up to **20 LLM calls** (2 iterations max).
