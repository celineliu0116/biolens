import httpx

OPEN_TARGETS_BASE = "https://api.platform.opentargets.org/api/v4"


class OpenTargetsClient:
    def __init__(self):
        self.base_url = OPEN_TARGETS_BASE

    async def get_gene_disease_associations(self, gene_symbol: str) -> list[dict]:
        """Fetch gene to disease associations from Open Targets."""
        query = """
        query GeneAssociations($ensemblId: String!, $size: Int!) {
            target(ensemblId: $ensemblId) {
                id
                approvedSymbol
                approvedName
                associatedDiseases(page: {size: $size, index: 0}) {
                    rows {
                        disease {
                            id
                            name
                            therapeuticAreas {
                                id
                                name
                            }
                        }
                        score
                        datasourceScores {
                            id
                            score
                        }
                    }
                }
            }
        }
        """

        ensembl_id = await self._resolve_gene_symbol(gene_symbol)
        if not ensembl_id:
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/graphql",
                json={"query": query, "variables": {"ensemblId": ensembl_id, "size": 20}},
            )

            if resp.status_code != 200:
                return []

            data = resp.json()

        target = data.get("data", {}).get("target")
        if not target:
            return []

        rows = target.get("associatedDiseases", {}).get("rows", [])
        results = []
        for row in rows:
            disease = row.get("disease", {})
            results.append({
                "disease_id": disease.get("id", ""),
                "disease_name": disease.get("name", ""),
                "therapeutic_areas": [
                    ta.get("name", "") for ta in disease.get("therapeuticAreas", [])
                ],
                "score": row.get("score", 0),
            })

        return results

    async def _resolve_gene_symbol(self, gene_symbol: str) -> str | None:
        """Resolve a gene symbol to an Ensembl ID using Open Targets search."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/search",
                params={"q": gene_symbol, "size": 5, "entity": "target"},
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            hits = data.get("data", [])

            for hit in hits:
                if hit.get("approvedSymbol", "").upper() == gene_symbol.upper():
                    return hit.get("id")

            return hits[0].get("id") if hits else None
