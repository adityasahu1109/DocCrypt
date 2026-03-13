// crypto.js - DocCrypt Core Engine

let keyPair = null;
let currentFileBuffer = null;
let currentFileName = "";
const BACKEND_URL = "http://localhost:8080";

// --- Helpers ---
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function bufferToHex(buffer) {
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a unique Document ID
function generateDocId() {
    return 'doc_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// --- Backend Integration ---
async function saveKeyToBackend(documentId, jwk) {
    try {
        console.log(`Saving key for doc ${documentId} to backend...`);
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
        console.log("Backend save success");
        return true;
    } catch (err) {
        console.error("Failed saving to backend:", err);
        return false;
    }
}

// --- UI Interaction Logic ---

// 1. Key Generation
document.getElementById('btnGenerateKeys').addEventListener('click', async () => {
    try {
        document.getElementById('keyStatus').textContent = "Generating keys...";
        keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-PSS",
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256"
            },
            true, 
            ["sign", "verify"]
        );

        document.getElementById('keyStatus').innerHTML = "<span style='color:green;'>Keys generated successfully!</span> Document processing unlocked.";
        if (currentFileBuffer) {
            document.getElementById('btnProcessDoc').disabled = false;
        }
    } catch (err) {
        console.error("Error generating keys:", err);
        document.getElementById('keyStatus').textContent = "Error generating keys.";
    }
});

// Drag and Drop Handling
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (file.type !== "application/pdf") {
        alert("Please upload a PDF document.");
        return;
    }
    
    currentFileName = file.name;
    document.getElementById('fileInfo').textContent = `Loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentFileBuffer = e.target.result;
        if (keyPair) {
            document.getElementById('btnProcessDoc').disabled = false;
        }
    };
    reader.readAsArrayBuffer(file);
}

// 3. Core Processing pipeline: Hash -> Sign -> QR -> PDF
document.getElementById('btnProcessDoc').addEventListener('click', async () => {
    try {
        const btn = document.getElementById('btnProcessDoc');
        btn.disabled = true;
        btn.textContent = "Processing...";

        // 1. Hash the raw PDF bytes
        const docHashBuffer = await window.crypto.subtle.digest("SHA-256", currentFileBuffer);
        const docHashHex = bufferToHex(docHashBuffer);
        
        // 2. Sign the Hash
        const signatureBuffer = await window.crypto.subtle.sign(
            { name: "RSA-PSS", saltLength: 32 },
            keyPair.privateKey,
            currentFileBuffer
        );
        const signatureBase64 = arrayBufferToBase64(signatureBuffer);
        
        // 3. Assign Document ID & Save Public Key to Backend
        const docId = generateDocId();
        const exportedPublicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
        await saveKeyToBackend(docId, exportedPublicKey);

        // 4. Construct QR Payload
        const payloadJson = JSON.stringify({
            docId: docId,
            hash: docHashHex,
            sig: signatureBase64
        });
        
        // Draw QR code onto hidden element to extract as Image
        const qrContainer = document.getElementById('qrcode-container');
        qrContainer.innerHTML = ""; // Clear existing
        const qr = new QRCode(qrContainer, {
            text: payloadJson,
            width: 250,
            height: 250,
            correctLevel: QRCode.CorrectLevel.M
        });

        // Small delay to allow qrcode.js to finish rendering to the DOM canvas
        setTimeout(async () => {
            try {
                const qrCanvas = qrContainer.querySelector('canvas');
                const qrImageDataUrl = qrCanvas.toDataURL('image/png');
                
                // 5. PDF Modification with pdf-lib
                const { PDFDocument, rgb } = PDFLib;
                const pdfDoc = await PDFDocument.load(currentFileBuffer);
                
                // Add a new page at the end for the verification stamp
                const page = pdfDoc.addPage();
                const { width, height } = page.getSize();
                
                // Embed the QR Code image
                const qrImage = await pdfDoc.embedPng(qrImageDataUrl);
                const qrDims = qrImage.scale(1.0);
                
                // Draw QR and Text
                page.drawImage(qrImage, {
                    x: width / 2 - qrDims.width / 2,
                    y: height / 2 - qrDims.height / 2 + 50,
                    width: qrDims.width,
                    height: qrDims.height,
                });
                
                page.drawText('DocCrypt Cryptographic Verification Stamp', {
                    x: 50,
                    y: height / 2 - 120,
                    size: 18,
                    color: rgb(0, 0, 0),
                });
                
                page.drawText(`Document ID: ${docId}`, { x: 50, y: height / 2 - 150, size: 10 });
                page.drawText(`Original SHA-256 Hash: ${docHashHex.substring(0, 32)}...`, { x: 50, y: height / 2 - 170, size: 10 });
                page.drawText(`Digital Signature (RSA-PSS): ${signatureBase64.substring(0, 40)}...`, { x: 50, y: height / 2 - 190, size: 10 });
                
                // 6. Serialize and Provide Download
                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                
                const link = document.getElementById('downloadLink');
                link.href = url;
                link.download = currentFileName.replace('.pdf', '_stamped.pdf');
                link.style.display = 'inline-block';
                
                btn.textContent = "Done!";
                
                // Verify against the newly stamped PDF using Phase 4 pipeline later
                // For now, this downloads the PDF
            } catch (pdfErr) {
                console.error("Error modifying PDF:", pdfErr);
                btn.textContent = "Error stamping PDF";
            }
        }, 500);

    } catch (err) {
        console.error("Error in processing pipeline:", err);
        document.getElementById('btnProcessDoc').textContent = "Error";
    }
});
