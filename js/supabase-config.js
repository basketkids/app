
// Supabase Client Initialization
// Using the global 'supabase' object provided by the CDN script

const supabaseUrl = 'https://geyzurfyfdhefpuinlqm.supabase.co';
const supabaseKey = 'sb_publishable_dNlszvioiebQgq5_IiZ63A_YWdMNzRQ';

// Check if supabase global exists
if (typeof supabase === 'undefined') {
    console.error('Supabase SDK not loaded. Make sure to include the script tag.');
} else {
    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');
}
