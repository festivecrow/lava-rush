import { createClient } from '@supabase/supabase-js';

// Same Supabase project as The Clock — just different tables. Both the URL
// and publishable key are meant to be public; what actually protects data
// is Row Level Security (leaderboard reads are public, writes only happen
// through the submit-score edge function).
const SUPABASE_URL = 'https://mspmobcppyiyplkufmtz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_A7fjCgRgXFwdMrxPu6nPfg_e4esoT8l';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const SUBMIT_SCORE_URL = 'https://mspmobcppyiyplkufmtz.supabase.co/functions/v1/hyper-function';
