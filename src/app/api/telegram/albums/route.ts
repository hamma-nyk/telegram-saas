import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectMongoDB();
  const user = await User.findById(session.user.id);
  
  return NextResponse.json({ success: true, albums: user?.savedAlbums || [] });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { albums } = body;

    console.log("📥 MENERIMA DATA ALBUM DARI FRONTEND:", albums);

    await connectMongoDB();
    
    // Paksa update dengan $set agar skema tidak membuangnya
    const updatedUser = await User.findByIdAndUpdate(
      session.user.id, 
      { $set: { savedAlbums: albums } },
      { new: true } // Kembalikan data setelah diupdate
    );

    console.log("💾 HASIL SAVE DI MONGODB:", updatedUser?.savedAlbums);

    return NextResponse.json({ success: true, message: "Daftar Album berhasil disimpan!" });
  } catch (error: any) {
    console.error("❌ ERROR SAVE ALBUM:", error);
    return NextResponse.json({ error: "Gagal menyimpan ke database" }, { status: 500 });
  }
}