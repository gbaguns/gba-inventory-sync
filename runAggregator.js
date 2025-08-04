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
    await new Promise(resolve => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', row => {
          const sku = row.SKU?.trim();
          const qty = parseInt(row.Stock_Level || 0, 10);
          if (sku) {
            inventoryMap.set(sku, (inventoryMap.get(sku) || 0) + qty);
          }
        })
        .on('end', resolve);
    });
  }

  return inventoryMap;
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

      for (const loc of locations) {
        await axios.put(`${BASE_URL}/inventory/products/${product.id}/locations/${loc.location_id}`, {
          stock_level: totalQty
        }, { headers });
      }

      console.log(`✔ Updated SKU: ${sku} with total qty: ${totalQty}`);
    } catch (err) {
      console.error(`✖ Failed SKU ${sku}:`, err.response?.data || err.message);
    }
  }
}

async function run() {
  const inventoryMap = await readAllFiles();
  await updateBigCommerce(inventoryMap);
}

run();
