# Frontend Documentation

## Overview

The frontend is a React (CRA) + Tailwind application that drives two workflows:

- LinkedIn content engine
- Instagram content engine

It consumes backend APIs from `backend/main.py` (default: `http://localhost:8000`) and renders live pipeline progress from SSE streams.

## Tech Stack

- React 19 (`react-scripts` / CRA)
- Tailwind CSS 3 + PostCSS
- `lucide-react` icons
- `react-markdown` + `remark-gfm` for strategy panels

## Run Locally

From `frontend`:

```bash
npm install
npm start
```

App URL:

- `http://localhost:3000`

Backend expectation:

- LinkedIn APIs at `http://localhost:8000`
- Instagram APIs at `http://localhost:8000/instagram`

## API Base Resolution

Frontend API base is resolved in `src/constants/api.js`:

- Uses `REACT_APP_API_BASE` if provided
- Otherwise:
  - On localhost/127.0.0.1: `http://<host>:8000`
  - On other hosts: current origin

## Main UI Structure

Entry files:

- `src/index.js`
- `src/App.js`

Platform switch + tabs:

- LinkedIn tabs:
  - `generator`
  - `copilot`
- Instagram tabs:
  - `ig_generator`
  - `ig_copilot`
  - `ig_scheduler`
  - `ig_competitor`

## State and Data Flow

Custom hooks manage pipeline state and SSE parsing:

- `src/hooks/usePipeline.js` (LinkedIn)
- `src/hooks/useIGPipeline.js` (Instagram)

Both hooks track:

- loading/error
- active step + completed steps
- partial scores/critiques during streaming
- iteration/reflexion history
- final result payload

## SSE Events Used by Frontend

LinkedIn hook handles:

- `node_done`
- `reflexion`
- `search_results`
- `hook`
- `scores`
- `critiques`
- `complete`
- `error`

Instagram hook handles:

- `node_done`
- `format_selected`
- `search_results`
- `hook`
- `hashtags`
- `scores`
- `critiques`
- `reflexion`
- `complete`
- `error`

## API Endpoints Called by Frontend

LinkedIn:

- `POST /api/generate`
- `POST /api/refine`
- `GET /api/copilot`

Instagram:

- `POST /api/ig/generate`
- `POST /api/ig/refine`
- `GET /api/ig/copilot`
- `POST /api/ig/schedule`
- `GET /api/ig/schedule/best-slots`
- `POST /api/ig/competitor`

Also present in standalone components (not currently routed by `App.js`):

- `POST /api/competitor`
- `POST /api/schedule`
- `GET /api/schedule/best-slots`
- `GET /api/linkedin/auth`
- `GET /api/linkedin/profile`
- `GET /api/linkedin/data`

## Styling

Global styles are in `src/index.css`:

- Tailwind layers + reusable utility classes (`ui-card`, `ui-control`, `ui-btn-*`, etc.)
- Brand tokens for LinkedIn/Instagram
- Reduced motion support

`src/App.css` is legacy CRA boilerplate and is not the main styling source.

## Key Components

- `Header` for platform/tab navigation
- LinkedIn:
  - `AgentWorkflow`
  - `ScoringPanel`
  - `FinalPostPanel`
  - `GrowthCopilot`
- Instagram:
  - `IGWorkflow`
  - `IGScoringPanel`
  - `IGOutputPanel`
  - `IGCopilot`
  - `IGScheduler`
  - `IGCompetitor`

## Common Troubleshooting

- Error: API unreachable
  - Ensure backend server is running on port `8000`
- Streaming panels not updating
  - Verify backend endpoint returns SSE (`event:` + `data:` lines)
- Wrong backend target
  - Set `REACT_APP_API_BASE` explicitly and restart `npm start`

