import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


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
