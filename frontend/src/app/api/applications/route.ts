import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const sql = getDb();
    const body = await request.json();
    
    if (!body.full_name || !body.email) {
      return NextResponse.json({ error: 'Full name and email are required' }, { status: 400 });
    }
    
    const existing = await sql`SELECT id FROM applications WHERE email = ${body.email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An application with this email already exists' }, { status: 409 });
    }
    
    const token = generateToken();
    
    const result = await sql`
      INSERT INTO applications (
        full_name, email, phone, location, graduation_date, preferred_start_date,
        availability, preferred_trial_date, self_description, motivation,
        admired_engineers, overall_self_rating, unique_trait, resume_filename,
        application_token, status, created_at, updated_at
      ) VALUES (
        ${body.full_name}, ${body.email}, ${body.phone || null}, ${body.location || null},
        ${body.graduation_date || null}, ${body.preferred_start_date || null},
        'need_to_discuss', ${body.preferred_trial_date || null},
        ${body.primary_role || null}, ${body.motivation || null}, ${body.engineers_admired || null},
        ${body.self_rating || null}, ${body.unique_qualities || null},
        ${body.resume_filename || null}, ${token}, 'pending',
        NOW(), NOW()
      ) RETURNING id, created_at, application_token
    `;
    
    return NextResponse.json({ 
      success: true, 
      application_id: result[0].id, 
      created_at: result[0].created_at,
      token: result[0].application_token 
    });
  } catch (error: unknown) {
    console.error('Application submission error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to submit application', details: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sql = getDb();
    const applications = await sql`
      SELECT id, full_name, email, phone, location, self_description as primary_role, 
             status, created_at
      FROM applications ORDER BY created_at DESC LIMIT 100
    `;
    return NextResponse.json({ success: true, applications, count: applications.length });
  } catch (error: unknown) {
    console.error('Failed to fetch applications:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch applications', details: message }, { status: 500 });
  }
}
