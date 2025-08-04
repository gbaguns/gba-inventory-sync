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
  const inventoryMap = new Map();
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

          if (!sku || !locationId) {
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
      console.log(`🔎 Raw location map for SKU ${sku}:`, locationMapRaw);

      // Force convert to Map if not already
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

      console.log(`📍 Available Locations for SKU ${sku}:`);
      locations.forEach(loc => {
        console.log(` - Location ID: ${loc.location_id}, Current Stock: ${loc.stock_level}`);
      });

      for (const [locationId, qty] of locationMap.entries()) {
        console.log(`🔄 Updating SKU ${sku} at Location ${locationId} with stock: ${qty}`);

        const response = await axios.put(`${BASE_URL}/inventory/products/${product.id}/locations/${locationId}`, {
          stock_level: qty
        }, { headers });

        console.log(`📝 BigCommerce API Response:`, JSON.stringify(response.data, null, 2));
      }

      console.log(`✔ Finished updating SKU: ${sku}`);
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
