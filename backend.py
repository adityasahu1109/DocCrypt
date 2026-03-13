from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os

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

# Initialize DB on startup
init_db()

# Pydantic models for API request/response validation
class KeyRegistration(BaseModel):
    document_id: str
    public_key_jwk: str

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
