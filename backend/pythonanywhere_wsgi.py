"""
WSGI entry point for PythonAnywhere
This file is required by PythonAnywhere to load the Flask app
"""
import sys
import os
from dotenv import load_dotenv

# Add the backend directory to the Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# Load environment variables BEFORE importing the app
load_dotenv(os.path.join(backend_dir, '.env'))
load_dotenv()

# Import the Flask app
from app import app

# PythonAnywhere expects the app to be named 'application'
application = app

if __name__ == "__main__":
    application.run()

