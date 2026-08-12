import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectionPool } from "@/lib/telegramPool";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import { Api } from "telegram";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectMongoDB();
    const user = await User.findById(session.user.id);
    
    if (!user || !user.telegramConnected || !user.telegramSession) {
      return NextResponse.json({ error: "Telegram not connected" }, { status: 400 });
    }

    const { firstName, lastName, about } = await req.json();

    const apiId = Number(process.env.TELEGRAM_API_ID);
    const apiHash = process.env.TELEGRAM_API_HASH as string;

    const client = await connectionPool.acquire(
      user.telegramSession,
      apiId,
      apiHash
    );

    try {
      await client.invoke(
        new Api.account.UpdateProfile({
          firstName: firstName || "",
          lastName: lastName || "",
          about: about || "",
        })
      );
    } finally {
      connectionPool.release(client);
    }

    return NextResponse.json({ message: "Profile Telegram berhasil diupdate" });
  } catch (error: any) {
    console.error("Update Telegram Profile Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}