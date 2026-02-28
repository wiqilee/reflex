import { AnalysisResult } from '../hooks/useStore';

export const DEMO_CODE = `import requests
import sqlite3
import os

DB_PATH = "/var/data/app.db"
API_TIMEOUT = 5
MAX_RETRIES = 3
PAYMENT_API = "https://api.stripe.com/v1/charges"

def process_payment(user_id, amount, currency="usd"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get user payment method
    cursor.execute(f"SELECT payment_method FROM users WHERE id = {user_id}")
    row = cursor.fetchone()
    payment_method = row[0]
    
    # Call payment API
    response = requests.post(
        PAYMENT_API,
        headers={"Authorization": f"Bearer {os.getenv('STRIPE_KEY')}"},
        json={"amount": int(amount * 100), "currency": currency, "payment_method": payment_method},
        timeout=API_TIMEOUT
    )
    
    if response.status_code == 200:
        charge_id = response.json()["id"]
        cursor.execute(
            f"INSERT INTO transactions (user_id, charge_id, amount) VALUES ({user_id}, '{charge_id}', {amount})"
        )
        conn.commit()
        return {"status": "success", "charge_id": charge_id}
    else:
        return {"status": "failed", "error": response.text}

def get_user_balance(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(f"SELECT SUM(amount) FROM transactions WHERE user_id = {user_id}")
    result = cursor.fetchone()
    return result[0] if result[0] else 0.0

def refund_payment(charge_id):
    response = requests.post(
        f"https://api.stripe.com/v1/refunds",
        headers={"Authorization": f"Bearer {os.getenv('STRIPE_KEY')}"},
        json={"charge": charge_id}
    )
    return response.json()`;

export const DEMO_RESULT: AnalysisResult = {
  service_name: "payment-service",
  files_analyzed: 1,
  overall_risk: "critical",
  summary: "Critical: SQL injection, connection leaks, no retry logic, missing input validation. This service has 8 failure scenarios, 3 critical.",
  scenarios: [
    { id: "FS-001", title: "SQL Injection via user_id", description: "User input is directly interpolated into SQL queries without parameterization, allowing attackers to inject malicious SQL.", category: "data_corruption", severity: "critical", trigger: "Malicious user_id input like: 1 OR 1=1; DROP TABLE users;--", impact: "Full database compromise, data breach, complete service outage", affected_code: "payment_service.py:16", likelihood: "frequent" },
    { id: "FS-002", title: "Database Connection Leak", description: "SQLite connections are opened but never closed. Each request leaks a connection, eventually exhausting OS file descriptors.", category: "resource_exhaustion", severity: "critical", trigger: "Sustained traffic (>1000 req) without restart", impact: "Service crash, all requests fail with 'too many open files'", affected_code: "payment_service.py:13", likelihood: "frequent" },
    { id: "FS-003", title: "Stripe API Timeout Without Retry", description: "Payment API call has a 5s timeout but no retry logic. Transient Stripe issues cause permanent payment failures.", category: "network", severity: "critical", trigger: "Stripe latency spike or brief outage", impact: "Lost revenue, failed payments, customer complaints", affected_code: "payment_service.py:19-24", likelihood: "occasional" },
    { id: "FS-004", title: "Missing STRIPE_KEY Crashes Service", description: "os.getenv('STRIPE_KEY') returns None if env var is missing. This gets sent as 'Bearer None' causing auth failures.", category: "configuration", severity: "high", trigger: "Deployment without STRIPE_KEY env variable", impact: "All payments fail silently with 401 errors", affected_code: "payment_service.py:21", likelihood: "occasional" },
    { id: "FS-005", title: "No Input Validation on Amount", description: "amount parameter is not validated. Negative amounts, zero, extremely large values, or non-numeric input could cause unexpected behavior.", category: "data_corruption", severity: "high", trigger: "API call with amount=-100 or amount=999999999", impact: "Negative charges, integer overflow, financial discrepancies", affected_code: "payment_service.py:11", likelihood: "occasional" },
    { id: "FS-006", title: "Refund Without Idempotency", description: "refund_payment() has no idempotency check. Duplicate calls create duplicate refunds.", category: "data_corruption", severity: "high", trigger: "Network retry, double-click, or race condition", impact: "Double refunds, financial loss", affected_code: "payment_service.py:40-46", likelihood: "occasional" },
    { id: "FS-007", title: "Database File Path Hardcoded", description: "DB_PATH is hardcoded to /var/data/app.db. This fails in containers, different environments, or if directory doesn't exist.", category: "configuration", severity: "medium", trigger: "Deployment to new environment or container", impact: "Service fails to start", affected_code: "payment_service.py:4", likelihood: "rare" },
    { id: "FS-008", title: "No Transaction Atomicity", description: "Payment charge and database insert are not in a transaction. If insert fails after successful charge, money is taken but not recorded.", category: "data_corruption", severity: "high", trigger: "Database error after successful Stripe charge", impact: "Ghost charges — money taken but no record in system", affected_code: "payment_service.py:26-31", likelihood: "rare" },
  ],
  runbooks: [
    {
      id: "RB-001", title: "Runbook: SQL Injection via user_id", estimated_resolution: "30-60 min", on_call_level: "L2",
      scenario: { id: "FS-001", title: "SQL Injection via user_id", description: "SQL injection vulnerability", category: "data_corruption", severity: "critical", trigger: "Malicious input", impact: "Database compromise", affected_code: "payment_service.py:16", likelihood: "frequent" },
      detection: [
        { order: 1, action: "Check application logs for unusual SQL patterns", command: "grep -E '(OR 1=1|DROP TABLE|UNION SELECT|--|;)' /var/log/app/*.log | tail -50", expected_output: "Any matches indicate active exploitation", estimated_time: "1 min" },
        { order: 2, action: "Check database for unexpected data modifications", command: "sqlite3 /var/data/app.db \"SELECT count(*) FROM users; SELECT count(*) FROM transactions;\"", expected_output: "Compare counts with expected values", estimated_time: "1 min" },
      ],
      diagnosis: [
        { order: 1, action: "Identify affected queries by searching for string interpolation in SQL", command: "grep -rn 'f\"SELECT\\|f\"INSERT\\|f\"UPDATE\\|f\"DELETE' backend/", expected_output: "List of all vulnerable queries with file:line", estimated_time: "2 min", access_required: "codebase access" },
        { order: 2, action: "Check if WAF or input sanitization exists", command: "grep -rn 'sanitize\\|escape\\|parameterize' backend/", expected_output: "Empty = no protection exists", estimated_time: "1 min" },
      ],
      fix: [
        { order: 1, action: "Replace all f-string SQL queries with parameterized queries", command: "# Change: cursor.execute(f\"SELECT ... WHERE id = {user_id}\")\n# To: cursor.execute(\"SELECT ... WHERE id = ?\", (user_id,))", warning: "Test each query change individually. Parameterized syntax varies by database driver.", estimated_time: "15 min", access_required: "code deploy access" },
        { order: 2, action: "Add input validation for user_id", command: "# Add at start of each function:\nif not isinstance(user_id, int) or user_id <= 0:\n    raise ValueError(\"Invalid user_id\")", estimated_time: "5 min" },
        { order: 3, action: "Deploy hotfix", command: "git add -A && git commit -m 'fix: parameterize SQL queries' && git push && kubectl rollout restart deployment/payment-service -n production", warning: "Monitor error rate after deploy for 15 minutes", estimated_time: "10 min", access_required: "deploy access" },
      ],
      rollback: [
        { order: 1, action: "Revert to previous deployment", command: "kubectl rollout undo deployment/payment-service -n production", warning: "This restores the vulnerable version. Enable WAF rules as temporary mitigation.", estimated_time: "2 min" },
      ],
      prevention: [
        "Enforce parameterized queries via linting rule (e.g. bandit B608)",
        "Add SQL injection test cases to CI/CD pipeline",
        "Enable WAF with SQL injection detection rules",
        "Implement ORM (SQLAlchemy) instead of raw SQL",
        "Add input validation middleware for all API endpoints",
      ]
    },
    {
      id: "RB-002", title: "Runbook: Database Connection Leak", estimated_resolution: "15-30 min", on_call_level: "L1",
      scenario: { id: "FS-002", title: "Database Connection Leak", description: "Connections never closed", category: "resource_exhaustion", severity: "critical", trigger: "Sustained traffic", impact: "Service crash", affected_code: "payment_service.py:13", likelihood: "frequent" },
      detection: [
        { order: 1, action: "Check open file descriptors for the process", command: "lsof -p $(pgrep -f uvicorn) | wc -l", expected_output: "Normal: <500. Problem: >1000 and growing", estimated_time: "30 sec" },
        { order: 2, action: "Check for 'too many open files' in logs", command: "grep -i 'too many open files\\|OperationalError' /var/log/app/*.log | tail -20", expected_output: "Any matches confirm the leak", estimated_time: "30 sec" },
      ],
      diagnosis: [
        { order: 1, action: "Count SQLite connections in code that lack close/context manager", command: "grep -n 'sqlite3.connect' backend/ -r", expected_output: "Compare with grep -n 'conn.close\\|with sqlite' backend/ -r", estimated_time: "2 min" },
      ],
      fix: [
        { order: 1, action: "Immediate: restart the service to free leaked connections", command: "kubectl rollout restart deployment/payment-service -n production", warning: "Brief downtime. Payments in-flight may fail.", estimated_time: "2 min" },
        { order: 2, action: "Fix code: use context managers for all database connections", command: "# Change: conn = sqlite3.connect(DB_PATH)\n# To: with sqlite3.connect(DB_PATH) as conn:", estimated_time: "10 min" },
      ],
      rollback: [
        { order: 1, action: "Restart service to temporarily fix", command: "kubectl rollout restart deployment/payment-service -n production", estimated_time: "2 min" },
      ],
      prevention: [
        "Use context managers (with statement) for all database connections",
        "Add connection pool with max limit (e.g. SQLAlchemy connection pool)",
        "Add file descriptor monitoring alert in Datadog/Grafana",
        "Add linting rule to detect sqlite3.connect without context manager",
      ]
    },
  ],
  dependency_graph: {
    nodes: [
      { name: "payment-service", type: "service", failure_modes: ["crash", "timeout", "memory_leak"] },
      { name: "sqlite-db", type: "database", failure_modes: ["connection_exhaustion", "corruption", "disk_full"] },
      { name: "stripe-api", type: "api", failure_modes: ["rate_limit", "outage", "timeout", "auth_failure"] },
      { name: "STRIPE_KEY", type: "config", failure_modes: ["missing", "expired", "rotated"] },
      { name: "filesystem", type: "service", failure_modes: ["disk_full", "permission_denied", "path_not_found"] },
    ],
    edges: [
      { source: "payment-service", target: "sqlite-db", relationship: "reads" },
      { source: "payment-service", target: "sqlite-db", relationship: "writes" },
      { source: "payment-service", target: "stripe-api", relationship: "calls" },
      { source: "payment-service", target: "STRIPE_KEY", relationship: "depends_on" },
      { source: "sqlite-db", target: "filesystem", relationship: "depends_on" },
    ],
  },
};
