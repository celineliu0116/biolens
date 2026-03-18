"""
MCP server that exposes biomedical research tools to LLM agents.

Tools allow an agent to search PubMed, query clinical trials, look up
adverse events, fetch gene information, and build knowledge graphs,
all through the Model Context Protocol.
"""

from mcp.server.fastmcp import FastMCP

from api.agent import BiomedicalAgent
from api.data_sources.pubmed import PubMedClient
from api.data_sources.clinical_trials import ClinicalTrialsClient
from api.data_sources.openfda import OpenFDAClient
from api.data_sources.open_targets import OpenTargetsClient
from api.graph_builder import build_knowledge_graph_data

mcp = FastMCP(
    "BioLens",
    instructions="Biomedical research assistant with access to PubMed, ClinicalTrials.gov, OpenFDA, and Open Targets.",
)

pubmed = PubMedClient()
trials = ClinicalTrialsClient()
fda = OpenFDAClient()
targets = OpenTargetsClient()
agent = BiomedicalAgent(pubmed=pubmed, trials=trials, fda=fda, targets=targets)


@mcp.tool()
async def search_pubmed(query: str, max_results: int = 10) -> dict:
    """Search PubMed for biomedical literature.

    Args:
        query: Search terms (supports PubMed query syntax).
        max_results: Maximum number of results to return.
    """
    results = await pubmed.search(query, max_results=max_results)
    return {"query": query, "count": len(results), "articles": results}


@mcp.tool()
async def get_gene_info(gene_symbol: str) -> dict:
    """Get detailed information about a human gene.

    Args:
        gene_symbol: Official gene symbol (e.g. BRCA1, TP53, EGFR).
    """
    info = await pubmed.fetch_gene_info(gene_symbol)
    if not info:
        return {"error": f"Gene '{gene_symbol}' not found"}

    associations = await targets.get_gene_disease_associations(gene_symbol)
    return {"gene": info, "disease_associations": associations[:10]}


@mcp.tool()
async def search_clinical_trials(
    query: str,
    phase: str | None = None,
    status: str | None = None,
    max_results: int = 10,
) -> dict:
    """Search ClinicalTrials.gov for clinical studies.

    Args:
        query: Search terms (disease, drug, gene, etc.).
        phase: Filter by phase (e.g. "PHASE3").
        status: Filter by status (e.g. "RECRUITING").
        max_results: Maximum number of results.
    """
    results = await trials.search(
        query, phase=phase, status=status, max_results=max_results
    )
    return {"query": query, "count": len(results), "trials": results}


@mcp.tool()
async def get_drug_adverse_events(drug_name: str, limit: int = 20) -> dict:
    """Look up adverse event reports for a drug from the FDA database.

    Args:
        drug_name: Name of the drug.
        limit: Maximum number of reports to return.
    """
    events = await fda.search_adverse_events(drug_name, limit=limit)
    return {"drug": drug_name, "count": len(events), "adverse_events": events}


@mcp.tool()
async def build_knowledge_graph(entity: str) -> dict:
    """Build a knowledge graph centered around a biomedical entity.

    Returns nodes (genes, diseases, drugs, trials) and edges representing
    their relationships. Useful for exploring connections in biomedical data.

    Args:
        entity: A gene symbol, disease name, or drug name to explore.
    """
    graph = await build_knowledge_graph_data(
        query=entity,
        pubmed=pubmed,
        trials=trials,
        fda=fda,
        targets=targets,
        max_trials=15,
        max_articles=8,
        max_adverse_events=8,
    )
    return graph


@mcp.tool()
async def summarize_entity(query: str) -> dict:
    """Run an agentic summary with citations and graph data."""
    result = await agent.run(message=query, history=[])
    return result


if __name__ == "__main__":
    mcp.run(transport="stdio")
