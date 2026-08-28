import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    // Demo credentials provider for easy testing
    CredentialsProvider({
      id: 'demo',
      name: 'Demo Login',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'demo@pathfinder.dev' },
        password: { label: 'Password', type: 'password', placeholder: 'demo123' },
      },
      async authorize(credentials) {
        // In demo mode, accept any credentials and return demo user
        if (process.env.ATLAS_MODE === 'demo') {
          const email = credentials?.email || 'demo@pathfinder.dev';
          
          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: 'Demo Traveler',
                emailVerified: new Date(),
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        }

        // In production, validate credentials properly
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
