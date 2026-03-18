import httpx

OPENFDA_BASE = "https://api.fda.gov"


class OpenFDAClient:
    def __init__(self):
        self.base_url = OPENFDA_BASE

    async def search_adverse_events(self, drug_name: str, limit: int = 10) -> list[dict]:
        """Search OpenFDA for adverse event reports related to a drug."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/drug/event.json",
                params={
                    "search": f'patient.drug.medicinalproduct:"{drug_name}"',
                    "limit": min(limit, 100),
                },
            )

            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()

        results = []
        for event in data.get("results", []):
            patient = event.get("patient", {})
            reactions = [
                r.get("reactionmeddrapt", "")
                for r in patient.get("reaction", [])
            ]
            drugs = [
                d.get("medicinalproduct", "")
                for d in patient.get("drug", [])
            ]

            results.append({
                "safety_report_id": event.get("safetyreportid", ""),
                "receive_date": event.get("receivedate", ""),
                "serious": event.get("serious", ""),
                "reactions": reactions,
                "drugs_involved": drugs,
                "patient_sex": patient.get("patientsex", ""),
                "patient_age": patient.get("patientonsetage", ""),
            })

        return results
