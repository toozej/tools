/**
 * anki-converter — Browser helpers for the Go WASM app
 * These functions are called from Go via app.Window().Call(...)
 */

/**
 * Reads a File object and returns it as a base64-encoded string
 * via the global onFileRead(name, base64) callback set by Go.
 * @param {File} file
 */
window.readFileAsBase64 = function (file) {
    const reader = new FileReader();
    reader.onload = function (evt) {
        const arrayBuffer = evt.target.result;
        const bytes = new Uint8Array(arrayBuffer);
        const binary = bytes.reduce((acc, b) => acc + String.fromCharCode(b), '');
        const b64 = btoa(binary);
        if (typeof window.onFileRead === 'function') {
            window.onFileRead(file.name, b64);
        }
    };
    reader.onerror = function () {
        console.error('FileReader error reading', file.name);
    };
    reader.readAsArrayBuffer(file);
};

/**
 * Fetches a URL and returns the response as a base64-encoded string
 * via the global onFileRead(name, base64) callback set by Go.
 * @param {string} url
 * @returns {Promise<void>}
 */
window.fetchURLAsBase64 = function (url) {
    const name = url.split('/').pop() || 'deck.apkg';
    return fetch(url)
        .then(function (resp) {
            if (!resp.ok) {
                throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
            }
            return resp.arrayBuffer();
        })
        .then(function (buf) {
            const bytes = new Uint8Array(buf);
            const binary = bytes.reduce((acc, b) => acc + String.fromCharCode(b), '');
            const b64 = btoa(binary);
            if (typeof window.onFileRead === 'function') {
                window.onFileRead(name, b64);
            }
        })
        .catch(function (err) {
            console.error('fetchURLAsBase64 error:', err);
            if (typeof window.onFileRead === 'function') {
                // Signal error by passing empty base64
                window.onFileRead('', '');
            }
        });
};

/**
 * Triggers a browser download of the given base64-encoded EPUB data.
 * @param {string} base64data - Base64-encoded EPUB bytes
 * @param {string} filename - Suggested filename for the download
 */
window.downloadEPUB = function (base64data, filename) {
    const binary = atob(base64data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
};
