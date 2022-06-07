import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

export const supabase = createClient(
    // @ts-ignore
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);
