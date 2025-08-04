import express from 'express';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'uploads')));

app.post('/upload', upload.array('files'), (req, res) => {
  res.json({ success: true, message: 'Files uploaded' });
});

app.post('/aggregate', (req, res) => {
  exec('node runAggregator.js', (err, stdout, stderr) => {
    if (err) {
      console.error('Aggregation Error:', err);
      return res.status(500).json({ success: false, error: stderr });
    }
    console.log(stdout);
    res.json({ success: true, message: 'Aggregation complete' });
  });
});

app.listen(PORT, () => {
  console.log(`Inventory Dashboard running on port ${PORT}`);
});
