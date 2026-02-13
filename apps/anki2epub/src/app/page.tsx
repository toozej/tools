"use client";

import { useState, useCallback, useRef } from 'react';
import { EINK_DEVICES, type EinkDevice, type AnkiDeck } from '@/lib/types';
import { parseAnkiDeck, fetchAnkiDeckFromUrl } from '@/lib/anki-parser';
import { generateEpub, downloadEpub } from '@/lib/epub-generator';

type InputMethod = 'file' | 'url';
type ConversionStatus = 'idle' | 'loading' | 'converting' | 'ready' | 'sending' | 'success' | 'error';

export default function Home() {
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [selectedDevice, setSelectedDevice] = useState<EinkDevice>(EINK_DEVICES[0]);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<AnkiDeck | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [epubBuffer, setEpubBuffer] = useState<ArrayBuffer | null>(null);
  const [epubFileName, setEpubFileName] = useState<string>('');
  const [apiEndpoint, setApiEndpoint] = useState<string>('');
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setStatus('loading');
    setError(null);
    setDeck(null);

    try {
      const parsedDeck = await parseAnkiDeck(file);
      setDeck(parsedDeck);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Anki deck');
      setStatus('error');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleUrlSubmit = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setStatus('loading');
    setError(null);
    setDeck(null);

    try {
      const buffer = await fetchAnkiDeckFromUrl(url.trim());
      const parsedDeck = await parseAnkiDeck(buffer);
      setDeck(parsedDeck);
      setFileName(url.split('/').pop() || 'remote-deck');
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Anki deck');
      setStatus('error');
    }
  }, [url]);

  const handleConvert = useCallback(async () => {
    if (!deck) return;

    setStatus('converting');
    setError(null);
    setSendSuccess(null);

    try {
      const buffer = await generateEpub(deck, selectedDevice);
      const name = `${deck.name.replace(/[^a-z0-9]/gi, '-')}-flashcards`;
      setEpubBuffer(buffer);
      setEpubFileName(name);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate EPUB');
      setStatus('error');
    }
  }, [deck, selectedDevice]);

  const handleDownload = useCallback(() => {
    if (!epubBuffer || !epubFileName) return;
    downloadEpub(epubBuffer, epubFileName);
    setStatus('success');
  }, [epubBuffer, epubFileName]);

  const handleSendToEreader = useCallback(async () => {
    if (!epubBuffer || !epubFileName || !apiEndpoint.trim()) return;

    setStatus('sending');
    setError(null);
    setSendSuccess(null);

    try {
      const blob = new Blob([epubBuffer], { type: 'application/epub+zip' });
      const formData = new FormData();
      formData.append('file', blob, `${epubFileName}.epub`);
      formData.append('filename', `${epubFileName}.epub`);

      const response = await fetch(apiEndpoint.trim(), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to send: ${response.status} ${response.statusText}`);
      }

      setSendSuccess('EPUB sent successfully to your e-reader!');
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send EPUB to e-reader');
      setStatus('ready');
    }
  }, [epubBuffer, epubFileName, apiEndpoint]);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setDeck(null);
    setFileName('');
    setUrl('');
    setEpubBuffer(null);
    setEpubFileName('');
    setApiEndpoint('');
    setSendSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            anki2epub
          </h1>
          <p className="text-gray-600">
            Convert Anki flashcard decks to EPUB files optimized for e-ink readers
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          {/* Input Method Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Input Method
            </label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setInputMethod('file')}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  inputMethod === 'file'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('url')}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  inputMethod === 'url'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                From URL
              </button>
            </div>
          </div>

          {/* File Upload */}
          {inputMethod === 'file' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anki Deck File (.apkg)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apkg"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    <span className="text-blue-600 hover:text-blue-500 font-medium">
                      Click to upload
                    </span>{' '}
                    or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Anki .apkg files only
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* URL Input */}
          {inputMethod === 'url' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anki Deck URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/deck.apkg"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  disabled={status === 'loading'}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Load
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter a direct URL to an .apkg file
              </p>
            </div>
          )}

          {/* Device Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              E-Ink Device Preset
            </label>
            <select
              value={selectedDevice.id}
              onChange={(e) => {
                const device = EINK_DEVICES.find((d) => d.id === e.target.value);
                if (device) setSelectedDevice(device);
              }}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {EINK_DEVICES.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.screenWidth}x{device.screenHeight})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Optimizes font size, margins, and layout for your device
            </p>
          </div>

          {/* Status Messages */}
          {status === 'loading' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-blue-700 text-sm">Loading deck...</span>
            </div>
          )}

          {status === 'converting' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-blue-700 text-sm">Generating EPUB...</span>
            </div>
          )}

          {status === 'sending' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-blue-700 text-sm">Sending to e-reader...</span>
            </div>
          )}

          {status === 'error' && error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Deck Info */}
          {deck && (status === 'success' || status === 'ready') && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-800 mb-2">
                ✓ Deck Loaded Successfully
              </h3>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Name:</strong> {deck.name}</p>
                <p><strong>Cards:</strong> {deck.cards.length}</p>
                <p><strong>EPUB Pages:</strong> {deck.cards.length * 2 + 1} (including intro)</p>
              </div>
            </div>
          )}

          {/* Send Success Message */}
          {sendSuccess && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg">
              <p className="text-green-700 text-sm font-medium">{sendSuccess}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Convert Button */}
            {deck && !epubBuffer && (
              <button
                type="button"
                onClick={handleConvert}
                disabled={status === 'converting'}
                className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === 'converting' ? 'Converting...' : 'Generate EPUB'}
              </button>
            )}

            {/* Download and Send Options */}
            {epubBuffer && (status === 'ready' || status === 'success' || status === 'sending') && (
              <>
                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download EPUB
                </button>

                {/* API Endpoint Section */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Send to E-Reader (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="https://your-ereader-api.com/upload"
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleSendToEreader}
                      disabled={!apiEndpoint.trim() || status === 'sending'}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {status === 'sending' ? (
                        'Sending...'
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Send
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Enter your e-reader&apos;s API endpoint to send the EPUB directly via POST request
                  </p>
                </div>
              </>
            )}
            
            {/* Reset Button */}
            {(deck || status === 'error') && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3 px-4 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reset & Start Over
              </button>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            How It Works
          </h2>
          <ol className="space-y-3 text-gray-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span>Upload your Anki deck file (.apkg) or provide a URL</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span>Select your e-ink device for optimized formatting</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span>Click Convert to generate and download your EPUB</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                4
              </span>
              <span>Transfer to your e-reader and study!</span>
            </li>
          </ol>
          
          <div className="mt-6 p-4 bg-amber-50 rounded-lg">
            <h3 className="font-medium text-amber-800 mb-1">📚 Study Tip</h3>
            <p className="text-sm text-amber-700">
              Each flashcard creates two pages: a &ldquo;Question&rdquo; page and an &ldquo;Answer&rdquo; page. 
              Navigate to the next page to reveal the answer, then continue to the next question.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Anki to EPUB Converter • Study anywhere, even without Anki app support</p>
        </footer>
      </div>
    </main>
  );
}
