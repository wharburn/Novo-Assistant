# Avatar Portal Upload Server

Simple Node.js server for uploading sprite files to your avatar portal.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
npm start
```

Server will run on `http://localhost:3000`

### 3. Upload Files
- Open http://your-domain:3000 in your browser
- Click or drag files to upload
- Supports ZIP files, PNG images, or any format
- Max 100MB per file

### 4. Access Uploads
Files are saved in `/server/uploads/upload_TIMESTAMP/`

## Deployment on Hostinger VPS

### Prerequisites
- Node.js installed
- Your domain pointed to your VPS IP
- Port 3000 accessible or reverse proxy configured

### Steps

1. **Copy files to VPS**
   ```bash
   scp -r avatar-portal/server/* user@your-vps:/path/to/your/site/
   ```

2. **SSH into VPS**
   ```bash
   ssh user@your-vps
   cd /path/to/your/site
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start server (development)**
   ```bash
   npm start
   ```

5. **Keep running (use PM2)**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "avatar-uploader"
   pm2 startup
   pm2 save
   ```

### Set Up Reverse Proxy (Nginx)

If you want to use a domain without `:3000` port:

Create `/etc/nginx/sites-available/avatar-uploader`:
```nginx
server {
    listen 80;
    server_name novofriend.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/avatar-uploader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### File Storage

Uploads are organized by timestamp:
```
uploads/
├── upload_1674123456789/
│   ├── neutral_soft.zip
│   ├── neutral_loud.zip
│   └── ...
└── upload_1674234567890/
    └── ...
```

## Configuration

Edit `server.js` to customize:
- **PORT**: Change from 3000 to something else
- **Max file size**: Line `limits: { fileSize: ... }`
- **Upload directory**: Change `uploadsDir`

## API Endpoints

- `GET /` — Uploader UI
- `POST /upload` — Upload files (multipart/form-data)
- `GET /api/uploads` — List recent uploads
- `GET /health` — Health check

## Environment Variables

```bash
PORT=3000
NODE_ENV=production
```

## Security Notes

- No authentication in basic version (add as needed)
- Validate file types in production
- Set appropriate file size limits
- Use HTTPS in production
- Consider rate limiting

## Troubleshooting

**Port already in use:**
```bash
lsof -i :3000
kill -9 <PID>
```

**Permission denied (uploads folder):**
```bash
chmod 755 uploads
```

**Upload fails:**
Check server logs in `pm2 logs avatar-uploader`

---

Ready to upload your sprites! 🚀
