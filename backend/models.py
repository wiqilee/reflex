"""
REFLEX — Data Models
Pydantic models for code analysis, failure scenarios, and runbook generation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


# === Enums ===

class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class FailureCategory(str, Enum):
    NETWORK = "network"
    DATABASE = "database"
    AUTHENTICATION = "authentication"
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    DATA_CORRUPTION = "data_corruption"
    DEPENDENCY = "dependency"
    CONFIGURATION = "configuration"
    CONCURRENCY = "concurrency"
    TIMEOUT = "timeout"
    PERMISSION = "permission"

class RunbookStatus(str, Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"


# === Input Models ===

class CodeInput(BaseModel):
    code: str = Field(..., description="Source code to analyze")
    filename: str = Field(default="untitled.py", description="Filename for context")
    language: str = Field(default="python", description="Programming language")
    context: Optional[str] = Field(default=None, description="Additional context about the service/system")

class MultiFileInput(BaseModel):
    files: list[CodeInput] = Field(..., description="List of code files to analyze")
    service_name: str = Field(default="my-service", description="Name of the service")
    context: Optional[str] = Field(default=None, description="System architecture context")


# === Analysis Models ===

class FailureScenario(BaseModel):
    id: str = Field(..., description="Unique identifier")
    title: str = Field(..., description="Short title of the failure scenario")
    description: str = Field(..., description="What goes wrong and why")
    category: FailureCategory
    severity: Severity
    severity_reasoning: str = Field(default="", description="Why this severity was chosen — references specific code patterns")
    trigger: str = Field(..., description="What triggers this failure")
    impact: str = Field(..., description="Business/user impact when this happens")
    affected_code: str = Field(..., description="File:line or function reference")
    likelihood: str = Field(..., description="How likely this is to happen: rare/occasional/frequent")

class DependencyNode(BaseModel):
    name: str
    type: str  # service, database, api, file, config
    failure_modes: list[str] = []

class DependencyEdge(BaseModel):
    source: str
    target: str
    relationship: str  # calls, reads, writes, depends_on

class DependencyGraph(BaseModel):
    nodes: list[DependencyNode] = []
    edges: list[DependencyEdge] = []


# === Runbook Models ===

class RunbookStep(BaseModel):
    order: int
    action: str = Field(..., description="What to do")
    command: Optional[str] = Field(default=None, description="CLI command if applicable")
    expected_output: Optional[str] = Field(default=None, description="What you should see")
    warning: Optional[str] = Field(default=None, description="Things to watch out for")
    estimated_time: str = Field(default="1-2 min", description="How long this step takes")
    access_required: Optional[str] = Field(default=None, description="Required permissions/access")

class Runbook(BaseModel):
    id: str
    title: str
    scenario: FailureScenario
    detection: list[RunbookStep] = Field(..., description="How to detect this incident")
    diagnosis: list[RunbookStep] = Field(..., description="How to diagnose root cause")
    fix: list[RunbookStep] = Field(..., description="How to fix/mitigate")
    rollback: list[RunbookStep] = Field(..., description="How to rollback if fix fails")
    prevention: list[str] = Field(..., description="Long-term prevention measures")
    estimated_resolution: str = Field(default="15-30 min", description="Total estimated resolution time")
    on_call_level: str = Field(default="L1", description="Minimum on-call level needed")
    last_updated: datetime = Field(default_factory=datetime.now)

class AnalysisResult(BaseModel):
    service_name: str
    files_analyzed: int
    scenarios: list[FailureScenario]
    runbooks: list[Runbook]
    dependency_graph: DependencyGraph
    overall_risk: Severity
    summary: str
    generated_at: datetime = Field(default_factory=datetime.now)
