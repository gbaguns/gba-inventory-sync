import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Parser as CsvParser } from 'json2csv';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');
const outputFilePath = path.join(uploadsDir, 'aggregated_inventory.csv');

async function readAndAggregateFiles() {
  const inventoryMap = new Map(); // Map<SKU, Map<LocationID, Qty>>
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.csv') && f !== 'aggregated_inventory.csv');

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    console.log(`📥 Reading file: ${file}`);

    await new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', row => {
          console.log(`📄 Row: ${JSON.stringify(row)}`);

          const locationId = row['Location ID']?.trim();
          const sku = row['SKU']?.trim();
          const qty = parseInt(row['Current Stock'] || 0, 10);

          if (!sku || !locationId || isNaN(qty)) {
            console.warn(`⚠️ Skipping row with missing data: ${JSON.stringify(row)}`);
            return;
          }

          if (!inventoryMap.has(sku)) {
            inventoryMap.set(sku, new Map());
          }

          const skuMap = inventoryMap.get(sku);
          const currentQty = skuMap.get(locationId) || 0;
          skuMap.set(locationId, currentQty + qty);
        })
        .on('end', resolve);
    });
  }

  // Convert the Map to an array of rows
  const resultRows = [];
  for (const [sku, locMap] of inventoryMap.entries()) {
    for (const [locId, qty] of locMap.entries()) {
      resultRows.push({
        SKU: sku,
        'Location ID': locId,
        'Total Quantity': qty
      });
    }
  }

  return resultRows;
}

async function writeAggregatedCSV(rows) {
  const csvParser = new CsvParser({ fields: ['SKU', 'Location ID', 'Total Quantity'] });
  const csvData = csvParser.parse(rows);

  fs.writeFileSync(outputFilePath, csvData);
  console.log(`✅ Aggregated CSV written to: ${outputFilePath}`);
}

async function run() {
  const aggregatedRows = await readAndAggregateFiles();
  if (aggregatedRows.length === 0) {
    console.log('⚠️ No valid inventory data found to aggregate.');
  } else {
    await writeAggregatedCSV(aggregatedRows);
  }
}

run();
