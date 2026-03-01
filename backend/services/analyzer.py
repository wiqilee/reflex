"""
REFLEX — Analyzer Service
Orchestrates code analysis: failure detection → runbook generation → dependency mapping.
Now with multi-pass validation for critical/high severity runbooks.
"""

import uuid
from datetime import datetime


from backend.models import (
    CodeInput, MultiFileInput, AnalysisResult,
    FailureScenario, Runbook, RunbookStep,
    DependencyGraph, DependencyNode, DependencyEdge,
    Severity
)
from backend.services.mistral_client import ReflexMistral


class Analyzer:
    """Orchestrates the full analysis pipeline."""

    def __init__(self, mistral: ReflexMistral):
        self.mistral = mistral

    async def analyze_single(self, input: CodeInput) -> AnalysisResult:
        """Analyze a single code file end-to-end."""

        # Step 1: Detect failure scenarios
        failure_data = await self.mistral.analyze_failures(
            code=input.code,
            filename=input.filename,
            language=input.language,
            context=input.context
        )

        scenarios = []
        for i, s in enumerate(failure_data.get("scenarios", [])):
            scenarios.append(FailureScenario(
                id=f"FS-{uuid.uuid4().hex[:8]}",
                title=s["title"],
                description=s["description"],
                category=s["category"],
                severity=s["severity"],
                severity_reasoning=s.get("severity_reasoning", ""),
                trigger=s["trigger"],
                impact=s["impact"],
                affected_code=s.get("affected_code", input.filename),
                likelihood=s.get("likelihood", "occasional")
            ))

        # Step 2: Generate runbook for each scenario + validate critical/high
        runbooks = []
        for scenario in scenarios:
            rb_data = await self.mistral.generate_runbook(
                scenario=scenario.model_dump(),
                code=input.code,
                filename=input.filename
            )

            # Multi-pass validation: validate critical and high severity runbooks
            if scenario.severity in (Severity.CRITICAL, Severity.HIGH):
                rb_data = await self.mistral.validate_runbook(
                    runbook=rb_data,
                    scenario=scenario.model_dump(),
                    code=input.code
                )

            runbook = self._build_runbook(scenario, rb_data)
            runbooks.append(runbook)

        # Step 3: Extract dependency graph
        dep_data = await self.mistral.extract_dependencies(
            code=input.code,
            filename=input.filename,
            language=input.language
        )
        dep_graph = self._build_dependency_graph(dep_data)

        return AnalysisResult(
            service_name=input.filename.split("/")[0] if "/" in input.filename else "service",
            files_analyzed=1,
            scenarios=scenarios,
            runbooks=runbooks,
            dependency_graph=dep_graph,
            overall_risk=Severity(failure_data.get("overall_risk", "medium")),
            summary=failure_data.get("summary", "Analysis complete."),
            generated_at=datetime.now()
        )

    async def analyze_multi(self, input: MultiFileInput) -> AnalysisResult:
        """Analyze multiple code files and merge results."""

        all_scenarios = []
        all_runbooks = []
        all_nodes = []
        all_edges = []
        summaries = []

        for file_input in input.files:
            result = await self.analyze_single(file_input)
            all_scenarios.extend(result.scenarios)
            all_runbooks.extend(result.runbooks)
            all_nodes.extend(result.dependency_graph.nodes)
            all_edges.extend(result.dependency_graph.edges)
            summaries.append(result.summary)

        # Deduplicate dependency nodes
        seen_nodes = set()
        unique_nodes = []
        for node in all_nodes:
            if node.name not in seen_nodes:
                seen_nodes.add(node.name)
                unique_nodes.append(node)

        # Determine overall risk
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        worst = min(
            (s.severity for s in all_scenarios),
            key=lambda x: severity_order.get(x, 3),
            default=Severity.LOW
        )

        return AnalysisResult(
            service_name=input.service_name,
            files_analyzed=len(input.files),
            scenarios=all_scenarios,
            runbooks=all_runbooks,
            dependency_graph=DependencyGraph(nodes=unique_nodes, edges=all_edges),
            overall_risk=worst,
            summary=" | ".join(summaries),
            generated_at=datetime.now()
        )

    def _build_runbook(self, scenario: FailureScenario, data: dict) -> Runbook:
        """Build a Runbook model from Mistral output."""

        def build_steps(steps_data: list) -> list[RunbookStep]:
            return [
                RunbookStep(
                    order=i + 1,
                    action=s.get("action", ""),
                    command=s.get("command"),
                    expected_output=s.get("expected_output"),
                    warning=s.get("warning"),
                    estimated_time=s.get("estimated_time", "1-2 min"),
                    access_required=s.get("access_required")
                )
                for i, s in enumerate(steps_data)
            ]

        return Runbook(
            id=f"RB-{uuid.uuid4().hex[:8]}",
            title=f"Runbook: {scenario.title}",
            scenario=scenario,
            detection=build_steps(data.get("detection", [])),
            diagnosis=build_steps(data.get("diagnosis", [])),
            fix=build_steps(data.get("fix", [])),
            rollback=build_steps(data.get("rollback", [])),
            prevention=data.get("prevention", []),
            estimated_resolution=data.get("estimated_resolution", "15-30 min"),
            on_call_level=data.get("on_call_level", "L2"),
            last_updated=datetime.now()
        )

    def _build_dependency_graph(self, data: dict) -> DependencyGraph:
        """Build a DependencyGraph model from Mistral output."""

        nodes = [
            DependencyNode(
                name=n["name"],
                type=n["type"],
                failure_modes=n.get("failure_modes", [])
            )
            for n in data.get("nodes", [])
        ]

        edges = [
            DependencyEdge(
                source=e["source"],
                target=e["target"],
                relationship=e["relationship"]
            )
            for e in data.get("edges", [])
        ]

        return DependencyGraph(nodes=nodes, edges=edges)
