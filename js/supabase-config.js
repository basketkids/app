
// Supabase Client Initialization
// Using the global 'supabase' object provided by the CDN script

const supabaseUrl = 'https://geyzurfyfdhefpuinlqm.supabase.co';
const supabaseKey = 'sb_publishable_dNlszvioiebQgq5_IiZ63A_YWdMNzRQ';

// Check if supabase global exists
if (typeof supabase === 'undefined') {
    console.error('Supabase SDK not loaded. Make sure to include the script tag.');
} else {
    // Configure client with lock options to avoid timeouts in multi-tab scenarios
    const options = {
        auth: {
            autoRefreshToken: false,
            persistSession: true,
            detectSessionInUrl: true,
            storageKey: 'basketkids-v1-auth' // Change key to bypass previous stuck locks
        }
    };

    // Check if we already have an instance
    if (!window.supabaseClient) {
        window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, options);
        console.log('Supabase client initialized');
    }
}
