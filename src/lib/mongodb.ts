import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("❌ Tolong definisikan MONGODB_URI di .env.local");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export const connectMongoDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // KITA MASUKKAN SETTINGAN DARI ATLAS KE SINI
    const opts = {
      bufferCommands: false,
      serverApi: { 
        version: '1', 
        strict: true, 
        deprecationErrors: true 
      } as any // Tambahkan 'as any' agar TypeScript tidak protes
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ Terhubung ke MongoDB Atlas Cluster dengan Stable API");
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
    // Opsi tambahan untuk memastikan koneksi benar-benar tembus (seperti perintah 'ping' di Atlas)
    await mongoose.connection.db?.admin().command({ ping: 1 });
  } catch (e) {
    cached.promise = null;
    console.error("❌ Gagal terhubung ke database:", e);
    throw e;
  }

  return cached.conn;
};