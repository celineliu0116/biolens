import httpx

NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


class PubMedClient:
    def __init__(self):
        self.base_url = NCBI_BASE

    async def search(self, query: str, max_results: int = 10) -> list[dict]:
        """Search PubMed for articles matching the query."""
        async with httpx.AsyncClient(timeout=30) as client:
            search_resp = await client.get(
                f"{self.base_url}/esearch.fcgi",
                params={
                    "db": "pubmed",
                    "term": query,
                    "retmax": max_results,
                    "retmode": "json",
                },
            )
            search_resp.raise_for_status()
            search_data = search_resp.json()

            id_list = search_data.get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return []

            summary_resp = await client.get(
                f"{self.base_url}/esummary.fcgi",
                params={
                    "db": "pubmed",
                    "id": ",".join(id_list),
                    "retmode": "json",
                },
            )
            summary_resp.raise_for_status()
            summary_data = summary_resp.json()

            results = []
            for pmid in id_list:
                article = summary_data.get("result", {}).get(pmid, {})
                if isinstance(article, dict):
                    results.append({
                        "pmid": pmid,
                        "title": article.get("title", ""),
                        "authors": [
                            a.get("name", "") for a in article.get("authors", [])
                        ],
                        "source": article.get("source", ""),
                        "pub_date": article.get("pubdate", ""),
                    })

            return results

    async def fetch_gene_info(self, gene_symbol: str) -> dict | None:
        """Fetch gene details from NCBI Gene database."""
        async with httpx.AsyncClient(timeout=30) as client:
            search_resp = await client.get(
                f"{self.base_url}/esearch.fcgi",
                params={
                    "db": "gene",
                    "term": f"{gene_symbol}[Gene Name] AND Homo sapiens[Organism]",
                    "retmax": 1,
                    "retmode": "json",
                },
            )
            search_resp.raise_for_status()
            id_list = search_resp.json().get("esearchresult", {}).get("idlist", [])

            if not id_list:
                return None

            gene_id = id_list[0]
            summary_resp = await client.get(
                f"{self.base_url}/esummary.fcgi",
                params={"db": "gene", "id": gene_id, "retmode": "json"},
            )
            summary_resp.raise_for_status()
            gene_data = summary_resp.json().get("result", {}).get(gene_id, {})

            return {
                "gene_id": gene_id,
                "symbol": gene_data.get("name", gene_symbol),
                "full_name": gene_data.get("description", ""),
                "chromosome": gene_data.get("chromosome", ""),
                "summary": gene_data.get("summary", ""),
                "organism": gene_data.get("organism", {}).get("scientificname", ""),
            }
