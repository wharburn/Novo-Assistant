const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create subdirectory by timestamp
    const timestamp = Date.now();
    const uploadDir = path.join(uploadsDir, `upload_${timestamp}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max file size
  }
});

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Routes

// Serve the upload page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle file uploads
app.post('/upload', upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ 
      error: 'No files uploaded' 
    });
  }

  const uploadedFiles = req.files.map(file => ({
    filename: file.originalname,
    size: file.size,
    path: file.path
  }));

  res.json({
    success: true,
    message: `${req.files.length} file(s) uploaded successfully`,
    files: uploadedFiles
  });
});

// List recent uploads
app.get('/api/uploads', (req, res) => {
  fs.readdir(uploadsDir, (err, dirs) => {
    if (err) {
      return res.status(500).json({ error: 'Could not read uploads' });
    }

    const uploads = dirs
      .map(dir => {
        const fullPath = path.join(uploadsDir, dir);
        const stats = fs.statSync(fullPath);
        return {
          name: dir,
          timestamp: stats.mtime.getTime(),
          size: 0 // Would calculate actual size here
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10); // Last 10 uploads

    res.json({ uploads });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Avatar Portal Upload Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});
