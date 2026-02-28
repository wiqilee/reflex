/**
 * REFLEX Engine — WASM Usage Example
 * 
 * This shows how to use the Rust WASM engine from JavaScript/React.
 * After building with `wasm-pack build --target web`, import and use like this:
 */

// === How to use in React/JS ===

/*
import init, { ReflexWasm } from './wasm/reflex_engine.js';

// Initialize WASM module (do this once on app load)
await init();

// Create engine with dependency graph from backend API response
const graph = {
  nodes: [
    { name: "api-gateway", node_type: "service", failure_probability: 0.01, recovery_time_seconds: 30, users_affected: 100000, failure_modes: ["timeout", "crash"] },
    { name: "auth-service", node_type: "service", failure_probability: 0.02, recovery_time_seconds: 60, users_affected: 80000, failure_modes: ["token_expired"] },
    { name: "postgres", node_type: "database", failure_probability: 0.001, recovery_time_seconds: 300, users_affected: 100000, failure_modes: ["connection_exhaustion"] },
    { name: "redis", node_type: "cache", failure_probability: 0.005, recovery_time_seconds: 15, users_affected: 30000, failure_modes: ["memory_full"] },
    { name: "stripe-api", node_type: "api", failure_probability: 0.01, recovery_time_seconds: 0, users_affected: 50000, failure_modes: ["rate_limit"] },
    { name: "payment-service", node_type: "service", failure_probability: 0.005, recovery_time_seconds: 120, users_affected: 50000, failure_modes: ["stripe_down"] },
  ],
  edges: [
    { source: "api-gateway", target: "auth-service", relationship: "calls", failure_propagation: 0.9, is_critical: true },
    { source: "api-gateway", target: "payment-service", relationship: "calls", failure_propagation: 0.7, is_critical: false },
    { source: "auth-service", target: "postgres", relationship: "reads", failure_propagation: 0.95, is_critical: true },
    { source: "auth-service", target: "redis", relationship: "reads", failure_propagation: 0.3, is_critical: false },
    { source: "payment-service", target: "postgres", relationship: "reads", failure_propagation: 0.95, is_critical: true },
    { source: "payment-service", target: "stripe-api", relationship: "calls", failure_propagation: 0.8, is_critical: true },
  ]
};

const engine = new ReflexWasm(JSON.stringify(graph));

// Feature 6: Monte Carlo Failure Simulation (10,000 simulations)
const simulation = JSON.parse(engine.simulate(10000, Date.now()));
console.log(`Availability: ${simulation.system_availability}%`);
console.log(`Worst case recovery: ${simulation.worst_case_recovery_time}s`);
console.log(`Execution time: ${simulation.execution_time_ms}ms`);

// Feature 7: Cascading Failure Scores
const cascades = JSON.parse(engine.cascade_scores());
console.log("Highest cascade risk:", cascades[0].node_name, cascades[0].cascade_score);

// Feature 8: Risk Score & Grade
const risk = JSON.parse(engine.risk_score());
console.log(`Risk Grade: ${risk.grade} (${risk.overall_score}/100)`);
console.log("SPOFs:", risk.single_points_of_failure);
console.log("Recommendations:", risk.recommendations);

// Feature 15: Blast Radius
const blast = JSON.parse(engine.blast_radius("api-gateway"));
console.log(`If api-gateway fails: ${blast.affected_count} nodes affected, ${blast.total_users_affected} users`);
*/

// === Demo data for testing without WASM ===
export const DEMO_GRAPH = {
  nodes: [
    { name: "api-gateway", node_type: "service", failure_probability: 0.01, recovery_time_seconds: 30, users_affected: 100000, failure_modes: ["timeout", "crash", "memory_leak"] },
    { name: "auth-service", node_type: "service", failure_probability: 0.02, recovery_time_seconds: 60, users_affected: 80000, failure_modes: ["token_expired", "ldap_timeout"] },
    { name: "payment-service", node_type: "service", failure_probability: 0.005, recovery_time_seconds: 120, users_affected: 50000, failure_modes: ["stripe_down", "idempotency_fail"] },
    { name: "notification-service", node_type: "service", failure_probability: 0.03, recovery_time_seconds: 45, users_affected: 20000, failure_modes: ["queue_full", "template_error"] },
    { name: "postgres", node_type: "database", failure_probability: 0.001, recovery_time_seconds: 300, users_affected: 100000, failure_modes: ["connection_exhaustion", "deadlock", "replication_lag"] },
    { name: "redis", node_type: "cache", failure_probability: 0.005, recovery_time_seconds: 15, users_affected: 30000, failure_modes: ["memory_full", "eviction_storm"] },
    { name: "rabbitmq", node_type: "queue", failure_probability: 0.008, recovery_time_seconds: 90, users_affected: 40000, failure_modes: ["queue_overflow", "split_brain"] },
    { name: "stripe-api", node_type: "api", failure_probability: 0.01, recovery_time_seconds: 0, users_affected: 50000, failure_modes: ["rate_limit", "outage", "webhook_delay"] },
    { name: "s3-storage", node_type: "service", failure_probability: 0.0001, recovery_time_seconds: 10, users_affected: 60000, failure_modes: ["throttling", "region_outage"] },
    { name: "config-service", node_type: "config", failure_probability: 0.002, recovery_time_seconds: 20, users_affected: 100000, failure_modes: ["stale_config", "parse_error"] },
  ],
  edges: [
    { source: "api-gateway", target: "auth-service", relationship: "calls", failure_propagation: 0.9, is_critical: true },
    { source: "api-gateway", target: "payment-service", relationship: "calls", failure_propagation: 0.7, is_critical: false },
    { source: "api-gateway", target: "notification-service", relationship: "calls", failure_propagation: 0.3, is_critical: false },
    { source: "api-gateway", target: "config-service", relationship: "reads", failure_propagation: 0.8, is_critical: true },
    { source: "auth-service", target: "postgres", relationship: "reads", failure_propagation: 0.95, is_critical: true },
    { source: "auth-service", target: "redis", relationship: "reads", failure_propagation: 0.3, is_critical: false },
    { source: "payment-service", target: "postgres", relationship: "reads", failure_propagation: 0.95, is_critical: true },
    { source: "payment-service", target: "stripe-api", relationship: "calls", failure_propagation: 0.8, is_critical: true },
    { source: "payment-service", target: "rabbitmq", relationship: "publishes", failure_propagation: 0.5, is_critical: false },
    { source: "notification-service", target: "rabbitmq", relationship: "subscribes", failure_propagation: 0.7, is_critical: true },
    { source: "notification-service", target: "s3-storage", relationship: "reads", failure_propagation: 0.4, is_critical: false },
    { source: "config-service", target: "postgres", relationship: "reads", failure_propagation: 0.9, is_critical: true },
  ]
};
