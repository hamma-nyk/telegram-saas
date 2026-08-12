import { NextRequest, NextResponse } from "next/server";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { username, password, email, phone } = await req.json();

    if (!username || !password || !email || !phone) {
      return NextResponse.json(
        { message: "Semua field wajib diisi." },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Username atau email sudah terpakai." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      username,
      password: hashedPassword,
      email,
      phone,
      telegramConnected: false,
      telegramSession: null
    });

    return NextResponse.json(
      { message: "User berhasil didaftarkan!" },
      { status: 201 }
    );
    
  } catch (error) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { message: "Terjadi kesalahan pada server saat mendaftar." },
      { status: 500 }
    );
  }
}