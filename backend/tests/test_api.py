import pytest
from httpx import ASGITransport, AsyncClient

from api import routes
from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def mock_data_sources(monkeypatch: pytest.MonkeyPatch):
    async def fake_pubmed_search(query: str, max_results: int = 10):
        return [
            {
                "pmid": "123456",
                "title": f"{query} in translational research",
                "authors": ["A. Scientist"],
                "source": "Nature",
                "pub_date": "2025",
            }
        ][:max_results]

    async def fake_fetch_gene_info(gene_symbol: str):
        if gene_symbol.upper() in {"TP53", "BRCA1"}:
            return {
                "gene_id": "7157",
                "symbol": gene_symbol.upper(),
                "full_name": "tumor protein p53",
                "chromosome": "17",
                "summary": "A key tumor suppressor gene.",
                "organism": "Homo sapiens",
            }
        return None

    async def fake_trials_search(
        query: str,
        phase: str | None = None,
        status: str | None = None,
        max_results: int = 10,
    ):
        _ = (phase, status)
        return [
            {
                "nct_id": "NCT12345678",
                "title": f"{query} phase study",
                "status": "RECRUITING",
                "phases": ["PHASE2"],
                "conditions": [query],
                "start_date": "2026-01-01",
            }
        ][:max_results]

    async def fake_fda_search(drug_name: str, limit: int = 10):
        return [
            {
                "safety_report_id": "SR-1",
                "receive_date": "20260101",
                "serious": 1,
                "reactions": ["Nausea"],
                "drugs_involved": [drug_name, "PLACEBO"],
                "patient_sex": "1",
                "patient_age": "45",
            }
        ][:limit]

    async def fake_gene_assoc(gene_symbol: str):
        if gene_symbol.upper() not in {"TP53", "BRCA1"}:
            return []
        return [
            {
                "disease_id": "EFO_0000305",
                "disease_name": "Breast carcinoma",
                "therapeutic_areas": ["Oncology"],
                "score": 0.93,
            },
            {
                "disease_id": "",
                "disease_name": "",
                "therapeutic_areas": [],
                "score": 0.2,
            },
        ]

    monkeypatch.setattr(routes.pubmed, "search", fake_pubmed_search)
    monkeypatch.setattr(routes.pubmed, "fetch_gene_info", fake_fetch_gene_info)
    monkeypatch.setattr(routes.trials, "search", fake_trials_search)
    monkeypatch.setattr(routes.fda, "search_adverse_events", fake_fda_search)
    monkeypatch.setattr(
        routes.targets, "get_gene_disease_associations", fake_gene_assoc
    )


@pytest.mark.anyio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"


@pytest.mark.anyio
async def test_search_endpoint_returns_structure(client: AsyncClient):
    resp = await client.get("/api/search", params={"q": "BRCA1"})
    assert resp.status_code == 200
    data = resp.json()
    assert "query" in data
    assert "pubmed" in data
    assert "clinical_trials" in data
    assert "openfda" in data


@pytest.mark.anyio
async def test_knowledge_graph_returns_nodes_and_edges(client: AsyncClient):
    resp = await client.get("/api/knowledge-graph", params={"q": "TP53"})
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert "topics" in data
    assert "links" in data

    node_ids = [node["id"] for node in data["nodes"]]
    assert "" not in node_ids
    assert len(node_ids) == len(set(node_ids))

    for edge in data["edges"]:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids


@pytest.mark.anyio
async def test_chat_endpoint_returns_agent_payload(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    async def fake_run(message: str, history: list[dict]):
        _ = history
        return {
            "reply": f"Analyzed: {message}",
            "graph_data": {"nodes": [], "edges": [], "topics": [], "links": []},
            "citations": [],
            "meta": {"used_llm": False},
        }

    monkeypatch.setattr(routes.agent, "run", fake_run)

    resp = await client.post(
        "/api/chat",
        json={
            "message": "summarize TP53",
            "history": [{"role": "user", "content": "Hello"}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert "graph_data" in data
    assert "citations" in data
