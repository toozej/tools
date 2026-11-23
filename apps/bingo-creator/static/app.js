// Detect characters that jsPDF's default Helvetica font cannot reliably render.
function hasUnsupportedPDFCharacters(text) {
    return /[^\x00-\xFF]/.test(text || '');
}

// Normalize spacing for safer text rendering in jsPDF text mode.
function sanitizeForPDF(text) {
    if (!text) return '';
    return String(text)
        .replace(/[\u00A0]/g, ' ')
        .replace(/[\u2000-\u200F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Fit each label inside its cell. jsPDF uses points for fonts and inches for this page.
function fitBingoPDFText(pdf, text, cellSize) {
    const pointsPerInch = 72;
    const maxWidth = cellSize * 0.9;
    const maxHeight = cellSize * 0.9;
    let fontSize = Math.min(cellSize * pointsPerInch * 0.3, 12);

    while (true) {
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        const lineHeight = fontSize * pdf.getLineHeightFactor() / pointsPerInch;
        const textHeight = lines.length * lineHeight;

        if (textHeight <= maxHeight) {
            return { lines, lineHeight };
        }

        // Rewrap at the smaller font size without dropping any text.
        fontSize *= 0.9;
    }
}

// PDF export function callable from Go WASM
window.exportBingoPDF = async function(elementId, filename, options = {}) {
    const element = document.getElementById(elementId);
    
    if (!element) {
        console.error('Element not found:', elementId);
        alert('Error: Could not find the bingo grid element. Please try generating a card first.');
        return;
    }

    // Show loading state
    const btn = document.querySelector(options.buttonSelector || '.btn-success');
    const originalText = btn ? btn.textContent : 'Export PDF';
    if (btn) {
        btn.textContent = options.loadingText || 'Generating PDF...';
        btn.disabled = true;
    }

    try {
        // Wait for PDF libraries to load
        if (typeof html2canvas === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        if (typeof window.jspdf === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        // Wait a bit for jspdf to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get the grid element and its column count
        const grid = element.querySelector('.bingo-grid');
        if (!grid) {
            alert('Error: Could not find the bingo grid. Please generate a card first.');
            return;
        }
        
        // Get the computed style to find grid columns
        const computedStyle = window.getComputedStyle(grid);
        const gridTemplateColumns = computedStyle.gridTemplateColumns;
        const columnCount = gridTemplateColumns.split(' ').length;
        
        // Get all cells
        const cells = grid.querySelectorAll('.grid-cell');
        const rawCellTexts = [];
        const unsupportedCells = [];
        const markedCells = new Set();

        cells.forEach((cell, index) => {
            const textEl = cell.querySelector('.cell-text');
            const rawText = textEl ? textEl.textContent : cell.textContent;
            const normalizedRawText = (rawText || '').trim();
            rawCellTexts.push(normalizedRawText);

            if (cell.classList.contains('marked')) {
                markedCells.add(index);
            }
            if (hasUnsupportedPDFCharacters(normalizedRawText)) {
                unsupportedCells.push({
                    index,
                    text: normalizedRawText,
                });
            }
        });

        if (unsupportedCells.length > 0) {
            console.warn(
                `[bingo-pdf] Found ${unsupportedCells.length} cells with non-Latin1 characters. Using html2canvas image fallback for accurate text rendering.`,
                unsupportedCells.slice(0, 5),
            );
        }

        const { jsPDF } = window.jspdf;
        
        // Create PDF with US Letter dimensions in inches
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'in',
            format: 'letter'
        });
        
        // US Letter size: 8.5 x 11 inches
        const pageWidth = 8.5;
        const pageHeight = 11;
        const margin = 0.5; // 0.5 inch margin
        const titleHeight = 0.4;
        
        // Extract title from filename (remove .pdf extension)
        let title = filename;
        if (title.endsWith('.pdf')) {
            title = title.slice(0, -4);
        }
        // Replace underscores with spaces for display
        title = title.replace(/_/g, ' ');
        
        // Add title at the top
        const titleForPDF = sanitizeForPDF(title);
        pdf.setFontSize(18);
        pdf.setTextColor(0, 0, 0);
        pdf.text(titleForPDF || 'Bingo Card', pageWidth / 2, margin, { align: 'center' });
        
        // Calculate grid dimensions
        const gridWidth = pageWidth - (margin * 2);
        const gridStartY = margin + titleHeight;
        const maxGridHeight = pageHeight - gridStartY - margin;
        
        // Use the smaller of gridWidth or maxGridHeight to keep it square-ish
        const gridSize = Math.min(gridWidth, maxGridHeight);
        const cellSize = gridSize / columnCount;
        
        // Draw the grid
        const gridStartX = (pageWidth - gridSize) / 2; // Center horizontally

        // If unsupported glyphs are detected, render the grid as an image to preserve exact text.
        if (unsupportedCells.length > 0) {
            const canvas = await html2canvas(grid, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
            });

            const imageData = canvas.toDataURL('image/png');
            const availableWidth = gridWidth;
            const availableHeight = maxGridHeight;
            const imageAspect = canvas.width / canvas.height;

            let renderWidth = availableWidth;
            let renderHeight = renderWidth / imageAspect;

            if (renderHeight > availableHeight) {
                renderHeight = availableHeight;
                renderWidth = renderHeight * imageAspect;
            }

            const imageX = (pageWidth - renderWidth) / 2;
            const imageY = gridStartY;

            pdf.addImage(imageData, 'PNG', imageX, imageY, renderWidth, renderHeight, undefined, 'FAST');
            pdf.save(filename);
            return;
        }

        const cellTexts = rawCellTexts.map(sanitizeForPDF);
        
        // Set line width for borders
        pdf.setLineWidth(0.02);
        pdf.setDrawColor(0, 0, 0);
        
        // Draw cells
        for (let row = 0; row < columnCount; row++) {
            for (let col = 0; col < columnCount; col++) {
                const cellIndex = row * columnCount + col;
                const x = gridStartX + (col * cellSize);
                const y = gridStartY + (row * cellSize);
                
                // Check if this is the center cell (free space)
                const isFreeSpace = row === Math.floor(columnCount / 2) && col === Math.floor(columnCount / 2);
                const isMarked = markedCells.has(cellIndex);
                
                // Fill background
                if (isMarked) {
                    pdf.setFillColor(255, 237, 213);
                } else if (isFreeSpace) {
                    pdf.setFillColor(240, 240, 240);
                } else {
                    pdf.setFillColor(255, 255, 255);
                }
                pdf.rect(x, y, cellSize, cellSize, 'FD'); // Fill and Draw
                
                // Add text
                const text = cellTexts[cellIndex] || '';
                
                const { lines, lineHeight } = fitBingoPDFText(pdf, text, cellSize);
                
                // Set text color
                pdf.setTextColor(0, 0, 0);
                
                // Center text in cell
                const cellCenterX = x + (cellSize / 2);
                const cellCenterY = y + (cellSize / 2);
                
                // Center the complete block using jsPDF's line spacing.
                const textStartY = cellCenterY - ((lines.length - 1) * lineHeight / 2);
                
                pdf.text(lines, cellCenterX, textStartY, { align: 'center', baseline: 'middle' });

                if (isMarked) {
                    const markerRadius = Math.max(cellSize * 0.13, 0.08);
                    pdf.setDrawColor(234, 88, 12);
                    pdf.setLineWidth(0.02);
                    pdf.circle(cellCenterX, cellCenterY, markerRadius, 'S');
                    pdf.line(cellCenterX - markerRadius * 0.55, cellCenterY - markerRadius * 0.55, cellCenterX + markerRadius * 0.55, cellCenterY + markerRadius * 0.55);
                    pdf.line(cellCenterX - markerRadius * 0.55, cellCenterY + markerRadius * 0.55, cellCenterX + markerRadius * 0.55, cellCenterY - markerRadius * 0.55);
                    pdf.setDrawColor(0, 0, 0);
                    pdf.setLineWidth(0.02);
                }
            }
        }

        // Download the PDF
        pdf.save(filename);

    } catch (error) {
        console.error('PDF export failed:', error);
        alert('Failed to export PDF. Please try again.\n\nError: ' + error.message);
    } finally {
        // Restore button state
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
};


function createBatchBingoCard(grid) {
    const columnCount = grid.length;
    const container = document.createElement('div');
    container.id = 'bingo-batch-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    container.className = 'batch-export-card';
    container.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;background:rgb(255,255,255);padding:2px;';

    const gridElement = document.createElement('div');
    gridElement.className = 'bingo-grid';
    gridElement.style.gridTemplateColumns = 'repeat(' + columnCount + ', 1fr)';

    grid.forEach((row, rowIndex) => {
        row.forEach((text, columnIndex) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            if (rowIndex === Math.floor(columnCount / 2) && columnIndex === Math.floor(columnCount / 2)) {
                cell.classList.add('free-space');
            }
            const textElement = document.createElement('span');
            textElement.className = 'cell-text';
            textElement.textContent = text || '';
            cell.appendChild(textElement);
            gridElement.appendChild(cell);
        });
    });

    container.appendChild(gridElement);
    document.body.appendChild(container);
    return container;
}

window.exportBingoPDFBatch = async function(cards, filenameBase) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return;
    }

    const button = document.querySelector('.btn-batch-export');
    const originalText = button ? button.textContent : 'Export PDFs';
    try {
        for (let index = 0; index < cards.length; index++) {
            if (button) {
                button.textContent = 'Exporting ' + (index + 1) + ' of ' + cards.length + '...';
                button.disabled = true;
            }
            const card = createBatchBingoCard(cards[index]);
            const filename = filenameBase + '_' + (index + 1) + '.pdf';
            await window.exportBingoPDF(card.id, filename, {
                buttonSelector: '.btn-batch-export',
                loadingText: 'Generating ' + (index + 1) + ' of ' + cards.length + '...',
            });
            card.remove();
            if (index < cards.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }
    } finally {
        if (button) {
            button.textContent = originalText;
            button.disabled = false;
        }
    }
};

window.loadBingoPoolFile = function(files) {
    const file = files && files.length > 0 ? files[0] : null;
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        if (window.onBingoPoolFileLoaded) {
            window.onBingoPoolFileLoaded(file.name, String(event.target.result || ''));
        }
    };
    reader.onerror = function() {
        if (window.onBingoPoolFileError) {
            window.onBingoPoolFileError();
        }
    };
    reader.readAsText(file);
};

window.downloadBingoTilePool = function(items, filename) {
    const blob = new Blob([String(items || '')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
