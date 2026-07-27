"use server";

import { signIn, signOut } from "@/auth";
import { Prisma } from "@/generated/prisma/client/client";
import { consumeRegistrationRateLimits } from "@/lib/auth-rate-limit";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/lib/auth-input";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { AuthError } from "next-auth";

export type { LoginInput, RegisterInput } from "@/lib/auth-input";
export type LoginResult =
  | {
      success: true;
      redirectTo: string;
    }
  | {
      success: false;
      error: string;
    };

export async function register(data: RegisterInput) {
  try {
    const validatedFields = registerSchema.safeParse(data);

    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { name, email, password, mainCurrency } = validatedFields.data;

    const requestHeaders = await headers();
    const request = new Request("http://localhost", { headers: requestHeaders });
    if (!(await consumeRegistrationRateLimits(email, request))) {
      return {
        success: false,
        error: "Too many registration attempts. Please try again later.",
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, password: hashedPassword, mainCurrency },
      });
      await createDefaultCategories(tx, user.id);
    });

    return {
      success: true,
      message: "Account created successfully",
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: true, message: "Account created successfully" };
    }
    console.error("Registration error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

function getLoginErrorMessage(error: unknown) {
  if (typeof error === "string") {
    switch (error) {
      case "CredentialsSignin":
        return "Invalid email or password";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  if (error instanceof AuthError) {
    return getLoginErrorMessage(error.type);
  }

  return "Something went wrong. Please try again.";
}

function getRelativeRedirectPath(redirectUrl: string) {
  try {
    const parsedUrl = new URL(redirectUrl, "http://localhost");
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return redirectUrl;
  }
}

function getRedirectError(redirectUrl: string) {
  try {
    const parsedUrl = new URL(redirectUrl, "http://localhost");
    return parsedUrl.searchParams.get("error");
  } catch {
    return null;
  }
}

export async function login(data: LoginInput): Promise<LoginResult> {
  try {
    const validatedFields = loginSchema.safeParse(data);

    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { email, password } = validatedFields.data;

    const redirectUrl = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: "/dashboard",
    });

    if (typeof redirectUrl === "string") {
      const redirectError = getRedirectError(redirectUrl);
      if (redirectError) {
        return {
          success: false,
          error: getLoginErrorMessage(redirectError),
        };
      }

      return {
        success: true,
        redirectTo: getRelativeRedirectPath(redirectUrl),
      };
    }

    return {
      success: true,
      redirectTo: "/dashboard",
    };
  } catch (error) {
    if (!(error instanceof AuthError)) {
      console.error("Login error:", error);
    }

    return {
      success: false,
      error: getLoginErrorMessage(error),
    };
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

async function createDefaultCategories(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const defaultCategories = [
    // Income categories
    { name: "Salary", icon: "💰", color: "#22c55e", type: "INCOME" as const },
    { name: "Freelance", icon: "💻", color: "#3b82f6", type: "INCOME" as const },
    { name: "Investment Returns", icon: "📈", color: "#8b5cf6", type: "INCOME" as const },
    { name: "Bank Interest", icon: "💰", color: "#22c55e", type: "INCOME" as const },
    { name: "Other Income", icon: "💵", color: "#6b7280", type: "INCOME" as const },
    
    // Expense categories
    { name: "Food & Dining", icon: "🍔", color: "#f97316", type: "EXPENSE" as const },
    { name: "Transportation", icon: "🚗", color: "#06b6d4", type: "EXPENSE" as const },
    { name: "Shopping", icon: "🛍️", color: "#ec4899", type: "EXPENSE" as const },
    { name: "Entertainment", icon: "🎬", color: "#a855f7", type: "EXPENSE" as const },
    { name: "Bills & Utilities", icon: "📱", color: "#eab308", type: "EXPENSE" as const },
    { name: "Healthcare", icon: "🏥", color: "#ef4444", type: "EXPENSE" as const },
    { name: "Education", icon: "📚", color: "#14b8a6", type: "EXPENSE" as const },
    { name: "Travel", icon: "✈️", color: "#0ea5e9", type: "EXPENSE" as const },
    { name: "Subscriptions", icon: "📺", color: "#f43f5e", type: "EXPENSE" as const },
    { name: "Other Expenses", icon: "📦", color: "#6b7280", type: "EXPENSE" as const },
  ];

  await tx.category.createMany({
    data: defaultCategories.map((cat) => ({
      ...cat,
      userId,
      isSystem: true,
    })),
  });
}
