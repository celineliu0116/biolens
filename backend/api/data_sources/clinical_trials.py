import httpx

CTGOV_BASE = "https://clinicaltrials.gov/api/v2"


class ClinicalTrialsClient:
    def __init__(self):
        self.base_url = CTGOV_BASE

    async def search(
        self,
        query: str,
        phase: str | None = None,
        status: str | None = None,
        max_results: int = 10,
    ) -> list[dict]:
        """Search ClinicalTrials.gov for studies matching the query."""
        params: dict = {
            "query.term": query,
            "pageSize": min(max_results, 100),
            "format": "json",
        }

        if phase:
            params["filter.phase"] = phase
        if status:
            params["filter.overallStatus"] = status

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.base_url}/studies", params=params)
            resp.raise_for_status()
            data = resp.json()

        studies = data.get("studies", [])
        results = []
        for study in studies:
            protocol = study.get("protocolSection", {})
            id_module = protocol.get("identificationModule", {})
            status_module = protocol.get("statusModule", {})
            design_module = protocol.get("designModule", {})
            conditions_module = protocol.get("conditionsModule", {})

            phases = design_module.get("phases", [])

            results.append(
                {
                    "nct_id": id_module.get("nctId", ""),
                    "title": id_module.get("briefTitle", ""),
                    "status": status_module.get("overallStatus", ""),
                    "phases": phases,
                    "conditions": conditions_module.get("conditions", []),
                    "start_date": status_module.get("startDateStruct", {}).get(
                        "date", ""
                    ),
                }
            )

        return results
