import { neon } from '@neondatabase/serverless';

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL environment variable is not set');
  }
  
  return neon(databaseUrl);
}

export async function initCloudTables() {
  const sql = getDb();
  
  await sql`
    CREATE TABLE IF NOT EXISTS cloud_applications (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50),
      location VARCHAR(255),
      graduation_date VARCHAR(100),
      preferred_start_date VARCHAR(100),
      available_for_trial VARCHAR(50),
      preferred_trial_date VARCHAR(100),
      primary_role VARCHAR(100),
      motivation TEXT,
      engineers_admired TEXT,
      self_rating INTEGER,
      unique_qualities TEXT,
      resume_filename VARCHAR(255),
      resume_data TEXT,
      skills JSONB,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      synced_to_local BOOLEAN DEFAULT FALSE
    )
  `;
  
  console.log('[CloudDB] Tables initialized');
}
