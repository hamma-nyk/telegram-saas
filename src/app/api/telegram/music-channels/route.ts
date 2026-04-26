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
  return NextResponse.json({ success: true, channels: user?.savedMusicChannels || [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { channels } = await req.json();
  await connectMongoDB();
  await User.findByIdAndUpdate(session.user.id, { $set: { savedMusicChannels: channels } });
  return NextResponse.json({ success: true, message: "Daftar Channel Musik disimpan!" });
}