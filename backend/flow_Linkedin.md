# LinkedIn API Flow

This file documents the LinkedIn endpoints served by `main.py` (base server, usually port `8000`).

## Base URL
- Local: `http://localhost:8000`

## Main Endpoints
- `POST /api/generate`
- `POST /api/refine`
- `GET /api/copilot`
- `GET /api/linkedin/auth`
- `GET /api/linkedin/callback`
- `GET /api/linkedin/profile`
- `GET /api/linkedin/data`
- `POST /api/schedule`
- `GET /api/schedule/best-slots`
- `POST /api/competitor`
- `GET /api/competitor/quick`

## 1) Generate Post Flow (`POST /api/generate`)
Input:
- `topic: str`
- `target_language: str`

Execution pipeline (LangGraph):
1. `drafting`
2. `competitor_analysis`
3. `trend_search`
4. `hook_gen`
5. `localization`
6. `critique`
7. `scoring`
8. `visuals`
9. `ab_variants`

Reflexion:
- If score `< 0.75` and attempts remain, loop back to `drafting`.

Response mode:
- `text/event-stream` (SSE), emits progress/events:
- `node_done`, `scores`, `critiques`, `search_results`, `hook`, `reflexion`, `complete`, `error`

Final payload contains:
- `final_post`, `hook`, `critiques`, `scores`, `image_prompt`, `image_url`
- `search_queries`, `search_results`, `trend_insights`
- `ab_variants`, `competitor_insights`, `iterations`

## 2) Refine Flow (`POST /api/refine`)
Input:
- `topic`
- `target_language`
- `previous_draft`
- `previous_critiques: list[str]`

Behavior:
- Same pipeline style as generate, with prior draft/feedback injected.
- SSE output with `complete` result.

## 3) Copilot (`GET /api/copilot`)
Returns:
- Growth strategy summary from trend analysis + ML prediction logic.

## 4) LinkedIn OAuth/Data Flow
1. Call `GET /api/linkedin/auth` to receive `auth_url`.
2. User authenticates at LinkedIn.
3. LinkedIn redirects to `GET /api/linkedin/callback`.
4. Backend exchanges code for access token.
5. Use token with:
- `GET /api/linkedin/profile`
- `GET /api/linkedin/data?days=14`

## 5) Scheduling
- `POST /api/schedule` for weekly plan.
- `GET /api/schedule/best-slots` for top slot ranking.

## 6) Competitor Analysis
- `POST /api/competitor` (full)
- `GET /api/competitor/quick` (fast path)
