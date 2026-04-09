
# DocCrypt

A decentralized document signing and cryptographic verification platform that issues tamper-proof PDFs using a **Hash-then-Sign** architecture.

---

## Idea & Intuition

Most document verification systems rely on a trusted central server to store the original file. DocCrypt takes a different approach — it **never stores your document**. Instead, it stores only the cryptographic proof.

**The core idea:**
1. When you sign a PDF, DocCrypt hashes the raw bytes of the file (SHA-256), generates a fresh RSA-PSS key pair in your browser, and signs that hash.
2. The **public key + hash + signature** are registered on a local "Trust Ledger" (SQLite via FastAPI).
3. A QR code containing a unique `Doc ID` is stamped onto the PDF and downloaded to you.
4. To verify later, anyone can scan the QR code or re-hash the original file and check it against the ledger — **no original file needed on the server**.

This means:
- Private keys **never leave the browser** (Web Crypto API).
- The server only holds public, non-sensitive cryptographic proofs.
- Any byte-level tampering of the document is instantly detectable.

---

## Architecture

```
┌─────────────────────────────┐                          ┌────────────────────────────┐
│   Frontend (React + Vite)   │                          │ Backend (FastAPI + SQLite) │
│                             │                          │                            │
│ - Key generation (RSA-PSS)  │── POST /register-key ───▶│ trust_registry.db          │
│ - PDF stamping (pdf-lib)    │                          │ users.db                   │
│ - QR scanning (jsQR)        │◀── GET /get-key/{id} ────│                            │
│ - Auth UI                   │─── POST /login ─────────▶│                            │
└─────────────────────────────┘                          └────────────────────────────┘
```

**Databases:**
| DB | Purpose |
|---|---|
| `users.db` | User profiles & hashed passwords |
| `trust_registry.db` | `document_id`, `public_key_jwk`, `document_hash`, `signature_base64` |

---

## Prerequisites

- **Python 3.8+**
- **Node.js v18+ & npm**

---

## Setup & Running

### 1. Backend (Trust Ledger)

```bash
# Navigate to backend
cd backend

# Install Python dependencies
pip install fastapi uvicorn pydantic

# Start the server
uvicorn backend:app --port 8080 --reload
```

Backend runs at: `http://127.0.0.1:8080`

---

### 2. Frontend (React App)

Open a **second terminal**:

```bash
# Navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## How to Use

### Sign a Document
1. Register/Login as an **Individual** or **Organization**.
2. Go to **Dashboard → Sign Document**.
3. Choose QR code placement (e.g., Bottom-Right or New Page).
4. Drag & drop your unsigned PDF → click **Sign & Stamp**.
5. The stamped PDF (with embedded QR code) downloads automatically.

### Verify a Document

Navigate to the **Verify** page. Two methods:

| Method | How |
|---|---|
| **Scan Stamped File** | Drop the stamped PDF — system reads QR → fetches ledger entry → verifies signature math |
| **Original File Hash** | Drop the original unsigned PDF → system hashes it → checks against ledger for byte-level integrity |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/signup` | Register a new user |
| `POST` | `/login` | Authenticate a user |
| `POST` | `/update-profile` | Update user profile |
| `POST` | `/register-key` | Register a signed document's crypto proof |
| `GET` | `/get-key/{document_id}` | Fetch public key for a Doc ID |
| `GET` | `/lookup-record?query=` | Lookup by Doc ID or document hash |

---

## Admin / Utility Scripts

Run these from inside the `backend/` directory:

```bash
# View all users and ledger entries
python view_dbs.py

# ⚠️ Wipe the entire Trust Registry (invalidates all QR codes)
python purge_db.py
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 + Vite |
| Styling | Tailwind CSS |
| PDF Manipulation | pdf-lib |
| QR Scanning | jsQR + PDF.js |
| Cryptography | Web Crypto API (RSA-PSS, SHA-256) |
| Backend | FastAPI (Python) |
| Database | SQLite |

---

## Project Structure

```
DocCrypt/
├── backend/
│   ├── backend.py        # FastAPI Trust Ledger server
│   ├── view_dbs.py       # Audit utility
│   └── purge_db.py       # Reset utility
├── frontend/
│   ├── src/              # React components & pages
│   ├── package.json
│   └── vite.config.js
└── manual.md             # Operations manual
```

