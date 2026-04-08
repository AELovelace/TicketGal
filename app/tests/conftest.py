"""Pytest configuration and fixtures."""
import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app, get_db
from app.database import Base, init_db, create_user, set_user_role


@pytest.fixture
def temp_db():
    """Create a temporary SQLite database for testing."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    if os.path.exists(path):
        os.unlink(path)


@pytest.fixture
def test_db(temp_db, monkeypatch):
    """Initialize test database and provide session."""
    monkeypatch.setenv("DATABASE_FILE", temp_db)
    from app import database
    database.DB_FILE = temp_db
    database.init_db()
    yield temp_db


@pytest.fixture
def client(test_db):
    """FastAPI TestClient with test database."""
    def override_get_db():
        from app.database import get_db as _get_db
        for session in _get_db():
            yield session
    
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


@pytest.fixture
def test_user(client):
    """Create a test user."""
    email = "test@example.com"
    password = "TestPassword123!"
    from app.database import create_user, SessionLocal
    
    db = SessionLocal()
    user = create_user(db, email, password, "Test User")
    db.close()
    
    return {"email": email, "password": password, "id": user.id}


@pytest.fixture
def test_admin(client, test_user):
    """Create a test admin user."""
    from app.database import set_user_role, SessionLocal
    
    db = SessionLocal()
    set_user_role(db, test_user["id"], "admin")
    db.close()
    
    admin_email = "admin@example.com"
    admin_password = "AdminPassword123!"
    from app.database import create_user
    
    db = SessionLocal()
    admin = create_user(db, admin_email, admin_password, "Admin User")
    set_user_role(db, admin.id, "admin")
    db.close()
    
    return {"email": admin_email, "password": admin_password, "id": admin.id}


@pytest.fixture
def authenticated_client(client, test_user):
    """TestClient with authenticated session."""
    response = client.post("/api/login", json={
        "email": test_user["email"],
        "password": test_user["password"]
    })
    assert response.status_code == 200
    return client


@pytest.fixture
def admin_client(client, test_admin):
    """TestClient with admin authenticated session."""
    response = client.post("/api/login", json={
        "email": test_admin["email"],
        "password": test_admin["password"]
    })
    assert response.status_code == 200
    return client
