//! REFLEX Engine — Failure Path Simulation
//! 
//! Rust → WebAssembly engine for:
//! - Failure path simulation (Monte Carlo)
//! - Cascading failure scoring
//! - Dependency graph risk calculation
//! - Blast radius calculation
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
    pub node_type: String, // service, database, api, queue, cache, config
    pub failure_probability: f64, // 0.0 - 1.0
    pub recovery_time_seconds: f64,
    pub users_affected: u64, // estimated users impacted if this node fails
    pub failure_modes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
    pub relationship: String, // calls, reads, writes, depends_on
    pub failure_propagation: f64, // probability that source failure propagates to target (0.0 - 1.0)
    pub is_critical: bool, // if true, target cannot function without source
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
    pub node_failure_frequency: HashMap<String, f64>, // node_name → % of simulations where it failed
    pub mean_cascade_depth: f64,
    pub max_cascade_depth: u32,
    pub mean_recovery_time: f64,
    pub worst_case_recovery_time: f64,
    pub system_availability: f64, // estimated % uptime
    pub execution_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailurePath {
    pub origin: String,
    pub chain: Vec<String>, // ordered list of nodes that fail
    pub depth: u32,
    pub total_recovery_time: f64,
    pub users_affected: u64,
    pub probability: f64,
    pub severity: String, // critical, high, medium, low
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskScore {
    pub overall_score: f64, // 0-100, higher = more risky
    pub grade: String, // A+ to F
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
    pub cascade_score: f64, // 0-100
    pub max_depth: u32,
    pub max_nodes_affected: u32,
    pub max_users_affected: u64,
    pub worst_path: Vec<String>,
}

// ============================================================
// Simple RNG (xorshift64 — no external deps needed for WASM)
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
    adjacency: HashMap<String, Vec<(String, f64, bool)>>, // source → [(target, propagation_prob, is_critical)]
    reverse_adjacency: HashMap<String, Vec<String>>, // target → [sources]
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

    // --------------------------------------------------------
    // Feature 6: Failure Path Simulation (Monte Carlo)
    // --------------------------------------------------------
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
            // Pick a random starting node weighted by failure probability
            let origin = self.pick_random_failure(&mut rng);
            if origin.is_none() { continue; }
            let origin = origin.unwrap();

            // Simulate cascade from this node
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

        // Calculate frequencies
        let mut node_failure_frequency: HashMap<String, f64> = HashMap::new();
        for (name, count) in &node_fail_count {
            node_failure_frequency.insert(
                name.clone(),
                (*count as f64) / (num_simulations as f64) * 100.0,
            );
        }

        // Deduplicate and sort paths by severity
        all_paths.sort_by(|a, b| b.users_affected.cmp(&a.users_affected));
        all_paths.truncate(50); // Keep top 50 most impactful paths

        let mean_depth = if num_simulations > 0 {
            total_depth as f64 / num_simulations as f64
        } else { 0.0 };

        let mean_recovery = if num_simulations > 0 {
            total_recovery / num_simulations as f64
        } else { 0.0 };

        // Estimate availability: assume each failure takes mean_recovery seconds
        // and occurs proportional to total failure probability
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
            if depth > 20 { break; } // Safety limit

            if let Some(targets) = self.adjacency.get(&current) {
                for (target, prop_prob, is_critical) in targets {
                    if failed.contains(target) { continue; }

                    let will_propagate = if *is_critical {
                        true // Critical dependencies always cascade
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

    // --------------------------------------------------------
    // Feature 7: Cascading Failure Scoring
    // --------------------------------------------------------
    pub fn cascade_scores(&self) -> Vec<CascadeScore> {
        let mut scores: Vec<CascadeScore> = Vec::new();

        for node in &self.graph.nodes {
            let blast = self.calculate_blast_radius(&node.name);
            
            // Score formula: weighted combination of depth, nodes affected, users affected
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

    // --------------------------------------------------------
    // Feature 8: Dependency Graph Risk Calculation
    // --------------------------------------------------------
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

        // Overall score: weighted average of top risks
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
                    "Add circuit breaker for '{}' — cascade potential {:.0}%",
                    nr.name, nr.cascade_potential * 100.0
                ));
            }
        }
        if critical_paths.len() > 3 {
            recommendations.push("Too many critical paths — consider decoupling services".to_string());
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

    // --------------------------------------------------------
    // Feature 15: Blast Radius Calculator
    // --------------------------------------------------------
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
                    // For blast radius, assume worst case: all propagations happen
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

    // --------------------------------------------------------
    // Helper Functions
    // --------------------------------------------------------

    fn find_single_points_of_failure(&self) -> Vec<String> {
        let mut spofs: Vec<String> = Vec::new();

        for node in &self.graph.nodes {
            // A node is SPOF if removing it disconnects any other node from the graph
            let downstream = self.count_downstream(&node.name);
            let has_redundancy = self.has_alternative_path(&node.name);

            if downstream > 0 && !has_redundancy {
                spofs.push(node.name.clone());
            }
        }
        spofs
    }

    fn has_alternative_path(&self, node_name: &str) -> bool {
        // Check if any downstream node has another path that doesn't go through this node
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

        (visited.len() - 1) as u32 // Exclude self
    }

    fn find_critical_paths(&self) -> Vec<Vec<String>> {
        let mut paths: Vec<Vec<String>> = Vec::new();

        // Find all paths through critical edges
        for edge in &self.graph.edges {
            if edge.is_critical {
                let mut path = vec![edge.source.clone(), edge.target.clone()];
                let mut current = edge.target.clone();

                // Follow the critical chain
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

        // Deduplicate (remove paths that are subsets of others)
        paths.sort_by(|a, b| b.len().cmp(&a.len()));
        paths.truncate(10);
        paths
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
    /// Create a new REFLEX engine from a JSON dependency graph.
    /// 
    /// Expected JSON format:
    /// ```json
    /// {
    ///   "nodes": [{"name": "api", "node_type": "service", "failure_probability": 0.01, ...}],
    ///   "edges": [{"source": "api", "target": "db", "relationship": "reads", ...}]
    /// }
    /// ```
    #[wasm_bindgen(constructor)]
    pub fn new(graph_json: &str) -> Result<ReflexWasm, JsValue> {
        let graph: DependencyGraph = serde_json::from_str(graph_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid graph JSON: {}", e)))?;
        
        Ok(ReflexWasm {
            engine: ReflexEngine::new(graph),
        })
    }

    /// Run Monte Carlo failure simulation.
    /// Returns JSON with failure paths, frequencies, and availability estimate.
    #[wasm_bindgen]
    pub fn simulate(&self, num_simulations: u32, seed: u64) -> String {
        let result = self.engine.simulate(num_simulations, seed);
        serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
    }

    /// Calculate cascading failure scores for all nodes.
    /// Returns JSON array sorted by cascade potential (highest first).
    #[wasm_bindgen]
    pub fn cascade_scores(&self) -> String {
        let scores = self.engine.cascade_scores();
        serde_json::to_string(&scores).unwrap_or_else(|_| "[]".to_string())
    }

    /// Calculate overall risk score and grade.
    /// Returns JSON with grade (A+ to F), node risks, SPOFs, and recommendations.
    #[wasm_bindgen]
    pub fn risk_score(&self) -> String {
        let score = self.engine.risk_score();
        serde_json::to_string(&score).unwrap_or_else(|_| "{}".to_string())
    }

    /// Calculate blast radius for a specific node failure.
    /// Returns JSON with affected nodes, users impacted, and propagation tree.
    #[wasm_bindgen]
    pub fn blast_radius(&self, node_name: &str) -> String {
        let radius = self.engine.calculate_blast_radius(node_name);
        serde_json::to_string(&radius).unwrap_or_else(|_| "{}".to_string())
    }

    /// Get all blast radii for every node (useful for heatmap visualization).
    #[wasm_bindgen]
    pub fn all_blast_radii(&self) -> String {
        let radii: Vec<BlastRadius> = self.engine.graph.nodes.iter()
            .map(|n| self.engine.calculate_blast_radius(&n.name))
            .collect();
        serde_json::to_string(&radii).unwrap_or_else(|_| "[]".to_string())
    }
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
        // API gateway should have highest cascade score
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
}
