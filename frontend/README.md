# DocCrypt Frontend

This directory contains the React (Vite-powered) frontend for DocCrypt — a decentralized document signing and cryptographic verification platform.

## 🛠️ Tech Stack

- **Framework:** React 19
- **Bundler:** Vite
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **Crypto & Hash:** Native Web Crypto API
- **PDF Manipulation:** `pdf-lib`
- **QR Operations:** `jsQR` & `qrcode.js` natively or injected

## 🚀 Getting Started

To launch the frontend locally for development:

1. **Install Dependencies**
   Navigate to this directory and install required npm packages:
   ```bash
   cd frontend
   npm install
   ```

2. **Start the Development Server**
   ```bash
   npm run dev
   ```
   *The application will typically map to `http://localhost:5173`.*

## 📁 Core Directory Structure

- `src/components/`: Modular reusable React components (Buttons, Cards, Navbars).
- `src/context/`: Contains `AuthContext.jsx` handling mock states for user authentication.
- `src/pages/`: Main view logic mapping to paths (`Landing`, `Auth`, `Dashboard`, `Verify`).
- `src/utils/crypto.js`: The central "engine" performing natively abstracted Web Crypto signing, verification, and `pdf-lib` PDF stamping logic.

## 🔗 Connection to Backend

This frontend interface corresponds directly to the Python/FastAPI service found within the `backend/` directory. By default, `crypto.js` and `AuthContext.jsx` are configured to point to `http://localhost:8080`.
