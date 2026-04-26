import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // Menangkap data dari request body
    const { username, password } = await req.json();

    // 1. Validasi input dasar
    if (!username || !password) {
      return NextResponse.json(
        { message: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    // 2. Koneksi ke MongoDB
    await connectMongoDB();

    // 3. Cek apakah username sudah ada di database
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json(
        { message: "Username sudah terpakai, silakan gunakan yang lain." },
        { status: 409 } // 409 Conflict
      );
    }

    // 4. Enkripsi (Hasing) password sebelum disimpan
    // Angka 10 adalah 'salt rounds', standar yang aman dan cukup cepat
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Simpan user baru ke database
    await User.create({
      username,
      password: hashedPassword,
      telegramConnected: false, // Default false saat baru daftar
      telegramSession: null
    });

    return NextResponse.json(
      { message: "User berhasil didaftarkan!" },
      { status: 201 } // 201 Created
    );
    
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan pada server saat mendaftar." },
      { status: 500 } // 500 Internal Server Error
    );
  }
}