# Instagram API Flow

This file documents Instagram endpoints from `instagram_content/instagram_main.py`.

Important:
- If mounted via `main.py`, Instagram routes are under `/instagram`.
- So local full base is usually: `http://localhost:8000/instagram`
- If run standalone `instagram_main.py` on `8001`, base is: `http://localhost:8001`

## Base URL (mounted mode)
- `http://localhost:8000/instagram`

## Endpoints
- `POST /api/ig/generate`
- `POST /api/ig/refine`
- `GET /api/ig/copilot`
- `POST /api/ig/schedule`
- `GET /api/ig/schedule/best-slots`
- `POST /api/ig/competitor`
- `POST /api/ig/hashtags`
- `POST /api/ig/reel-script`
- `POST /api/ig/carousel`
- `GET /api/ig/health`

## 1) Full Instagram Generation (`POST /api/ig/generate`)
Input:
- `topic: str`
- `target_language: str` (default `English`)

Pipeline nodes:
1. `competitor_analysis`
2. `format_selector`
3. `trend_search`
4. `caption_drafter`
5. `hook_gen`
6. `hashtags` and format-specific writer (`reel_script` or `carousel`)
7. `critique`
8. `scoring`
9. `visuals`

Reflexion:
- If final score `< 0.75`, caption refinement loop can trigger.

Output mode:
- SSE (`text/event-stream`) with events:
- `node_done`, `format_selected`, `search_results`, `hook`, `hashtags`, `critiques`, `scores`, `reflexion`, `complete`, `error`

Final `complete` event includes:
- `format`, `tone`, `caption`, `first_line`, `hook`
- `hashtags`, `reel_script`, `carousel`
- `image_url`, `image_prompt`, `scores`, `critiques`
- `ab_captions`, `competitor_insights`, `trend_insights`, `search_queries`, `iterations`

## 2) Refine Existing Caption (`POST /api/ig/refine`)
Input:
- `topic`
- `target_language`
- `previous_caption`
- `previous_critiques: list[str]`

Behavior:
- Re-runs pipeline with prior feedback context.
- Returns SSE progress and final payload.

## 3) Copilot (`GET /api/ig/copilot`)
Returns:
- AI strategy + trend analysis + ML predictions for next 7 days.

## 4) Scheduling
- `POST /api/ig/schedule`
  - Body: `format`, `tone`, `audience`, `posts_per_week`
- `GET /api/ig/schedule/best-slots`
  - Query: `format`, `tone`, `audience`, `top_n`

## 5) Niche/Creative Helpers
- `POST /api/ig/competitor` for competitor intelligence
- `POST /api/ig/hashtags` for tiered hashtag generation
- `POST /api/ig/reel-script` for structured reel script
- `POST /api/ig/carousel` for slide-by-slide carousel content

## 6) Health Check
- `GET /api/ig/health`
- Returns service status and identifier.
