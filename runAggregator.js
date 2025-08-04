import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { Parser } from 'json2csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

export async function aggregateInventory(outputDir = path.join(__dirname, 'public')) {
  const inventoryMap = new Map();
  const files = fs.readdirSync(uploadsDir).filter(f =>
    f.endsWith('.csv') && !f.startsWith('aggregated') && !f.toLowerCase().includes('test')
  );

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    console.log(`📥 Reading file: ${file}`);

    await new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', row => {
          const locationId = row['Location ID']?.trim();
          const sku = row['SKU']?.trim();
          const qty = parseInt(row['Current Stock'] || 0, 10);
          if (!sku || !locationId || isNaN(qty)) return;

          if (!inventoryMap.has(sku)) inventoryMap.set(sku, new Map());
          const skuMap = inventoryMap.get(sku);
          skuMap.set(locationId, (skuMap.get(locationId) || 0) + qty);
        })
        .on('end', resolve);
    });
  }

  const outputRows = [];
  for (const [sku, locMap] of inventoryMap.entries()) {
    for (const [locId, qty] of locMap.entries()) {
      outputRows.push({ 'Location ID': locId, 'SKU': sku, 'Current Stock': qty });
    }
  }

  const parser = new Parser({ fields: ['Location ID', 'SKU', 'Current Stock'] });
  const csvData = parser.parse(outputRows);
  const outputPath = path.join(outputDir, `aggregated-${Date.now()}.csv`);
  fs.writeFileSync(outputPath, csvData);
  console.log(`✅ Aggregated CSV written to: ${outputPath}`);

  // Optional: clean up uploads
  files.forEach(file => fs.unlinkSync(path.join(uploadsDir, file)));

  return outputPath;
}
