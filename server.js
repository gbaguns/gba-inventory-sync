import express from 'express';
import multer from 'multer';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { aggregateInventory } from './runaggregator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT || 3000;

// Create required directories if they don't exist
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Express session config
app.use(session({
  secret: 'gba-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Upload form UI
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

// Handle file upload and aggregation
app.post('/upload', upload.array('csvFiles', 10), async (req, res) => {
  try {
    const aggregatedFilePath = await aggregateInventory();
    req.session.aggregatedFilePath = aggregatedFilePath;
    res.redirect('/download-ready');
  } catch (err) {
    console.error(err);
    res.status(500).send('Aggregation failed');
  }
});

// After upload page
app.get('/download-ready', (req, res) => {
  res.send(`
    <h3>✅ Aggregation Complete</h3>
    <a href="/download">Download Aggregated CSV</a>
  `);
});

// Handle download
app.get('/download', (req, res) => {
  const file = req.session.aggregatedFilePath;
  if (!file || !fs.existsSync(file)) {
    return res.status(404).send('No file found for this session. Please upload again.');
  }
  res.download(file, (err) => {
    if (!err) {
      console.log(`✅ File downloaded: ${file}`);
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
