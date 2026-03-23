import { createClient } from '@supabase/supabase-js'

// Estos datos salen de tus capturas:
const supabaseUrl = 'https://yyfjliinpodeapbunzne.supabase.co'
const supabaseAnonKey = 'sb_publishable_kqBBaaJGSEcje1Xe7oJR9w_ZlCLGTD9' 

export const supabase = createClient(supabaseUrl, supabaseAnonKey)