import session from 'express-session';

// Setup session middleware
app.use(session({
  secret: 'gba-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Upload route
app.post('/upload', upload.array('csvFiles', 10), async (req, res) => {
  try {
    const aggregatedFilePath = await aggregateCSVFiles('./uploads');
    req.session.aggregatedFilePath = aggregatedFilePath;
    res.redirect('/download-ready');
  } catch (err) {
    console.error(err);
    res.status(500).send('Aggregation failed');
  }
});

// Page after aggregation to allow download
app.get('/download-ready', (req, res) => {
  res.send(`
    <h2>Aggregation Complete</h2>
    <a href="/download">Download Aggregated CSV</a>
  `);
});

// Serve the correct file from session
app.get('/download', (req, res) => {
  const file = req.session.aggregatedFilePath;
  if (!file || !fs.existsSync(file)) {
    return res.status(404).send('No file to download. Please upload and aggregate again.');
  }
  res.download(file);
});
