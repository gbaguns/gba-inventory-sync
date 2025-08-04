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

// Ensure uploads and public folders exist
[uploadsDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use(express.static(publicDir));

// Upload form
app.get('/', (req, res) => {
  res.send(`
    <h2>Upload CSV Files</h2>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="csvFiles" accept=".csv" multiple required />
      <br><br>
      <button type="submit">Run Aggregation</button>
    </form>
  `);
});

// Upload + Aggregate
app.post('/upload', upload.array('csvFiles', 10), async (req, res) => {
  try {
    console.log("✅ Received files:", req.files.map(f => f.originalname));
    const aggregatedFilePath = await aggregateInventory(publicDir); // pass destination
    const publicFilename = path.basename(aggregatedFilePath);

    res.send(`
      <h3>✅ Aggregation Complete</h3>
      <a href="/${publicFilename}" download>Download Aggregated CSV</a>
    `);
  } catch (err) {
    console.error("❌ Aggregation failed:", err);
    res.status(500).send('Aggregation failed');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
