import { auth } from "@/auth";
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * Retrieve trade history for a user's investment asset.
 *
 * Verifies the asset belongs to the authenticated user, supports optional
 * query filters (`type` - ignored when `ALL`) and sorting (`sortBy`, `sortOrder`),
 * and returns 401 if unauthenticated or 404 if the asset is not found.
 *
 * @param params - Route parameters containing the asset `id`
 * @returns An object with a `trades` array of trade records. Each trade includes:
 * `id`, `type`, `quantity`, `pricePerUnit`, `totalAmount`, `fees`, `date` (ISO string),
 * `notes`, `realizedPnL`, `assetId`, `userId`, `createdAt` (ISO string), and `updatedAt` (ISO string)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: assetId } = await params;

    // Verify the asset belongs to the user
    const asset = await prisma.investmentAsset.findFirst({
      where: {
        id: assetId,
        userId: session.user.id,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    // Get query parameters for filtering/sorting
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: Record<string, unknown> = {
      assetId,
      userId: session.user.id,
    };

    if (type && type !== "ALL") {
      where.type = type;
    }

    // Build order by clause
    const orderBy: Record<string, string> = {
      [sortBy]: sortOrder,
    };

    // Fetch trade history
    const trades = await prisma.tradeHistory.findMany({
      where,
      orderBy,
      select: {
        id: true,
        type: true,
        quantity: true,
        pricePerUnit: true,
        totalAmount: true,
        fees: true,
        date: true,
        notes: true,
        realizedPnL: true,
        assetId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Serialize dates to ISO strings for JSON response
    const serializedTrades = trades.map((trade) => ({
      ...trade,
      date: trade.date.toISOString(),
      createdAt: trade.createdAt.toISOString(),
      updatedAt: trade.updatedAt.toISOString(),
    }));

    return NextResponse.json({ trades: serializedTrades });
  } catch (error) {
    console.error("Get trade history API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade history" },
      { status: 500 }
    );
  }
}