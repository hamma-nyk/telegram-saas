import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username, email, phone, currentPassword, newPassword } = await req.json();
    
    if (!currentPassword) {
      return NextResponse.json({ error: "Password saat ini wajib diisi untuk verifikasi." }, { status: 400 });
    }

    await connectMongoDB();
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // Verify current password
    const passwordsMatch = await bcrypt.compare(currentPassword, user.password as string);
    if (!passwordsMatch) {
      return NextResponse.json({ error: "Password saat ini salah." }, { status: 401 });
    }

    // Update basic fields
    if (username) user.username = username;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    // Update password if provided
    if (newPassword) {
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    return NextResponse.json({ message: "Profile berhasil diupdate" });
  } catch (error: any) {
    console.error("Update User Profile Error:", error);
    return NextResponse.json({ error: "Gagal update profile" }, { status: 500 });
  }
}