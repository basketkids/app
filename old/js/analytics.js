// Google Analytics Integration
// TODO: Replace 'G-XXXXXXXXXX' with your actual Measurement ID
const GA_MEASUREMENT_ID = 'G-T9K21H6TPY';

// Load the Google Analytics script
const script = document.createElement('script');
script.async = true;
script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
document.head.appendChild(script);

// Initialize dataLayer
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());

// Config
gtag('config', GA_MEASUREMENT_ID);
