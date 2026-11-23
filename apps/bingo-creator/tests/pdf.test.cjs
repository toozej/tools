const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const exportScript = fs.readFileSync(path.join(__dirname, '../static/app.js'), 'utf8');

function createHarness(size, { texts, marked = [], failSave = false } = {}) {
    const pdfs = [];
    const captures = [];
    const alerts = [];
    const elements = new Map();
    const button = { textContent: 'Export PDF', disabled: false };
    const cellTexts = texts || Array.from({ length: size * size }, (_, index) => `Tile ${index + 1}`);
    cellTexts[Math.floor(size / 2) * size + Math.floor(size / 2)] = 'Free Space';

    function makeElement() {
        return {
            children: [],
            style: {},
            className: '',
            textContent: '',
            classList: {
                values: new Set(),
                add(value) { this.values.add(value); },
                contains(value) { return this.values.has(value); },
            },
            appendChild(child) { this.children.push(child); },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
            querySelectorAll(selector) {
                return this.children.flatMap(child => [
                    ...(child.className.split(' ').includes(selector.slice(1)) ? [child] : []),
                    ...child.querySelectorAll(selector),
                ]);
            },
            remove() { elements.delete(this.id); },
        };
    }

    const grid = makeElement();
    grid.className = 'bingo-grid';
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    cellTexts.forEach((text, index) => {
        const cell = makeElement();
        cell.className = 'grid-cell';
        if (marked.includes(index)) cell.classList.add('marked');
        const label = makeElement();
        label.className = 'cell-text';
        label.textContent = text;
        cell.appendChild(label);
        grid.appendChild(cell);
    });
    const container = makeElement();
    container.appendChild(grid);
    elements.set('card', container);

    class PDF {
        constructor() {
            this.rects = [];
            this.labels = [];
            this.images = [];
            this.markers = [];
            this.internal = { scaleFactor: 72 };
            pdfs.push(this);
        }
        setFontSize(size) { this.fontSize = size; }
        getLineHeightFactor() { return 1.15; }
        setTextColor() {}
        setLineWidth() {}
        setDrawColor() {}
        setFillColor(...color) { this.fillColor = color; }
        rect(x, y, width, height) {
            this.rects.push({ x, y, width, height, color: this.fillColor });
        }
        splitTextToSize(text, width) {
            // Use a fixed character width to exercise wrapping without a PDF dependency.
            const capacity = Math.max(1, Math.floor(width * 72 / (this.fontSize * 0.55)));
            return text.match(new RegExp(`.{1,${capacity}}`, 'g')) || [''];
        }
        text(lines, x, y, options) {
            this.labels.push({
                lines: Array.isArray(lines) ? [...lines] : [lines],
                x, y, options, fontSize: this.fontSize,
            });
        }
        circle(...args) { this.markers.push(args); }
        line() {}
        addImage(...args) { this.images.push(args); }
        save(filename) {
            if (failSave) throw new Error('Download failed');
            this.filename = filename;
        }
    }

    const context = vm.createContext({
        window: {
            jspdf: { jsPDF: PDF },
            getComputedStyle(element) {
                const count = Number(element.style.gridTemplateColumns.match(/\d+/)[0]);
                return { gridTemplateColumns: Array(count).fill('100px').join(' ') };
            },
        },
        document: {
            getElementById: id => elements.get(id),
            querySelector: () => button,
            createElement: makeElement,
            body: { appendChild: element => elements.set(element.id, element) },
        },
        html2canvas: async element => {
            captures.push(element);
            return { width: 720, height: 720, toDataURL: () => 'data:image/png;base64,grid' };
        },
        alert: message => alerts.push(message),
        console: { warn() {}, error() {} },
        setTimeout: callback => callback(),
    });
    vm.runInContext(exportScript, context);
    return { context, pdfs, captures, alerts, button, cellTexts, elements };
}

function assertLabelsFit(pdf, expectedTexts, { readable = false } = {}) {
    const labels = pdf.labels.slice(1); // The first label is the page title.
    assert.equal(labels.length, expectedTexts.length);
    assert.equal(pdf.rects.length, expectedTexts.length);
    labels.forEach((label, index) => {
        assert.equal(label.lines.join(''), expectedTexts[index], `Cell ${index} must retain all text`);
        if (readable) assert.ok(label.fontSize >= 6, `Cell ${index} font is too small: ${label.fontSize} pt`);
        const rect = pdf.rects[index];
        // Calculate glyph bounds from the actual text calls, in page inches.
        const fontHeight = label.fontSize / 72;
        const lineHeight = fontHeight * 1.15;
        const top = label.y - (label.options.baseline === 'middle' ? fontHeight / 2 : fontHeight);
        const bottom = top + fontHeight + (label.lines.length - 1) * lineHeight;
        assert.ok(top >= rect.y, `Cell ${index} text starts above its cell: ${top} < ${rect.y}`);
        assert.ok(bottom <= rect.y + rect.height, `Cell ${index} text ends below its cell`);
        for (const line of label.lines) {
            const width = line.length * fontHeight * 0.55;
            assert.ok(width <= rect.width * 0.9 + 1e-9, `Cell ${index} text exceeds its width`);
        }
    });
}

for (let size = 3; size <= 10; size++) {
    test(`${size}x${size} PDF retains every short label at a readable size`, async () => {
        const harness = createHarness(size);
        await harness.context.window.exportBingoPDF('card', 'test_card.pdf');
        assert.deepEqual(harness.alerts, []);
        assertLabelsFit(harness.pdfs[0], harness.cellTexts, { readable: true });
        assert.equal(harness.pdfs[0].filename, 'test_card.pdf');
        assert.equal(harness.button.textContent, 'Export PDF');
        assert.equal(harness.button.disabled, false);
    });

    test(`${size}x${size} PDF keeps long labels inside every cell`, async () => {
        const texts = Array.from({ length: size * size }, (_, index) =>
            `Tile ${index}: ` + 'See a highland cow and take a picture. '.repeat(12).trim());
        const harness = createHarness(size, { texts });
        await harness.context.window.exportBingoPDF('card', 'long_card.pdf');
        assert.deepEqual(harness.alerts, []);
        assertLabelsFit(harness.pdfs[0], harness.cellTexts);
    });
}

test('PDF preserves Latin-1 labels, whitespace normalization, and tablet marks', async () => {
    const texts = ['Café', 'First\u00a0stop', '  Long\t trip  ', 'EMPTY', 'Free Space', 'A'.repeat(200), 'Two words', 'Fish & chips', ''];
    const harness = createHarness(3, { texts, marked: [0, 4] });
    await harness.context.window.exportBingoPDF('card', 'marked.pdf');
    assert.deepEqual(harness.alerts, []);
    assert.equal(harness.captures.length, 0);
    assertLabelsFit(harness.pdfs[0], harness.cellTexts.map(text => text.replace(/\s+/g, ' ').trim()));
    assert.equal(harness.pdfs[0].markers.length, 2);
    assert.deepEqual(harness.pdfs[0].rects[0].color, [255, 237, 213]);
});

test('PDF retains the image fallback for Unicode labels', async () => {
    const harness = createHarness(3);
    harness.cellTexts[0] = 'See a cow 🐄';
    harness.elements.get('card').querySelector('.cell-text').textContent = harness.cellTexts[0];
    await harness.context.window.exportBingoPDF('card', 'unicode.pdf');
    assert.deepEqual(harness.alerts, []);
    assert.equal(harness.captures.length, 1);
    assert.equal(harness.pdfs[0].images.length, 1);
    assert.equal(harness.pdfs[0].filename, 'unicode.pdf');
    assert.equal(harness.button.disabled, false);
});

test('batch PDFs retain every tile and remove temporary cards', async () => {
    const harness = createHarness(5);
    const cards = [3, 5, 10].map(size => Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, col) => `Tile ${row * size + col}`)));
    await harness.context.window.exportBingoPDFBatch(cards, 'batch');
    assert.deepEqual(harness.alerts, []);
    assert.equal(harness.pdfs.length, cards.length);
    harness.pdfs.forEach((pdf, index) => {
        assertLabelsFit(pdf, cards[index].flat(), { readable: true });
        assert.equal(pdf.filename, `batch_${index + 1}.pdf`);
    });
    assert.equal(harness.elements.size, 1);
    assert.equal(harness.button.disabled, false);
    assert.equal(harness.button.textContent, 'Export PDF');
});

test('PDF export restores the button after a download failure', async () => {
    const harness = createHarness(3, { failSave: true });
    await harness.context.window.exportBingoPDF('card', 'failure.pdf');
    assert.equal(harness.alerts.length, 1);
    assert.match(harness.alerts[0], /Download failed/);
    assert.equal(harness.button.disabled, false);
    assert.equal(harness.button.textContent, 'Export PDF');
});
