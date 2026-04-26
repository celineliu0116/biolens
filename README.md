# BioLens

**An AI powered platform for exploring biomedical knowledge through interactive visualizations.**

BioLens helps researchers and curious minds explore the connections between genes, diseases, drugs, and clinical trials. It pulls live data from public biomedical APIs, renders it as an interactive knowledge graph using D3.js, and lets you ask questions in plain English through an LLM agent built on the Model Context Protocol (MCP).

![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://img.shields.io/github/actions/workflow/status/yourusername/biolens/ci.yml?label=CI)
![Python](https://img.shields.io/badge/python-3.12-green)
![Node](https://img.shields.io/badge/node-20-green)

## What It Does

BioLens is built around a simple idea: biomedical research data is scattered across dozens of databases, and it takes too much effort to connect the dots between them. This tool does that work for you.

Type in a gene symbol like **BRCA1**, a disease like **lung cancer**, or a drug like **imatinib**, and BioLens will:

1. Query multiple public APIs simultaneously (PubMed, ClinicalTrials.gov, OpenFDA, Open Targets)
2. Build an interactive knowledge graph showing how entities are connected
3. Let you drill into any node for detailed information
4. Allow you to ask follow up questions in natural language through the chat panel

The visualization is fully interactive. You can drag nodes around, zoom in and out, click to expand, and filter by entity type. The graph uses force simulation so everything arranges itself naturally.

## Key Features

**Interactive Knowledge Graph** built with D3.js. Nodes represent genes, diseases, clinical trials, and drugs. Edges represent relationships like "associated with" or "studied in." The graph supports zooming, panning, dragging, and click to expand.

**Multi Source Data Integration** across four major biomedical APIs. PubMed provides literature data through the NCBI E-utilities. ClinicalTrials.gov provides trial data through their v2 API. OpenFDA provides drug adverse event data. Open Targets provides gene to disease association scores via GraphQL.

**LLM Research Assistant** powered by tool-augmented reasoning. The backend exposes a real `/api/chat` endpoint that can call biomedical tools and return grounded responses with source links and graph updates. The MCP server also exposes tools for external MCP clients.

**Real Time Search** across all data sources at once. Results come back as structured data and feed directly into the visualization layer.

**Automated CI/CD** with GitHub Actions. Every push runs linting, tests, builds, and Docker image creation. Merges to main trigger deployment.

## Architecture

The project has two main parts:

**Backend** is a Python FastAPI application that handles data fetching, transformation, API routing, and tool-assisted chat orchestration. It also hosts the MCP server that exposes biomedical research tools to LLM agents. The data integration layer uses async HTTP clients so API calls happen concurrently.

**Frontend** is a Next.js 14 application with TypeScript. The knowledge graph is rendered using D3.js with force simulation. Vega Lite handles supplementary charts and heatmaps. The chat interface talks to the backend and updates the graph in real time. Tailwind CSS provides the styling with a dark, modern aesthetic.

```
biolens/
├── backend/
│   ├── api/
│   │   ├── routes.py              # FastAPI endpoints
│   │   ├── graph_builder.py       # Graph assembly, dedupe, topic clusters
│   │   ├── agent.py               # Tool-calling chat agent orchestration
│   │   └── data_sources/
│   │       ├── pubmed.py          # NCBI E-utilities client
│   │       ├── clinical_trials.py # ClinicalTrials.gov v2 client
│   │       ├── openfda.py         # OpenFDA adverse events client
│   │       └── open_targets.py    # Open Targets GraphQL client
│   ├── mcp_server/
│   │   └── server.py             # MCP tools for LLM agents
│   ├── tests/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Main application page
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── KnowledgeGraph.tsx # D3.js force directed graph
│   │   │   ├── ChatInterface.tsx  # LLM chat panel
│   │   │   ├── SearchBar.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   └── TopicPanel.tsx
│   │   └── lib/
│   │       └── api.ts            # API client functions
│   ├── package.json
│   └── Dockerfile
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

You will need Python 3.12 or later, Node.js 20-22, and optionally Docker if you want to run everything in containers.
If you use `nvm`, run `nvm use` from the repo root (an `.nvmrc` is included).

### Running Locally

**Start the backend:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

**Start the frontend** (in a separate terminal):

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

If you see intermittent unstyled pages on refresh in dev mode, clear the cache and restart:

```bash
cd frontend
rm -rf .next
npm run dev
```

Set `OPENAI_API_KEY` in `backend/.env` to enable full LLM agent mode for `/api/chat`.  
If no key is set, chat still works in fallback mode using deterministic tool summaries.

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Running with Docker

```bash
docker compose up --build
```

This brings up both the backend and frontend. The app will be available at [http://localhost:3000](http://localhost:3000).

## Using the MCP Server

The MCP server can be used with any MCP compatible client (such as Claude Desktop or a custom agent). To run it standalone:

```bash
cd backend
python -m mcp_server.server
```

It exposes these tools:

| Tool | What it does |
|------|-------------|
| `search_pubmed` | Searches PubMed for biomedical literature using NCBI query syntax |
| `get_gene_info` | Fetches detailed gene information and disease associations |
| `search_clinical_trials` | Queries ClinicalTrials.gov with optional phase and status filters |
| `get_drug_adverse_events` | Looks up FDA adverse event reports for a given drug |
| `build_knowledge_graph` | Constructs a full knowledge graph around any biomedical entity |
| `summarize_entity` | Runs a tool-augmented summary with citations and graph payload |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search?q=BRCA1` | GET | Unified search across all data sources |
| `/api/genes/{symbol}` | GET | Gene info with disease associations |
| `/api/diseases/{name}/trials` | GET | Clinical trials for a disease |
| `/api/drugs/{name}/adverse-events` | GET | FDA adverse event reports |
| `/api/knowledge-graph?q=TP53` | GET | Build a knowledge graph for any entity |
| `/api/chat` | POST | Tool-augmented research chat with graph + citations |
| `/health` | GET | Health check |

## Data Sources

All data comes from publicly available, well maintained biomedical databases. No API keys are required for the core functionality.

**PubMed via NCBI E-utilities** provides access to over 36 million biomedical citations. We use the esearch and esummary endpoints to find and retrieve article metadata.

**ClinicalTrials.gov v2 API** provides data on over 500,000 clinical studies worldwide. We query for studies by condition, intervention, phase, and recruitment status.

**OpenFDA** provides access to FDA datasets including drug adverse event reports. We search by drug name and return structured safety data.

**Open Targets Platform** uses a GraphQL API to provide gene to disease association scores computed from multiple evidence sources including genetics, literature, and known pathways.

## Running Tests

**Backend tests:**

```bash
cd backend
pytest tests/ -v
```

**Frontend lint:**

```bash
cd frontend
npm run lint
```

## CI/CD Pipeline

The GitHub Actions workflow runs automatically on every push and pull request to main. Here is what each stage does:

1. **Lint Backend** checks Python code with Ruff for style and formatting issues
2. **Test Backend** runs the pytest suite against the API endpoints
3. **Lint Frontend** runs Next.js ESLint checks
4. **Build Frontend** ensures the Next.js build completes without errors
5. **Docker Build** creates container images for both services
6. **Deploy** runs on merges to main (configure with your cloud provider)

## Contributing

Contributions are welcome. If you want to add a new data source, create a new client class in `backend/api/data_sources/` following the pattern of the existing ones. If you want to add a new visualization type, add a component in `frontend/src/components/` and wire it into the main page.

Please open an issue first if you are planning a large change so we can discuss the approach.

## License

MIT
