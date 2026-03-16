// crypto.js - DocCrypt Core Engine (Refactored for React)

const BACKEND_URL = "http://localhost:8080";

export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export function bufferToHex(buffer) {
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateDocId() {
    return 'doc_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export async function extractTextFromPdfBytes(pdfArrayBuffer, skipLastPage = false) {
    const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(pdfArrayBuffer) });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    let fullText = "";

    const pagesToRead = skipLastPage && numPages > 1 ? numPages - 1 : numPages;

    for (let i = 1; i <= pagesToRead; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + "\n";
    }
    return fullText;
}

export async function loadKeyFromBackend(documentId) {
    try {
        const response = await fetch(`${BACKEND_URL}/get-key/${documentId}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Backend error");
        return JSON.parse(result.public_key_jwk);
    } catch (err) {
        console.error("Failed loading from backend:", err);
        return null;
    }
}

export async function saveKeyToBackend(documentId, jwk, documentHash, signatureBase64) {
    try {
        const response = await fetch(`${BACKEND_URL}/register-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_id: documentId,
                public_key_jwk: JSON.stringify(jwk),
                document_hash: documentHash,
                signature_base64: signatureBase64
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Backend error");
        return true;
    } catch (err) {
        console.error("Failed saving to backend:", err);
        return false;
    }
}

export async function lookupRecordFromBackend(query) {
    try {
        const response = await fetch(`${BACKEND_URL}/lookup-record?query=${encodeURIComponent(query)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Failed looking up record from backend:", err);
        return null;
    }
}

export function scanCanvasForQR(canvas, ctx) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
}

// ----- THE MAIN WORKFLOWS -----

export async function generateKeys() {
    return await window.crypto.subtle.generateKey(
        { name: "RSA-PSS", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true, ["sign", "verify"]
    );
}

export async function signAndStampPDF(fileBuffer, keyPair, qrPlacement = 'Bottom-Right', issuerAuthData = null) {
    // 1. Hash the raw PHYSICAL bytes of the original PDF (Collision-Proof)
    const docHashBuffer = await window.crypto.subtle.digest("SHA-256", fileBuffer);
    const docHashHex = bufferToHex(docHashBuffer);
    
    // 2. Sign the textual Hex string of the hash
    const textEncoder = new TextEncoder();
    const hashDataBuffer = textEncoder.encode(docHashHex);
    
    const signatureBuffer = await window.crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: 32 },
        keyPair.privateKey,
        hashDataBuffer
    );
    const signatureBase64 = arrayBufferToBase64(signatureBuffer);
    
    // 3. Save Public Key + Ledger Data
    const docId = generateDocId();
    const exportedPublicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    await saveKeyToBackend(docId, exportedPublicKey, docHashHex, signatureBase64);

    // 5. Construct QR Payload (Minified to solve jsQR density blurring issues)
    const payloadJson = JSON.stringify({ docId: docId });
    
    // Generate QR Data URL using a temporary DOM element (standard qrcode.js behavior)
    const tempDiv = document.createElement('div');
    new window.QRCode(tempDiv, { text: payloadJson, width: 250, height: 250, correctLevel: window.QRCode.CorrectLevel.M });
    
    // We need to wait a tiny bit for the library to render the canvas
    await new Promise(r => setTimeout(r, 100));
    const qrCanvas = tempDiv.querySelector('canvas');
    if (!qrCanvas) throw new Error("QR Generation failed");
    
    // --- Badge Enrichment (Fixes Bug 2 & 1) ---
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 800;
    badgeCanvas.height = 250;
    const ctx = badgeCanvas.getContext('2d');
    
    // Draw white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, badgeCanvas.width, badgeCanvas.height);
    
    // Draw Border
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#4F46E5"; // Primary color
    ctx.strokeRect(2, 2, badgeCanvas.width - 4, badgeCanvas.height - 4);

    // Draw QR Code with a 20px quiet zone offset to prevent border interference
    ctx.drawImage(qrCanvas, 20, 0, 250, 250);
    
    // Draw Text
    ctx.fillStyle = "#111827"; // Text color
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("DocCrypt Verified Seal", 290, 60);

    
    ctx.font = "24px sans-serif";
    
    // Robust name extraction to prevent 'undefined' for old mock users
    let issuerName = 'Unknown Issuer';
    if (issuerAuthData) {
        if (issuerAuthData.type === 'Organization') {
            issuerName = issuerAuthData.orgName || issuerAuthData.name || 'Unknown Org';
        } else {
            const first = issuerAuthData.firstName || '';
            const last = issuerAuthData.lastName || '';
            issuerName = `${first} ${last}`.trim();
            if (!issuerName) issuerName = issuerAuthData.name || 'Unknown Individual';
        }
    }

    ctx.fillText(`Issued By: ${issuerName}`, 290, 110);
    ctx.fillText(`Date: ${new Date().toLocaleString()}`, 290, 150);
    ctx.fillText(`Doc ID: ${docId}`, 290, 190);

    const qrImageDataUrl = badgeCanvas.toDataURL('image/png');
    
    // 6. Embed in PDF
    const { PDFDocument, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(fileBuffer);
    let page;
    
    if (qrPlacement === 'New Page (Appended)') {
        page = pdfDoc.addPage();
    } else {
        // Place inline stamps on the FIRST page
        const pages = pdfDoc.getPages();
        page = pages[0];
    }

    const { width, height } = page.getSize();
    const qrImage = await pdfDoc.embedPng(qrImageDataUrl);
    
    // A more advanced placement logic based on the user's dropdown choice
    let qrX = 50;
    let qrY = 50;
    
    const scaleFactor = 0.35;
    const qrDims = qrImage.scale(scaleFactor);
    
    if (qrPlacement === 'Bottom-Right') {
        qrX = width - qrDims.width - 50;
        qrY = 50;
    } else if (qrPlacement === 'Top-Right') {
        qrX = width - qrDims.width - 50;
        qrY = height - qrDims.height - 50;
    } else if (qrPlacement === 'Top-Left') {
        qrX = 50;
        qrY = height - qrDims.height - 50;
    } else if (qrPlacement === 'New Page (Appended)') {
        qrX = (width - qrDims.width) / 2;
        qrY = height / 2;
    }

    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrDims.width, height: qrDims.height });
    
    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
}

export async function verifyDocumentContent(fileUpload, setStatusCallback) {
    return new Promise(async (resolve, reject) => {
        try {
            let verifyImageElement = null; 
            let verifyPdfArrayBuffer = null; 
            
            const reader = new FileReader();

            const parseFile = () => {
                return new Promise((res) => {
                    if (fileUpload.type.startsWith('image/')) {
                        reader.onload = function(e) {
                            verifyImageElement = new Image();
                            verifyImageElement.onload = res;
                            verifyImageElement.src = e.target.result;
                        };
                        reader.readAsDataURL(fileUpload);
                    } else if (fileUpload.type === 'application/pdf') {
                        reader.onload = function(e) { 
                            verifyPdfArrayBuffer = e.target.result; 
                            res();
                        };
                        reader.readAsArrayBuffer(fileUpload);
                    }
                });
            };

            await parseFile();

            setStatusCallback("Processing Document...");
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let code = null;

            if (verifyImageElement) {
                setStatusCallback("Processing Image Canvas...");
                canvas.width = verifyImageElement.width;
                canvas.height = verifyImageElement.height;
                ctx.drawImage(verifyImageElement, 0, 0, canvas.width, canvas.height);
                code = scanCanvasForQR(canvas, ctx);
            } else if (verifyPdfArrayBuffer) {
                setStatusCallback("Rendering final PDF page to detect Verification Stamp...");
                try {
                    const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(verifyPdfArrayBuffer) });
                    const pdfDocument = await loadingTask.promise;
                    const numPages = pdfDocument.numPages;
                    
                    // 1. Scan the LAST page first (for Appended pages)
                    let page = await pdfDocument.getPage(numPages);
                    let viewport = page.getViewport({ scale: 2.0 }); 
                    
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                    code = scanCanvasForQR(canvas, ctx);

                    // 2. If not found, scan the FIRST page (for inline stamps like Top-Right)
                    if (!code && numPages > 1) {
                        setStatusCallback("QR not on last page, checking first page...");
                        page = await pdfDocument.getPage(1);
                        viewport = page.getViewport({ scale: 2.0 }); 
                        
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                        code = scanCanvasForQR(canvas, ctx);
                    }
                } catch (pdfJsError) {
                    return resolve({ success: false, error: "Failed to parse PDF for QR code scanning.", resultData: null });
                }
            }

            if (!code) {
                return resolve({ success: false, error: "No valid QR code found in the document.", resultData: null });
            }

            let payload;
            try {
                payload = JSON.parse(code.data);
                setStatusCallback(`QR Payload Found: Doc ID [${payload.docId}]`);
            } catch(e) {
                return resolve({ success: false, error: "QR code contents are not a valid DocCrypt payload.", resultData: null });
            }

            setStatusCallback("Contacting Trust Registry to fetch Ledger Data...");
            const record = await lookupRecordFromBackend(payload.docId);
            
            if (!record) {
                return resolve({ success: false, error: "VERIFICATION FAILED: This Document ID does not exist in the decentralized ledger.", resultData: null });
            }

            let verificationKey;
            try {
                const jwk = JSON.parse(record.public_key_jwk);
                verificationKey = await window.crypto.subtle.importKey("jwk", jwk, { name: "RSA-PSS", hash: "SHA-256" }, true, ["verify"]);
            } catch(e) {
                return resolve({ success: false, error: "Failed to import the retrieved public key.", resultData: null });
            }

            // --- File Matching vs Payload Hash ---
            let isOriginal = false;
            let fileHashHex = "";
            if (verifyPdfArrayBuffer) {
                setStatusCallback("Hashing uploaded physical document bytes...");
                const currentHashBuffer = await window.crypto.subtle.digest("SHA-256", verifyPdfArrayBuffer);
                fileHashHex = bufferToHex(currentHashBuffer);
                
                setStatusCallback(`Uploaded File Hash: ${fileHashHex.substring(0,32)}...`);
                if (fileHashHex === record.document_hash) {
                    setStatusCallback("Uploaded file matches the authentic payload exactly (Original Document).");
                    isOriginal = true;
                } else {
                    setStatusCallback("Uploaded file is structurally modified (e.g., Stamped) from the Original.");
                }
            } 

            // --- Final strict Cryptographic Verification ---
            setStatusCallback("Executing strict RSA-PSS Signature Verification...");
            const textEncoder = new TextEncoder();
            const hashDataBuffer = textEncoder.encode(record.document_hash);
            
            const signatureBuffer = base64ToArrayBuffer(record.signature_base64);
            const isValid = await window.crypto.subtle.verify(
                { name: "RSA-PSS", saltLength: 32 },
                verificationKey,
                signatureBuffer,
                hashDataBuffer
            );
            
            if (isValid) {
                return resolve({ 
                    success: true, 
                    resultData: {
                        docId: record.document_id,
                        originalHash: record.document_hash,
                        fileHashHex: fileHashHex,
                        isOriginal: isOriginal,
                        dateIssued: new Date(record.created_at).toLocaleString(),
                        signature: record.signature_base64
                    }
                });
            } else {
                return resolve({ success: false, error: "Ledger Database Corruption or Forgery detected. Signature Validation Failed.", resultData: null });
            }

        } catch(err) {
            console.error(err);
            return resolve({ success: false, error: `Cryptographic failure: ${err.message}`, resultData: null });
        }
    });
}

export async function verifyByManualHash(query, setStatusCallback) {
    return new Promise(async (resolve) => {
        try {
            setStatusCallback(`Looking up Trust Registry for identifier: ${query}...`);
            const record = await lookupRecordFromBackend(query);
            if (!record) return resolve({ success: false, error: "Identifier not found in the decentralized ledger." });
            
            setStatusCallback(`Ledger match found. Registered by Doc ID: ${record.document_id}`);
            const jwk = JSON.parse(record.public_key_jwk);
            const verificationKey = await window.crypto.subtle.importKey("jwk", jwk, { name: "RSA-PSS", hash: "SHA-256" }, true, ["verify"]);
            
            setStatusCallback("Verifying ledger signature against ledger hash...");
            const textEncoder = new TextEncoder();
            const hashDataBuffer = textEncoder.encode(record.document_hash);
            const signatureBuffer = base64ToArrayBuffer(record.signature_base64);
            
            const isValid = await window.crypto.subtle.verify(
                { name: "RSA-PSS", saltLength: 32 },
                verificationKey,
                signatureBuffer,
                hashDataBuffer
            );
            
            if (isValid) {
                return resolve({ 
                    success: true, 
                    resultData: { 
                        docId: record.document_id, 
                        originalHash: record.document_hash, 
                        dateIssued: new Date(record.created_at).toLocaleString(),
                        isOriginal: true, 
                        signature: record.signature_base64 
                    } 
                });
            } else {
                return resolve({ success: false, error: "Ledger Database Corruption or Forgery detected. Signature Validation Failed." });
            }
        } catch (e) {
            return resolve({ success: false, error: `Manual Cryptographic verify failed: ${e.message}` });
        }
    });
}
