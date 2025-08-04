import express from 'express';
import multer from 'multer';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { aggregateInventory } from './runAggregator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.use(session({
  secret: 'gba-secret-key',
  resave: false,
  saveUninitialized: true,
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.array('csvFiles', 10), async (req, res) => {
  try {
    const aggregatedFilePath = await aggregateInventory();
    req.session.aggregatedFilePath = aggregatedFilePath;
    res.redirect('/download-ready');
  } catch (err) {
    console.error("❌ Aggregation failed:", err);
    res.status(500).send('Aggregation failed');
  }
});

app.get('/download-ready', (req, res) => {
res.send(`
  <h3>✅ Aggregation Complete</h3>
  <a href="/download">Download Aggregated CSV</a>
`);
});

app.get('/download', (req, res) => {
  const file = req.session.aggregatedFilePath;
  if (!file || !fs.existsSync(file)) {
    return res.status(404).send('No file found for this session. Please upload again.');
  }
  res.download(file, (err) => {
    if (!err) {
      console.log(\`✅ File downloaded: \${file}\`);
    }
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
});
