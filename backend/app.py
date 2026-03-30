import os
import sys
import sqlite3
import logging
import json
import uuid
from typing import Any
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, render_template, Response
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables BEFORE anything else
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
load_dotenv()  # Also try CWD / project root

# ensure stdout/stderr use UTF-8 so emojis and other characters can be logged
if hasattr(sys.stdout, "reconfigure"):  # type: ignore[attr-defined]
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
if hasattr(sys.stderr, "reconfigure"):  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]

# --- CONFIGURATION (from config.py + .env) ---
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# --- 1. SMART PATH LOGIC (env-var driven, no hardcoded usernames) ---
DEPLOY_ENV = Config.DEPLOY_ENV  # 'local' or 'pythonanywhere'
DATA_DIR = Config.DATA_DIR

if DEPLOY_ENV == 'pythonanywhere':
    logger_msg = f"Running on PythonAnywhere - using {DATA_DIR} for data"
else:
    logger_msg = f"Running locally - using {DATA_DIR} for data"

DB_PATH = os.path.join(DATA_DIR, Config.DATABASE_PATH)
LOG_PATH = os.path.join(DATA_DIR, Config.LOG_FILE)

# Configure CORS with RESTRICTED origins from .env (no more wildcard "*")
CORS(app, resources={r"/*": {"origins": Config.CORS_ORIGINS}}, supports_credentials=True)

# Setup logging
log_format = '%(asctime)s - %(levelname)s - %(message)s'
# Using absolute path for log file
file_handler = logging.FileHandler(LOG_PATH, encoding='utf-8')
file_handler.setFormatter(logging.Formatter(log_format))

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(logging.Formatter(log_format))

logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL, logging.INFO),
    handlers=[file_handler, stream_handler]
)
logger = logging.getLogger(__name__)
logger.info(logger_msg)

# Configuration from Config object
MAX_REQUESTS_PER_MINUTE = Config.MAX_REQUESTS_PER_MINUTE
REQUEST_TIMEOUT = Config.REQUEST_TIMEOUT

# --- 2. INPUT VALIDATION ---
def validate_violation_data(data):
    """Validates incoming violation data."""
    if not isinstance(data, dict):
        return False, "Invalid JSON format"
    
    # Check required fields (session_id is optional)
    required_fields = ['student_name', 'violation_type', 'timestamp', 'url']
    for field in required_fields:
        if field not in data or not isinstance(data[field], str):
            return False, f"Missing or invalid field: {field}"
    
    # Validate lengths to prevent injection attacks
    if len(data['student_name']) > 255:
        return False, "Student name too long (max 255 characters)"
    if len(data['violation_type']) > 100:
        return False, "Violation type too long"
    if len(data['url']) > 2000:
        return False, "URL too long"
    
    return True, "Valid"

# --- 3. RATE LIMITING ---
request_counts = {}

def rate_limit(f):
    """Simple rate limiting decorator."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.remote_addr
        current_minute = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        key = f"{client_ip}:{current_minute}"
        request_counts[key] = request_counts.get(key, 0) + 1
        
        if request_counts[key] > MAX_REQUESTS_PER_MINUTE:
            logger.warning(f"Rate limit exceeded for {client_ip}")
            return jsonify({"status": "error", "message": "Rate limit exceeded"}), 429
        
        return f(*args, **kwargs)
    return decorated_function

# --- 4. DATABASE INITIALIZATION ---
def init_db():
    """Initializes the database with session support."""
    try:
        logger.info(f"Connecting to database at: {DB_PATH}")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Create violations table with session_id
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                student_info TEXT NOT NULL,
                type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Add session_id column if it doesn't exist (for existing databases)
        cursor.execute("PRAGMA table_info(violations)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'session_id' not in columns:
            cursor.execute('ALTER TABLE violations ADD COLUMN session_id TEXT')
            logger.info("Added session_id column to violations table")
        
        conn.commit()
        conn.close()
        logger.info("Database is READY and synchronized with Extension.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

# Run setup on startup
try:
    init_db()
except Exception as e:
    logger.error(f"Failed to start application: {e}")

# --- 5. SESSION MANAGEMENT ROUTE ---
@app.route('/session', methods=['POST'])
@rate_limit
def manage_session() -> Any:
    """Handle exam session START and END events."""
    try:
        if not request.is_json:
            return jsonify({"status": "error", "message": "Content-Type must be application/json"}), 400
        
        data = request.json
        if data is None:
            return jsonify({"status": "error", "message": "Request body cannot be empty"}), 400
        
        event_type = data.get('event', '').upper()
        if event_type not in ['START', 'END']:
            return jsonify({"status": "error", "message": "Event must be START or END"}), 400
        
        if event_type == 'START':
            # Generate unique session ID
            session_id = str(uuid.uuid4())
            student_name = data.get('examUrl', 'N/A')
            logger.info(f"📝 Session START: {session_id}")
            return jsonify({
                "status": "success",
                "session_id": session_id,
                "message": "Exam session started"
            }), 200
        
        elif event_type == 'END':
            logger.info(f"📝 Session END")
            return jsonify({
                "status": "success",
                "message": "Exam session ended"
            }), 200
        
    except Exception as e:
        logger.error(f"Session management error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# --- 6. LOGGING ROUTE ---
@app.route('/log', methods=['POST'])
@rate_limit
def log_violation() -> Any:
    """Receives data from the extension and saves it to the DB."""
    try:
        if not request.is_json:
            logger.warning("Invalid content type in /log request")
            return jsonify({"status": "error", "message": "Content-Type must be application/json"}), 400
        
        data = request.json
        if data is None:
            logger.warning("Request body is empty")
            return jsonify({"status": "error", "message": "Request body cannot be empty"}), 400
        
        is_valid, message = validate_violation_data(data)
        if not is_valid:
            logger.warning(f"Invalid violation data: {message}")
            return jsonify({"status": "error", "message": message}), 400
        
        s_info = data.get('student_name', 'Anonymous').strip()
        v_type = data.get('violation_type', 'Unknown').strip()
        v_time = data.get('timestamp', datetime.now().isoformat()).strip()
        v_url = data.get('url', 'N/A').strip()
        session_id = data.get('session_id', None)

        # Insert into database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO violations (session_id, student_info, type, timestamp, url) VALUES (?, ?, ?, ?, ?)', 
            (session_id, s_info, v_type, v_time, v_url)
        )
        conn.commit()
        conn.close()
        
        logger.info(f"✅ LOGGED: {s_info} | Event: {v_type} | Session: {session_id}")
        return jsonify({"status": "success", "message": "Violation logged"}), 200
        
    except sqlite3.Error as e:
        logger.error(f"❌ Database Error: {e}")
        return jsonify({"status": "error", "message": "Database error occurred"}), 500
    except Exception as e:
        logger.error(f"❌ Unexpected Error: {e}")
        return jsonify({"status": "error", "message": "Internal server error"}), 500

# --- 7. DASHBOARD ROUTE ---
@app.route('/dashboard')
def dashboard() -> Any:
    """Renders the modern HTML dashboard with sessions grouped by exam."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all violations grouped by session
        cursor.execute('''
            SELECT session_id, student_info, type, timestamp, url 
            FROM violations 
            ORDER BY session_id DESC, id DESC 
            LIMIT 5000
        ''')
        logs = cursor.fetchall()
        conn.close()
        
        # Group by session_id and build structured data
        sessions_dict = {}
        for log in logs:
            sid, student_info, violation_type, ts, url = log
            if sid not in sessions_dict:
                sessions_dict[sid] = {
                    'session_id': sid or 'No Session',
                    'student_name': student_info or 'Unknown',
                    'start_time': ts,
                    'end_time': ts,
                    'violations': []
                }
            
            # Update end_time to latest timestamp
            if ts > sessions_dict[sid]['end_time']:
                sessions_dict[sid]['end_time'] = ts
            
            # Add violation with array format [type, timestamp, url] to match original format
            # But store as dict for clarity
            sessions_dict[sid]['violations'].append({
                'type': violation_type,
                'timestamp': ts,
                'url': url
            })
        
        # Convert to list ordered by most recent first
        sessions_list = sorted(sessions_dict.values(), 
                              key=lambda x: x['start_time'], 
                              reverse=True)
        sessions_json = json.dumps(sessions_list)
        logger.info(f"Dashboard loaded with {len(sessions_list)} sessions")
        return render_template('dashboard.html', logs=sessions_json)
    except sqlite3.Error as e:
        logger.error(f"Dashboard Database Error: {e}")
        return jsonify({"status": "error", "message": "Database error"}), 500
    except Exception as e:
        logger.error(f"Dashboard Error: {e}")
        return jsonify({"status": "error", "message": "Dashboard error"}), 500

# --- 8. SESSIONS API ROUTE ---
@app.route('/sessions', methods=['GET'])
def get_sessions() -> Any:
    """Get all exam sessions with violation counts."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get sessions with violation counts
        cursor.execute('''
            SELECT session_id, student_info, COUNT(*) as violation_count,
                   MIN(timestamp) as start_time, MAX(timestamp) as end_time
            FROM violations
            WHERE session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY start_time DESC
        ''')
        sessions = cursor.fetchall()
        
        # Get details for each session
        sessions_data = []
        for session in sessions:
            sid, student, violation_count, start_time, end_time = session
            cursor.execute('''
                SELECT type, timestamp, url FROM violations 
                WHERE session_id = ? 
                ORDER BY id DESC
            ''', (sid,))
            violations = cursor.fetchall()
            sessions_data.append({
                'session_id': sid,
                'student': student,
                'violation_count': violation_count,
                'start_time': start_time,
                'end_time': end_time,
                'violations': [{'type': v[0], 'timestamp': v[1], 'url': v[2]} for v in violations]
            })
        
        conn.close()
        return jsonify({
            "status": "success",
            "sessions": sessions_data
        }), 200
    except Exception as e:
        logger.error(f"Error fetching sessions: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# --- 9. DATA MANAGEMENT ROUTE ---
@app.route('/clear', methods=['POST'])
@rate_limit
def clear_logs() -> Any:
    """Wipes the violation table clean."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM violations')
        count = cursor.fetchone()[0]
        cursor.execute('DELETE FROM violations')
        conn.commit()
        conn.close()
        logger.info(f"🗑️ Cleared {count} violation records")
        return jsonify({"status": "success", "message": f"Cleared {count} records"}), 200
    except sqlite3.Error as e:
        logger.error(f"Clear logs database error: {e}")
        return jsonify({"status": "error", "message": "Database error"}), 500
    except Exception as e:
        logger.error(f"Clear logs error: {e}")
        return jsonify({"status": "error", "message": "Error clearing logs"}), 500

# --- 10. HEALTH CHECK ROUTE ---
@app.route('/health', methods=['GET'])
def health_check() -> Any:
    """Health check endpoint for monitoring."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM violations')
        count = cursor.fetchone()[0]
        conn.close()
        logger.info("Health check passed")
        return jsonify({
            "status": "healthy", 
            "database": "connected", 
            "violations": count,
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# --- 11. API VIOLATIONS ENDPOINT (for dashboard auto-refresh) ---
@app.route('/api/violations', methods=['GET'])
def get_violations():
    """Get violations as JSON API."""
    try:
        limit = request.args.get('limit', Config.MAX_VIOLATIONS_FETCH, type=int)
        if limit > 10000:
            limit = 10000
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT session_id, student_info, type, timestamp, url FROM violations ORDER BY id DESC LIMIT ?', (limit,))
        violations = cursor.fetchall()
        conn.close()
        
        return jsonify({
            "status": "success",
            "count": len(violations),
            "violations": violations
        }), 200
    except Exception as e:
        logger.error(f"Error fetching violations: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # This block only runs on your local machine. PythonAnywhere ignores it!
    try:
        app.run(debug=Config.DEBUG, port=Config.PORT, host=Config.HOST)
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        raise