
const fs = require('fs');
const path = require('path');

const CSV_PATH = 'd:\\mormor\\mortwo\\webpro_wms\\products.csv';

function getShelfLife(name, category) {
    const n = name.toLowerCase();
    const c = category.toLowerCase();

    // Specific cases first
    if (n.includes('แช่แข็ง')) return 90;
    if (n.includes('ของแห้ง') || c.includes('ของแห้ง')) return 180;

    if (c.includes('เนื้อสัตว์')) {
        if (n.includes('ไก่')) return 3;
        if (n.includes('หมู')) return 4;
        if (n.includes('วัว') || n.includes('เนื้อ')) return 5;
        return 4;
    }

    if (c.includes('อาหารทะเล')) {
        if (n.includes('กุ้ง') || n.includes('หอย')) return 2;
        return 3;
    }

    if (c.includes('ผัก')) {
        if (n.includes('เห็ด')) return 3;
        if (n.includes('ผักกาด') || n.includes('บุ้ง')) return 4;
        if (n.includes('หอม') || n.includes('กระเทียม') || n.includes('มันฝรั่ง')) return 30;
        return 5;
    }

    if (c.includes('ผลไม้')) {
        if (n.includes('แอปเปิ้ล')) return 21;
        if (n.includes('ส้ม')) return 14;
        if (n.includes('องุ่น')) return 7;
        if (n.includes('กล้วย')) return 5;
        return 7;
    }

    if (n.includes('ไข่')) return 14;

    return 7; // Default
}

function processCSV() {
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split('\n');
    const header = lines[0].split(',');

    // Find column indexes
    const nameIdx = header.findIndex(h => h.includes('product_name'));
    const catIdx = header.findIndex(h => h.includes('category_name'));
    const lifeIdx = header.findIndex(h => h.includes('shelf_life_days'));

    const newLines = [lines[0]];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handling quoted CSV fields roughly (simplistic split for this specific task)
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < header.length) {
            // Fallback for lines that don't match the regex perfectly
            const simpleParts = line.split(',');
            if (simpleParts.length >= header.length) {
                const name = simpleParts[nameIdx].replace(/"/g, '');
                const cat = simpleParts[catIdx].replace(/"/g, '');
                simpleParts[lifeIdx] = getShelfLife(name, cat).toString();
                newLines.push(simpleParts.join(','));
            }
            continue;
        }

        const name = parts[nameIdx].replace(/"/g, '');
        const cat = parts[catIdx].replace(/"/g, '');

        const shelfLife = getShelfLife(name, cat);
        parts[lifeIdx] = `"${shelfLife}"`;

        newLines.push(parts.join(','));
    }

    fs.writeFileSync(CSV_PATH, newLines.join('\n'), 'utf8');
    console.log('CSV transformation complete with realistic shelf life.');
}

processCSV();
