import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use(fileUpload());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  const html = `
    <h2>Upload Inventory Files</h2>
    <form method="POST" encType="multipart/form-data">
      <input type="file" name="files" multiple><br><br>
      <button type="submit">Upload Files</button>
    </form>
    <br><hr><br>
    <form method="POST" action="/run">
      <button type="submit">Run Aggregation & Update BigCommerce</button>
    </form>
    <br>
    <a href="/files">View Uploaded Files</a>
  `;
  res.send(html);
});

app.post('/', (req, res) => {
  if (!req.files || !req.files.files) {
    return res.status(400).send('No files uploaded.');
  }

  const uploaded = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
  uploaded.forEach(file => {
    const filepath = path.join(uploadsDir, file.name);
    file.mv(filepath);
  });

  res.send('Files uploaded successfully.<br><a href="/">Back</a>');
});

app.post('/run', (req, res) => {
  exec('node runAggregator.js', (err, stdout, stderr) => {
    if (err) return res.send(`<pre>Error:\n${stderr}</pre><a href="/">Back</a>`);
    res.send(`<pre>${stdout}</pre><br><a href="/">Back</a>`);
  });
});

app.get('/files', (req, res) => {
  const files = fs.readdirSync(uploadsDir);
  res.send(`<ul>${files.map(f => `<li>${f}</li>`).join('')}</ul><a href="/">Back</a>`);
});

app.listen(3000, () => console.log('Inventory Dashboard running on port 3000'));
