// ============================================================
// Code Complexity Scoring (add to existing lib.rs)
// ============================================================
// Cyclomatic complexity, nesting depth, and coupling metrics
// computed entirely client-side in WASM for sub-ms performance.

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct ComplexityResult {
    pub cyclomatic: u32,
    pub max_nesting: u32,
    pub avg_nesting: f64,
    pub lines_of_code: u32,
    pub blank_lines: u32,
    pub comment_lines: u32,
    pub function_count: u32,
    pub coupling_score: f64,
    pub risk_label: String,
    pub hotspots: Vec<Hotspot>,
}

#[derive(Serialize, Deserialize)]
pub struct Hotspot {
    pub line: u32,
    pub complexity: u32,
    pub nesting: u32,
    pub reason: String,
}

/// Compute cyclomatic complexity for a code string.
///
/// Cyclomatic complexity = number of decision points + 1.
/// Decision points: if, else if, elif, for, while, case, catch,
/// except, &&, ||, ternary (?), match arms (=>).
#[wasm_bindgen]
pub fn analyze_complexity(code: &str, language: &str) -> JsValue {
    let lines: Vec<&str> = code.lines().collect();
    let total_lines = lines.len() as u32;

    let mut cyclomatic: u32 = 1; // base path
    let mut max_nesting: u32 = 0;
    let mut current_nesting: u32 = 0;
    let mut nesting_sum: u64 = 0;
    let mut nesting_count: u64 = 0;
    let mut blank_lines: u32 = 0;
    let mut comment_lines: u32 = 0;
    let mut function_count: u32 = 0;
    let mut hotspots: Vec<Hotspot> = Vec::new();
    let mut imports: Vec<String> = Vec::new();

    // Language-specific patterns
    let comment_prefix = match language {
        "python" => "#",
        "rust" => "//",
        "go" => "//",
        "java" => "//",
        "typescript" | "javascript" => "//",
        "yaml" => "#",
        _ => "//",
    };

    let fn_keywords: Vec<&str> = match language {
        "python" => vec!["def ", "async def "],
        "rust" => vec!["fn ", "pub fn ", "async fn ", "pub async fn "],
        "go" => vec!["func "],
        "java" => vec!["public ", "private ", "protected ", "void ", "static "],
        "typescript" | "javascript" => vec!["function ", "const ", "async function ", "=> {"],
        _ => vec!["fn ", "def ", "func ", "function "],
    };

    let branch_keywords: Vec<&str> = match language {
        "python" => vec!["if ", "elif ", "for ", "while ", "except ", "except:", "and ", "or "],
        "rust" => vec!["if ", "else if ", "for ", "while ", "match ", "=> ", "&&", "||"],
        "go" => vec!["if ", "else if ", "for ", "switch ", "case ", "&&", "||"],
        "java" => vec!["if ", "else if ", "for ", "while ", "switch ", "case ", "catch ", "&&", "||"],
        "typescript" | "javascript" => vec!["if ", "else if ", "for ", "while ", "switch ", "case ", "catch ", "? ", "&&", "||"],
        _ => vec!["if ", "else if ", "for ", "while ", "&&", "||"],
    };

    let nesting_open = match language {
        "python" => ":",
        _ => "{",
    };

    let nesting_close = match language {
        "python" => "",  // Python uses indentation; we track indent level instead
        _ => "}",
    };

    let mut prev_indent: usize = 0;

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        let line_num = (i + 1) as u32;

        // Blank line
        if trimmed.is_empty() {
            blank_lines += 1;
            continue;
        }

        // Comment line
        if trimmed.starts_with(comment_prefix) {
            comment_lines += 1;
            continue;
        }

        // Function detection
        for kw in &fn_keywords {
            if trimmed.contains(kw) && !trimmed.starts_with(comment_prefix) {
                function_count += 1;
                break;
            }
        }

        // Branch complexity
        let mut line_complexity: u32 = 0;
        for kw in &branch_keywords {
            let count = trimmed.matches(kw).count() as u32;
            line_complexity += count;
            cyclomatic += count;
        }

        // Ternary operator
        if trimmed.contains("? ") && trimmed.contains(" : ") {
            line_complexity += 1;
            cyclomatic += 1;
        }

        // Nesting tracking
        if language == "python" {
            // Python: track indentation level
            let indent = line.len() - line.trim_start().len();
            let indent_level = (indent / 4) as u32;
            current_nesting = indent_level;
        } else {
            // Brace-based languages
            let opens = trimmed.matches(nesting_open).count() as u32;
            let closes = trimmed.matches(nesting_close).count() as u32;
            current_nesting = current_nesting.saturating_add(opens).saturating_sub(closes);
        }

        if current_nesting > max_nesting {
            max_nesting = current_nesting;
        }
        nesting_sum += current_nesting as u64;
        nesting_count += 1;

        // Import tracking for coupling score
        if trimmed.starts_with("import ") || trimmed.starts_with("from ") || trimmed.starts_with("use ") || trimmed.starts_with("require(") {
            imports.push(trimmed.to_string());
        }

        // Hotspot detection: high complexity or deep nesting on a single line
        if line_complexity >= 2 || current_nesting >= 4 {
            let reason = if line_complexity >= 2 && current_nesting >= 4 {
                format!("{} branches at nesting depth {}", line_complexity, current_nesting)
            } else if line_complexity >= 2 {
                format!("{} decision points on single line", line_complexity)
            } else {
                format!("nesting depth {} exceeds threshold", current_nesting)
            };

            hotspots.push(Hotspot {
                line: line_num,
                complexity: line_complexity,
                nesting: current_nesting,
                reason,
            });
        }

        prev_indent = line.len() - line.trim_start().len();
    }

    let avg_nesting = if nesting_count > 0 {
        (nesting_sum as f64) / (nesting_count as f64)
    } else {
        0.0
    };

    // Coupling score: ratio of imports to functions (higher = more coupled)
    let coupling_score = if function_count > 0 {
        (imports.len() as f64) / (function_count as f64)
    } else {
        imports.len() as f64
    };

    // Risk label
    let risk_label = if cyclomatic > 20 || max_nesting > 6 {
        "high".to_string()
    } else if cyclomatic > 10 || max_nesting > 4 {
        "medium".to_string()
    } else {
        "low".to_string()
    };

    let result = ComplexityResult {
        cyclomatic,
        max_nesting,
        avg_nesting: (avg_nesting * 100.0).round() / 100.0,
        lines_of_code: total_lines - blank_lines - comment_lines,
        blank_lines,
        comment_lines,
        function_count,
        coupling_score: (coupling_score * 100.0).round() / 100.0,
        risk_label,
        hotspots,
    };

    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

/// Batch analyze multiple files and return aggregate metrics.
#[wasm_bindgen]
pub fn analyze_complexity_batch(codes: &str, languages: &str) -> JsValue {
    // codes and languages are JSON arrays
    let code_list: Vec<String> = serde_json::from_str(codes).unwrap_or_default();
    let lang_list: Vec<String> = serde_json::from_str(languages).unwrap_or_default();

    let mut total_cyclomatic: u32 = 0;
    let mut worst_nesting: u32 = 0;
    let mut total_loc: u32 = 0;
    let mut total_functions: u32 = 0;
    let mut all_hotspots: Vec<Hotspot> = Vec::new();

    for (i, code) in code_list.iter().enumerate() {
        let lang = lang_list.get(i).map(|s| s.as_str()).unwrap_or("python");
        let js_result = analyze_complexity(code, lang);
        if let Ok(result) = serde_wasm_bindgen::from_value::<ComplexityResult>(js_result) {
            total_cyclomatic += result.cyclomatic;
            if result.max_nesting > worst_nesting {
                worst_nesting = result.max_nesting;
            }
            total_loc += result.lines_of_code;
            total_functions += result.function_count;
            all_hotspots.extend(result.hotspots);
        }
    }

    let risk_label = if total_cyclomatic > 50 || worst_nesting > 6 {
        "high".to_string()
    } else if total_cyclomatic > 25 || worst_nesting > 4 {
        "medium".to_string()
    } else {
        "low".to_string()
    };

    let aggregate = serde_json::json!({
        "total_cyclomatic": total_cyclomatic,
        "worst_nesting": worst_nesting,
        "total_loc": total_loc,
        "total_functions": total_functions,
        "hotspot_count": all_hotspots.len(),
        "risk_label": risk_label,
    });

    serde_wasm_bindgen::to_value(&aggregate).unwrap_or(JsValue::NULL)
}
