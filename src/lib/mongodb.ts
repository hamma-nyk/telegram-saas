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
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10, // 🔥 Connection pooling untuk MongoDB
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      serverApi: { 
        version: '1', 
        strict: true, 
        deprecationErrors: true 
      } as any
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ Terhubung ke MongoDB Atlas dengan Connection Pool");
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
    // Ping database untuk memastikan koneksi aktif
    await mongoose.connection.db?.admin().command({ ping: 1 });
  } catch (e) {
    cached.promise = null;
    console.error("❌ Gagal terhubung ke database:", e);
    throw e;
  }

  return cached.conn;
};

/**
 * 🔥 OPTIMIZED: Query Helper dengan lean() default
 */
export async function findUserById(id: string) {
  return await mongoose.model('User').findById(id)
    .select('telegramSession telegramConnected')
    .lean()
    .exec();
}

/**
 * 📊 Database Health Check
 */
export async function checkDatabaseHealth() {
  try {
    await connectMongoDB();
    await mongoose.connection.db?.admin().ping();
    
    // Get connection count safely
    const client = mongoose.connection.getClient() as any;
    const poolSize = client?.topology?.s?.pool?.totalConnectionCount || 0;
    
    return {
      healthy: true,
      latency: 0,
      poolSize: poolSize,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}
