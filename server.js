import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');

app.use(fileUpload());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
    <h2>Upload Inventory Files</h2>
    <form method="POST" encType="multipart/form-data">
      <input type="file" name="files" multiple /><br /><br />
      <button type="submit">Upload Files</button>
    </form>
    <br />
    <form method="POST" action="/run">
      <button type="submit">Run Aggregation & Update BigCommerce</button>
    </form>
  `);
});

app.post('/', (req, res) => {
  if (!req.files || !req.files.files) {
    return res.status(400).send('No files uploaded.');
  }

  const uploaded = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
  uploaded.forEach(file => {
    file.mv(path.join(uploadsDir, file.name));
  });

  res.send('Files uploaded successfully. <a href="/">Back</a>');
});

app.post('/run', (req, res) => {
  exec('node runAggregator.js', (err, stdout, stderr) => {
    if (err) return res.send(`Error: ${stderr}`);
    res.send(`<pre>${stdout}</pre><br><a href="/">Back</a>`);
  });
});

app.listen(3000, () => console.log('Web dashboard running on port 3000'));
