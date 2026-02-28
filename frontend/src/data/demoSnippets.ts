/**
 * REFLEX — Demo Code Snippets in 6 Languages
 * Each snippet represents a realistic microservice with intentional failure points.
 */

export interface DemoSnippet {
  language: string;
  filename: string;
  label: string;
  icon: string;
  code: string;
}

export const DEMO_SNIPPETS: DemoSnippet[] = [
  {
    language: 'python',
    filename: 'payment_service.py',
    label: 'Python',
    icon: '🐍',
    code: `import sqlite3
import hashlib
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)
DB_PATH = "/data/payments.db"

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

@app.route("/api/payment", methods=["POST"])
def process_payment():
    data = request.get_json()
    amount = data["amount"]
    card_number = data["card_number"]
    user_id = data["user_id"]

    # Validate payment with external gateway
    gateway_response = requests.post(
        "https://api.paymentgateway.com/v1/charge",
        json={"amount": amount, "card": card_number},
        timeout=30
    )

    if gateway_response.status_code != 200:
        return jsonify({"error": "Payment failed"}), 500

    tx_id = gateway_response.json()["transaction_id"]

    # Store in database
    db = get_db()
    db.execute(
        f"INSERT INTO payments (user_id, amount, tx_id, status) VALUES ('{user_id}', {amount}, '{tx_id}', 'completed')",
    )
    db.commit()
    db.close()

    # Notify user service
    requests.post(f"http://user-service:8080/notify/{user_id}", json={"tx_id": tx_id})

    return jsonify({"status": "success", "transaction_id": tx_id})

@app.route("/api/refund/<tx_id>", methods=["POST"])
def process_refund(tx_id):
    db = get_db()
    row = db.execute(f"SELECT * FROM payments WHERE tx_id = '{tx_id}'").fetchone()
    if not row:
        return jsonify({"error": "Transaction not found"}), 404

    requests.post(
        "https://api.paymentgateway.com/v1/refund",
        json={"transaction_id": tx_id, "amount": row[2]}
    )

    db.execute(f"UPDATE payments SET status = 'refunded' WHERE tx_id = '{tx_id}'")
    db.commit()
    db.close()

    return jsonify({"status": "refunded"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)`,
  },
  {
    language: 'go',
    filename: 'order_service.go',
    label: 'Go',
    icon: '🔵',
    code: `package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "time"

    _ "github.com/lib/pq"
)

var db *sql.DB

func init() {
    var err error
    connStr := os.Getenv("DATABASE_URL")
    db, err = sql.Open("postgres", connStr)
    if err != nil {
        log.Fatal(err)
    }
    db.SetMaxOpenConns(10)
    db.SetConnMaxLifetime(0)
}

type Order struct {
    ID        string  \`json:"id"\`
    UserID    string  \`json:"user_id"\`
    Items     []Item  \`json:"items"\`
    Total     float64 \`json:"total"\`
    Status    string  \`json:"status"\`
}

type Item struct {
    ProductID string \`json:"product_id"\`
    Quantity  int    \`json:"quantity"\`
    Price     float64 \`json:"price"\`
}

func createOrder(w http.ResponseWriter, r *http.Request) {
    var order Order
    json.NewDecoder(r.Body).Decode(&order)

    // Check inventory for each item
    for _, item := range order.Items {
        resp, _ := http.Get(fmt.Sprintf("http://inventory-service:8081/stock/%s", item.ProductID))
        var stock map[string]int
        json.NewDecoder(resp.Body).Decode(&stock)
        if stock["available"] < item.Quantity {
            http.Error(w, "Insufficient stock", 409)
            return
        }
    }

    // Reserve inventory
    for _, item := range order.Items {
        payload, _ := json.Marshal(map[string]int{"quantity": item.Quantity})
        http.Post(
            fmt.Sprintf("http://inventory-service:8081/reserve/%s", item.ProductID),
            "application/json",
            bytes.NewBuffer(payload),
        )
    }

    // Insert order into database
    tx, _ := db.Begin()
    _, err := tx.Exec(
        "INSERT INTO orders (id, user_id, total, status) VALUES ($1, $2, $3, $4)",
        order.ID, order.UserID, order.Total, "pending",
    )
    if err != nil {
        tx.Rollback()
        http.Error(w, "Database error", 500)
        return
    }
    tx.Commit()

    // Trigger payment asynchronously
    go func() {
        client := &http.Client{Timeout: 60 * time.Second}
        payload, _ := json.Marshal(order)
        client.Post("http://payment-service:5000/api/payment", "application/json", bytes.NewBuffer(payload))
    }()

    json.NewEncoder(w).Encode(order)
}

func getOrder(w http.ResponseWriter, r *http.Request) {
    id := r.URL.Query().Get("id")
    row := db.QueryRow("SELECT id, user_id, total, status FROM orders WHERE id = $1", id)
    var order Order
    row.Scan(&order.ID, &order.UserID, &order.Total, &order.Status)
    json.NewEncoder(w).Encode(order)
}

func main() {
    http.HandleFunc("/order", createOrder)
    http.HandleFunc("/order/get", getOrder)
    log.Fatal(http.ListenAndServe(":8080", nil))
}`,
  },
  {
    language: 'rust',
    filename: 'cache_service.rs',
    label: 'Rust',
    icon: '🦀',
    code: `use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tokio::net::TcpListener;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
struct CacheEntry {
    value: String,
    expires_at: Option<u64>,
    created_at: u64,
}

struct CacheStore {
    data: RwLock<HashMap<String, CacheEntry>>,
    max_entries: usize,
}

impl CacheStore {
    fn new(max_entries: usize) -> Self {
        CacheStore {
            data: RwLock::new(HashMap::new()),
            max_entries,
        }
    }

    fn get(&self, key: &str) -> Option<CacheEntry> {
        let store = self.data.read().unwrap();
        let entry = store.get(key)?;
        
        // Check expiry
        if let Some(expires) = entry.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            if now > expires {
                return None; // Expired but not cleaned up
            }
        }
        Some(entry.clone())
    }

    fn set(&self, key: String, value: String, ttl_secs: Option<u64>) {
        let mut store = self.data.write().unwrap();
        
        // Evict if at capacity (no LRU, just drop random entries)
        if store.len() >= self.max_entries {
            let keys: Vec<String> = store.keys().take(100).cloned().collect();
            for k in keys {
                store.remove(&k);
            }
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        store.insert(key, CacheEntry {
            value,
            expires_at: ttl_secs.map(|t| now + t),
            created_at: now,
        });
    }

    fn delete(&self, key: &str) -> bool {
        let mut store = self.data.write().unwrap();
        store.remove(key).is_some()
    }

    fn flush(&self) {
        let mut store = self.data.write().unwrap();
        store.clear();
    }

    fn stats(&self) -> (usize, usize) {
        let store = self.data.read().unwrap();
        (store.len(), self.max_entries)
    }
}

async fn handle_request(cache: Arc<CacheStore>, req: String) -> String {
    let parts: Vec<&str> = req.trim().splitn(3, ' ').collect();
    match parts[0] {
        "GET" => {
            match cache.get(parts[1]) {
                Some(entry) => format!("OK {}", entry.value),
                None => "MISS".to_string(),
            }
        }
        "SET" => {
            cache.set(parts[1].to_string(), parts[2].to_string(), Some(3600));
            "OK".to_string()
        }
        "DEL" => {
            if cache.delete(parts[1]) { "OK" } else { "NOT_FOUND" }.to_string()
        }
        "FLUSH" => { cache.flush(); "OK".to_string() }
        "STATS" => {
            let (used, max) = cache.stats();
            format!("ENTRIES {} MAX {}", used, max)
        }
        _ => "ERR unknown command".to_string(),
    }
}

#[tokio::main]
async fn main() {
    let cache = Arc::new(CacheStore::new(100_000));
    let listener = TcpListener::bind("0.0.0.0:6380").await.unwrap();
    
    loop {
        let (socket, _) = listener.accept().await.unwrap();
        let cache = cache.clone();
        tokio::spawn(async move {
            // Handle connection (simplified)
            let _ = handle_request(cache, "GET test".to_string()).await;
        });
    }
}`,
  },
  {
    language: 'java',
    filename: 'NotificationService.java',
    label: 'Java',
    icon: '☕',
    code: `package com.reflex.notifications;

import java.sql.*;
import java.util.*;
import java.net.http.*;
import java.net.URI;
import java.time.Duration;
import java.util.concurrent.*;

public class NotificationService {
    private static final String DB_URL = System.getenv("DB_URL");
    private static final String SMTP_HOST = System.getenv("SMTP_HOST");
    private static final String FCM_KEY = System.getenv("FCM_SERVER_KEY");
    private Connection dbConnection;
    private ExecutorService threadPool = Executors.newFixedThreadPool(20);
    private HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public NotificationService() throws SQLException {
        dbConnection = DriverManager.getConnection(DB_URL);
    }

    public void sendNotification(String userId, String type, String message) throws Exception {
        // Get user preferences
        Statement stmt = dbConnection.createStatement();
        ResultSet rs = stmt.executeQuery(
            "SELECT email, phone, fcm_token, preferences FROM users WHERE id = '" + userId + "'"
        );

        if (!rs.next()) throw new Exception("User not found: " + userId);

        String email = rs.getString("email");
        String phone = rs.getString("phone");
        String fcmToken = rs.getString("fcm_token");
        String prefs = rs.getString("preferences");

        // Send via all enabled channels
        List<Future<?>> futures = new ArrayList<>();

        if (prefs.contains("email")) {
            futures.add(threadPool.submit(() -> sendEmail(email, type, message)));
        }
        if (prefs.contains("sms")) {
            futures.add(threadPool.submit(() -> sendSms(phone, message)));
        }
        if (prefs.contains("push") && fcmToken != null) {
            futures.add(threadPool.submit(() -> sendPush(fcmToken, type, message)));
        }

        // Wait for all to complete
        for (Future<?> f : futures) {
            f.get(30, TimeUnit.SECONDS);
        }

        // Log notification
        stmt.executeUpdate(
            "INSERT INTO notification_log (user_id, type, message, sent_at) " +
            "VALUES ('" + userId + "', '" + type + "', '" + message + "', NOW())"
        );
    }

    private void sendEmail(String to, String subject, String body) {
        try {
            Properties props = new Properties();
            props.put("mail.smtp.host", SMTP_HOST);
            props.put("mail.smtp.port", "587");
            // Send email via SMTP (simplified)
            Thread.sleep(500); // Simulate
        } catch (Exception e) {
            throw new RuntimeException("Email failed: " + e.getMessage());
        }
    }

    private void sendSms(String phone, String message) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.twilio.com/2010-04-01/Accounts/send"))
                    .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"to\":\"" + phone + "\",\"body\":\"" + message + "\"}"))
                    .build();
            httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new RuntimeException("SMS failed: " + e.getMessage());
        }
    }

    private void sendPush(String token, String title, String body) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://fcm.googleapis.com/fcm/send"))
                    .header("Authorization", "key=" + FCM_KEY)
                    .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"to\":\"" + token + "\",\"notification\":{\"title\":\"" + title + "\",\"body\":\"" + body + "\"}}"))
                    .build();
            httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new RuntimeException("Push failed: " + e.getMessage());
        }
    }

    public void shutdown() {
        threadPool.shutdown();
        try { dbConnection.close(); } catch (SQLException e) { }
    }
}`,
  },
  {
    language: 'typescript',
    filename: 'auth-middleware.ts',
    label: 'TypeScript',
    icon: '🔷',
    code: `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL);

interface TokenPayload {
  userId: string;
  role: string;
  exp: number;
}

const TOKEN_BLACKLIST = new Set<string>();

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  if (TOKEN_BLACKLIST.has(token)) {
    return res.status(401).json({ error: 'Token revoked' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    
    // Check session in Redis
    const session = await redis.get(\`session:\${payload.userId}\`);
    if (!session) return res.status(401).json({ error: 'Session expired' });

    // Rate limiting
    const rateKey = \`rate:\${payload.userId}\`;
    const count = await redis.incr(rateKey);
    if (count === 1) await redis.expire(rateKey, 60);
    if (count > 100) return res.status(429).json({ error: 'Rate limited' });

    (req as any).user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  // Fetch user from database (simplified)
  const user = await fetchUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Store session
  await redis.set(\`session:\${user.id}\`, JSON.stringify({
    token, ip: req.ip, userAgent: req.headers['user-agent']
  }), 'EX', 86400);

  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
}

export async function logout(req: Request, res: Response) {
  const token = req.headers.authorization?.split(' ')[1];
  const user = (req as any).user;
  
  TOKEN_BLACKLIST.add(token!);
  await redis.del(\`session:\${user.userId}\`);
  
  res.json({ status: 'logged out' });
}

async function fetchUserByEmail(email: string) {
  // Simulated DB query
  return { id: '1', email, passwordHash: '$2b$10$hash', role: 'user' };
}`,
  },
  {
    language: 'yaml',
    filename: 'docker-compose.yml',
    label: 'YAML',
    icon: '🐳',
    code: `version: "3.8"

services:
  api-gateway:
    build: ./gateway
    ports:
      - "80:3000"
      - "443:3443"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=super-secret-key-2024
      - REDIS_URL=redis://redis:6379
      - RATE_LIMIT=1000
    depends_on:
      - redis
      - user-service
      - payment-service
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
    restart: always
    networks:
      - frontend
      - backend

  user-service:
    build: ./services/user
    environment:
      - DATABASE_URL=postgresql://admin:password123@postgres:5432/users
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 256M
    restart: always
    networks:
      - backend

  payment-service:
    build: ./services/payment
    environment:
      - DATABASE_URL=postgresql://admin:password123@postgres:5432/payments
      - STRIPE_SECRET_KEY=sk_live_abc123xyz
      - WEBHOOK_SECRET=whsec_def456
    depends_on:
      - postgres
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 256M
    restart: on-failure
    networks:
      - backend

  notification-service:
    build: ./services/notification
    environment:
      - SMTP_HOST=smtp.sendgrid.net
      - SMTP_USER=apikey
      - SMTP_PASS=SG.xxxxx
      - FCM_SERVER_KEY=AAAAxxxxxx
    depends_on:
      - redis
      - postgres
    deploy:
      replicas: 1
    restart: always
    networks:
      - backend

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=password123
      - POSTGRES_DB=main
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    deploy:
      resources:
        limits:
          memory: 1G
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    networks:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api-gateway
    networks:
      - frontend

volumes:
  pgdata:
  redisdata:

networks:
  frontend:
  backend:`,
  },
];

export function getDemoSnippet(language: string): DemoSnippet | undefined {
  return DEMO_SNIPPETS.find(s => s.language === language);
}
