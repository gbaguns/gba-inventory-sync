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
  async function readAllFiles() {
  const inventoryMap = new Map(); // Map<sku, Map<locationId, quantity>>
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.csv'));

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    await new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', row => {
          const locationId = row['Location ID']?.trim();
          const sku = row['SKU']?.trim();
          const qty = parseInt(row['Current Stock'] || 0, 10);
          if (!sku || !locationId) return;

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

  return inventoryMap; // Map<sku, Map<locationId, quantity>>
}

async function updateBigCommerce(inventoryMap) {
  for (const [sku, totalQty] of inventoryMap.entries()) {
    try {
      const res = await axios.get(`${BASE_URL}/catalog/products?sku=${sku}`, { headers });
      const product = res.data.data[0];

      if (!product) {
        console.warn(`❗ SKU NOT FOUND in BigCommerce: ${sku}`);
        continue;
      } else {
        console.log(`✅ Found SKU in BigCommerce: ${sku} → Product ID: ${product.id}`);
      }

      const inventoryRes = await axios.get(`${BASE_URL}/inventory/products/${product.id}`, { headers });
      const locations = inventoryRes.data.data;

      const skuMap = inventoryMap.get(sku);
for (const [locationId, qty] of skuMap.entries()) {
  console.log(`🔄 Updating SKU ${sku} at Location ${locationId} with stock: ${qty}`);
  await axios.put(`${BASE_URL}/inventory/products/${product.id}/locations/${locationId}`, {
    stock_level: qty
  }, { headers });
}

      console.log(`✔ Updated SKU: ${sku} with total qty: ${totalQty}`);
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
