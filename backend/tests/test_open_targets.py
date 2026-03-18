import pytest

from api.data_sources import open_targets
from api.data_sources.open_targets import OpenTargetsClient


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        _ = (args, kwargs)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        _ = (exc_type, exc, tb)

    async def get(self, url: str, params: dict | None = None):
        _ = url
        query = (params or {}).get("q", "")
        if query == "TP53":
            return _FakeResponse(
                {"data": [{"id": "ENSG00000141510", "approvedSymbol": "TP53"}]}
            )
        return _FakeResponse(
            {"data": [{"id": "ENSG000001", "approvedSymbol": "OTHER"}]}
        )


@pytest.mark.anyio
async def test_resolve_gene_symbol_requires_exact_match(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(open_targets.httpx, "AsyncClient", _FakeAsyncClient)
    client = OpenTargetsClient()

    resolved = await client._resolve_gene_symbol("TP53")
    not_resolved = await client._resolve_gene_symbol("lung cancer")

    assert resolved == "ENSG00000141510"
    assert not_resolved is None
