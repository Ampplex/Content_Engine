# Hybrid OS Prototype


This repository is a prototype for a Hybrid Operating System designed to automate and optimize content creation workflows for social media platforms like Instagram and LinkedIn. It features:
- A modular Python backend with agent-based content generation, ML-powered scoring, scheduling, and platform-specific logic.
- A modern React frontend for workflow management, visualization, and user interaction.

The system is intended for content creators, marketers, and developers seeking to automate, analyze, and optimize social media content pipelines.

## Table of Contents
- [Project Structure](#project-structure)
- [Backend Overview](#backend-overview)
- [Frontend Overview](#frontend-overview)
- [Setup Instructions](#setup-instructions)
- [Key Features](#key-features)
- [Contributing](#contributing)
- [License](#license)

---

hybrid-os-prototype/
├── backend/           # Python backend for content agents and automation
│   ├── instagram_content/   # Instagram-specific agents and scripts
│   └── linkedin_content/    # LinkedIn-specific agents and scripts
├── frontend/          # React frontend for workflow management
│   ├── src/           # Source code for React app
│   └── public/        # Static assets
└── Flow.md            # High-level workflow documentation

## Project Structure

```
hybrid-os-prototype/
├── backend/                  # Python backend for content agents and automation
│   ├── agent_graph.py        # Core agent orchestration logic
│   ├── bedrock_llm.py        # Integration with Bedrock LLM (if used)
│   ├── competitor_analysis.py# Competitor analysis logic
│   ├── config.py             # Backend configuration
│   ├── copilot.py            # Copilot agent logic
│   ├── demo_e2e.py           # End-to-end demo script
│   ├── image_gen.py          # Image generation utilities
│   ├── linkedin_api.py       # LinkedIn API integration
│   ├── main.py               # Backend entry point
│   ├── ml_model.py           # Machine learning model logic
│   ├── scheduler.py          # Scheduling logic
│   ├── web_search.py         # Web search integration
│   ├── instagram_content/    # Instagram-specific agents and scripts
│   │   ├── carousel_writer.py      # Carousel post writer
│   │   ├── hashtag_engine.py       # Hashtag generation
│   │   ├── instagram_agent_graph.py# IG agent orchestration
│   │   ├── instagram_caption.py    # IG caption generator
│   │   ├── instagram_competitor.py # IG competitor analysis
│   │   ├── instagram_copilot.py    # IG copilot logic
│   │   ├── instagram_main.py       # IG entry point
│   │   ├── instagram_ml_model.py   # IG ML models
│   │   ├── instagram_scheduler.py  # IG scheduling
│   │   ├── reel_script.py          # IG reel script generator
│   ├── linkedin_content/     # LinkedIn-specific agents and scripts
│   │   ├── agent_graph.py          # LinkedIn agent orchestration
│   │   ├── competitor_analysis.py  # LinkedIn competitor analysis
│   │   ├── copilot.py              # LinkedIn copilot logic
│   │   ├── linkedin_api.py         # LinkedIn API integration
│   │   ├── ml_model.py             # LinkedIn ML models
│   │   ├── scheduler.py            # LinkedIn scheduling
├── frontend/                 # React frontend for workflow management
│   ├── src/                  # Source code for React app
│   │   ├── App.js                  # Main app component
│   │   ├── components/             # UI components (workflows, panels, etc.)
│   │   ├── constants/              # Pipeline/API constants
│   │   ├── hooks/                  # Custom React hooks
│   ├── public/               # Static assets
├── Flow.md                   # High-level workflow documentation
```


## Backend Overview

- **Language:** Python 3.x
- **Structure:** Modular, agent-based architecture with platform-specific submodules.

### Main Backend Files
- `main.py`: Launches backend services and orchestrates agent workflows.
- `agent_graph.py`: Defines agent relationships and workflow logic.
- `copilot.py`: Implements the core copilot agent for content suggestions.
- `ml_model.py`: Contains ML models for scoring, optimization, and content analysis.
- `scheduler.py`: Handles scheduling and automation of content posting.
- `competitor_analysis.py`: Analyzes competitors' content and strategies.
- `image_gen.py`: Generates images for posts using ML or external APIs.
- `web_search.py`: Integrates web search for content inspiration and research.
- `linkedin_api.py`: Connects to LinkedIn for posting and data retrieval.
- `bedrock_llm.py`: (Optional) Integrates with Bedrock LLM for advanced language tasks.

#### Instagram Content Submodule
- `carousel_writer.py`: Generates carousel post content.
- `hashtag_engine.py`: Suggests and scores hashtags.
- `instagram_caption.py`: Creates Instagram captions.
- `instagram_competitor.py`: Analyzes Instagram competitors.
- `instagram_copilot.py`: Instagram-specific copilot logic.
- `reel_script.py`: Generates scripts for Instagram reels.

#### LinkedIn Content Submodule
- `agent_graph.py`, `copilot.py`, `ml_model.py`, `scheduler.py`, `linkedin_api.py`, `competitor_analysis.py`: LinkedIn-specific versions of the above logic.

### Backend Features
- Automated content generation: captions, hashtags, carousel/reel scripts.
- Competitor analysis: benchmarking and insights.
- ML-based scoring: rates content for engagement and quality.
- Scheduler: automates posting times and frequency.
- API integrations: LinkedIn, Instagram, web search, image generation.


## Frontend Overview

- **Language:** JavaScript (React, ES6+)
- **Styling:** Tailwind CSS

### Main Frontend Files
- `src/App.js`: Main application entry point.
- `src/components/`: Modular UI components:
   - `AgentWorkflow.js`: Visualizes agent workflow steps.
   - `CompetitorPanel.js`, `IGCompetitor.js`: Show competitor analysis results.
   - `GrowthCopilot.js`, `IGCopilot.js`: Copilot UI for content suggestions.
   - `IGOutputPanel.js`, `FinalPostPanel.js`: Display generated content.
   - `IGScheduler.js`, `SchedulerPanel.js`: Schedule and manage posts.
   - `ScoreBar.js`, `ScoringPanel.js`, `IGScoringPanel.js`: Show ML-based content scores.
   - `LinkedInPanel.js`: LinkedIn-specific content management.
   - `Header.js`: App header and navigation.
- `constants/`: Pipeline and API endpoint definitions.
- `hooks/`: Custom React hooks for pipeline logic and state management.
- `public/`: Static assets and HTML templates.

### Frontend Features
- Visual workflow management for content creation and review.
- Modular panels for competitor analysis, scoring, scheduling, and post review.
- Real-time integration with backend APIs for content generation and analysis.
- Responsive, modern UI using Tailwind CSS.


## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js (v16+ recommended) & npm

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd hybrid-os-prototype/backend
   ```
2. (Optional) Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables as needed (see `.env.example` if present).
5. Run the backend server:
   ```bash
   python main.py
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd hybrid-os-prototype/frontend
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env` if required.
4. Start the development server:
   ```bash
   npm start
   ```
5. The app will be available at `http://localhost:3000` by default.

### Usage
- Use the frontend UI to create, review, and schedule content.
- The backend will handle content generation, scoring, and scheduling via API endpoints.
- For custom workflows, modify or extend the agent logic in the backend or add new UI panels in the frontend.


## Key Features

- **Agent-based Content Generation:** Modular agents for Instagram and LinkedIn automate captions, hashtags, carousel/reel scripts, and more.
- **ML Integration:** Machine learning models score and optimize content for engagement and quality.
- **Scheduler:** Automated scheduling and posting to social platforms.
- **Competitor Analysis:** Tools for analyzing and benchmarking against competitors' content and strategies.
- **Web Search & Image Generation:** Integrates web search for inspiration and generates images for posts.
- **Modern UI:** Intuitive, responsive frontend for managing workflows, reviewing content, and visualizing scores.


## Contributing

Contributions are welcome! To contribute:
- Fork the repository and create a new branch for your feature or bugfix.
- Follow the existing code style and add docstrings/comments where appropriate.
- Add or update tests if relevant.
- Open a pull request with a clear description of your changes.

For major changes or questions, please open an issue first to discuss your proposal.


## License

This project is licensed under the MIT License. See the LICENSE file for details.
