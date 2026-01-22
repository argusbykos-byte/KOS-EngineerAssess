import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const sql = getDb();
    
    const result = await sql`SELECT NOW() as time`;
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result[0].time,
      environment: process.env.NODE_ENV
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    }, { status: 500 });
  }
}