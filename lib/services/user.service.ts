import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import bcrypt from "bcryptjs";

export type CreateUserInput = {
  username: string;
  email: string;
  passwordHash: string;
  referralCode?: string;
  referredByUserId?: string;
};

function generateReferralCode(): string {
  return `BAO${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const code = input.referralCode ?? generateReferralCode();

  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      referralCode: code,
      referredByUserId: input.referredByUserId ?? null,
    },
  });
}

export async function createUserWithPassword(input: {
  username: string;
  email: string;
  password: string;
  referralCode?: string;
  referredByUserId?: string;
}): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return createUser({
    username: input.username,
    email: input.email,
    passwordHash,
    referralCode: input.referralCode,
    referredByUserId: input.referredByUserId,
  });
}

export async function findUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}
