import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      telegramConnected: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    telegramConnected: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    telegramConnected: boolean;
  }
}