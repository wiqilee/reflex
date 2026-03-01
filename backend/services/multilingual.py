"""
REFLEX — Multilingual Runbook Service
Feature 14: Translate runbooks to multiple languages using Mistral AI.
Leverages Mistral's strong multilingual capabilities.
"""

import json

from backend.services.mistral_client import ReflexMistral

SUPPORTED_LANGUAGES = {
    "en": "English",
    "id": "Indonesian",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Simplified)",
    "ar": "Arabic",
    "hi": "Hindi",
    "ru": "Russian",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "nl": "Dutch",
    "it": "Italian",
    "pl": "Polish",
}

TRANSLATE_TOOL = {
    "type": "function",
    "function": {
        "name": "deliver_translation",
        "description": "Deliver the translated runbook content",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Translated title"},
                "overview_description": {"type": "string"},
                "overview_trigger": {"type": "string"},
                "overview_impact": {"type": "string"},
                "detection_steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "expected_output": {"type": "string"},
                            "warning": {"type": "string"}
                        },
                        "required": ["action"]
                    }
                },
                "diagnosis_steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "expected_output": {"type": "string"},
                            "warning": {"type": "string"}
                        },
                        "required": ["action"]
                    }
                },
                "fix_steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "expected_output": {"type": "string"},
                            "warning": {"type": "string"}
                        },
                        "required": ["action"]
                    }
                },
                "rollback_steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "action": {"type": "string"},
                            "warning": {"type": "string"}
                        },
                        "required": ["action"]
                    }
                },
                "prevention": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            },
            "required": ["title", "overview_description", "overview_trigger", "overview_impact",
                         "detection_steps", "diagnosis_steps", "fix_steps", "rollback_steps", "prevention"]
        }
    }
}


class MultilingualService:
    """Translate runbooks to any supported language using Mistral."""

    def __init__(self, mistral: ReflexMistral):
        self.mistral = mistral

    @staticmethod
    def get_supported_languages() -> dict[str, str]:
        return SUPPORTED_LANGUAGES

    async def translate_runbook(self, runbook_markdown: str, target_lang: str) -> str:
        """Translate a full runbook markdown to target language."""
        
        lang_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

        system_prompt = f"""You are a professional technical translator specializing in DevOps and SRE documentation.
Translate the following incident runbook to {lang_name}.

Critical rules:
- NEVER translate: code commands, CLI commands, file paths, variable names, service names, error messages, log patterns
- NEVER translate: content inside ```code blocks```
- DO translate: all human-readable descriptions, instructions, warnings, explanations
- Keep the exact same Markdown formatting (headers, bullets, bold, code blocks)
- Use technical terminology appropriate for {lang_name}-speaking DevOps engineers
- Keep the tone professional and actionable — this is read during incidents"""

        response = await self.mistral.client.chat.complete_async(
            model=self.mistral.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Translate this runbook to {lang_name}:\n\n{runbook_markdown}"}
            ],
            max_tokens=4096
        )

        return response.choices[0].message.content

    async def translate_runbook_structured(self, runbook_dict: dict, target_lang: str) -> dict:
        """Translate runbook using structured function calling for precise output."""
        
        lang_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)

        system_prompt = f"""You are a professional technical translator for DevOps/SRE documentation.
Translate the runbook content to {lang_name}.

NEVER translate: code commands, CLI commands, file paths, variable names, service names, technical identifiers.
DO translate: descriptions, instructions, warnings, explanations.
Use natural {lang_name} technical terminology that DevOps engineers would use."""

        user_prompt = f"""Translate this runbook to {lang_name}:

Title: {runbook_dict.get('title', '')}
Description: {runbook_dict.get('description', '')}
Trigger: {runbook_dict.get('trigger', '')}
Impact: {runbook_dict.get('impact', '')}

Detection steps:
{json.dumps(runbook_dict.get('detection', []), indent=2)}

Diagnosis steps:
{json.dumps(runbook_dict.get('diagnosis', []), indent=2)}

Fix steps:
{json.dumps(runbook_dict.get('fix', []), indent=2)}

Rollback steps:
{json.dumps(runbook_dict.get('rollback', []), indent=2)}

Prevention:
{json.dumps(runbook_dict.get('prevention', []), indent=2)}
"""

        response = await self.mistral.client.chat.complete_async(
            model=self.mistral.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            tools=[TRANSLATE_TOOL],
            tool_choice="any"
        )

        tool_call = response.choices[0].message.tool_calls[0]
        return json.loads(tool_call.function.arguments)
