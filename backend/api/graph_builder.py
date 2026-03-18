import asyncio
from collections import Counter
from urllib.parse import quote

from api.data_sources.clinical_trials import ClinicalTrialsClient
from api.data_sources.open_targets import OpenTargetsClient
from api.data_sources.openfda import OpenFDAClient
from api.data_sources.pubmed import PubMedClient


def _safe_id(value: str | None) -> str:
    if not value:
        return ""
    return str(value).strip()


def _node_url(node_type: str, node_id: str, node_data: dict) -> str | None:
    if node_type == "gene":
        gene_id = node_data.get("gene_id")
        if gene_id:
            return f"https://www.ncbi.nlm.nih.gov/gene/{quote(str(gene_id))}"
    if node_type == "disease":
        if node_id:
            return f"https://platform.opentargets.org/disease/{quote(node_id)}"
    if node_type == "trial":
        nct_id = node_data.get("nct_id", node_id)
        if nct_id:
            return f"https://clinicaltrials.gov/study/{quote(str(nct_id))}"
    if node_type == "drug":
        label = node_data.get("label", node_id)
        if label:
            return (
                "https://open.fda.gov/apis/drug/event/"
                f"?search=patient.drug.medicinalproduct:%22{quote(str(label))}%22"
            )
    if node_type == "paper":
        pmid = node_data.get("pmid", node_id.replace("pmid:", ""))
        if pmid:
            return f"https://pubmed.ncbi.nlm.nih.gov/{quote(str(pmid))}/"
    return None


def _select_root_type(
    gene_result: dict | None,
    associations: list[dict],
    trials: list[dict],
    fda_events: list[dict],
) -> str:
    if gene_result:
        return "gene"
    if fda_events and not associations and len(trials) < 3:
        return "drug"
    return "disease"


def _build_topics(
    associations: list[dict], trials: list[dict], pubmed_results: list[dict]
) -> list[dict]:
    therapeutic_area_counter: Counter[str] = Counter()
    for assoc in associations:
        therapeutic_area_counter.update(assoc.get("therapeutic_areas", []))

    trial_status_counter: Counter[str] = Counter()
    trial_phase_counter: Counter[str] = Counter()
    for trial in trials:
        status = trial.get("status")
        if status:
            trial_status_counter[str(status)] += 1
        for phase in trial.get("phases", []) or []:
            if phase:
                trial_phase_counter[str(phase)] += 1

    journal_counter: Counter[str] = Counter()
    for paper in pubmed_results:
        source = paper.get("source")
        if source:
            journal_counter[str(source)] += 1

    topics = [
        {
            "id": "therapeutic_areas",
            "label": "Therapeutic Areas",
            "count": sum(therapeutic_area_counter.values()),
            "highlights": [name for name, _ in therapeutic_area_counter.most_common(5)],
        },
        {
            "id": "trial_status",
            "label": "Trial Status",
            "count": sum(trial_status_counter.values()),
            "highlights": [name for name, _ in trial_status_counter.most_common(5)],
        },
        {
            "id": "trial_phase",
            "label": "Trial Phases",
            "count": sum(trial_phase_counter.values()),
            "highlights": [name for name, _ in trial_phase_counter.most_common(5)],
        },
        {
            "id": "literature_sources",
            "label": "Top Journals",
            "count": sum(journal_counter.values()),
            "highlights": [name for name, _ in journal_counter.most_common(5)],
        },
    ]

    return [topic for topic in topics if topic["count"] > 0]


async def build_knowledge_graph_data(
    query: str,
    pubmed: PubMedClient,
    trials: ClinicalTrialsClient,
    fda: OpenFDAClient,
    targets: OpenTargetsClient,
    max_trials: int = 20,
    max_articles: int = 10,
    max_adverse_events: int = 10,
) -> dict:
    """Construct graph data with deduped entities, links, and topic summaries."""
    graph_query = query.strip()
    if not graph_query:
        return {"query": query, "nodes": [], "edges": [], "topics": [], "meta": {}}

    gene_task = pubmed.fetch_gene_info(graph_query)
    assoc_task = targets.get_gene_disease_associations(graph_query)
    trial_task = trials.search(graph_query, max_results=max_trials)
    paper_task = pubmed.search(graph_query, max_results=max_articles)
    fda_task = fda.search_adverse_events(graph_query, limit=max_adverse_events)

    (
        gene_result,
        assoc_result,
        trial_result,
        paper_result,
        fda_result,
    ) = await asyncio.gather(
        gene_task,
        assoc_task,
        trial_task,
        paper_task,
        fda_task,
        return_exceptions=True,
    )

    failures: list[str] = []
    if isinstance(gene_result, Exception):
        failures.append("gene_lookup_failed")
        gene_result = None
    if isinstance(assoc_result, Exception):
        failures.append("open_targets_failed")
        assoc_result = []
    if isinstance(trial_result, Exception):
        failures.append("clinical_trials_failed")
        trial_result = []
    if isinstance(paper_result, Exception):
        failures.append("pubmed_failed")
        paper_result = []
    if isinstance(fda_result, Exception):
        failures.append("openfda_failed")
        fda_result = []

    root_type = _select_root_type(gene_result, assoc_result, trial_result, fda_result)
    root_id = f"{root_type}:{graph_query.lower()}"

    node_map: dict[str, dict] = {}
    edges: list[dict] = []
    edge_keys: set[tuple[str, str, str]] = set()

    def add_node(node: dict) -> None:
        node_id = _safe_id(node.get("id"))
        if not node_id:
            return

        clean = {
            "id": node_id,
            "type": node.get("type", "disease"),
            "label": str(node.get("label", node_id)),
            "data": node.get("data", {}),
            "url": node.get("url"),
        }

        existing = node_map.get(node_id)
        if not existing:
            node_map[node_id] = clean
            return

        if not existing.get("url") and clean.get("url"):
            existing["url"] = clean["url"]
        if not existing.get("data") and clean.get("data"):
            existing["data"] = clean["data"]

    def add_edge(
        source: str, target: str, edge_type: str, score: float | None = None
    ) -> None:
        src = _safe_id(source)
        tgt = _safe_id(target)
        if not src or not tgt:
            return
        edge_key = (src, tgt, edge_type)
        if edge_key in edge_keys:
            return
        edge_keys.add(edge_key)
        edge = {"source": src, "target": tgt, "type": edge_type}
        if score is not None:
            edge["score"] = score
        edges.append(edge)

    root_data = gene_result if isinstance(gene_result, dict) else {"query": graph_query}
    root_node = {
        "id": root_id,
        "type": root_type,
        "label": graph_query,
        "data": root_data,
        "url": _node_url(root_type, root_id, root_data),
    }
    add_node(root_node)

    for assoc in assoc_result:
        disease_id = _safe_id(assoc.get("disease_id")) or _safe_id(
            assoc.get("disease_name")
        )
        if not disease_id:
            continue
        disease_label = assoc.get("disease_name", disease_id)
        node = {
            "id": disease_id,
            "type": "disease",
            "label": disease_label,
            "data": assoc,
            "url": _node_url("disease", disease_id, assoc),
        }
        add_node(node)
        add_edge(root_id, disease_id, "associated_with", assoc.get("score"))

    for trial in trial_result:
        trial_id = _safe_id(trial.get("nct_id")) or _safe_id(trial.get("id"))
        if not trial_id:
            continue
        node = {
            "id": trial_id,
            "type": "trial",
            "label": (trial.get("title") or trial_id)[:80],
            "data": trial,
            "url": _node_url("trial", trial_id, trial),
        }
        add_node(node)
        add_edge(root_id, trial_id, "studied_in")

    for paper in paper_result:
        pmid = _safe_id(paper.get("pmid"))
        if not pmid:
            continue
        paper_id = f"pmid:{pmid}"
        node = {
            "id": paper_id,
            "type": "paper",
            "label": (paper.get("title") or pmid)[:80],
            "data": paper,
            "url": _node_url("paper", paper_id, paper),
        }
        add_node(node)
        add_edge(root_id, paper_id, "documented_in")

    # If query appears to be a drug, expose frequently co-reported medications.
    involved_drugs: Counter[str] = Counter()
    for event in fda_result:
        for drug_name in event.get("drugs_involved", []) or []:
            name = _safe_id(drug_name)
            if name:
                involved_drugs[name] += 1

    for name, _ in involved_drugs.most_common(10):
        drug_id = f"drug:{name.lower()}"
        node_data = {"label": name}
        node = {
            "id": drug_id,
            "type": "drug",
            "label": name,
            "data": node_data,
            "url": _node_url("drug", drug_id, node_data),
        }
        add_node(node)
        add_edge(root_id, drug_id, "co_reported_with")

    # Keep edges only when both endpoints exist after dedupe/sanitization.
    valid_edges = [
        edge
        for edge in edges
        if edge["source"] in node_map and edge["target"] in node_map
    ]

    nodes = list(node_map.values())
    topics = _build_topics(assoc_result, trial_result, paper_result)
    links = [
        {"label": node["label"], "url": node["url"], "type": node["type"]}
        for node in nodes
        if node.get("url")
    ][:25]

    return {
        "query": graph_query,
        "nodes": nodes,
        "edges": valid_edges,
        "topics": topics,
        "links": links,
        "meta": {
            "failures": failures,
            "counts": {
                "nodes": len(nodes),
                "edges": len(valid_edges),
                "topics": len(topics),
            },
        },
    }
