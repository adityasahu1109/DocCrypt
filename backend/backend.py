from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os

import hashlib

app = FastAPI(title="DocCrypt Local Trust Registry")

# Configure CORS so our local HTML file can talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for MVP development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "trust_registry.db"
USERS_DB = "users.db"

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Database initialization
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    # Create the table mapping document IDs to public keys
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS public_keys (
            document_id TEXT PRIMARY KEY,
            public_key_jwk TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

    # Initialize users database
    conn_users = sqlite3.connect(USERS_DB)
    cursor_users = conn_users.cursor()
    cursor_users.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            user_type TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            org_name TEXT,
            contact_person TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn_users.commit()
    conn_users.close()

# Initialize DB on startup
init_db()

# Pydantic models for API request/response validation
class KeyRegistration(BaseModel):
    document_id: str
    public_key_jwk: str

class UserSignup(BaseModel):
    email: str
    password: str
    userType: str  # 'Individual' or 'Organization'
    firstName: str = None
    lastName: str = None
    orgName: str = None
    contactPerson: str = None

class UserLogin(BaseModel):
    email: str
    password: str

@app.post("/signup")
async def signup(user: UserSignup):
    try:
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO users (email, password_hash, user_type, first_name, last_name, org_name, contact_person)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user.email, hash_password(user.password), user.userType, user.firstName, user.lastName, user.orgName, user.contactPerson)
        )
        conn.commit()
        
        # Return user profile (without password)
        profile = {
            "email": user.email,
            "userType": user.userType,
            "name": f"{user.firstName} {user.lastName}" if user.userType == 'Individual' else f"{user.orgName} ({user.contactPerson})"
        }
        return {"status": "success", "user": profile}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already registered")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/login")
async def login(user: UserLogin):
    try:
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT email, user_type, first_name, last_name, org_name, contact_person FROM users WHERE email=? AND password_hash=?",
            (user.email, hash_password(user.password))
        )
        row = cursor.fetchone()
        
        if row:
            email, user_type, first_name, last_name, org_name, contact_person = row
            profile = {
                "email": email,
                "userType": user_type,
                "name": f"{first_name} {last_name}" if user_type == 'Individual' else f"{org_name} ({contact_person})"
            }
            return {"status": "success", "user": profile}
        else:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/register-key")
async def register_key(registration: KeyRegistration):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO public_keys (document_id, public_key_jwk) VALUES (?, ?)",
            (registration.document_id, registration.public_key_jwk)
        )
        conn.commit()
        return {"status": "success", "message": f"Key registered for document {registration.document_id}"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Document ID already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/get-key/{document_id}")
async def get_key(document_id: str):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT public_key_jwk FROM public_keys WHERE document_id = ?",
            (document_id,)
        )
        result = cursor.fetchone()
        
        if result is None:
            raise HTTPException(status_code=404, detail="Key not found for document ID")
            
        return {"document_id": document_id, "public_key_jwk": result[0]}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
