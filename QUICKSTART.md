# 🎯 QUICK START GUIDE - Telegram SaaS

## ⚡ 5 Menit Setup

### Step 1: Clone & Install (2 menit)
```bash
# Clone repository
git clone <your-repo-url>
cd telegram-saas

# Install dependencies
npm install
```

### Step 2: Dapatkan Telegram API Credentials (2 menit)

1. Buka https://my.telegram.org
2. Login dengan nomor HP Telegram Anda
3. Klik "API Development Tools"
4. Isi form aplikasi (nama bebas)
5. Copy `api_id` dan `api_hash`

### Step 3: Setup Environment (30 detik)

Create `.env.local`:
```env
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/telegram-saas
NEXTAUTH_SECRET=generate-random-string-here-min-32-chars
```

**Generate Secret:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Step 4: Setup MongoDB (1 menit)

**Option A: MongoDB Atlas (Free)**
1. Buka https://www.mongodb.com/cloud/atlas
2. Sign up gratis
3. Create cluster (pilih free tier)
4. Create database user
5. Whitelist IP: `0.0.0.0/0` (allow all)
6. Copy connection string ke `.env.local`

**Option B: Local MongoDB**
```env
MONGODB_URI=mongodb://localhost:27017/telegram-saas
```

### Step 5: Run! (10 detik)
```bash
npm run dev
```

Open: http://localhost:3000

---

## 🎉 First Time Usage

### 1. Register Account
- Buka http://localhost:3000/register
- Username: `admin` (or apapun)
- Password: pilih yang kuat

### 2. Login
- Login di http://localhost:3000/login

### 3. Connect Telegram
- Di dashboard, klik **"KONEKSIKAN VIA QR"**
- Buka Telegram di HP
- Settings → Devices → Link Desktop Device
- Scan QR code yang muncul
- Jika ada 2FA, masukkan Cloud Password

### 4. Test Features

#### Music Player:
1. Klik menu **"Music Player"**
2. Klik **"TAMBAH CHANNEL"**
3. Pilih channel yang punya music files
4. Klik channel untuk browse music
5. Klik **"PLAY NOW"** untuk play

#### Album Manager:
1. Klik menu **"Photo Album"**
2. Klik **"TAMBAH ALBUM"**
3. Pilih channel untuk dijadikan album
4. Klik album untuk browse photos/videos

#### Send Message:
1. Klik menu **"Quick Message"**
2. Target: `me` (kirim ke diri sendiri) atau `@username`
3. Tulis pesan
4. Klik **"KIRIM PESAN"**

---

## 🔍 Verify Installation

### Check Health:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": { "healthy": true },
  "cache": { "metadata": {...}, "thumbnail": {...} }
}
```

### Check Browser Console:
Buka DevTools (F12), tidak boleh ada error merah.

---

## 🐛 Common Issues

### Issue: `MONGODB_URI not defined`
**Fix**: Copy `.env.local` properly, restart server

### Issue: `Cannot connect to Telegram`
**Fix**: Check API_ID dan API_HASH benar

### Issue: QR Code tidak muncul
**Fix**: Check browser console for errors, restart server

### Issue: Port 3000 already in use
**Fix**: 
```bash
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 📱 Development Tips

### Hot Reload Not Working?
```bash
# Kill all Node processes
pkill -f node    # Linux/Mac
taskkill /F /IM node.exe  # Windows

# Restart
npm run dev
```

### Need Clean Start?
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules (if needed)
rm -rf node_modules
npm install
```

### Database Reset?
Drop database di MongoDB Atlas atau:
```bash
# If using local MongoDB
mongo telegram-saas --eval "db.dropDatabase()"
```

---

## 🚀 Ready for Production?

See `USAGE_GUIDE.md` → Deployment section

Quick deploy to Vercel:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables via Vercel dashboard
# Then deploy to production
vercel --prod
```

---

## 📚 Next Steps

1. ✅ Read `README.md` - Full overview
2. ✅ Read `USAGE_GUIDE.md` - Detailed usage
3. ✅ Read `OPTIMIZATION_REPORT.md` - Technical deep dive
4. ✅ Check `/api/health` - Monitor performance

---

**Setup time: ~5 minutes**  
**Difficulty: Easy ⭐⭐☆☆☆**

Need help? Check `USAGE_GUIDE.md` Troubleshooting section.
