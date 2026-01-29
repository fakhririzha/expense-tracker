"use server";

import { signIn, signOut } from "@/auth";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  mainCurrency: z.string().default("IDR"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        mainCurrency,
      },
    });

    // Create default categories for the user
    await createDefaultCategories(user.id);

    return {
      success: true,
      message: "Account created successfully",
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export async function login(data: LoginInput) {
  try {
    const validatedFields = loginSchema.safeParse(data);

    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { email, password } = validatedFields.data;

    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, error: "Invalid email or password" };
        default:
          return { success: false, error: "Something went wrong" };
      }
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

async function createDefaultCategories(userId: string) {
  const defaultCategories = [
    // Income categories
    { name: "Salary", icon: "💰", color: "#22c55e", type: "INCOME" as const },
    { name: "Freelance", icon: "💻", color: "#3b82f6", type: "INCOME" as const },
    { name: "Investment Returns", icon: "📈", color: "#8b5cf6", type: "INCOME" as const },
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

  await prisma.category.createMany({
    data: defaultCategories.map((cat) => ({
      ...cat,
      userId,
      isSystem: true,
    })),
  });
}
