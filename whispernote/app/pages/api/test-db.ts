import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Testing database connection...');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key exists:', !!supabaseKey);

    // Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('memberships')
      .select('count', { count: 'exact', head: true });

    if (connectionError) {
      console.error('Connection test failed:', connectionError);
      return res.status(500).json({
        error: 'Database connection failed',
        details: connectionError.message,
        code: connectionError.code
      });
    }

    console.log('Connection test successful');

    // Test table structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'memberships' })
      .single();

    if (tableError) {
      console.log('Could not get table info (this is normal if RPC function does not exist)');
    }

    return res.status(200).json({
      success: true,
      message: 'Database connection successful',
      connectionTest,
      tableInfo: tableInfo || 'Table info not available'
    });

  } catch (error) {
    console.error('Test DB error:', error);
    return res.status(500).json({
      error: 'Test failed',
      message: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}
