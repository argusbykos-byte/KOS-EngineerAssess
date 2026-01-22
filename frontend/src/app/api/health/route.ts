import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const sql = getDb();
    await sql`SELECT 1`;
    return NextResponse.json({ status: "healthy", database: "connected", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV });
  } catch (error: unknown) {
    console.error("Health check failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ status: "unhealthy", database: "disconnected", error: message }, { status: 500 });
  }
}
