# DocCrypt Operations Manual

Welcome to **DocCrypt**, a decentralized document signing and cryptographic verification platform. This manual provides instructions on how to run, operate, and maintain the DocCrypt ecosystem.

---

## 1. System Architecture

DocCrypt consists of two primary components operating locally:
1.  **Frontend (React + Vite)**: The user-facing dashboard for uploading, signing, and verifying documents.
2.  **Backend (FastAPI + SQLite)**: The "Trust Ledger" that securely stores user profiles, cryptographic public keys, document hashes, and signatures.

---

## 2. Running the Application

To start DocCrypt, you need to open two separate terminal windows (one for the frontend, one for the backend).

### Starting the Backend (Trust Ledger)
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd d:\Projects\DocCrypt\backend
   ```
2. Start the FastAPI server using `uvicorn`:
   ```bash
   uvicorn backend:app --port 8080 --reload
   ```
   *The backend will now be actively listening for database queries on `http://127.0.0.1:8080/`.*

### Starting the Frontend (React App)
1. Open a *second* terminal window and navigate to the frontend directory:
   ```bash
   cd d:\Projects\DocCrypt\frontend
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to the Localhost URL provided in the terminal (usually `http://localhost:5173/`).

---

## 3. How to Use DocCrypt

### A. Creating an Account & Profile
1. On the main page, click **Login / Sign Up** and register as either an *Individual* or an *Organization*.
2. Once logged in, navigate to **Dashboard**.
3. Use the **Profile Settings** tab to update your First Name, Last Name, or Organization Name. *These changes are immediately synced to `users.db` on the backend so your signatures always reflect your true identity.*

### B. Digitally Signing a Document
1. Navigate to the **Dashboard** and go to the **Sign Document** tab.
2. Under "Placement", choose where you want DocCrypt to visually place the QR Code (e.g., *Bottom-Right* or appended to a *New Page*).
3. Drag and drop your **un-signed PDF** into the upload zone.
4. Click **Sign & Stamp**. 
   * **What happens behind the scenes:** DocCrypt hashes the raw physical bytes of your file, generates an RSA-PSS public/private key pair, signs the hash, and sends the payload to the backend Ledger. It then generates a minimal QR code containing the permanent `Doc ID` and embeds it into your PDF.
5. The stamped PDF will automatically download to your computer.

### C. Verifying a Document
Navigate to the **Verify** page from the top navigation bar. You have two methods:

**Method 1: Scan Stamped File**
1. Drag and drop a document that has a DocCrypt QR code stamped on it.
2. The system scans the QR code to find the `Doc ID`.
3. It queries the backend Ledger for the matching cryptographic signature and strictly verifies the math. If it passes, you will see a green checkmark indicating the signature itself is authentic.

**Method 2: Manual Hash / Original File**
If you want to prove your *original* document was never tampered with (byte-for-byte tracking), use this tab:
1. Drag and drop the **Original, Un-Stamped** version of the PDF into the zone.
2. DocCrypt will automatically hash the file and fill out the text box.
3. Click "Validate". The system checks the backend Ledger. If the hash matches the original ledger entry perfectly, it confirms absolute non-tampering.

---

## 4. Administrative Scripts

The `backend` folder contains utility Python scripts for database management. Run these from your terminal while inside the `d:\Projects\DocCrypt\backend` folder.

### 1. View Databases (`view_dbs.py`)
Use this script to print the contents of the SQLite databases directly to your console. This is useful for auditing registered users and reviewing the cryptographic keys stored in the Trust Registry.
```bash
python view_dbs.py
```
*Output will display tables for `Users` and `Public Keys (Ledger)`.*

### 2. Purge Trust Registry (`purge_db.py`)
Use this script to permanently wipe the `public_keys` table inside the `trust_registry.db`. This destroys all cryptographic ledgers, invalidating every QR code previously generated. **Use with caution.**
```bash
python purge_db.py
```
