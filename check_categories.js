const fs = require('fs');
const csv = require('csv-parser');

const categories = new Set();

fs.createReadStream('products.csv')
    .pipe(csv({
        mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]+/, '').replace(/^"/, '').replace(/"$/, '')
    }))
    .on('data', row => {
        if (row.category_name) categories.add(row.category_name);
    })
    .on('end', () => {
        console.log("Categories in CSV:", Array.from(categories));
    });
