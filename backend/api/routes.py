from fastapi import APIRouter, HTTPException, Query

from api.data_sources.pubmed import PubMedClient
from api.data_sources.clinical_trials import ClinicalTrialsClient
from api.data_sources.openfda import OpenFDAClient
from api.data_sources.open_targets import OpenTargetsClient

router = APIRouter()

pubmed = PubMedClient()
trials = ClinicalTrialsClient()
fda = OpenFDAClient()
targets = OpenTargetsClient()


@router.get("/search")
async def unified_search(q: str = Query(..., description="Search query across all sources")):
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
        "clinical_trials": trials_results if not isinstance(trials_results, Exception) else [],
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
    results = await trials.search(disease_name, phase=phase, status=status, max_results=50)
    return {"disease": disease_name, "trials": results}


@router.get("/drugs/{drug_name}/adverse-events")
async def get_drug_adverse_events(drug_name: str, limit: int = Query(20, le=100)):
    """Fetch adverse event reports for a specific drug."""
    events = await fda.search_adverse_events(drug_name, limit=limit)
    return {"drug": drug_name, "adverse_events": events}


@router.get("/knowledge-graph")
async def build_knowledge_graph(q: str = Query(..., description="Entity to build graph around")):
    """Build a knowledge graph around a biomedical entity (gene, disease, or drug)."""
    import asyncio

    gene_info = pubmed.fetch_gene_info(q)
    associations = targets.get_gene_disease_associations(q)
    trial_data = trials.search(q, max_results=20)

    gene_result, assoc_result, trial_result = await asyncio.gather(
        gene_info, associations, trial_data, return_exceptions=True
    )

    nodes = []
    edges = []

    if not isinstance(gene_result, Exception) and gene_result:
        nodes.append({"id": q, "type": "gene", "label": q, "data": gene_result})

    if not isinstance(assoc_result, Exception):
        for assoc in assoc_result:
            disease_id = assoc.get("disease_id", assoc.get("disease_name", ""))
            disease_label = assoc.get("disease_name", disease_id)
            nodes.append({"id": disease_id, "type": "disease", "label": disease_label, "data": assoc})
            edges.append({
                "source": q,
                "target": disease_id,
                "type": "associated_with",
                "score": assoc.get("score", 0),
            })

    if not isinstance(trial_result, Exception):
        for trial in trial_result:
            trial_id = trial.get("nct_id", trial.get("id", ""))
            nodes.append({
                "id": trial_id,
                "type": "trial",
                "label": trial.get("title", trial_id)[:60],
                "data": trial,
            })
            edges.append({"source": q, "target": trial_id, "type": "studied_in"})

    return {"nodes": nodes, "edges": edges}
