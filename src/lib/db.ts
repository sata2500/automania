import { neon } from '@neondatabase/serverless';

// Fetch the DATABASE_URL from environment variables
const sql = neon(process.env.DATABASE_URL!);

export default sql;
