import json
import os
from typing import Any

from openai import AsyncOpenAI

from api.data_sources.clinical_trials import ClinicalTrialsClient
from api.data_sources.open_targets import OpenTargetsClient
from api.data_sources.openfda import OpenFDAClient
from api.data_sources.pubmed import PubMedClient
from api.graph_builder import build_knowledge_graph_data


class BiomedicalAgent:
    def __init__(
        self,
        pubmed: PubMedClient,
        trials: ClinicalTrialsClient,
        fda: OpenFDAClient,
        targets: OpenTargetsClient,
    ) -> None:
        self.pubmed = pubmed
        self.trials = trials
        self.fda = fda
        self.targets = targets
        self.model = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def _execute_tool(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        if name == "search_pubmed":
            query = str(args.get("query", ""))
            max_results = int(args.get("max_results", 10))
            articles = await self.pubmed.search(query, max_results=max_results)
            return {"query": query, "count": len(articles), "articles": articles}
        if name == "search_clinical_trials":
            query = str(args.get("query", ""))
            max_results = int(args.get("max_results", 10))
            phase = args.get("phase")
            status = args.get("status")
            results = await self.trials.search(
                query,
                phase=str(phase) if phase else None,
                status=str(status) if status else None,
                max_results=max_results,
            )
            return {"query": query, "count": len(results), "trials": results}
        if name == "get_gene_info":
            symbol = str(args.get("gene_symbol", ""))
            gene = await self.pubmed.fetch_gene_info(symbol)
            if not gene:
                return {"error": f"Gene '{symbol}' not found"}
            associations = await self.targets.get_gene_disease_associations(symbol)
            return {"gene": gene, "disease_associations": associations[:10]}
        if name == "get_drug_adverse_events":
            drug_name = str(args.get("drug_name", ""))
            limit = int(args.get("limit", 10))
            events = await self.fda.search_adverse_events(drug_name, limit=limit)
            return {"drug": drug_name, "count": len(events), "adverse_events": events}
        if name == "build_knowledge_graph":
            query = str(args.get("query", ""))
            graph = await build_knowledge_graph_data(
                query=query,
                pubmed=self.pubmed,
                trials=self.trials,
                fda=self.fda,
                targets=self.targets,
            )
            return graph
        return {"error": f"Unknown tool '{name}'"}

    async def run(
        self, message: str, history: list[dict[str, str]] | None = None
    ) -> dict:
        graph_data = await build_knowledge_graph_data(
            query=message,
            pubmed=self.pubmed,
            trials=self.trials,
            fda=self.fda,
            targets=self.targets,
        )

        citations = graph_data.get("links", [])[:8]
        if not self.client:
            reply = self._fallback_reply(message, graph_data)
            return {
                "reply": reply,
                "graph_data": graph_data,
                "citations": citations,
                "meta": {"used_llm": False, "model": None},
            }

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search_pubmed",
                    "description": "Search PubMed for biomedical literature.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "max_results": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 25,
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "search_clinical_trials",
                    "description": "Search ClinicalTrials.gov for matching studies.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "phase": {"type": "string"},
                            "status": {"type": "string"},
                            "max_results": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 50,
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_gene_info",
                    "description": "Get detailed human gene information and associations.",
                    "parameters": {
                        "type": "object",
                        "properties": {"gene_symbol": {"type": "string"}},
                        "required": ["gene_symbol"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_drug_adverse_events",
                    "description": "Look up adverse events for a drug in OpenFDA.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "drug_name": {"type": "string"},
                            "limit": {"type": "integer", "minimum": 1, "maximum": 30},
                        },
                        "required": ["drug_name"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "build_knowledge_graph",
                    "description": "Build graph entities, relationships, and topic clusters for a query.",
                    "parameters": {
                        "type": "object",
                        "properties": {"query": {"type": "string"}},
                        "required": ["query"],
                    },
                },
            },
        ]

        system_prompt = (
            "You are a biomedical research copilot. Use tools to gather evidence before answering. "
            "Prioritize correctness, uncertainty calibration, and concise recommendations. "
            "When possible, explain major topic clusters and practical next steps for scientists."
        )

        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for item in history or []:
            role = item.get("role")
            content = item.get("content", "")
            if role in {"user", "assistant"} and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        final_answer = ""
        used_llm = False
        try:
            for _ in range(6):
                resp = await self.client.chat.completions.create(
                    model=self.model,
                    temperature=0.2,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                )
                msg = resp.choices[0].message

                if msg.tool_calls:
                    tool_calls = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in msg.tool_calls
                    ]
                    messages.append(
                        {
                            "role": "assistant",
                            "content": msg.content or "",
                            "tool_calls": tool_calls,
                        }
                    )

                    for tc in msg.tool_calls:
                        try:
                            args = json.loads(tc.function.arguments or "{}")
                        except json.JSONDecodeError:
                            args = {}
                        result = await self._execute_tool(tc.function.name, args)
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tc.id,
                                "name": tc.function.name,
                                "content": json.dumps(result),
                            }
                        )
                    continue

                final_answer = (msg.content or "").strip()
                if final_answer:
                    used_llm = True
                    break
        except Exception:
            final_answer = ""

        if not final_answer:
            final_answer = self._fallback_reply(message, graph_data)

        return {
            "reply": final_answer,
            "graph_data": graph_data,
            "citations": citations,
            "meta": {"used_llm": used_llm, "model": self.model},
        }

    @staticmethod
    def _fallback_reply(message: str, graph_data: dict) -> str:
        node_count = len(graph_data.get("nodes", []))
        edge_count = len(graph_data.get("edges", []))
        topics = graph_data.get("topics", [])
        topic_labels = (
            ", ".join(topic["label"] for topic in topics[:3])
            or "no dominant topics yet"
        )
        return (
            f"I analyzed '{message}' and found {node_count} entities connected by {edge_count} relationships. "
            f"Main categories: {topic_labels}. Open node details and source links to continue exploration."
        )
