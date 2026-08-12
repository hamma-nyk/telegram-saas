import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectMongoDB } from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        try {
          await connectMongoDB();
          const user = await User.findOne({ username: credentials.username });
          if (!user || !user.password) return null;
          const passwordsMatch = await bcrypt.compare(credentials.password, user.password);
          if (!passwordsMatch) return null;

          return { 
            id: user._id.toString(), 
            name: user.username, 
            telegramConnected: user.telegramConnected,
            telegramSession: user.telegramSession,
          };
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // PENYELAMAT SINKRONISASI: Tarik data terbaru dari MongoDB
      if (trigger === "update" && token.id) {
        await connectMongoDB();
        const freshUser = await User.findById(token.id);
        if (freshUser) {
          token.telegramConnected = freshUser.telegramConnected;
          token.telegramSession = freshUser.telegramSession;
        }
      }
      
      if (user) {
        token.id = user.id;
        token.telegramConnected = (user as any).telegramConnected;
        token.telegramSession = (user as any).telegramSession;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).telegramConnected = token.telegramConnected as boolean;
        (session.user as any).telegramSession = token.telegramSession as string | undefined;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };