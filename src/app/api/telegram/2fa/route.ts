import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const sessionApp = await getServerSession(authOptions);
    if (!sessionApp?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });

    await connectMongoDB();
    // Titipkan password ke DB
    await User.findByIdAndUpdate(sessionApp.user.id, { temp2FA: password });

    return NextResponse.json({ success: true, message: "Password diterima server." });
  } catch (error) {
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}