from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from api.agent import BiomedicalAgent
from api.data_sources.pubmed import PubMedClient
from api.data_sources.clinical_trials import ClinicalTrialsClient
from api.data_sources.openfda import OpenFDAClient
from api.data_sources.open_targets import OpenTargetsClient
from api.graph_builder import build_knowledge_graph_data

router = APIRouter()

pubmed = PubMedClient()
trials = ClinicalTrialsClient()
fda = OpenFDAClient()
targets = OpenTargetsClient()
agent = BiomedicalAgent(pubmed=pubmed, trials=trials, fda=fda, targets=targets)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list)


@router.get("/search")
async def unified_search(
    q: str = Query(..., description="Search query across all sources"),
):
    """Search across PubMed, ClinicalTrials.gov, and OpenFDA simultaneously."""
    import asyncio

    pubmed_task = pubmed.search(q, max_results=10)
    trials_task = trials.search(q, max_results=10)
    fda_task = fda.search_adverse_events(q, limit=10)

    pubmed_results, trials_results, fda_results = await asyncio.gather(
        pubmed_task, trials_task, fda_task, return_exceptions=True
    )

    return {
        "query": q,
        "pubmed": pubmed_results if not isinstance(pubmed_results, Exception) else [],
        "clinical_trials": trials_results
        if not isinstance(trials_results, Exception)
        else [],
        "openfda": fda_results if not isinstance(fda_results, Exception) else [],
    }


@router.get("/genes/{gene_symbol}")
async def get_gene_info(gene_symbol: str):
    """Fetch gene information and known disease associations."""
    gene_data = await pubmed.fetch_gene_info(gene_symbol)
    if not gene_data:
        raise HTTPException(status_code=404, detail=f"Gene '{gene_symbol}' not found")

    associations = await targets.get_gene_disease_associations(gene_symbol)

    return {
        "gene": gene_data,
        "disease_associations": associations,
    }


@router.get("/diseases/{disease_name}/trials")
async def get_disease_trials(
    disease_name: str,
    phase: str | None = Query(None, description="Filter by trial phase"),
    status: str | None = Query(None, description="Filter by trial status"),
):
    """Fetch clinical trials for a specific disease."""
    results = await trials.search(
        disease_name, phase=phase, status=status, max_results=50
    )
    return {"disease": disease_name, "trials": results}


@router.get("/drugs/{drug_name}/adverse-events")
async def get_drug_adverse_events(drug_name: str, limit: int = Query(20, le=100)):
    """Fetch adverse event reports for a specific drug."""
    events = await fda.search_adverse_events(drug_name, limit=limit)
    return {"drug": drug_name, "adverse_events": events}


@router.get("/knowledge-graph")
async def build_knowledge_graph(
    q: str = Query(..., description="Entity to build graph around"),
):
    """Build a knowledge graph around a biomedical entity with topic summaries."""
    graph = await build_knowledge_graph_data(
        query=q,
        pubmed=pubmed,
        trials=trials,
        fda=fda,
        targets=targets,
    )
    return graph


@router.post("/chat")
async def chat(request: ChatRequest):
    """Research copilot endpoint that uses tool-augmented reasoning."""
    history = [{"role": turn.role, "content": turn.content} for turn in request.history]
    result = await agent.run(message=request.message, history=history)
    return result
