import { auth } from "@/auth";
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/investments/[id]/trades
 * 
 * Fetches trade history for a specific investment asset.
 * Returns trades filtered by assetId, ordered by date descending.
 * 
 * @param request - The Next.js request object
 * @param params - Route parameters containing the asset id
 * @returns JSON response with trade history data
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
