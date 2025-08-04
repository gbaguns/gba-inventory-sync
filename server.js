import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { aggregateInventory } from './runAggregator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');

const app = express();
const PORT = process.env.PORT || 3000;

[uploadsDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.get('/', (req, res) => {
  res.send(`
    <h2>Upload CSV Files</h2>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="csvFiles" multiple required />
      <button type="submit">Run Aggregation</button>
    </form>
  `);
});

app.post('/upload', upload.array('csvFiles', 10), async (req, res) => {
  try {
    const filePath = await aggregateInventory(publicDir);
    const publicFile = path.basename(filePath);

    res.send(`
      <h3>✅ Aggregation Complete</h3>
      <a href="/${publicFile}" download>⬇ Download Aggregated CSV</a>
    `);
  } catch (err) {
    console.error('❌ Aggregation failed:', err);
    res.status(500).send('Aggregation failed');
  }
});

app.use(express.static(publicDir));

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
