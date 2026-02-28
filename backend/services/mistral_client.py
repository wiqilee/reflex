"""
REFLEX — Mistral AI Client
Handles all interactions with Mistral API for code analysis and runbook generation.
Uses function calling for structured output.
"""

import os
import json
from typing import Optional
from mistralai import Mistral

# === Tool Definitions for Function Calling ===

ANALYZE_FAILURE_TOOL = {
    "type": "function",
    "function": {
        "name": "report_failure_scenarios",
        "description": "Report all failure scenarios found in the code analysis",
        "parameters": {
            "type": "object",
            "properties": {
                "scenarios": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Short title of failure scenario"},
                            "description": {"type": "string", "description": "What goes wrong and why"},
                            "category": {"type": "string", "enum": ["network", "database", "authentication", "resource_exhaustion", "data_corruption", "dependency", "configuration", "concurrency", "timeout", "permission"]},
                            "severity": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
                            "severity_reasoning": {"type": "string", "description": "Explain WHY this severity was chosen. Reference specific code patterns: missing retry logic, no circuit breaker, hardcoded credentials, unvalidated input, number of downstream dependencies affected, etc."},
                            "trigger": {"type": "string", "description": "What triggers this failure"},
                            "impact": {"type": "string", "description": "Business/user impact"},
                            "affected_code": {"type": "string", "description": "File and line/function reference"},
                            "likelihood": {"type": "string", "enum": ["rare", "occasional", "frequent"]}
                        },
                        "required": ["title", "description", "category", "severity", "severity_reasoning", "trigger", "impact", "affected_code", "likelihood"]
                    }
                },
                "overall_risk": {"type": "string", "enum": ["critical", "high", "medium", "low"]},
                "summary": {"type": "string", "description": "Brief summary of the analysis"}
            },
            "required": ["scenarios", "overall_risk", "summary"]
        }
    }
}

GENERATE_RUNBOOK_TOOL = {
    "type": "function",
    "function": {
        "name": "generate_runbook",
        "description": "Generate a complete incident runbook for a failure scenario",
        "parameters": {
            "type": "object",
            "properties": {
                "detection": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "command": {"type": "string"},
                            "expected_output": {"type": "string"},
                            "estimated_time": {"type": "string"}
                        },
                        "required": ["action"]
                    },
                    "description": "Steps to detect the incident"
                },
                "diagnosis": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "command": {"type": "string"},
                            "expected_output": {"type": "string"},
                            "warning": {"type": "string"},
                            "estimated_time": {"type": "string"},
                            "access_required": {"type": "string"}
                        },
                        "required": ["action"]
                    },
                    "description": "Steps to diagnose root cause"
                },
                "fix": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "command": {"type": "string"},
                            "expected_output": {"type": "string"},
                            "warning": {"type": "string"},
                            "estimated_time": {"type": "string"},
                            "access_required": {"type": "string"}
                        },
                        "required": ["action"]
                    },
                    "description": "Steps to fix/mitigate"
                },
                "rollback": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "command": {"type": "string"},
                            "warning": {"type": "string"},
                            "estimated_time": {"type": "string"}
                        },
                        "required": ["action"]
                    },
                    "description": "Rollback steps if fix fails"
                },
                "prevention": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Long-term prevention measures"
                },
                "estimated_resolution": {"type": "string"},
                "on_call_level": {"type": "string", "enum": ["L1", "L2", "L3"]}
            },
            "required": ["detection", "diagnosis", "fix", "rollback", "prevention", "estimated_resolution", "on_call_level"]
        }
    }
}

EXTRACT_DEPENDENCIES_TOOL = {
    "type": "function",
    "function": {
        "name": "report_dependencies",
        "description": "Report the dependency graph extracted from code",
        "parameters": {
            "type": "object",
            "properties": {
                "nodes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "type": {"type": "string", "enum": ["service", "database", "api", "file", "config", "queue", "cache"]},
                            "failure_modes": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["name", "type"]
                    }
                },
                "edges": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source": {"type": "string"},
                            "target": {"type": "string"},
                            "relationship": {"type": "string", "enum": ["calls", "reads", "writes", "depends_on", "publishes", "subscribes"]}
                        },
                        "required": ["source", "target", "relationship"]
                    }
                }
            },
            "required": ["nodes", "edges"]
        }
    }
}


class ReflexMistral:
    """Mistral AI client for REFLEX code analysis and runbook generation."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("MISTRAL_API_KEY")
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY is required")
        self.client = Mistral(api_key=self.api_key)
        self.model = "mistral-large-latest"

    async def analyze_failures(self, code: str, filename: str, language: str, context: Optional[str] = None) -> dict:
        """Analyze code for potential failure scenarios using Mistral function calling."""

        system_prompt = """You are REFLEX, an expert incident response engineer and SRE. 
Your job is to analyze source code and identify every possible failure scenario that could 
cause a production incident.

Think like a senior SRE who has been woken up at 3 AM too many times. Look for:
- Unhandled errors and missing retry logic
- Network calls without timeouts or circuit breakers
- Database queries that could deadlock, timeout, or return unexpected results
- Resource leaks (connections, file handles, memory)
- Race conditions and concurrency issues
- Hardcoded values that will break at scale
- Missing input validation that could cause cascading failures
- Authentication/authorization gaps
- Configuration dependencies that could drift
- Missing health checks and monitoring blind spots

Be thorough. Be paranoid. Every line of code is a potential 3 AM wake-up call.

IMPORTANT: For each scenario, you MUST provide a severity_reasoning field that explains 
WHY you chose that severity level. Reference specific code patterns, line numbers, 
missing safeguards, and the number of downstream services affected. Do not just restate 
the severity — explain the technical evidence."""

        user_prompt = f"""Analyze this {language} code from `{filename}` for all possible failure scenarios:

```{language}
{code}
```"""
        if context:
            user_prompt += f"\n\nAdditional context about the system:\n{context}"

        response = await self.client.chat.complete_async(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            tools=[ANALYZE_FAILURE_TOOL],
            tool_choice="any"
        )

        # Extract function call result
        tool_call = response.choices[0].message.tool_calls[0]
        return json.loads(tool_call.function.arguments)

    async def generate_runbook(self, scenario: dict, code: str, filename: str) -> dict:
        """Generate a detailed runbook for a specific failure scenario."""

        system_prompt = """You are REFLEX, an expert SRE writing incident runbooks.
Generate a complete, actionable runbook that a junior engineer could follow at 3 AM 
while half-asleep and panicking.

Rules:
- Every step must be specific and actionable (not "check the logs" but "run: kubectl logs -f deployment/api -n production | grep ERROR")
- Include exact commands where possible
- Include expected output so the engineer knows if they're on the right track
- Include warnings for dangerous steps
- Estimate time for each step
- Specify required access level (L1: basic monitoring, L2: server access, L3: database/infra admin)
- Rollback steps must be safe and tested
- Prevention measures should be concrete engineering tasks, not platitudes"""

        user_prompt = f"""Generate a complete incident runbook for this failure scenario:

**Scenario:** {scenario['title']}
**Description:** {scenario['description']}
**Category:** {scenario['category']}
**Severity:** {scenario['severity']}
**Why this severity:** {scenario.get('severity_reasoning', 'N/A')}
**Trigger:** {scenario['trigger']}
**Impact:** {scenario['impact']}

**Affected code** (`{filename}`):
```
{code}
```

Generate detection steps, diagnosis steps, fix steps, rollback steps, and prevention measures."""

        response = await self.client.chat.complete_async(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            tools=[GENERATE_RUNBOOK_TOOL],
            tool_choice="any"
        )

        tool_call = response.choices[0].message.tool_calls[0]
        return json.loads(tool_call.function.arguments)

    async def validate_runbook(self, runbook: dict, scenario: dict, code: str) -> dict:
        """Second-pass validation: review generated runbook for accuracy and specificity.
        Returns the runbook with corrections applied."""

        system_prompt = """You are a senior SRE reviewer validating an auto-generated incident runbook.

Review EVERY step and check:
1. Are the commands correct for this specific codebase? (not generic placeholder commands)
2. Are expected outputs realistic for this failure scenario?
3. Are there missing steps that a 3 AM engineer would need?
4. Are rollback steps actually safe? Could they cause more damage?
5. Are access levels (L1/L2/L3) correctly assigned?
6. Are time estimates realistic?

Return the CORRECTED runbook using the generate_runbook tool. Fix any issues you find.
If a command is too generic (like "check the logs"), replace it with the specific command 
for this codebase. If a step is missing, add it. If a step is dangerous without a warning, 
add the warning."""

        user_prompt = f"""Validate and improve this auto-generated runbook:

**Scenario:** {scenario['title']} ({scenario['severity']})
**Trigger:** {scenario['trigger']}

**Original code being analyzed:**
```
{code[:2000]}
```

**Generated runbook to validate:**
{json.dumps(runbook, indent=2)[:3000]}

Review every step. Fix inaccurate commands, add missing steps, correct access levels. 
Return the improved version."""

        try:
            response = await self.client.chat.complete_async(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                tools=[GENERATE_RUNBOOK_TOOL],
                tool_choice="any"
            )
            tool_call = response.choices[0].message.tool_calls[0]
            return json.loads(tool_call.function.arguments)
        except Exception:
            # If validation fails, return original runbook
            return runbook

    async def extract_dependencies(self, code: str, filename: str, language: str) -> dict:
        """Extract dependency graph from code."""

        system_prompt = """You are REFLEX, analyzing code to extract its dependency graph.
Identify all external dependencies: services, databases, APIs, files, configs, queues, caches.
Map how they connect and what happens when each one fails."""

        user_prompt = f"""Extract the dependency graph from this {language} code (`{filename}`):

```{language}
{code}
```

Identify all nodes (services, databases, APIs, etc.) and edges (how they connect)."""

        response = await self.client.chat.complete_async(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            tools=[EXTRACT_DEPENDENCIES_TOOL],
            tool_choice="any"
        )

        tool_call = response.choices[0].message.tool_calls[0]
        return json.loads(tool_call.function.arguments)
