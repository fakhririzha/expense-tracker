import { auth } from "@/auth";
import { TransactionType } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_CATEGORY_TYPES = Object.values(TransactionType);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const isValidType = !type || ALLOWED_CATEGORY_TYPES.includes(type as TransactionType);

    if (!isValidType) {
      return NextResponse.json({ error: "Invalid category type filter" }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      OR: [
        { userId: session.user.id },
        { isSystem: true },
      ],
    };

    if (type) {
      where.type = type;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        icon: true,
        type: true,
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
