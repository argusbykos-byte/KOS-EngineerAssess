import { NextRequest, NextResponse } from 'next/server';
import { getDb, initCloudTables } from '@/lib/db';

let tablesInitialized = false;

export async function POST(request: NextRequest) {
  try {
    const sql = getDb();
    
    if (!tablesInitialized) {
      await initCloudTables();
      tablesInitialized = true;
    }
    
    const data = await request.json();
    
    if (!data.full_name || !data.email) {
      return NextResponse.json(
        { error: 'Full name and email are required' },
        { status: 400 }
      );
    }
    
    const existing = await sql`
      SELECT id FROM cloud_applications WHERE email = ${data.email}
    `;
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An application with this email already exists' },
        { status: 409 }
      );
    }
    
    const result = await sql`
      INSERT INTO cloud_applications (
        full_name, email, phone, location, graduation_date,
        preferred_start_date, available_for_trial, preferred_trial_date,
        primary_role, motivation, engineers_admired, self_rating,
        unique_qualities, resume_filename, resume_data, skills, status
      ) VALUES (
        ${data.full_name}, ${data.email}, ${data.phone || null},
        ${data.location || null}, ${data.graduation_date || null},
        ${data.preferred_start_date || null}, ${data.available_for_trial || null},
        ${data.preferred_trial_date || null}, ${data.primary_role || null},
        ${data.motivation || null}, ${data.engineers_admired || null},
        ${data.self_rating || null}, ${data.unique_qualities || null},
        ${data.resume_filename || null}, ${data.resume_data || null},
        ${JSON.stringify(data.skills || {})}, 'pending'
      )
      RETURNING id, created_at
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      application_id: result[0].id,
      created_at: result[0].created_at
    });
    
  } catch (error: any) {
    console.error('[API] Error submitting application:', error);
    return NextResponse.json(
      { error: 'Failed to submit application', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sql = getDb();
    
    if (!tablesInitialized) {
      await initCloudTables();
      tablesInitialized = true;
    }
    
    const applications = await sql`
      SELECT id, full_name, email, phone, location, primary_role, 
             self_rating, status, created_at, synced_to_local
      FROM cloud_applications 
      ORDER BY created_at DESC
      LIMIT 100
    `;
    
    return NextResponse.json({
      success: true,
      count: applications.length,
      applications
    });
    
  } catch (error: any) {
    console.error('[API] Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications', details: error.message },
      { status: 500 }
    );
  }
}