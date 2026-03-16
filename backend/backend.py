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
    
    # Check if the table has the new schema columns. If not, drop and recreate it.
    try:
        cursor.execute("SELECT document_hash FROM public_keys LIMIT 1")
    except sqlite3.OperationalError:
        print("Migrating trust_registry schema: dropping old public_keys table.")
        cursor.execute("DROP TABLE IF EXISTS public_keys")
        
    # Create the table mapping document IDs to public keys and hashes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS public_keys (
            document_id TEXT PRIMARY KEY,
            public_key_jwk TEXT NOT NULL,
            document_hash TEXT NOT NULL,
            signature_base64 TEXT NOT NULL,
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
    document_hash: str
    signature_base64: str

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

class UserUpdate(BaseModel):
    email: str
    firstName: str = None
    lastName: str = None
    orgName: str = None

@app.post("/update-profile")
async def update_profile(update: UserUpdate):
    try:
        conn = sqlite3.connect(USERS_DB)
        cursor = conn.cursor()
        
        # We use email to find the user
        cursor.execute("SELECT user_type, first_name, last_name, org_name, contact_person FROM users WHERE email=?", (update.email,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_type, first_name, last_name, org_name, contact_person = row
        
        # Update fields depending on user type
        new_first = update.firstName if update.firstName is not None else first_name
        new_last = update.lastName if update.lastName is not None else last_name
        new_org = update.orgName if update.orgName is not None else org_name
        
        cursor.execute(
            "UPDATE users SET first_name=?, last_name=?, org_name=? WHERE email=?",
            (new_first, new_last, new_org, update.email)
        )
        conn.commit()
        
        profile = {
            "email": update.email,
            "type": user_type,
            "firstName": new_first,
            "lastName": new_last,
            "orgName": new_org,
            "contactPerson": contact_person,
            "name": f"{new_first} {new_last}" if user_type == 'Individual' else f"{new_org} ({contact_person})"
        }
        return {"status": "success", "user": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

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
            "type": user.userType,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "orgName": user.orgName,
            "contactPerson": user.contactPerson,
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
                "type": user_type,
                "firstName": first_name,
                "lastName": last_name,
                "orgName": org_name,
                "contactPerson": contact_person,
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
            "INSERT INTO public_keys (document_id, public_key_jwk, document_hash, signature_base64) VALUES (?, ?, ?, ?)",
            (registration.document_id, registration.public_key_jwk, registration.document_hash, registration.signature_base64)
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

@app.get("/lookup-record")
async def lookup_record(query: str):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Search by Document ID exactly OR search by Document Hash exactly
        cursor.execute(
            "SELECT document_id, public_key_jwk, document_hash, signature_base64, created_at FROM public_keys WHERE document_id = ? OR document_hash = ?",
            (query, query)
        )
        result = cursor.fetchone()
        
        if result is None:
            raise HTTPException(status_code=404, detail="No cryptographic record found for this identifier.")
            
        return {
            "document_id": result[0],
            "public_key_jwk": result[1],
            "document_hash": result[2],
            "signature_base64": result[3],
            "created_at": result[4]
        }
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
