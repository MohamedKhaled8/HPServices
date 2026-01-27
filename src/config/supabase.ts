import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dwvicjxlgwcdmladabyl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dmljanhsZ3djZG1sYWRhYnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MzI3OTAsImV4cCI6MjA4NTEwODc5MH0.aBH4ytt9pZRGhtblBmpgUU22dQ0LYDchyIlghLKhnkI';

export const supabase = createClient(supabaseUrl, supabaseKey);
export const ASSIGNMENTS_BUCKET = 'assignments';
