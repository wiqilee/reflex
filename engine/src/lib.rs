//! REFLEX Engine — Failure Path Simulation + Code Complexity
//! 
//! Rust → WebAssembly engine for:
//! - Failure path simulation (Monte Carlo)
//! - Cascading failure scoring
//! - Dependency graph risk calculation
//! - Blast radius calculation
//! - Cyclomatic complexity scoring
//! - Nesting depth analysis
//! - Coupling metrics
//!
//! Runs in the browser at sub-millisecond speed.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

// ============================================================
// Data Structures
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub name: String,
    pub node_type: String,
    pub failure_probability: f64,
    pub recovery_time_seconds: f64,
    pub users_affected: u64,
    pub failure_modes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
    pub relationship: String,
    pub failure_propagation: f64,
    pub is_critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyGraph {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

// ============================================================
// Result Structures
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub total_simulations: u32,
    pub failure_paths: Vec<FailurePath>,
    pub node_failure_frequency: HashMap<String, f64>,
    pub mean_cascade_depth: f64,
    pub max_cascade_depth: u32,
    pub mean_recovery_time: f64,
    pub worst_case_recovery_time: f64,
    pub system_availability: f64,
    pub execution_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailurePath {
    pub origin: String,
    pub chain: Vec<String>,
    pub depth: u32,
    pub total_recovery_time: f64,
    pub users_affected: u64,
    pub probability: f64,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskScore {
    pub overall_score: f64,
    pub grade: String,
    pub node_scores: Vec<NodeRisk>,
    pub critical_paths: Vec<Vec<String>>,
    pub single_points_of_failure: Vec<String>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeRisk {
    pub name: String,
    pub risk_score: f64,
    pub is_single_point_of_failure: bool,
    pub downstream_count: u32,
    pub cascade_potential: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastRadius {
    pub origin: String,
    pub affected_nodes: Vec<String>,
    pub affected_count: u32,
    pub total_users_affected: u64,
    pub cascade_depth: u32,
    pub estimated_recovery_time: f64,
    pub severity: String,
    pub propagation_tree: Vec<PropagationStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropagationStep {
    pub from_node: String,
    pub to_node: String,
    pub propagation_probability: f64,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CascadeScore {
    pub node_name: String,
    pub cascade_score: f64,
    pub max_depth: u32,
    pub max_nodes_affected: u32,
    pub max_users_affected: u64,
    pub worst_path: Vec<String>,
}

// ============================================================
// Code Complexity Structures
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hotspot {
    pub line: u32,
    pub complexity: u32,
    pub nesting: u32,
    pub reason: String,
}

// ============================================================
// Simple RNG (xorshift64)
// ============================================================

struct Rng {
    state: u64,
}

impl Rng {
    fn new(seed: u64) -> Self {
        Rng { state: if seed == 0 { 1 } else { seed } }
    }

    fn next_u64(&mut self) -> u64 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        self.state
    }

    fn next_f64(&mut self) -> f64 {
        (self.next_u64() as f64) / (u64::MAX as f64)
    }
}

// ============================================================
// Core Engine
// ============================================================

pub struct ReflexEngine {
    graph: DependencyGraph,
    adjacency: HashMap<String, Vec<(String, f64, bool)>>,
    reverse_adjacency: HashMap<String, Vec<String>>,
    node_map: HashMap<String, Node>,
}

impl ReflexEngine {
    pub fn new(graph: DependencyGraph) -> Self {
        let mut adjacency: HashMap<String, Vec<(String, f64, bool)>> = HashMap::new();
        let mut reverse_adjacency: HashMap<String, Vec<String>> = HashMap::new();
        let mut node_map: HashMap<String, Node> = HashMap::new();

        for node in &graph.nodes {
            node_map.insert(node.name.clone(), node.clone());
            adjacency.entry(node.name.clone()).or_default();
            reverse_adjacency.entry(node.name.clone()).or_default();
        }

        for edge in &graph.edges {
            adjacency
                .entry(edge.source.clone())
                .or_default()
                .push((edge.target.clone(), edge.failure_propagation, edge.is_critical));
            reverse_adjacency
                .entry(edge.target.clone())
                .or_default()
                .push(edge.source.clone());
        }

        ReflexEngine { graph, adjacency, reverse_adjacency, node_map }
    }

    pub fn simulate(&self, num_simulations: u32, seed: u64) -> SimulationResult {
        let start = js_sys::Date::now();
        let mut rng = Rng::new(seed);
        let mut all_paths: Vec<FailurePath> = Vec::new();
        let mut node_fail_count: HashMap<String, u32> = HashMap::new();
        let mut total_depth: u64 = 0;
        let mut max_depth: u32 = 0;
        let mut total_recovery: f64 = 0.0;
        let mut worst_recovery: f64 = 0.0;

        for node in &self.graph.nodes {
            node_fail_count.insert(node.name.clone(), 0);
        }

        for _ in 0..num_simulations {
            let origin = self.pick_random_failure(&mut rng);
            if origin.is_none() { continue; }
            let origin = origin.unwrap();

            let path = self.simulate_cascade(&origin, &mut rng);

            for node_name in &path.chain {
                *node_fail_count.entry(node_name.clone()).or_insert(0) += 1;
            }

            total_depth += path.depth as u64;
            if path.depth > max_depth { max_depth = path.depth; }
            total_recovery += path.total_recovery_time;
            if path.total_recovery_time > worst_recovery {
                worst_recovery = path.total_recovery_time;
            }

            all_paths.push(path);
        }

        let mut node_failure_frequency: HashMap<String, f64> = HashMap::new();
        for (name, count) in &node_fail_count {
            node_failure_frequency.insert(
                name.clone(),
                (*count as f64) / (num_simulations as f64) * 100.0,
            );
        }

        all_paths.sort_by(|a, b| b.users_affected.cmp(&a.users_affected));
        all_paths.truncate(50);

        let mean_depth = if num_simulations > 0 {
            total_depth as f64 / num_simulations as f64
        } else { 0.0 };

        let mean_recovery = if num_simulations > 0 {
            total_recovery / num_simulations as f64
        } else { 0.0 };

        let total_failure_prob: f64 = self.graph.nodes.iter()
            .map(|n| n.failure_probability)
            .sum();
        let estimated_downtime_per_year = total_failure_prob * mean_recovery * 365.25 * 24.0;
        let total_seconds_per_year = 365.25 * 24.0 * 3600.0;
        let availability = ((total_seconds_per_year - estimated_downtime_per_year) / total_seconds_per_year * 100.0)
            .max(0.0).min(100.0);

        let elapsed = js_sys::Date::now() - start;

        SimulationResult {
            total_simulations: num_simulations,
            failure_paths: all_paths,
            node_failure_frequency,
            mean_cascade_depth: mean_depth,
            max_cascade_depth: max_depth,
            mean_recovery_time: mean_recovery,
            worst_case_recovery_time: worst_recovery,
            system_availability: (availability * 1000.0).round() / 1000.0,
            execution_time_ms: elapsed,
        }
    }

    fn pick_random_failure(&self, rng: &mut Rng) -> Option<String> {
        let total_prob: f64 = self.graph.nodes.iter().map(|n| n.failure_probability).sum();
        if total_prob == 0.0 { return self.graph.nodes.first().map(|n| n.name.clone()); }

        let mut roll = rng.next_f64() * total_prob;
        for node in &self.graph.nodes {
            roll -= node.failure_probability;
            if roll <= 0.0 {
                return Some(node.name.clone());
            }
        }
        self.graph.nodes.last().map(|n| n.name.clone())
    }

    fn simulate_cascade(&self, origin: &str, rng: &mut Rng) -> FailurePath {
        let mut failed: HashSet<String> = HashSet::new();
        let mut chain: Vec<String> = Vec::new();
        let mut queue: VecDeque<(String, u32)> = VecDeque::new();
        let mut max_depth: u32 = 0;
        let mut total_recovery = 0.0;
        let mut total_users: u64 = 0;
        let mut probability = 1.0;

        failed.insert(origin.to_string());
        chain.push(origin.to_string());
        queue.push_back((origin.to_string(), 0));

        if let Some(node) = self.node_map.get(origin) {
            total_recovery += node.recovery_time_seconds;
            total_users += node.users_affected;
            probability *= node.failure_probability;
        }

        while let Some((current, depth)) = queue.pop_front() {
            if depth > 20 { break; }

            if let Some(targets) = self.adjacency.get(&current) {
                for (target, prop_prob, is_critical) in targets {
                    if failed.contains(target) { continue; }

                    let will_propagate = if *is_critical {
                        true
                    } else {
                        rng.next_f64() < *prop_prob
                    };

                    if will_propagate {
                        failed.insert(target.clone());
                        chain.push(target.clone());
                        queue.push_back((target.clone(), depth + 1));

                        if depth + 1 > max_depth { max_depth = depth + 1; }

                        if let Some(node) = self.node_map.get(target) {
                            total_recovery += node.recovery_time_seconds;
                            total_users += node.users_affected;
                            probability *= prop_prob;
                        }
                    }
                }
            }
        }

        let severity = match (chain.len(), total_users) {
            (_, u) if u > 100_000 => "critical",
            (n, _) if n > 5 => "critical",
            (_, u) if u > 10_000 => "high",
            (n, _) if n > 3 => "high",
            (_, u) if u > 1_000 => "medium",
            _ => "low",
        };

        FailurePath {
            origin: origin.to_string(),
            chain,
            depth: max_depth,
            total_recovery_time: total_recovery,
            users_affected: total_users,
            probability,
            severity: severity.to_string(),
        }
    }

    pub fn cascade_scores(&self) -> Vec<CascadeScore> {
        let mut scores: Vec<CascadeScore> = Vec::new();

        for node in &self.graph.nodes {
            let blast = self.calculate_blast_radius(&node.name);
            
            let depth_factor = (blast.cascade_depth as f64 / 10.0).min(1.0) * 30.0;
            let nodes_factor = (blast.affected_count as f64 / self.graph.nodes.len() as f64) * 40.0;
            let users_factor = if blast.total_users_affected > 100_000 { 30.0 }
                else if blast.total_users_affected > 10_000 { 20.0 }
                else if blast.total_users_affected > 1_000 { 10.0 }
                else { 5.0 };

            let score = (depth_factor + nodes_factor + users_factor).min(100.0);

            scores.push(CascadeScore {
                node_name: node.name.clone(),
                cascade_score: (score * 100.0).round() / 100.0,
                max_depth: blast.cascade_depth,
                max_nodes_affected: blast.affected_count,
                max_users_affected: blast.total_users_affected,
                worst_path: blast.affected_nodes.clone(),
            });
        }

        scores.sort_by(|a, b| b.cascade_score.partial_cmp(&a.cascade_score).unwrap());
        scores
    }

    pub fn risk_score(&self) -> RiskScore {
        let mut node_risks: Vec<NodeRisk> = Vec::new();
        let spofs = self.find_single_points_of_failure();
        let critical_paths = self.find_critical_paths();

        for node in &self.graph.nodes {
            let downstream = self.count_downstream(&node.name);
            let blast = self.calculate_blast_radius(&node.name);
            let is_spof = spofs.contains(&node.name);

            let cascade_potential = if self.graph.nodes.len() > 1 {
                blast.affected_count as f64 / (self.graph.nodes.len() - 1) as f64
            } else { 0.0 };

            let risk = node.failure_probability * 20.0
                + cascade_potential * 40.0
                + if is_spof { 30.0 } else { 0.0 }
                + (downstream as f64 / self.graph.nodes.len().max(1) as f64) * 10.0;

            node_risks.push(NodeRisk {
                name: node.name.clone(),
                risk_score: (risk.min(100.0) * 100.0).round() / 100.0,
                is_single_point_of_failure: is_spof,
                downstream_count: downstream,
                cascade_potential: (cascade_potential * 100.0).round() / 100.0,
            });
        }

        node_risks.sort_by(|a, b| b.risk_score.partial_cmp(&a.risk_score).unwrap());

        let overall = if node_risks.is_empty() { 0.0 } else {
            let top_n = node_risks.len().min(5);
            let sum: f64 = node_risks[..top_n].iter().map(|n| n.risk_score).sum();
            sum / top_n as f64
        };

        let grade = match overall as u32 {
            0..=10 => "A+",
            11..=20 => "A",
            21..=30 => "B+",
            31..=40 => "B",
            41..=50 => "C+",
            51..=60 => "C",
            61..=70 => "D",
            _ => "F",
        };

        let mut recommendations: Vec<String> = Vec::new();
        if !spofs.is_empty() {
            recommendations.push(format!(
                "Add redundancy for single points of failure: {}",
                spofs.join(", ")
            ));
        }
        for nr in node_risks.iter().take(3) {
            if nr.cascade_potential > 0.5 {
                recommendations.push(format!(
                    "Add circuit breaker for '{}' - cascade potential {:.0}%",
                    nr.name, nr.cascade_potential * 100.0
                ));
            }
        }
        if critical_paths.len() > 3 {
            recommendations.push("Too many critical paths - consider decoupling services".to_string());
        }

        RiskScore {
            overall_score: (overall * 100.0).round() / 100.0,
            grade: grade.to_string(),
            node_scores: node_risks,
            critical_paths,
            single_points_of_failure: spofs,
            recommendations,
        }
    }

    pub fn calculate_blast_radius(&self, origin: &str) -> BlastRadius {
        let mut affected: Vec<String> = Vec::new();
        let mut visited: HashSet<String> = HashSet::new();
        let mut queue: VecDeque<(String, u32)> = VecDeque::new();
        let mut max_depth: u32 = 0;
        let mut total_users: u64 = 0;
        let mut total_recovery: f64 = 0.0;
        let mut propagation_tree: Vec<PropagationStep> = Vec::new();

        visited.insert(origin.to_string());
        queue.push_back((origin.to_string(), 0));

        if let Some(node) = self.node_map.get(origin) {
            total_users += node.users_affected;
            total_recovery += node.recovery_time_seconds;
        }

        while let Some((current, depth)) = queue.pop_front() {
            if depth > 20 { break; }

            if let Some(targets) = self.adjacency.get(&current) {
                for (target, prop_prob, is_critical) in targets {
                    if visited.contains(target) { continue; }
                    if *prop_prob > 0.0 || *is_critical {
                        visited.insert(target.clone());
                        affected.push(target.clone());
                        queue.push_back((target.clone(), depth + 1));

                        if depth + 1 > max_depth { max_depth = depth + 1; }

                        propagation_tree.push(PropagationStep {
                            from_node: current.clone(),
                            to_node: target.clone(),
                            propagation_probability: *prop_prob,
                            depth: depth + 1,
                        });

                        if let Some(node) = self.node_map.get(target) {
                            total_users += node.users_affected;
                            total_recovery += node.recovery_time_seconds;
                        }
                    }
                }
            }
        }

        let severity = match (affected.len(), total_users) {
            (_, u) if u > 100_000 => "critical",
            (n, _) if n > 5 => "critical",
            (_, u) if u > 10_000 => "high",
            (n, _) if n > 3 => "high",
            (_, u) if u > 1_000 => "medium",
            _ => "low",
        };

        BlastRadius {
            origin: origin.to_string(),
            affected_nodes: affected.clone(),
            affected_count: affected.len() as u32,
            total_users_affected: total_users,
            cascade_depth: max_depth,
            estimated_recovery_time: total_recovery,
            severity: severity.to_string(),
            propagation_tree,
        }
    }

    fn find_single_points_of_failure(&self) -> Vec<String> {
        let mut spofs: Vec<String> = Vec::new();
        for node in &self.graph.nodes {
            let downstream = self.count_downstream(&node.name);
            let has_redundancy = self.has_alternative_path(&node.name);
            if downstream > 0 && !has_redundancy {
                spofs.push(node.name.clone());
            }
        }
        spofs
    }

    fn has_alternative_path(&self, node_name: &str) -> bool {
        if let Some(targets) = self.adjacency.get(node_name) {
            for (target, _, _) in targets {
                let sources = self.reverse_adjacency.get(target).cloned().unwrap_or_default();
                let other_sources: Vec<_> = sources.iter().filter(|s| *s != node_name).collect();
                if !other_sources.is_empty() {
                    return true;
                }
            }
        }
        false
    }

    fn count_downstream(&self, node_name: &str) -> u32 {
        let mut visited: HashSet<String> = HashSet::new();
        let mut queue: VecDeque<String> = VecDeque::new();

        visited.insert(node_name.to_string());
        queue.push_back(node_name.to_string());

        while let Some(current) = queue.pop_front() {
            if let Some(targets) = self.adjacency.get(&current) {
                for (target, _, _) in targets {
                    if !visited.contains(target) {
                        visited.insert(target.clone());
                        queue.push_back(target.clone());
                    }
                }
            }
        }

        (visited.len() - 1) as u32
    }

    fn find_critical_paths(&self) -> Vec<Vec<String>> {
        let mut paths: Vec<Vec<String>> = Vec::new();

        for edge in &self.graph.edges {
            if edge.is_critical {
                let mut path = vec![edge.source.clone(), edge.target.clone()];
                let mut current = edge.target.clone();

                loop {
                    let next = self.adjacency.get(&current)
                        .and_then(|targets| {
                            targets.iter()
                                .find(|(_, _, is_crit)| *is_crit)
                                .map(|(t, _, _)| t.clone())
                        });

                    match next {
                        Some(n) if !path.contains(&n) => {
                            path.push(n.clone());
                            current = n;
                        }
                        _ => break,
                    }
                }

                if path.len() >= 2 {
                    paths.push(path);
                }
            }
        }

        paths.sort_by(|a, b| b.len().cmp(&a.len()));
        paths.truncate(10);
        paths
    }
}


// ============================================================
// Code Complexity Analyzer
// ============================================================

/// Analyze cyclomatic complexity, nesting depth, and coupling
/// for a given source code string. Runs entirely client-side.
fn analyze_complexity_inner(code: &str, language: &str) -> ComplexityResult {
    let lines: Vec<&str> = code.lines().collect();
    let total_lines = lines.len() as u32;

    let mut cyclomatic: u32 = 1;
    let mut max_nesting: u32 = 0;
    let mut current_nesting: u32 = 0;
    let mut nesting_sum: u64 = 0;
    let mut code_lines: u64 = 0;
    let mut blank_lines: u32 = 0;
    let mut comment_lines: u32 = 0;
    let mut function_count: u32 = 0;
    let mut hotspots: Vec<Hotspot> = Vec::new();
    let mut import_count: u32 = 0;

    let comment_prefix: &[&str] = match language {
        "python" => &["#"],
        "yaml" => &["#"],
        "rust" => &["//", "///", "//!"],
        "go" | "java" | "typescript" | "javascript" => &["//"],
        _ => &["//", "#"],
    };

    let branch_patterns: &[&str] = match language {
        "python" => &["if ", "elif ", "for ", "while ", "except ", "except:", " and ", " or ", " if "],
        "rust" => &["if ", "else if ", "for ", "while ", "match ", "=> {", "&&", "||"],
        "go" => &["if ", "else if ", "for ", "switch ", "case ", "&&", "||"],
        "java" => &["if (", "else if ", "for (", "while (", "switch ", "case ", "catch (", "&&", "||"],
        "typescript" | "javascript" => &["if (", "else if ", "for (", "while (", "switch ", "case ", "catch (", "? ", "&&", "||"],
        _ => &["if ", "else if ", "for ", "while ", "&&", "||"],
    };

    let fn_patterns: &[&str] = match language {
        "python" => &["def ", "async def ", "class "],
        "rust" => &["fn ", "pub fn ", "async fn ", "pub async fn ", "impl "],
        "go" => &["func "],
        "java" => &["public ", "private ", "protected ", "void "],
        "typescript" | "javascript" => &["function ", "async function ", "=> {", "export default", "export function"],
        _ => &["fn ", "def ", "func ", "function "],
    };

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        let line_num = (i + 1) as u32;

        if trimmed.is_empty() {
            blank_lines += 1;
            continue;
        }

        let is_comment = comment_prefix.iter().any(|p| trimmed.starts_with(p));
        if is_comment {
            comment_lines += 1;
            continue;
        }

        code_lines += 1;

        // Function detection
        for pat in fn_patterns {
            if trimmed.contains(pat) {
                function_count += 1;
                break;
            }
        }

        // Branch complexity
        let mut line_complexity: u32 = 0;
        for pat in branch_patterns {
            line_complexity += trimmed.matches(pat).count() as u32;
        }
        cyclomatic += line_complexity;

        // Nesting tracking
        if language == "python" {
            let indent = line.len() - line.trim_start().len();
            current_nesting = (indent / 4) as u32;
        } else {
            let opens = trimmed.matches('{').count() as u32;
            let closes = trimmed.matches('}').count() as u32;
            current_nesting = current_nesting.saturating_add(opens).saturating_sub(closes);
        }

        if current_nesting > max_nesting {
            max_nesting = current_nesting;
        }
        nesting_sum += current_nesting as u64;

        // Import tracking
        if trimmed.starts_with("import ") || trimmed.starts_with("from ")
            || trimmed.starts_with("use ") || trimmed.starts_with("require(")
            || trimmed.starts_with("const ") && trimmed.contains("require(")
        {
            import_count += 1;
        }

        // Hotspot detection
        if line_complexity >= 2 || current_nesting >= 4 {
            let reason = if line_complexity >= 2 && current_nesting >= 4 {
                format!("{} branches at depth {}", line_complexity, current_nesting)
            } else if line_complexity >= 2 {
                format!("{} decision points on one line", line_complexity)
            } else {
                format!("nesting depth {} exceeds safe threshold", current_nesting)
            };

            hotspots.push(Hotspot {
                line: line_num,
                complexity: line_complexity,
                nesting: current_nesting,
                reason,
            });
        }
    }

    let avg_nesting = if code_lines > 0 {
        (nesting_sum as f64) / (code_lines as f64)
    } else {
        0.0
    };

    let coupling_score = if function_count > 0 {
        (import_count as f64) / (function_count as f64)
    } else {
        import_count as f64
    };

    let loc = total_lines - blank_lines - comment_lines;

    let risk_label = if cyclomatic > 20 || max_nesting > 6 {
        "high"
    } else if cyclomatic > 10 || max_nesting > 4 {
        "medium"
    } else {
        "low"
    };

    ComplexityResult {
        cyclomatic,
        max_nesting,
        avg_nesting: (avg_nesting * 100.0).round() / 100.0,
        lines_of_code: loc,
        blank_lines,
        comment_lines,
        function_count,
        coupling_score: (coupling_score * 100.0).round() / 100.0,
        risk_label: risk_label.to_string(),
        hotspots,
    }
}


// ============================================================
// WASM Bindings
// ============================================================

#[wasm_bindgen]
pub struct ReflexWasm {
    engine: ReflexEngine,
}

#[wasm_bindgen]
impl ReflexWasm {
    #[wasm_bindgen(constructor)]
    pub fn new(graph_json: &str) -> Result<ReflexWasm, JsValue> {
        let graph: DependencyGraph = serde_json::from_str(graph_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid graph JSON: {}", e)))?;
        
        Ok(ReflexWasm {
            engine: ReflexEngine::new(graph),
        })
    }

    #[wasm_bindgen]
    pub fn simulate(&self, num_simulations: u32, seed: u64) -> String {
        let result = self.engine.simulate(num_simulations, seed);
        serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
    }

    #[wasm_bindgen]
    pub fn cascade_scores(&self) -> String {
        let scores = self.engine.cascade_scores();
        serde_json::to_string(&scores).unwrap_or_else(|_| "[]".to_string())
    }

    #[wasm_bindgen]
    pub fn risk_score(&self) -> String {
        let score = self.engine.risk_score();
        serde_json::to_string(&score).unwrap_or_else(|_| "{}".to_string())
    }

    #[wasm_bindgen]
    pub fn blast_radius(&self, node_name: &str) -> String {
        let radius = self.engine.calculate_blast_radius(node_name);
        serde_json::to_string(&radius).unwrap_or_else(|_| "{}".to_string())
    }

    #[wasm_bindgen]
    pub fn all_blast_radii(&self) -> String {
        let radii: Vec<BlastRadius> = self.engine.graph.nodes.iter()
            .map(|n| self.engine.calculate_blast_radius(&n.name))
            .collect();
        serde_json::to_string(&radii).unwrap_or_else(|_| "[]".to_string())
    }
}

/// Standalone WASM function: analyze code complexity.
/// No dependency graph needed - just pass source code and language.
#[wasm_bindgen]
pub fn analyze_complexity(code: &str, language: &str) -> String {
    let result = analyze_complexity_inner(code, language);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}


// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_graph() -> DependencyGraph {
        DependencyGraph {
            nodes: vec![
                Node { name: "api-gateway".into(), node_type: "service".into(), failure_probability: 0.01, recovery_time_seconds: 30.0, users_affected: 100_000, failure_modes: vec!["timeout".into(), "crash".into()] },
                Node { name: "auth-service".into(), node_type: "service".into(), failure_probability: 0.02, recovery_time_seconds: 60.0, users_affected: 80_000, failure_modes: vec!["token_expired".into()] },
                Node { name: "payment-service".into(), node_type: "service".into(), failure_probability: 0.005, recovery_time_seconds: 120.0, users_affected: 50_000, failure_modes: vec!["stripe_down".into()] },
                Node { name: "postgres".into(), node_type: "database".into(), failure_probability: 0.001, recovery_time_seconds: 300.0, users_affected: 100_000, failure_modes: vec!["connection_exhaustion".into(), "deadlock".into()] },
                Node { name: "redis".into(), node_type: "cache".into(), failure_probability: 0.005, recovery_time_seconds: 15.0, users_affected: 30_000, failure_modes: vec!["memory_full".into()] },
                Node { name: "stripe-api".into(), node_type: "api".into(), failure_probability: 0.01, recovery_time_seconds: 0.0, users_affected: 50_000, failure_modes: vec!["rate_limit".into(), "outage".into()] },
            ],
            edges: vec![
                Edge { source: "api-gateway".into(), target: "auth-service".into(), relationship: "calls".into(), failure_propagation: 0.9, is_critical: true },
                Edge { source: "api-gateway".into(), target: "payment-service".into(), relationship: "calls".into(), failure_propagation: 0.7, is_critical: false },
                Edge { source: "auth-service".into(), target: "postgres".into(), relationship: "reads".into(), failure_propagation: 0.95, is_critical: true },
                Edge { source: "auth-service".into(), target: "redis".into(), relationship: "reads".into(), failure_propagation: 0.3, is_critical: false },
                Edge { source: "payment-service".into(), target: "postgres".into(), relationship: "reads".into(), failure_propagation: 0.95, is_critical: true },
                Edge { source: "payment-service".into(), target: "stripe-api".into(), relationship: "calls".into(), failure_propagation: 0.8, is_critical: true },
            ],
        }
    }

    #[test]
    fn test_simulation() {
        let engine = ReflexEngine::new(sample_graph());
        let result = engine.simulate(1000, 42);
        assert!(result.total_simulations == 1000);
        assert!(!result.failure_paths.is_empty());
        assert!(result.system_availability > 0.0);
    }

    #[test]
    fn test_cascade_scores() {
        let engine = ReflexEngine::new(sample_graph());
        let scores = engine.cascade_scores();
        assert!(!scores.is_empty());
        assert_eq!(scores[0].node_name, "api-gateway");
    }

    #[test]
    fn test_risk_score() {
        let engine = ReflexEngine::new(sample_graph());
        let risk = engine.risk_score();
        assert!(risk.overall_score >= 0.0 && risk.overall_score <= 100.0);
        assert!(!risk.grade.is_empty());
    }

    #[test]
    fn test_blast_radius() {
        let engine = ReflexEngine::new(sample_graph());
        let blast = engine.calculate_blast_radius("api-gateway");
        assert!(blast.affected_count > 0);
        assert!(blast.total_users_affected > 0);
    }

    #[test]
    fn test_complexity_python() {
        let code = "def hello():\n    if True:\n        for i in range(10):\n            if i > 5 and i < 8:\n                print(i)\n";
        let result = analyze_complexity_inner(code, "python");
        assert!(result.cyclomatic > 1);
        assert!(result.max_nesting >= 3);
        assert_eq!(result.function_count, 1);
        assert_eq!(result.risk_label, "medium");
    }

    #[test]
    fn test_complexity_rust() {
        let code = "fn main() {\n    let x = 5;\n    if x > 3 {\n        println!(\"big\");\n    }\n}\n";
        let result = analyze_complexity_inner(code, "rust");
        assert!(result.cyclomatic >= 2);
        assert_eq!(result.function_count, 1);
    }

    #[test]
    fn test_complexity_empty() {
        let result = analyze_complexity_inner("", "python");
        assert_eq!(result.cyclomatic, 1);
        assert_eq!(result.max_nesting, 0);
        assert_eq!(result.lines_of_code, 0);
    }

    #[test]
    fn test_complexity_hotspots() {
        let code = "def f():\n    if a and b:\n        if c or d:\n            if e:\n                if f and g:\n                    pass\n";
        let result = analyze_complexity_inner(code, "python");
        assert!(!result.hotspots.is_empty());
        assert_eq!(result.risk_label, "high");
    }
}
