import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_HPuWRDVC50JB@ep-square-night-ahsa22li-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.full_name || !body.email) {
      return NextResponse.json({ error: 'Full name and email are required' }, { status: 400 });
    }

    // Check for existing application
    const existing = await sql`SELECT id FROM cloud_applications WHERE email = ${body.email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An application with this email already exists' }, { status: 409 });
    }

    // Insert new application
    const result = await sql`
      INSERT INTO cloud_applications (
        full_name, email, phone, location, graduation_date, preferred_start_date,
        available_for_trial, preferred_trial_date, primary_role, motivation,
        engineers_admired, self_rating, unique_qualities, resume_filename, resume_data, skills
      ) VALUES (
        ${body.full_name}, ${body.email}, ${body.phone || null}, ${body.location || null},
        ${body.graduation_date || null}, ${body.preferred_start_date || null},
        ${body.available_for_trial || 'false'}, ${body.preferred_trial_date || null},
        ${body.primary_role || null}, ${body.motivation || null}, ${body.engineers_admired || null},
        ${body.self_rating || null}, ${body.unique_qualities || null},
        ${body.resume_filename || null}, ${body.resume_data || null}, ${JSON.stringify(body.skills || [])}
      ) RETURNING id, created_at
    `;

    return NextResponse.json({
      success: true,
      application_id: result[0].id,
      created_at: result[0].created_at
    });
  } catch (error: unknown) {
    console.error('Application submission error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to submit application', details: message }, { status: 500 });
  }
}
