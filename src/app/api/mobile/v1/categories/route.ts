import { NextResponse } from "next/server";

import prisma from "@/lib/db";
import { authenticateMobileRequest } from "@/server/auth/mobile-session";

const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;
const CATEGORY_TYPE_SET = new Set<string>(CATEGORY_TYPES);

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = new URL(request.url).searchParams.get("type");
    if (type && !CATEGORY_TYPE_SET.has(type)) {
      return NextResponse.json(
        { error: "Invalid category type filter" },
        { status: 400 }
      );
    }

    const categories = await prisma.category.findMany({
      where: {
        userId: authenticated.userId,
        type: type
          ? (type as (typeof CATEGORY_TYPES)[number])
          : { in: [...CATEGORY_TYPES] },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, icon: true, color: true, type: true },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Mobile categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
