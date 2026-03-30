"""
Configuration module for Proctor AI Backend
Centralized settings management
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env from the backend directory (or project root)
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
load_dotenv()  # Also try CWD / project root

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================

class Config:
    """Base configuration"""
    
    # Application
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # Deployment detection (replaces hardcoded /home/saalfy check)
    # Set DEPLOY_ENV=pythonanywhere in your PythonAnywhere .env
    DEPLOY_ENV = os.getenv('DEPLOY_ENV', 'local')
    DATA_DIR = os.getenv('DATA_DIR', os.path.dirname(os.path.abspath(__file__)))
    
    # Database
    DATABASE_PATH = os.getenv('DATABASE_PATH', 'proctor.db')
    DATABASE_TIMEOUT = int(os.getenv('DATABASE_TIMEOUT', 30))
    
    # Server
    HOST = os.getenv('HOST', '127.0.0.1')
    PORT = int(os.getenv('PORT', 5000))
    
    # Security
    MAX_REQUESTS_PER_MINUTE = int(os.getenv('MAX_REQUESTS_PER_MINUTE', 60))
    REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', 30))
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB
    
    # CORS
    raw_origins = os.getenv('CORS_ORIGINS', 'http://127.0.0.1:*,http://localhost:*').split(',')
    CORS_ORIGINS = []
    for origin in raw_origins:
        origin = origin.strip()
        if origin == 'chrome-extension://*':
            import re
            CORS_ORIGINS.append(re.compile(r"chrome-extension://.*"))
        else:
            CORS_ORIGINS.append(origin)
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'proctor.log')
    LOG_MAX_BYTES = int(os.getenv('LOG_MAX_BYTES', 10485760))  # 10MB
    LOG_BACKUP_COUNT = int(os.getenv('LOG_BACKUP_COUNT', 5))
    
    # Violation tracking
    MAX_VIOLATIONS_PER_STUDENT_PER_MINUTE = int(os.getenv('MAX_VIOLATIONS_PER_STUDENT_PER_MINUTE', 10))
    VIOLATION_RETENTION_DAYS = int(os.getenv('VIOLATION_RETENTION_DAYS', 30))
    
    # Pagination
    VIOLATIONS_PER_PAGE = int(os.getenv('VIOLATIONS_PER_PAGE', 100))
    MAX_VIOLATIONS_FETCH = int(os.getenv('MAX_VIOLATIONS_FETCH', 1000))


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    SECRET_KEY = os.getenv('SECRET_KEY')  # Must be set in production
    
    @classmethod
    def validate(cls):
        """Call this when actually using production config to enforce SECRET_KEY."""
        if not cls.SECRET_KEY:
            raise ValueError("SECRET_KEY environment variable must be set in production")


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DATABASE_PATH = ':memory:'  # Use in-memory database for tests
    DEBUG = True


# ============================================================================
# CONFIGURATION SELECTION
# ============================================================================

def get_config():
    """Get configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development')
    
    config_map = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig,
    }
    
    return config_map.get(env, DevelopmentConfig)


# ============================================================================
# USEFUL CONSTANTS
# ============================================================================

VIOLATION_TYPES = {
    'tab_switch': 'Tab Switched / Hidden',
    'focus_loss': 'Focus Lost (Alt+Tab or Window Switch)',
    'fullscreen_exit': 'Exited Fullscreen Mode',
    'copy_attempt': 'Copy Attempted',
    'paste_attempt': 'Paste Attempted',
    'page_navigation': 'Navigating away from Exam Page',
}

CRITICAL_VIOLATIONS = ['Copy Attempted', 'Paste Attempted', 'Navigating away']
WARNING_VIOLATIONS = ['Tab Switched / Hidden', 'Focus Lost']

# ============================================================================
# DATABASE SCHEMA VERSION
# ============================================================================

DB_SCHEMA_VERSION = '1.0'

# ============================================================================
# API VERSIONING
# ============================================================================

API_VERSION = 'v1'
API_PREFIX = f'/api/{API_VERSION}'
