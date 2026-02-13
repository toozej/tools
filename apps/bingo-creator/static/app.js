// PDF export function callable from Go WASM
window.exportBingoPDF = async function(elementId, filename) {
    const element = document.getElementById(elementId);
    
    if (!element) {
        console.error('Element not found:', elementId);
        alert('Error: Could not find the bingo grid element. Please try generating a card first.');
        return;
    }

    // Show loading state
    const btn = document.querySelector('.btn-success');
    const originalText = btn ? btn.textContent : 'Export PDF';
    if (btn) {
        btn.textContent = 'Generating PDF...';
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
        const cellTexts = [];
        cells.forEach(cell => {
            const textEl = cell.querySelector('.cell-text');
            cellTexts.push(textEl ? textEl.textContent : cell.textContent);
        });

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
        pdf.setFontSize(18);
        pdf.setTextColor(0, 0, 0);
        pdf.text(title, pageWidth / 2, margin, { align: 'center' });
        
        // Calculate grid dimensions
        const gridWidth = pageWidth - (margin * 2);
        const gridStartY = margin + titleHeight;
        const maxGridHeight = pageHeight - gridStartY - margin;
        
        // Use the smaller of gridWidth or maxGridHeight to keep it square-ish
        const gridSize = Math.min(gridWidth, maxGridHeight);
        const cellSize = gridSize / columnCount;
        
        // Draw the grid
        const gridStartX = (pageWidth - gridSize) / 2; // Center horizontally
        
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
                
                // Fill background
                if (isFreeSpace) {
                    pdf.setFillColor(240, 240, 240);
                } else {
                    pdf.setFillColor(255, 255, 255);
                }
                pdf.rect(x, y, cellSize, cellSize, 'FD'); // Fill and Draw
                
                // Add text
                const text = cellTexts[cellIndex] || '';
                
                // Calculate font size based on cell size and text length
                const maxFontSize = cellSize * 0.3;
                const minFontSize = 6;
                let fontSize = Math.min(maxFontSize, 12);
                
                // Reduce font size for longer text
                if (text.length > 20) {
                    fontSize = Math.max(minFontSize, fontSize * 0.7);
                } else if (text.length > 15) {
                    fontSize = Math.max(minFontSize, fontSize * 0.8);
                }
                
                pdf.setFontSize(fontSize);
                
                // Set text color
                pdf.setTextColor(0, 0, 0);
                
                // Center text in cell
                const cellCenterX = x + (cellSize / 2);
                const cellCenterY = y + (cellSize / 2);
                
                // Split text if too long and center it
                const maxWidth = cellSize * 0.9;
                const lines = pdf.splitTextToSize(text, maxWidth);
                const lineHeight = fontSize * 0.05; // Convert to inches (approximate)
                const totalTextHeight = lines.length * lineHeight;
                const textStartY = cellCenterY - (totalTextHeight / 2) + (lineHeight * 0.4);
                
                pdf.text(lines, cellCenterX, textStartY, { align: 'center' });
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
