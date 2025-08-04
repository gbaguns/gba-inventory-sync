import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');

const BASE_URL = `https://api.bigcommerce.com/stores/${process.env.STORE_HASH}/v3`;
const headers = {
  'X-Auth-Token': process.env.ACCESS_TOKEN,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

async function readAllFiles() {
  const inventoryMap = new Map(); // Map<SKU, Map<LocationID, Qty>>
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.csv'));

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

  console.log(`✅ Parsed inventory map:`);
  for (const [sku, locMap] of inventoryMap.entries()) {
    for (const [locId, qty] of locMap.entries()) {
      console.log(` - SKU: ${sku}, Location: ${locId}, Qty: ${qty}`);
    }
  }

  return inventoryMap;
}

async function updateBigCommerce(inventoryMap) {
  for (const [sku, locationMapRaw] of inventoryMap.entries()) {
    try {
      const locationMap = locationMapRaw instanceof Map
        ? locationMapRaw
        : new Map(Object.entries(locationMapRaw));

      const res = await axios.get(`${BASE_URL}/catalog/products?sku=${sku}`, { headers });
      const product = res.data.data[0];

      if (!product) {
        console.warn(`❗ SKU NOT FOUND in BigCommerce: ${sku}`);
        continue;
      }

      console.log(`✅ Found SKU in BigCommerce: ${sku} → Product ID: ${product.id}`);

      const inventoryRes = await axios.get(`${BASE_URL}/inventory/products/${product.id}`, { headers });
      const locations = inventoryRes.data.data;

      const currentStockByLocation = new Map();
      locations.forEach(loc => {
        currentStockByLocation.set(String(loc.location_id), loc.stock_level);
      });

      const locArray = [...locationMap.entries()];

      for (const [locationId, desiredQty] of locArray) {
        const locIdNum = parseInt(locationId, 10);
        const currentQty = currentStockByLocation.get(String(locIdNum)) ?? 0;
        const delta = desiredQty - currentQty;

        console.log(`📊 SKU: ${sku} | Location: ${locIdNum} | Current: ${currentQty} | Target: ${desiredQty} | Delta: ${delta}`);

        if (delta === 0) {
          console.log(`⏩ No adjustment needed for SKU ${sku} at Location ${locIdNum}`);
          continue;
        }

        try {
          const response = await axios.post(`${BASE_URL}/inventory/adjustments`, {
            product_id: product.id,
            location_id: locIdNum,
            quantity_delta: delta,
            reason: 'Adjusted via CSV import'
          }, { headers });

          console.log(`✅ Inventory adjusted for SKU ${sku} at Location ${locIdNum}:`, JSON.stringify(response.data, null, 2));
        } catch (adjustmentErr) {
          console.error(`❌ Failed adjustment for SKU ${sku} at Location ${locIdNum}:`, JSON.stringify(adjustmentErr.response?.data, null, 2) || adjustmentErr.message);
        }
      }

      console.log(`✔ Finished processing SKU: ${sku}`);
    } catch (err) {
      console.error(`✖ Failed SKU ${sku}:`, JSON.stringify(err.response?.data, null, 2) || err.message);
    }
  }
}

async function run() {
  const inventoryMap = await readAllFiles();
  await updateBigCommerce(inventoryMap);
}

run();
