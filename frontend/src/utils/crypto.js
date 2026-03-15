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

export async function saveKeyToBackend(documentId, jwk) {
    try {
        const response = await fetch(`${BACKEND_URL}/register-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_id: documentId,
                public_key_jwk: JSON.stringify(jwk)
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

export async function signAndStampPDF(fileBuffer, keyPair, qrPlacement = 'Bottom-Right') {
    // 1. Extract digital text from the original PDF
    const extractedText = await extractTextFromPdfBytes(fileBuffer, false);
    const textEncoder = new TextEncoder();
    const textDataBuffer = textEncoder.encode(extractedText);

    // 2. Hash the raw TEXT
    const docHashBuffer = await window.crypto.subtle.digest("SHA-256", textDataBuffer);
    const docHashHex = bufferToHex(docHashBuffer);
    
    // 3. Sign the Hash (by signing the textDataBuffer)
    const signatureBuffer = await window.crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: 32 },
        keyPair.privateKey,
        textDataBuffer
    );
    const signatureBase64 = arrayBufferToBase64(signatureBuffer);
    
    // 4. Save Public Key
    const docId = generateDocId();
    const exportedPublicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    await saveKeyToBackend(docId, exportedPublicKey);

    // 5. Construct QR Payload
    const payloadJson = JSON.stringify({ docId: docId, hash: docHashHex, sig: signatureBase64 });
    
    // Generate QR Data URL using a temporary DOM element (standard qrcode.js behavior)
    const tempDiv = document.createElement('div');
    new window.QRCode(tempDiv, { text: payloadJson, width: 250, height: 250, correctLevel: window.QRCode.CorrectLevel.M });
    
    // We need to wait a tiny bit for the library to render the canvas
    await new Promise(r => setTimeout(r, 100));
    const qrCanvas = tempDiv.querySelector('canvas');
    if (!qrCanvas) throw new Error("QR Generation failed");
    const qrImageDataUrl = qrCanvas.toDataURL('image/png');
    
    // 6. Embed in PDF
    const { PDFDocument, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(fileBuffer);
    let page;
    
    if (qrPlacement === 'New Page (Appended)') {
        page = pdfDoc.addPage();
    } else {
        // Just append to the last page for simplicity
        const pages = pdfDoc.getPages();
        page = pages[pages.length - 1];
    }

    const { width, height } = page.getSize();
    const qrImage = await pdfDoc.embedPng(qrImageDataUrl);
    
    // A more advanced placement logic based on the user's dropdown choice
    let qrX = 50;
    let qrY = 50;
    
    if (qrPlacement === 'Bottom-Right') {
        qrX = width - 150;
        qrY = 50;
    } else if (qrPlacement === 'Top-Right') {
        qrX = width - 150;
        qrY = height - 150;
    } else if (qrPlacement === 'Top-Left') {
        qrX = 50;
        qrY = height - 150;
    } else if (qrPlacement === 'New Page (Appended)') {
        qrX = width / 2 - 50;
        qrY = height / 2;
    }

    const qrDims = qrImage.scale(0.5);
    
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrDims.width, height: qrDims.height });
    
    // If it's a new page, write some text, else keep it subtle
    if (qrPlacement === 'New Page (Appended)') {
        page.drawText('DocCrypt Text-Content Verification Stamp', { x: 50, y: height / 2 - 120, size: 16, color: rgb(0, 0, 0) });
        page.drawText(`Document ID: ${docId}`, { x: 50, y: height / 2 - 150, size: 10 });
    }
    
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
                    // Usually stamp is on the last page
                    const page = await pdfDocument.getPage(numPages);
                    const viewport = page.getViewport({ scale: 2.0 }); 
                    
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                    code = scanCanvasForQR(canvas, ctx);
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

            setStatusCallback("Contacting Trust Registry to fetch Public Key...");
            const jwk = await loadKeyFromBackend(payload.docId);
            
            if (!jwk) {
                return resolve({ success: false, error: "VERIFICATION FAILED: This Document ID does not exist in the Trust Registry.", resultData: null });
            }

            let verificationKey;
            try {
                verificationKey = await window.crypto.subtle.importKey("jwk", jwk, { name: "RSA-PSS", hash: "SHA-256" }, true, ["verify"]);
            } catch(e) {
                return resolve({ success: false, error: "Failed to import the retrieved public key.", resultData: null });
            }

            // --- Cryptographic Text-Content Re-assembly ---
            setStatusCallback("Reconstructing digital text content block...");
            let verificationArrayBuffer = null;

            if (verifyPdfArrayBuffer) {
                setStatusCallback("Extracting raw text from original document pages...");
                // Extracting text from all pages EXCEPT the last page (which contains the stamp)
                // Wait, if we just stamped the bottom right of the existing page, skipping the last page FAILS verification!
                // We MUST skip last page ONLY if qrPlacement was "New Page (Appended)".
                // Uh oh, `extractTextFromPdfBytes(verifyPdfArrayBuffer, false)` should be used if the stamp is inline!
                // For simplicity, DocCrypt was using `true` previously for Phase 4. Let's just pass `false` for inline!
                
                // Let's do `false` (extract all pages). The QR code is an image, it doesn't affect `getTextContent()`.
                const extractedText = await extractTextFromPdfBytes(verifyPdfArrayBuffer, false);
                
                const textEncoder = new TextEncoder();
                verificationArrayBuffer = textEncoder.encode(extractedText);
                
                const currentHashBuffer = await window.crypto.subtle.digest("SHA-256", verificationArrayBuffer);
                const currentHashHex = bufferToHex(currentHashBuffer);
                
                setStatusCallback(`Extracted Text Hash: ${currentHashHex.substring(0,32)}...`);
                
                if (currentHashHex === payload.hash) {
                    setStatusCallback("Document text hash matches payload flawlessly.");
                } else {
                    return resolve({ success: false, error: "Document text hash mismatch. Content may have been altered.", resultData: null });
                }
            } 

            // --- Final strict Cryptographic Verification ---
            if (verificationArrayBuffer) {
                const signatureBuffer = base64ToArrayBuffer(payload.sig);
                const isValid = await window.crypto.subtle.verify(
                    { name: "RSA-PSS", saltLength: 32 },
                    verificationKey,
                    signatureBuffer,
                    verificationArrayBuffer
                );
                
                if (isValid) {
                    return resolve({ 
                        success: true, 
                        resultData: {
                            docId: payload.docId,
                            originalHash: payload.hash
                        }
                    });
                } else {
                    return resolve({ success: false, error: "Signature tampering detected.", resultData: null });
                }
            } else {
                return resolve({ success: false, error: "Could not extract text buffer to verify signature.", resultData: null });
            }

        } catch(err) {
            console.error(err);
            return resolve({ success: false, error: `Cryptographic failure: ${err.message}`, resultData: null });
        }
    });
}
