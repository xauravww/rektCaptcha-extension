const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runOcr } = require('./oce');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const result = await runOcr(req.file.path);
    // Optionally delete the file after processing
    fs.unlink(req.file.path, () => {});
    res.json({ result });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 