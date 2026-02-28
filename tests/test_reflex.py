"""
REFLEX — Test Suite
Unit tests for models, analyzer pipeline, and edge cases.

Run: pytest tests/ -v
"""

import pytest
import uuid
from datetime import datetime
from unittest.mock import AsyncMock

from backend.models import (
    CodeInput, MultiFileInput, AnalysisResult,
    FailureScenario, RunbookStep,
    DependencyGraph, DependencyNode,
    Severity, FailureCategory, RunbookStatus,
)
from backend.services.analyzer import Analyzer


# ---------------------------------------------------------------------------
# Model validation tests
# ---------------------------------------------------------------------------

class TestModels:
    """Pydantic model constraints and serialization."""

    def test_severity_enum_values(self):
        assert Severity.CRITICAL == "critical"
        assert Severity.HIGH == "high"
        assert Severity.MEDIUM == "medium"
        assert Severity.LOW == "low"

    def test_code_input_defaults(self):
        inp = CodeInput(code="print('hello')")
        assert inp.filename == "untitled.py"
        assert inp.language == "python"
        assert inp.context is None

    def test_code_input_custom(self):
        inp = CodeInput(
            code="fn main() {}",
            filename="main.rs",
            language="rust",
            context="Cache service",
        )
        assert inp.filename == "main.rs"
        assert inp.language == "rust"
        assert inp.context == "Cache service"

    def test_code_input_rejects_missing_code(self):
        with pytest.raises(Exception):
            CodeInput()  # code is required

    def test_failure_scenario_with_severity_reasoning(self):
        sc = FailureScenario(
            id="FS-001",
            title="SQL Injection",
            description="f-string SQL",
            category=FailureCategory.DATABASE,
            severity=Severity.CRITICAL,
            severity_reasoning="f-string on line 37 with raw user input",
            trigger="Malicious input",
            impact="Full database compromise",
            affected_code="service.py:37",
            likelihood="frequent",
        )
        assert sc.severity_reasoning == "f-string on line 37 with raw user input"
        assert sc.severity == Severity.CRITICAL

    def test_failure_scenario_severity_reasoning_default(self):
        sc = FailureScenario(
            id="FS-002",
            title="Timeout",
            description="No timeout set",
            category=FailureCategory.TIMEOUT,
            severity=Severity.MEDIUM,
            trigger="Slow upstream",
            impact="Request hangs",
            affected_code="client.py:12",
            likelihood="occasional",
        )
        assert sc.severity_reasoning == ""

    def test_runbook_step_defaults(self):
        step = RunbookStep(order=1, action="Check logs")
        assert step.command is None
        assert step.expected_output is None
        assert step.warning is None
        assert step.estimated_time == "1-2 min"
        assert step.access_required is None

    def test_dependency_graph_empty(self):
        graph = DependencyGraph()
        assert graph.nodes == []
        assert graph.edges == []

    def test_dependency_node_failure_modes(self):
        node = DependencyNode(
            name="payment_db",
            type="database",
            failure_modes=["Connection exhaustion", "Deadlocks"],
        )
        assert len(node.failure_modes) == 2

    def test_multi_file_input(self):
        mfi = MultiFileInput(
            files=[
                CodeInput(code="import os", filename="a.py"),
                CodeInput(code="package main", filename="b.go", language="go"),
            ],
            service_name="my-api",
        )
        assert len(mfi.files) == 2
        assert mfi.service_name == "my-api"

    def test_analysis_result_serialization(self):
        result = AnalysisResult(
            service_name="test",
            files_analyzed=1,
            scenarios=[],
            runbooks=[],
            dependency_graph=DependencyGraph(),
            overall_risk=Severity.LOW,
            summary="No issues found.",
        )
        data = result.model_dump()
        assert data["service_name"] == "test"
        assert data["overall_risk"] == "low"
        assert isinstance(data["generated_at"], datetime)


# ---------------------------------------------------------------------------
# Analyzer pipeline tests (with mocked Mistral client)
# ---------------------------------------------------------------------------

def _mock_failure_response():
    """Simulated Mistral analyze_failures output."""
    return {
        "scenarios": [
            {
                "title": "SQL Injection in process_payment",
                "description": "f-string interpolation in SQL query",
                "category": "database",
                "severity": "critical",
                "severity_reasoning": "Direct string interpolation on line 37",
                "trigger": "Malicious user_id parameter",
                "impact": "Full database compromise",
                "affected_code": "payment_service.py:37",
                "likelihood": "frequent",
            },
            {
                "title": "Missing connection pooling",
                "description": "New connection per request",
                "category": "resource_exhaustion",
                "severity": "high",
                "severity_reasoning": "No pool config, 3 downstream services",
                "trigger": "Traffic spike",
                "impact": "Connection exhaustion under load",
                "affected_code": "payment_service.py:12",
                "likelihood": "occasional",
            },
            {
                "title": "Unvalidated input amount",
                "description": "No bounds check on amount field",
                "category": "data_corruption",
                "severity": "medium",
                "trigger": "Negative or overflow amount",
                "impact": "Incorrect financial records",
                "affected_code": "payment_service.py:45",
                "likelihood": "rare",
            },
        ],
        "overall_risk": "critical",
        "summary": "3 failure scenarios detected. Critical SQL injection risk.",
    }


def _mock_runbook_response():
    """Simulated Mistral generate_runbook output."""
    return {
        "detection": [
            {"action": "Check application logs for SQL errors", "command": "grep -i 'sql' /var/log/app.log", "expected_output": "SQL error entries", "estimated_time": "2 min"}
        ],
        "diagnosis": [
            {"action": "Identify the vulnerable query", "command": "grep -rn 'f\".*SELECT' *.py", "expected_output": "Lines with f-string SQL"}
        ],
        "fix": [
            {"action": "Replace f-string with parameterized query", "command": None, "expected_output": None, "warning": "Test in staging first"}
        ],
        "rollback": [
            {"action": "Revert to previous deployment", "command": "kubectl rollout undo deployment/payment-svc", "expected_output": "Rollback successful"}
        ],
        "prevention": [
            "Use parameterized queries exclusively",
            "Add SQL injection detection to CI pipeline",
        ],
        "estimated_resolution": "15-30 min",
        "on_call_level": "L2",
    }


def _mock_dependency_response():
    """Simulated Mistral extract_dependencies output."""
    return {
        "nodes": [
            {"name": "payment_service", "type": "service", "failure_modes": ["SQL injection", "Timeout"]},
            {"name": "payment_db", "type": "database", "failure_modes": ["Connection exhaustion"]},
        ],
        "edges": [
            {"source": "payment_service", "target": "payment_db", "relationship": "writes"},
        ],
    }


class TestAnalyzer:
    """Integration tests for the Analyzer pipeline."""

    @pytest.fixture
    def mock_mistral(self):
        client = AsyncMock()
        client.analyze_failures = AsyncMock(return_value=_mock_failure_response())
        client.generate_runbook = AsyncMock(return_value=_mock_runbook_response())
        client.validate_runbook = AsyncMock(return_value=_mock_runbook_response())
        client.extract_dependencies = AsyncMock(return_value=_mock_dependency_response())
        return client

    @pytest.fixture
    def analyzer(self, mock_mistral):
        return Analyzer(mock_mistral)

    @pytest.mark.asyncio
    async def test_analyze_single_returns_result(self, analyzer):
        inp = CodeInput(code="def pay(): pass", filename="payment_service.py", language="python")
        result = await analyzer.analyze_single(inp)

        assert isinstance(result, AnalysisResult)
        assert result.files_analyzed == 1
        assert result.overall_risk == Severity.CRITICAL

    @pytest.mark.asyncio
    async def test_analyze_single_scenario_count(self, analyzer):
        inp = CodeInput(code="def pay(): pass", filename="payment_service.py")
        result = await analyzer.analyze_single(inp)

        assert len(result.scenarios) == 3
        assert result.scenarios[0].severity == Severity.CRITICAL
        assert result.scenarios[1].severity == Severity.HIGH
        assert result.scenarios[2].severity == Severity.MEDIUM

    @pytest.mark.asyncio
    async def test_analyze_single_runbook_count(self, analyzer):
        inp = CodeInput(code="def pay(): pass")
        result = await analyzer.analyze_single(inp)

        assert len(result.runbooks) == 3
        for rb in result.runbooks:
            assert rb.id.startswith("RB-")
            assert len(rb.detection) > 0
            assert len(rb.prevention) > 0

    @pytest.mark.asyncio
    async def test_critical_runbooks_get_validated(self, analyzer, mock_mistral):
        inp = CodeInput(code="def pay(): pass")
        await analyzer.analyze_single(inp)

        # Critical + High = 2 calls to validate_runbook
        assert mock_mistral.validate_runbook.call_count == 2

    @pytest.mark.asyncio
    async def test_medium_runbooks_skip_validation(self, analyzer, mock_mistral):
        # Override to return only medium scenarios
        mock_mistral.analyze_failures = AsyncMock(return_value={
            "scenarios": [{
                "title": "Minor issue",
                "description": "Low risk",
                "category": "configuration",
                "severity": "medium",
                "trigger": "Misconfigured env",
                "impact": "Degraded performance",
                "affected_code": "config.py:5",
                "likelihood": "rare",
            }],
            "overall_risk": "medium",
            "summary": "1 scenario.",
        })

        inp = CodeInput(code="x = 1")
        await analyzer.analyze_single(inp)

        # Medium severity should NOT trigger validation
        assert mock_mistral.validate_runbook.call_count == 0

    @pytest.mark.asyncio
    async def test_dependency_graph_structure(self, analyzer):
        inp = CodeInput(code="def pay(): pass")
        result = await analyzer.analyze_single(inp)

        assert len(result.dependency_graph.nodes) == 2
        assert len(result.dependency_graph.edges) == 1
        assert result.dependency_graph.edges[0].relationship == "writes"

    @pytest.mark.asyncio
    async def test_severity_reasoning_passthrough(self, analyzer):
        inp = CodeInput(code="def pay(): pass")
        result = await analyzer.analyze_single(inp)

        critical = result.scenarios[0]
        assert "line 37" in critical.severity_reasoning

    @pytest.mark.asyncio
    async def test_analyze_multi_deduplicates_nodes(self, analyzer):
        inp = MultiFileInput(
            files=[
                CodeInput(code="def a(): pass", filename="a.py"),
                CodeInput(code="def b(): pass", filename="b.py"),
            ],
            service_name="payments",
        )
        result = await analyzer.analyze_multi(inp)

        # Same mock returns same nodes, dedup should keep 2
        node_names = [n.name for n in result.dependency_graph.nodes]
        assert len(node_names) == len(set(node_names))

    @pytest.mark.asyncio
    async def test_analyze_multi_merges_scenarios(self, analyzer):
        inp = MultiFileInput(
            files=[
                CodeInput(code="def a(): pass"),
                CodeInput(code="def b(): pass"),
            ],
        )
        result = await analyzer.analyze_multi(inp)

        # 3 scenarios per file × 2 files = 6 total
        assert len(result.scenarios) == 6
        assert result.files_analyzed == 2

    @pytest.mark.asyncio
    async def test_analyze_multi_worst_severity(self, analyzer):
        inp = MultiFileInput(files=[CodeInput(code="x = 1")])
        result = await analyzer.analyze_multi(inp)

        assert result.overall_risk == Severity.CRITICAL


# ---------------------------------------------------------------------------
# Edge case tests
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Boundary conditions and error handling."""

    def test_empty_code_input(self):
        inp = CodeInput(code="")
        assert inp.code == ""

    def test_severity_ordering(self):
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        severities = [Severity.MEDIUM, Severity.CRITICAL, Severity.LOW, Severity.HIGH]
        worst = min(severities, key=lambda x: order.get(x, 3))
        assert worst == Severity.CRITICAL

    def test_runbook_id_format(self):
        rid = f"RB-{uuid.uuid4().hex[:8]}"
        assert rid.startswith("RB-")
        assert len(rid) == 11  # RB- + 8 hex chars

    def test_scenario_id_format(self):
        sid = f"FS-{uuid.uuid4().hex[:8]}"
        assert sid.startswith("FS-")
        assert len(sid) == 11

    def test_failure_category_all_values(self):
        expected = {
            "network", "database", "authentication", "resource_exhaustion",
            "data_corruption", "dependency", "configuration", "concurrency",
            "timeout", "permission",
        }
        actual = {c.value for c in FailureCategory}
        assert actual == expected

    def test_runbook_status_enum(self):
        assert RunbookStatus.DRAFT == "draft"
        assert RunbookStatus.REVIEWED == "reviewed"
        assert RunbookStatus.APPROVED == "approved"
