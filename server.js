import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure dirs
[uploadsDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.send(`
    <h2>Upload CSV</h2>
    <form action="/upload" method="post" enctype="multipart/form-data">
      <input type="file" name="csvFiles" multiple required />
      <button type="submit">Run Aggregation</button>
    </form>
  `);
});

app.post('/upload', upload.array('csvFiles', 10), async (req, res) => {
  try {
    const filePath = path.join(publicDir, `aggregated-${Date.now()}.csv`);
    const headers = 'Location ID,SKU,Current Stock\n';
    const rows = [
      '1001,GLOCK19,12',
      '1002,GLOCK19,8',
      '1003,P365,5'
    ].join('\n');
    fs.writeFileSync(filePath, headers + rows);

    const publicFile = path.basename(filePath);
    console.log(`✅ Fake aggregated CSV written to ${filePath}`);

    res.send(`
      <h3>Test Aggregation Complete</h3>
      <a href="/${publicFile}" download>⬇ Download CSV</a>
    `);
  } catch (err) {
    console.error("❌ Upload failed:", err);
    res.status(500).send("Upload failed");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
