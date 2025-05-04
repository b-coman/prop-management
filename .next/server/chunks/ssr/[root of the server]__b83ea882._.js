module.exports = {

"[externals]/util [external] (util, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}}),
"[externals]/crypto [external] (crypto, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}}),
"[externals]/process [external] (process, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("process", () => require("process"));

module.exports = mod;
}}),
"[externals]/tls [external] (tls, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("tls", () => require("tls"));

module.exports = mod;
}}),
"[externals]/fs [external] (fs, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}}),
"[externals]/os [external] (os, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}}),
"[externals]/net [external] (net, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("net", () => require("net"));

module.exports = mod;
}}),
"[externals]/events [external] (events, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}}),
"[externals]/stream [external] (stream, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}}),
"[externals]/http2 [external] (http2, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("http2", () => require("http2"));

module.exports = mod;
}}),
"[externals]/http [external] (http, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}}),
"[externals]/dns [external] (dns, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("dns", () => require("dns"));

module.exports = mod;
}}),
"[externals]/zlib [external] (zlib, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}}),
"[project]/src/lib/firebase.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
// src/lib/firebase.ts
__turbopack_context__.s({
    "app": (()=>app),
    "db": (()=>db)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$app$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/app/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm2017$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@firebase/app/dist/esm/index.esm2017.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
;
;
// Remove dotenv import - let scripts handle their own env loading if needed outside Next.js context
// import * as dotenv from 'dotenv';
// import * as path from 'path';
// import { getAuth } from "firebase/auth"; // Add if using Firebase Auth
// import { getStorage } from "firebase/storage"; // Add if using Firebase Storage
// Load environment variables from .env.local at the project root
// dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // No longer needed here, Next.js handles it
// Your web app's Firebase configuration
// Loaded from environment variables automatically by Next.js
const firebaseConfig = {
    apiKey: ("TURBOPACK compile-time value", "AIzaSyDCteU3dj_3lAMDzdjW3hLPgci5mGuPUUo"),
    authDomain: ("TURBOPACK compile-time value", "rentalspot-fzwom.firebaseapp.com"),
    projectId: ("TURBOPACK compile-time value", "rentalspot-fzwom"),
    storageBucket: ("TURBOPACK compile-time value", "rentalspot-fzwom.firebasestorage.app"),
    messagingSenderId: ("TURBOPACK compile-time value", "1061532538391"),
    appId: ("TURBOPACK compile-time value", "1:1061532538391:web:aff9b573f7b4c09f99ae52")
};
// Remove the checkEnvVars function, as Next.js handles env loading for the app runtime.
// The script now uses Admin SDK and verifies its own specific requirements.
/*
function checkEnvVars() {
    // ... (removed) ...
}
checkEnvVars();
*/ // Initialize Firebase Client SDK
// Use getApps() to ensure initialization only happens once within the Next.js app runtime
let app;
if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm2017$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getApps"])().length === 0) {
    // Check if critical client config vars are present before initializing client SDK
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("❌ Client Firebase Config Missing: NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in environment variables. Client SDK cannot initialize.");
    // Throwing here might break the app build/runtime if env vars aren't set during build phase
    // Consider logging the error and letting parts of the app fail gracefully if Firebase is needed client-side
    // throw new Error("Missing critical client Firebase configuration. Check environment variables.");
    } else {
        try {
            app = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm2017$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["initializeApp"])(firebaseConfig);
        // console.log("✅ Firebase Client SDK initialized successfully."); // Less verbose logging
        } catch (initError) {
            console.error("❌ Firebase Client SDK initialization failed:", initError);
        // Handle or re-throw the initialization error appropriately
        // throw initError; // Depending on whether the app can function without Firebase client
        }
    }
} else {
    app = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$app$2f$dist$2f$esm$2f$index$2e$esm2017$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getApp"])();
// console.log("ℹ️ Firebase Client SDK app already initialized.");
}
// Initialize Firestore Client SDK only if the app was successfully initialized or retrieved
let db;
if (app) {
    try {
        db = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getFirestore"])(app);
    // console.log("✅ Firestore Client SDK initialized successfully.");
    } catch (firestoreError) {
        console.error("❌ Firestore Client SDK initialization failed:", firestoreError);
    // Handle or re-throw the Firestore initialization error
    }
} else {
    console.error("❌ Cannot initialize Firestore Client SDK because Firebase app is not available.");
}
;
}}),
"[project]/src/services/booking-sync.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
/**
 * @fileoverview Service functions for synchronizing booking availability with external platforms like Airbnb and Booking.com.
 * IMPORTANT: These functions currently contain placeholder logic and require actual API integration.
 */ /* __next_internal_action_entry_do_not_use__ {"40120d23c0e137e69672a272e832e29ce25109973a":"getPropertyForSync","401384fc287599b455b7ced615c3309db315386bba":"getAirbnbListing","404606227eaa0714e258d94331326bf52d99064e78":"getBookingComListing","78a57aba3b2059d4f744f79a3c4069e88ddcb1a308":"updateAirbnbListingAvailability","78cadc2b153e7523b43ae1e820d27b044efd8b0b54":"updateBookingComListingAvailability"} */ __turbopack_context__.s({
    "getAirbnbListing": (()=>getAirbnbListing),
    "getBookingComListing": (()=>getBookingComListing),
    "getPropertyForSync": (()=>getPropertyForSync),
    "updateAirbnbListingAvailability": (()=>updateAirbnbListingAvailability),
    "updateBookingComListingAvailability": (()=>updateBookingComListingAvailability)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$app$2d$render$2f$encryption$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/app-render/encryption.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getPropertyForSync(propertyId) {
    const propertyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'properties', propertyId);
    try {
        const docSnap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDoc"])(propertyRef);
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            };
        } else {
            console.warn(`[getPropertyForSync] Property document not found in Firestore: properties/${propertyId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ [getPropertyForSync] Error fetching property ${propertyId}:`, error);
        return null;
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getAirbnbListing(listingId) {
    console.log(`[Sync Placeholder] Fetching Airbnb listing details for ID: ${listingId}`);
    // TODO: Replace with actual API call to Airbnb.
    await new Promise((resolve)=>setTimeout(resolve, 100)); // Simulate network delay
    return {
        listingId: listingId,
        isAvailable: true,
        pricePerNight: 150
    };
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getBookingComListing(listingId) {
    console.log(`[Sync Placeholder] Fetching Booking.com listing details for ID: ${listingId}`);
    // TODO: Replace with actual API call to Booking.com.
    await new Promise((resolve)=>setTimeout(resolve, 100)); // Simulate network delay
    return {
        listingId: listingId,
        isAvailable: true,
        pricePerNight: 160
    };
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ updateAirbnbListingAvailability(listingId, isAvailable, checkInDate, checkOutDate) {
    const dateRangeString = checkInDate && checkOutDate ? ` from ${checkInDate.toISOString().split('T')[0]} to ${checkOutDate.toISOString().split('T')[0]}` : '';
    console.log(`[Sync Placeholder] Updating Airbnb listing ${listingId} availability to ${isAvailable}${dateRangeString}.`);
    // TODO: Replace with actual API call to Airbnb, passing the specific date range to block/unblock.
    await new Promise((resolve)=>setTimeout(resolve, 150)); // Simulate network delay
    return;
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ updateBookingComListingAvailability(listingId, isAvailable, checkInDate, checkOutDate) {
    const dateRangeString = checkInDate && checkOutDate ? ` from ${checkInDate.toISOString().split('T')[0]} to ${checkOutDate.toISOString().split('T')[0]}` : '';
    console.log(`[Sync Placeholder] Updating Booking.com listing ${listingId} availability to ${isAvailable}${dateRangeString}.`);
    // TODO: Replace with actual API call to Booking.com, passing the specific date range to block/unblock.
    await new Promise((resolve)=>setTimeout(resolve, 150)); // Simulate network delay
    return;
} // TODO: Add functions for more granular sync (e.g., update price, minimum stay).
 // TODO: Implement webhook handlers to receive availability updates FROM external platforms.
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    getPropertyForSync,
    getAirbnbListing,
    getBookingComListing,
    updateAirbnbListingAvailability,
    updateBookingComListingAvailability
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getPropertyForSync, "40120d23c0e137e69672a272e832e29ce25109973a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAirbnbListing, "401384fc287599b455b7ced615c3309db315386bba", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBookingComListing, "404606227eaa0714e258d94331326bf52d99064e78", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateAirbnbListingAvailability, "78a57aba3b2059d4f744f79a3c4069e88ddcb1a308", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateBookingComListingAvailability, "78cadc2b153e7523b43ae1e820d27b044efd8b0b54", null);
}}),
"[project]/src/services/bookingService.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
// src/services/bookingService.ts
/* __next_internal_action_entry_do_not_use__ {"4006e8ba16649f98d908108b2e66e3db796ea69c68":"createBooking","404a55478edc034a4c5e5045d6eca3eb88530c3630":"getBookingsForUser","409966a54d7b64e85efcfdaf60b9dc081d99628819":"getBookingById","40e27282493dc0101cc37e2a3e7921ba309bfa8a54":"getBookingsForProperty","6021360a88c359099ff28f4bd1463da3250e44a7ea":"getUnavailableDatesForProperty","60cf603f51f57547a295812039ae2618b7620cb422":"updateBookingStatus","60e1671d7cb1dc65a9e38bee9faba5e22c93ae4b99":"updateBookingPaymentInfo","783cf81384dd07b293ddd7dd28aa8db422f521713b":"updatePropertyAvailability"} */ __turbopack_context__.s({
    "createBooking": (()=>createBooking),
    "getBookingById": (()=>getBookingById),
    "getBookingsForProperty": (()=>getBookingsForProperty),
    "getBookingsForUser": (()=>getBookingsForUser),
    "getUnavailableDatesForProperty": (()=>getUnavailableDatesForProperty),
    "updateBookingPaymentInfo": (()=>updateBookingPaymentInfo),
    "updateBookingStatus": (()=>updateBookingStatus),
    "updatePropertyAvailability": (()=>updatePropertyAvailability)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$app$2d$render$2f$encryption$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/app-render/encryption.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zod/lib/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/eachDayOfInterval.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/date-fns/format.mjs [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/subDays.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfDay$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/startOfDay.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/booking-sync.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
const CreateBookingDataSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    propertyId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1),
    guestInfo: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        firstName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1),
        lastName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        email: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().email(),
        phone: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        userId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional()
    }).passthrough(),
    checkInDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().refine((val)=>!isNaN(Date.parse(val))),
    checkOutDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().refine((val)=>!isNaN(Date.parse(val))),
    numberOfGuests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().positive(),
    pricing: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        baseRate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        numberOfNights: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().positive(),
        cleaningFee: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        extraGuestFee: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative().optional(),
        numberOfExtraGuests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().nonnegative().optional(),
        accommodationTotal: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        subtotal: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        taxes: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative().optional(),
        discountAmount: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative().optional(),
        total: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative()
    }).passthrough(),
    appliedCouponCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].enum([
        'pending',
        'confirmed',
        'cancelled',
        'completed'
    ]).optional(),
    // Removed paymentInput validation here, handled separately
    notes: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    source: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    externalId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional()
}).refine((data)=>new Date(data.checkOutDate) > new Date(data.checkInDate), {
    message: 'Check-out date must be after check-in date.',
    path: [
        'checkOutDate'
    ]
}).refine((data)=>{
    const calculatedTotal = (data.pricing.subtotal ?? 0) + (data.pricing.taxes ?? 0) - (data.pricing.discountAmount ?? 0);
    return Math.abs(calculatedTotal - data.pricing.total) < 0.01;
}, {
    message: 'Calculated total does not match provided total price.',
    path: [
        'pricing.total'
    ]
});
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ updateBookingPaymentInfo(bookingId, paymentInfo) {
    console.log(`--- [updateBookingPaymentInfo] Called for booking: ${bookingId} ---`);
    if (!bookingId) {
        throw new Error("Booking ID is required to update payment info.");
    }
    if (!paymentInfo || !paymentInfo.stripePaymentIntentId || paymentInfo.status !== 'paid' && paymentInfo.status !== 'succeeded') {
        console.warn(`[updateBookingPaymentInfo] Invalid or incomplete payment info for booking ${bookingId}. Status: ${paymentInfo?.status}`);
        throw new Error("Valid payment information (status 'paid' or 'succeeded') is required.");
    }
    const bookingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings', bookingId);
    try {
        // Fetch the booking to get check-in/out dates for availability update
        const bookingSnap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDoc"])(bookingRef);
        if (!bookingSnap.exists()) {
            console.error(`[updateBookingPaymentInfo] Booking ${bookingId} not found.`);
            throw new Error(`Booking with ID ${bookingId} not found.`);
        }
        const bookingData = bookingSnap.data(); // Cast to Booking
        console.log(`[updateBookingPaymentInfo] Updating booking ${bookingId} status to 'confirmed' and adding payment details.`);
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateDoc"])(bookingRef, {
            status: 'confirmed',
            paymentInfo: {
                ...bookingData.paymentInfo,
                ...paymentInfo,
                paidAt: paymentInfo.paidAt instanceof Date ? Timestamp.fromDate(paymentInfo.paidAt) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])()
            },
            updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])()
        });
        console.log(`✅ [updateBookingPaymentInfo] Successfully updated booking ${bookingId} to confirmed.`);
        // --- Update Property Availability ---
        const checkInDate = bookingData.checkInDate instanceof Timestamp ? bookingData.checkInDate.toDate() : bookingData.checkInDate ? new Date(bookingData.checkInDate) : null; // Handle different types
        const checkOutDate = bookingData.checkOutDate instanceof Timestamp ? bookingData.checkOutDate.toDate() : bookingData.checkOutDate ? new Date(bookingData.checkOutDate) : null;
        if (checkInDate && checkOutDate) {
            console.log(`[updateBookingPaymentInfo] Triggering availability update for property ${bookingData.propertyId}, booking ${bookingId}`);
            try {
                await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false); // Mark as unavailable
                console.log(`✅ [updateBookingPaymentInfo] Availability updated for property ${bookingData.propertyId}.`);
            } catch (availabilityError) {
                console.error(`❌ [updateBookingPaymentInfo] Failed to update availability for property ${bookingData.propertyId} after confirming booking ${bookingId}:`, availabilityError);
            // Log but don't fail the whole process, booking is confirmed
            }
            // --- Trigger External Sync ---
            // Move sync here, only sync AFTER booking is confirmed
            console.log(`[updateBookingPaymentInfo] Triggering external sync for property ${bookingData.propertyId}, booking ${bookingId}...`);
            try {
                const propertyDetails = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPropertyForSync"])(bookingData.propertyId);
                if (propertyDetails) {
                    if (propertyDetails.airbnbListingId) {
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateAirbnbListingAvailability"])(propertyDetails.airbnbListingId, false, checkInDate, checkOutDate);
                    }
                    if (propertyDetails.bookingComListingId) {
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBookingComListingAvailability"])(propertyDetails.bookingComListingId, false, checkInDate, checkOutDate);
                    }
                } else {
                    console.warn(`[updateBookingPaymentInfo Sync] Could not find property ${bookingData.propertyId} for external sync.`);
                }
            } catch (syncError) {
                console.error(`❌ [updateBookingPaymentInfo Sync] Error syncing externally for booking ${bookingId}:`, syncError);
            }
        } else {
            console.warn(`[updateBookingPaymentInfo] Missing check-in/out dates for booking ${bookingId}. Cannot update availability.`);
        }
    } catch (error) {
        console.error(`❌ [updateBookingPaymentInfo] Error updating booking ${bookingId}:`, error);
        throw new Error(`Failed to update booking payment info: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ createBooking(rawBookingData) {
    const paymentIntentId = rawBookingData?.paymentInput?.stripePaymentIntentId || 'N/A'; // Handle potential missing paymentInput
    console.log(`--- [createBooking] Function called (likely simulation) for Payment Intent [${paymentIntentId}] ---`);
    console.log(`[createBooking] Received raw data:`, JSON.stringify(rawBookingData, null, 2));
    let bookingData;
    // Zod Validation
    console.log(`[createBooking] Starting Zod validation...`);
    const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
    if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map((e)=>`${e.path.join('.')}: ${e.message}`).join(', ');
        const validationError = new Error(`Invalid booking data: ${errorMessages}`);
        console.error(`❌ [createBooking] Validation Error:`, validationError.message);
        throw validationError;
    }
    bookingData = validationResult.data;
    console.log(`[createBooking] Data passed validation.`);
    try {
        console.log(`[createBooking] Entered main try block.`);
        const bookingsCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings');
        // Data Transformation
        console.log(`[createBooking] Transforming data for Firestore...`);
        const checkInDate = new Date(bookingData.checkInDate);
        const checkOutDate = new Date(bookingData.checkOutDate);
        const checkInTimestamp = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(checkInDate);
        const checkOutTimestamp = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(checkOutDate);
        // Construct PaymentInfo if paymentInput exists (for simulation)
        let paymentInfo = undefined;
        if (rawBookingData.paymentInput) {
            const paymentInput = rawBookingData.paymentInput;
            paymentInfo = {
                stripePaymentIntentId: paymentInput.stripePaymentIntentId || `simulated_${Date.now()}`,
                amount: paymentInput.amount ?? bookingData.pricing.total,
                status: paymentInput.status || 'succeeded',
                paidAt: paymentInput.status === 'succeeded' || paymentInput.status === 'paid' ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].now() : null
            };
        } else {
            // Create a default placeholder if no paymentInput provided (shouldn't happen in normal flow)
            paymentInfo = {
                stripePaymentIntentId: 'N/A',
                amount: bookingData.pricing.total,
                status: 'unknown',
                paidAt: null
            };
        }
        // Construct the final booking document data
        const docData = {
            propertyId: bookingData.propertyId,
            guestInfo: bookingData.guestInfo,
            checkInDate: checkInTimestamp,
            checkOutDate: checkOutTimestamp,
            numberOfGuests: bookingData.numberOfGuests,
            pricing: bookingData.pricing,
            appliedCouponCode: bookingData.appliedCouponCode,
            status: bookingData.status || 'confirmed',
            paymentInfo: paymentInfo,
            notes: bookingData.notes,
            source: bookingData.source || 'simulation',
            externalId: bookingData.externalId,
            createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
            updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])()
        };
        console.log(`[createBooking] Firestore Doc Data Prepared:`, JSON.stringify({
            ...docData,
            checkInDate: `Timestamp(${checkInDate.toISOString()})`,
            checkOutDate: `Timestamp(${checkOutDate.toISOString()})`,
            paidAt: docData.paymentInfo.paidAt ? `Timestamp(${docData.paymentInfo.paidAt.toDate().toISOString()})` : null,
            createdAt: 'ServerTimestamp',
            updatedAt: 'ServerTimestamp'
        }, null, 2));
        // Firestore Operation (Client SDK)
        console.log(`[createBooking] Attempting to add booking document...`);
        const docRef = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addDoc"])(bookingsCollection, docData);
        const bookingId = docRef.id;
        console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId}`);
        // --- Update Property Availability (Client SDK) ---
        console.log(`[createBooking] Triggering local availability update for property ${bookingData.propertyId}, booking ${bookingId}`);
        try {
            await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false);
            console.log(`✅ [createBooking] Successfully finished update call for local availability for property ${bookingData.propertyId}, booking ${bookingId}.`);
        } catch (availabilityError) {
            console.error(`❌ [createBooking] Failed to update local availability for property ${bookingData.propertyId} after creating booking ${bookingId}:`, availabilityError);
            // Decide if this should block the entire process or just log a warning
            // In simulation, maybe log and continue? For real bookings, re-throw.
            // throw availabilityError; // Uncomment if availability update failure should halt creation
            console.warn(`⚠️ [createBooking] Availability update failed, but booking ${bookingId} was created (source: ${docData.source}). Manual check needed.`);
        }
        // --- Synchronize Availability with External Platforms ---
        // Skip sync for simulation/test bookings or handle differently if needed
        if (docData.source !== 'simulation' && docData.source !== 'test-button') {
            console.log(`[createBooking] Starting external platform sync for property ${bookingData.propertyId}, booking ${bookingId}...`);
            try {
                const propertyDetails = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPropertyForSync"])(bookingData.propertyId);
                if (propertyDetails) {
                    if (propertyDetails.airbnbListingId) {
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateAirbnbListingAvailability"])(propertyDetails.airbnbListingId, false, checkInDate, checkOutDate);
                    }
                    if (propertyDetails.bookingComListingId) {
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBookingComListingAvailability"])(propertyDetails.bookingComListingId, false, checkInDate, checkOutDate);
                    }
                } else {
                    console.warn(`[createBooking Sync] Could not retrieve property details for ${bookingData.propertyId} to perform external sync.`);
                }
            } catch (syncError) {
                console.error(`❌ [createBooking Sync] Error synchronizing availability with external platforms for property ${bookingData.propertyId} after creating booking ${bookingId}:`, syncError);
            }
        } else {
            console.log(`[createBooking] Skipping external sync for booking source: ${docData.source}`);
        }
        console.log(`--- [createBooking] Function returning successfully with booking ID: ${bookingId} ---`);
        return bookingId;
    } catch (error) {
        if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
            console.error(`❌ [createBooking] Error during booking creation process:`, error);
        }
        const errorMessage = error instanceof Error ? error.message.startsWith('Invalid booking data:') ? error.message : `Failed to create booking (Ref: ${paymentIntentId}). Please contact support.` : `An unexpected error occurred while creating the booking (Ref: ${paymentIntentId}). Please contact support.`;
        throw new Error(errorMessage);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getBookingById(bookingId) {
    try {
        const bookingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings', bookingId); // Use Client SDK 'db'
        const docSnap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDoc"])(bookingRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Convert Timestamps if needed for client consumption, or keep as Timestamps
            const bookingResult = {
                id: docSnap.id,
                ...data,
                checkInDate: data.checkInDate,
                checkOutDate: data.checkOutDate,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt
                }
            };
            return bookingResult;
        } else {
            console.warn(`[getBookingById] No booking found with ID: ${bookingId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ [getBookingById] Error fetching booking with ID ${bookingId}:`, error);
        throw new Error(`Failed to fetch booking: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ updateBookingStatus(bookingId, status) {
    try {
        const bookingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings', bookingId); // Use Client SDK 'db'
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateDoc"])(bookingRef, {
            status: status,
            updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])()
        });
        console.log(`✅ [updateBookingStatus] Successfully updated booking ${bookingId} to status: ${status}`);
        if (status === 'cancelled') {
            const booking = await getBookingById(bookingId); // Re-fetch using Client SDK
            if (booking && booking.checkInDate && booking.checkOutDate) {
                // Convert Client Timestamps back to Dates
                const checkInDate = booking.checkInDate instanceof Timestamp ? booking.checkInDate.toDate() : booking.checkInDate ? new Date(booking.checkInDate) : null;
                const checkOutDate = booking.checkOutDate instanceof Timestamp ? booking.checkOutDate.toDate() : booking.checkOutDate ? new Date(booking.checkOutDate) : null;
                if (checkInDate && checkOutDate) {
                    try {
                        // Make dates available again
                        await updatePropertyAvailability(booking.propertyId, checkInDate, checkOutDate, true);
                        console.log(`✅ [updateBookingStatus] Successfully updated local availability (Client SDK) for cancelled booking ${bookingId}.`);
                        // Trigger external sync to release dates
                        await triggerExternalSyncForDateUpdate(booking.propertyId, checkInDate, checkOutDate, true);
                    } catch (availError) {
                        console.error(`❌ [updateBookingStatus] Failed to update local availability or sync for cancelled booking ${bookingId}:`, availError);
                    }
                } else {
                    console.warn(`[updateBookingStatus] Could not parse dates for booking ${bookingId} to update availability after cancellation.`);
                }
            } else {
                console.warn(`[updateBookingStatus] Could not find booking ${bookingId} or its dates to update availability after cancellation.`);
            }
        }
    } catch (error) {
        console.error(`❌ [updateBookingStatus] Error updating status for booking ${bookingId} (Client SDK):`, error);
        throw new Error(`Failed to update booking status: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getBookingsForProperty(propertyId) {
    const bookings = [];
    try {
        const bookingsCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings'); // Use Client SDK 'db'
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["query"])(bookingsCollection, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["where"])('propertyId', '==', propertyId));
        const querySnapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(q);
        querySnapshot.forEach((doc)=>{
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
                checkInDate: data.checkInDate,
                checkOutDate: data.checkOutDate,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt
                }
            });
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForProperty] Error fetching bookings for property ${propertyId}:`, error);
        throw new Error(`Failed to fetch bookings for property: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getBookingsForUser(userId) {
    const bookings = [];
    try {
        const bookingsCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings'); // Use Client SDK 'db'
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["query"])(bookingsCollection, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["where"])('guestInfo.userId', '==', userId));
        const querySnapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(q);
        querySnapshot.forEach((doc)=>{
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
                checkInDate: data.checkInDate,
                checkOutDate: data.checkOutDate,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt
                }
            });
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForUser] Error fetching bookings for user ${userId}:`, error);
        throw new Error(`Failed to fetch bookings for user: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ updatePropertyAvailability(propertyId, checkInDate, checkOutDate, available) {
    console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function called ---`);
    console.log(`[updatePropertyAvailability - CLIENT SDK] Args: propertyId=${propertyId}, checkIn=${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(checkInDate, 'yyyy-MM-dd')}, checkOut=${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(checkOutDate, 'yyyy-MM-dd')} (exclusive), available=${available}`);
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"]) {
        console.error("❌ [updatePropertyAvailability - CLIENT SDK] Firestore Client SDK (db) is not initialized.");
        throw new Error("Firestore Client SDK is not initialized.");
    }
    if (checkOutDate <= checkInDate) {
        console.warn(`[updatePropertyAvailability] Check-out date (${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(checkOutDate, 'yyyy-MM-dd')}) must be after check-in date (${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(checkInDate, 'yyyy-MM-dd')}). No update performed.`);
        return;
    }
    // Ensure dates are at the start of the day UTC for consistency
    const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfDay$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfDay"])(checkInDate);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfDay$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfDay"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["subDays"])(checkOutDate, 1)); // Make checkout date exclusive
    const datesToUpdate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["eachDayOfInterval"])({
        start,
        end
    });
    if (datesToUpdate.length === 0) {
        console.log("[updatePropertyAvailability - CLIENT SDK] No dates need updating.");
        return;
    }
    console.log(`[updatePropertyAvailability - CLIENT SDK] Dates to update (${datesToUpdate.length}): ${datesToUpdate.map((d)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(d, 'yyyy-MM-dd')).join(', ')}`);
    const updatesByMonth = {};
    datesToUpdate.forEach((date)=>{
        const monthStr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, 'yyyy-MM'); // Use UTC month
        const dayOfMonth = date.getUTCDate(); // Use UTC day
        if (!updatesByMonth[monthStr]) {
            updatesByMonth[monthStr] = {};
        }
        updatesByMonth[monthStr][dayOfMonth] = available;
    });
    console.log(`[updatePropertyAvailability - CLIENT SDK] Updates grouped by month:`, JSON.stringify(updatesByMonth));
    const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"]);
    const availabilityCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'availability');
    console.log(`[updatePropertyAvailability - CLIENT SDK] Initialized Firestore Client batch.`);
    try {
        const monthStrings = Object.keys(updatesByMonth);
        console.log(`[updatePropertyAvailability - CLIENT SDK] Processing months: ${monthStrings.join(', ')}`);
        if (monthStrings.length === 0) return;
        const docIdsToFetch = monthStrings.map((monthStr)=>`${propertyId}_${monthStr}`);
        console.log(`[updatePropertyAvailability - CLIENT SDK] Fetching existing availability docs for ${monthStrings.length} months...`);
        const idBatches = [];
        for(let i = 0; i < docIdsToFetch.length; i += 30){
            idBatches.push(docIdsToFetch.slice(i, i + 30));
        }
        const fetchedDocsMap = new Map();
        await Promise.all(idBatches.map(async (batchIds)=>{
            if (batchIds.length === 0) return;
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["query"])(availabilityCollection, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["where"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["documentId"])(), 'in', batchIds));
            const querySnapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(q);
            querySnapshot.forEach((docSnap)=>{
                if (docSnap.exists()) {
                    fetchedDocsMap.set(docSnap.id, {
                        id: docSnap.id,
                        ...docSnap.data()
                    });
                }
            });
        }));
        console.log(`[updatePropertyAvailability - CLIENT SDK] Fetched ${fetchedDocsMap.size} existing doc snapshots.`);
        monthStrings.forEach((monthStr)=>{
            const availabilityDocId = `${propertyId}_${monthStr}`;
            console.log(`[updatePropertyAvailability Batch Prep] Processing month ${monthStr} (Doc ID: ${availabilityDocId}). Days: ${Object.keys(updatesByMonth[monthStr]).join(', ')}`);
            const availabilityDocRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["doc"])(availabilityCollection, availabilityDocId);
            const updatesForDay = updatesByMonth[monthStr];
            const updatePayload = {};
            for(const day in updatesForDay){
                updatePayload[`available.${String(day)}`] = updatesForDay[day];
            }
            updatePayload.updatedAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])();
            console.log(`[updatePropertyAvailability Batch Prep] Payload for ${availabilityDocId}:`, JSON.stringify({
                ...updatePayload,
                updatedAt: 'ServerTimestamp'
            }));
            const existingDoc = fetchedDocsMap.get(availabilityDocId);
            if (existingDoc) {
                console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} exists. Adding UPDATE.`);
                batch.update(availabilityDocRef, updatePayload);
            } else {
                console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} DOES NOT exist. Creating initial.`);
                const [year, month] = monthStr.split('-').map(Number);
                const daysInMonth = new Date(year, month, 0).getDate();
                const initialAvailableMap = {};
                for(let day = 1; day <= daysInMonth; day++){
                    initialAvailableMap[day] = updatesForDay[day] !== undefined ? updatesForDay[day] : true;
                }
                const newDocData = {
                    propertyId: propertyId,
                    month: monthStr,
                    available: initialAvailableMap,
                    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])()
                };
                console.log(`[updatePropertyAvailability Batch Prep] Adding SET (merge: true) for ${availabilityDocId}.`);
                batch.set(availabilityDocRef, newDocData, {
                    merge: true
                });
            }
        });
        console.log(`[updatePropertyAvailability - CLIENT SDK] Committing client batch for property ${propertyId}...`);
        await batch.commit();
        console.log(`✅ [updatePropertyAvailability - CLIENT SDK] Batch committed for property ${propertyId}.`);
        console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function finished successfully ---`);
    } catch (error) {
        console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
        console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function throwing error ---`);
        // Rethrow with a more specific message if it's a permission error
        if (error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
            throw new Error(`Permission denied updating availability. Check Firestore rules.`);
        }
        throw new Error(`Failed to update local property availability using Client SDK: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Helper function to trigger external sync after availability update.
 */ async function triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, isAvailable) {
    console.log(`[Sync Trigger] Syncing availability change for property ${propertyId} (${isAvailable ? 'Release' : 'Block'})`);
    try {
        const propertyDetails = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPropertyForSync"])(propertyId);
        if (propertyDetails) {
            if (propertyDetails.airbnbListingId) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateAirbnbListingAvailability"])(propertyDetails.airbnbListingId, isAvailable, checkInDate, checkOutDate);
            }
            if (propertyDetails.bookingComListingId) {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBookingComListingAvailability"])(propertyDetails.bookingComListingId, isAvailable, checkInDate, checkOutDate);
            }
        } else {
            console.warn(`[Sync Trigger] Could not find property ${propertyId} for external sync.`);
        }
    } catch (syncError) {
        console.error(`❌ [Sync Trigger] Error syncing externally for property ${propertyId}:`, syncError);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getUnavailableDatesForProperty(propertyId, monthsToFetch = 12) {
    const unavailableDates = [];
    console.log(`--- [getUnavailableDatesForProperty] Function called ---`);
    console.log(`[getUnavailableDatesForProperty] Fetching for property ${propertyId} for the next ${monthsToFetch} months.`);
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"]) {
        console.error("❌ [getUnavailableDatesForProperty] Firestore Client SDK (db) is not initialized.");
        return [];
    }
    const availabilityCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'availability');
    const today = new Date();
    const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    try {
        const monthDocIds = [];
        for(let i = 0; i < monthsToFetch; i++){
            const targetMonth = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1));
            const monthStr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(targetMonth, 'yyyy-MM');
            monthDocIds.push(`${propertyId}_${monthStr}`);
        }
        const queryBatches = [];
        for(let i = 0; i < monthDocIds.length; i += 30){
            queryBatches.push(monthDocIds.slice(i, i + 30));
        }
        if (monthDocIds.length === 0) {
            console.log("[getUnavailableDatesForProperty] No month document IDs to query.");
            return [];
        }
        const allQuerySnapshots = await Promise.all(queryBatches.map(async (batchIds)=>{
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["query"])(availabilityCollection, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["where"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["documentId"])(), 'in', batchIds));
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(q);
        }));
        allQuerySnapshots.forEach((querySnapshot)=>{
            querySnapshot.forEach((doc)=>{
                const data = doc.data();
                const docId = doc.id;
                const monthStr = data.month || docId.split('_')[1]; // Prefer data.month
                if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                    console.warn(`[getUnavailableDates] Invalid month string for doc ${docId}. Skipping.`);
                    return;
                }
                if (data.available && typeof data.available === 'object') {
                    const [year, monthIndex] = monthStr.split('-').map((num)=>parseInt(num, 10));
                    const month = monthIndex - 1; // JS months 0-indexed
                    for(const dayStr in data.available){
                        const day = parseInt(dayStr, 10);
                        if (!isNaN(day) && data.available[day] === false) {
                            try {
                                // Construct date as UTC date
                                const date = new Date(Date.UTC(year, month, day));
                                // Double check date validity after creation
                                if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                    const todayUtcStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$startOfDay$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["startOfDay"])(new Date()); // Compare against local start of today
                                    if (date >= todayUtcStart) {
                                        unavailableDates.push(date);
                                    }
                                } else {
                                    console.warn(`[getUnavailableDates] Invalid date created for ${monthStr}-${dayStr}. Skipping.`);
                                }
                            } catch (dateError) {
                                console.warn(`[getUnavailableDates] Error creating date ${monthStr}-${dayStr}:`, dateError);
                            }
                        }
                    }
                }
            });
        });
        unavailableDates.sort((a, b)=>a.getTime() - b.getTime());
        console.log(`[getUnavailableDates] Found ${unavailableDates.length} unavailable dates for ${propertyId}.`);
        console.log(`--- [getUnavailableDatesForProperty] Function finished successfully ---`);
        return unavailableDates;
    } catch (error) {
        console.error(`❌ Error fetching unavailable dates for property ${propertyId}:`, error);
        console.log(`--- [getUnavailableDatesForProperty] Function finished with error ---`);
        return [];
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    updateBookingPaymentInfo,
    createBooking,
    getBookingById,
    updateBookingStatus,
    getBookingsForProperty,
    getBookingsForUser,
    updatePropertyAvailability,
    getUnavailableDatesForProperty
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateBookingPaymentInfo, "60e1671d7cb1dc65a9e38bee9faba5e22c93ae4b99", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createBooking, "4006e8ba16649f98d908108b2e66e3db796ea69c68", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBookingById, "409966a54d7b64e85efcfdaf60b9dc081d99628819", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateBookingStatus, "60cf603f51f57547a295812039ae2618b7620cb422", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBookingsForProperty, "40e27282493dc0101cc37e2a3e7921ba309bfa8a54", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBookingsForUser, "404a55478edc034a4c5e5045d6eca3eb88530c3630", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updatePropertyAvailability, "783cf81384dd07b293ddd7dd28aa8db422f521713b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getUnavailableDatesForProperty, "6021360a88c359099ff28f4bd1463da3250e44a7ea", null);
}}),
"[project]/src/services/couponService.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
// src/services/couponService.ts
/* __next_internal_action_entry_do_not_use__ {"7042f9d68d96277d89a2284ba641903b616efa9e9e":"validateAndApplyCoupon"} */ __turbopack_context__.s({
    "validateAndApplyCoupon": (()=>validateAndApplyCoupon)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$app$2d$render$2f$encryption$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/app-render/encryption.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-rsc] (ecmascript)"); // Client SDK Firestore instance
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/parseISO.mjs [app-rsc] (ecmascript)"); // Changed 'overlaps' to 'areIntervalsOverlapping'
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$areIntervalsOverlapping$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/areIntervalsOverlapping.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
// Helper function to convert SerializableTimestamp to Date or null
const toDate = (timestamp)=>{
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"]) return timestamp.toDate();
    if (typeof timestamp === 'string') {
        try {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$parseISO$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseISO"])(timestamp);
        } catch  {
            return null;
        }
    }
    if (typeof timestamp === 'number') {
        // Assuming number is milliseconds since epoch
        return new Date(timestamp);
    }
    return null;
};
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ validateAndApplyCoupon(couponCode, bookingCheckInDate, bookingCheckOutDate) {
    if (!couponCode) {
        return {
            error: 'Coupon code cannot be empty.'
        };
    }
    if (!bookingCheckInDate || !bookingCheckOutDate || bookingCheckOutDate <= bookingCheckInDate) {
        return {
            error: 'Valid booking dates are required to apply a coupon.'
        };
    }
    const couponCodeUpper = couponCode.toUpperCase(); // Normalize code
    try {
        const couponsCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'coupons');
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["query"])(couponsCollection, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["where"])('code', '==', couponCodeUpper), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["limit"])(1));
        const querySnapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(q);
        if (querySnapshot.empty) {
            console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" not found.`);
            return {
                error: 'Invalid coupon code.'
            };
        }
        const couponDoc = querySnapshot.docs[0];
        // Cast data to include new fields, ensuring they can be null/undefined
        const couponData = couponDoc.data();
        // --- Basic Validations ---
        if (!couponData.isActive) {
            console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" is not active.`);
            return {
                error: 'Coupon code is no longer active.'
            };
        }
        const couponExpiryDate = toDate(couponData.validUntil);
        const now = new Date(); // Compare with current date, not just timestamp
        // Make comparison based on the start of the day for coupon expiry
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (couponExpiryDate && couponExpiryDate < todayStart) {
            console.warn(`[Coupon Service] Coupon code "${couponCodeUpper}" has expired on ${couponExpiryDate.toISOString().split('T')[0]}.`);
            return {
                error: 'Coupon code has expired.'
            };
        }
        if (typeof couponData.discount !== 'number' || couponData.discount <= 0 || couponData.discount > 100) {
            console.error(`[Coupon Service] Invalid discount percentage (${couponData.discount}) for coupon "${couponCodeUpper}".`);
            return {
                error: 'Invalid coupon configuration.'
            };
        }
        // --- Booking Timeframe Validations ---
        const bookingValidFrom = toDate(couponData.bookingValidFrom);
        const bookingValidUntil = toDate(couponData.bookingValidUntil);
        // Check if booking starts before the valid period
        if (bookingValidFrom && bookingCheckInDate < bookingValidFrom) {
            console.warn(`[Coupon Service] Booking check-in (${bookingCheckInDate.toISOString().split('T')[0]}) is before coupon booking validity start (${bookingValidFrom.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
            return {
                error: 'Coupon not valid for selected check-in date.'
            };
        }
        // Check if booking ends after the valid period
        // For bookingValidUntil, we should check if the *check-in* date is after the validity end date
        // OR if the check-out date is strictly after the validity end date.
        if (bookingValidUntil) {
            // Set validity end to the end of the day for comparison
            const validityEndDate = new Date(bookingValidUntil.getFullYear(), bookingValidUntil.getMonth(), bookingValidUntil.getDate(), 23, 59, 59, 999);
            if (bookingCheckInDate > validityEndDate) {
                console.warn(`[Coupon Service] Booking check-in (${bookingCheckInDate.toISOString().split('T')[0]}) is after coupon booking validity end (${bookingValidUntil.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
                return {
                    error: 'Coupon not valid for selected check-in date.'
                };
            }
        // Note: Check-out date is typically exclusive. A booking ending on the validity date should be allowed.
        // However, if the policy is strict, you might compare bookingCheckOutDate > validityEndDate + 1 day or similar.
        // Sticking to check-in date for simplicity based on typical coupon logic.
        }
        // --- Exclusion Period Validations ---
        if (couponData.exclusionPeriods && Array.isArray(couponData.exclusionPeriods)) {
            // The booking interval includes the check-in day but excludes the check-out day for night calculations.
            // For overlap checking, we should consider the full range of occupied days.
            const bookingInterval = {
                start: bookingCheckInDate,
                end: new Date(bookingCheckOutDate.getTime() - 1)
            }; // Adjust end date to be inclusive
            for (const period of couponData.exclusionPeriods){
                const exclusionStart = toDate(period.start);
                const exclusionEnd = toDate(period.end);
                if (exclusionStart && exclusionEnd) {
                    // Ensure exclusion end is inclusive for overlap check
                    const exclusionInterval = {
                        start: exclusionStart,
                        end: new Date(exclusionEnd.getFullYear(), exclusionEnd.getMonth(), exclusionEnd.getDate(), 23, 59, 59, 999)
                    };
                    // Check if the booking interval overlaps with any exclusion interval
                    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$areIntervalsOverlapping$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["areIntervalsOverlapping"])(bookingInterval, exclusionInterval, {
                        inclusive: true
                    })) {
                        console.warn(`[Coupon Service] Booking dates (${bookingCheckInDate.toISOString().split('T')[0]} - ${bookingCheckOutDate.toISOString().split('T')[0]}) overlap with exclusion period (${exclusionStart.toISOString().split('T')[0]} - ${exclusionEnd.toISOString().split('T')[0]}) for "${couponCodeUpper}".`);
                        return {
                            error: 'Coupon not valid for the selected dates due to an exclusion period.'
                        };
                    }
                } else {
                    console.warn(`[Coupon Service] Invalid exclusion period found for coupon "${couponCodeUpper}":`, period);
                }
            }
        }
        // TODO: Add validation for usage limits if implemented (maxUses, currentUses)
        console.log(`[Coupon Service] Coupon code "${couponCodeUpper}" validated successfully for the booking dates. Discount: ${couponData.discount}%`);
        return {
            discountPercentage: couponData.discount
        };
    } catch (error) {
        console.error(`❌ [Coupon Service] Error validating coupon code "${couponCodeUpper}":`, error);
        return {
            error: 'Could not validate coupon code. Please try again.'
        }; // Generic error for the user
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    validateAndApplyCoupon
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(validateAndApplyCoupon, "7042f9d68d96277d89a2284ba641903b616efa9e9e", null);
}}),
"[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
/* __next_internal_action_entry_do_not_use__ {"408eb28e78660906ce6dabefafb029a0c856029d33":"createPendingBookingAction"} */ __turbopack_context__.s({
    "createPendingBookingAction": (()=>createPendingBookingAction)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$app$2d$render$2f$encryption$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/app-render/encryption.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zod/lib/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-rsc] (ecmascript)"); // Client SDK
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
// Schema for creating a PENDING booking
const CreatePendingBookingSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    propertyId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1),
    guestInfo: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        firstName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1),
        lastName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1),
        email: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().email(),
        phone: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1)
    }).passthrough(),
    checkInDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().datetime(),
    checkOutDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().datetime(),
    numberOfGuests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().positive(),
    pricing: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        baseRate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        numberOfNights: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().positive(),
        cleaningFee: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        extraGuestFee: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative().optional(),
        numberOfExtraGuests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().nonnegative().optional(),
        accommodationTotal: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        subtotal: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative(),
        taxes: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative().optional(),
        discountAmount: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative().optional(),
        total: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative()
    }).passthrough(),
    status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal('pending'),
    appliedCouponCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional()
});
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ createPendingBookingAction(input) {
    console.log("[Action createPendingBookingAction] Called with input:", input);
    const validationResult = CreatePendingBookingSchema.safeParse(input);
    if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map((e)=>`${e.path.join('.')}: ${e.message}`).join(', ');
        console.error("[Action createPendingBookingAction] Validation Error:", errorMessages);
        return {
            error: `Invalid pending booking data: ${errorMessages}`
        };
    }
    const { propertyId, guestInfo, checkInDate: checkInStr, checkOutDate: checkOutStr, numberOfGuests, pricing, status, appliedCouponCode } = validationResult.data;
    try {
        const bookingsCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings');
        const checkIn = new Date(checkInStr);
        const checkOut = new Date(checkOutStr);
        // Prepare data for Firestore
        const bookingData = {
            propertyId,
            guestInfo,
            checkInDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(checkIn),
            checkOutDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(checkOut),
            numberOfGuests,
            pricing,
            status: 'pending',
            appliedCouponCode: appliedCouponCode,
            createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
            updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
            // Payment info will be added/updated by the webhook
            paymentInfo: {
                stripePaymentIntentId: '',
                amount: pricing.total,
                status: 'pending',
                paidAt: null
            },
            source: 'website-pending'
        };
        console.log("[Action createPendingBookingAction] Prepared Firestore Data:", bookingData);
        // Add the document
        const docRef = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addDoc"])(bookingsCollection, bookingData);
        console.log(`[Action createPendingBookingAction] Pending booking created successfully with ID: ${docRef.id}`);
        // No revalidation needed yet, booking isn't confirmed
        return {
            bookingId: docRef.id
        };
    } catch (error) {
        console.error(`❌ [Action createPendingBookingAction] Error creating pending booking:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('PERMISSION_DENIED')) {
            return {
                error: 'Permission denied. Could not create pending booking.'
            };
        }
        return {
            error: `Failed to create pending booking: ${errorMessage}`
        };
    }
} // TODO: Add action `createAvailabilityAlertAction` later
 // export async function createAvailabilityAlertAction(input: { propertyId: string, checkInDate: string, checkOutDate: string, contactMethod: 'email' | 'sms', contactInfo: string }) { ... }
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createPendingBookingAction
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createPendingBookingAction, "408eb28e78660906ce6dabefafb029a0c856029d33", null);
}}),
"[externals]/https [external] (https, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}}),
"[externals]/child_process [external] (child_process, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}}),
"[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
/* __next_internal_action_entry_do_not_use__ {"4097e3b6d26be9a6460352557de41c60a1b9a8a31d":"createCheckoutSession"} */ __turbopack_context__.s({
    "createCheckoutSession": (()=>createCheckoutSession)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$app$2d$render$2f$encryption$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/app-render/encryption.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$stripe$2f$esm$2f$stripe$2e$esm$2e$node$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/stripe/esm/stripe.esm.node.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}
const stripe = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$stripe$2f$esm$2f$stripe$2e$esm$2e$node$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"](stripeSecretKey);
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ createCheckoutSession(input) {
    const { property, checkInDate, checkOutDate, numberOfGuests, totalPrice, numberOfNights, guestEmail, guestFirstName, guestLastName, appliedCouponCode, discountPercentage, pendingBookingId } = input;
    const origin = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["headers"])().get('origin') || 'http://localhost:9002';
    const numberOfExtraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);
    // --- Prepare metadata ---
    const metadata = {
        propertyId: property.id,
        propertyName: property.name,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        numberOfGuests: String(numberOfGuests),
        numberOfNights: String(numberOfNights),
        totalPrice: String(totalPrice),
        cleaningFee: String(property.cleaningFee),
        pricePerNight: String(property.pricePerNight),
        baseOccupancy: String(property.baseOccupancy),
        extraGuestFee: String(property.extraGuestFee),
        numberOfExtraGuests: String(numberOfExtraGuests),
        guestFirstName: guestFirstName || '',
        guestLastName: guestLastName || '',
        // Add pendingBookingId to metadata
        pendingBookingId: pendingBookingId || ''
    };
    if (appliedCouponCode && discountPercentage !== undefined) {
        metadata.appliedCouponCode = appliedCouponCode;
        metadata.discountPercentage = String(discountPercentage);
    }
    // --- Construct Success URL ---
    // Keep success URL simple, rely on webhook and booking ID for confirmation logic
    const success_url = `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`; // Optionally pass booking ID
    const cancel_url = `${origin}/booking/cancel?property_slug=${property.slug}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`; // Pass booking ID to cancel if needed
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: [
                'card'
            ],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${property.name} (${numberOfNights} nights, ${numberOfGuests} guests)${appliedCouponCode ? ` - Coupon: ${appliedCouponCode}` : ''}`,
                            description: `Booking from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()}. Ref: ${pendingBookingId || 'N/A'}`,
                            images: [
                                property.images.find((img)=>img.isFeatured)?.url || property.images[0]?.url || ''
                            ]
                        },
                        unit_amount: Math.round(totalPrice * 100)
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: success_url,
            cancel_url: cancel_url,
            customer_email: guestEmail,
            phone_number_collection: {
                enabled: true
            },
            metadata: metadata
        });
        if (!session.id) {
            throw new Error('Failed to create Stripe session.');
        }
        // Link session to pending booking if ID provided
        if (pendingBookingId && session.payment_intent) {
            // You might want to update the pending booking with the payment_intent ID here
            // This provides another link between the booking and the payment attempt.
            // Example (requires an update action):
            // await updatePendingBookingWithPaymentIntent(pendingBookingId, session.payment_intent as string);
            console.log(`[createCheckoutSession] Stripe session ${session.id} created, linked to pending booking ${pendingBookingId} via metadata. Payment Intent: ${session.payment_intent}`);
        }
        return {
            sessionId: session.id
        };
    } catch (error) {
        console.error('Error creating Stripe Checkout session:', error);
        return {
            error: `Failed to create checkout session: ${error instanceof Error ? error.message : String(error)}`
        };
    }
} // Optional helper action (if needed)
 // async function updatePendingBookingWithPaymentIntent(bookingId: string, paymentIntentId: string) {
 //   try {
 //     const bookingRef = doc(db, 'bookings', bookingId);
 //     await updateDoc(bookingRef, {
 //       'paymentInfo.stripePaymentIntentId': paymentIntentId,
 //       updatedAt: serverTimestamp(),
 //     });
 //     console.log(`[updatePendingBooking] Updated booking ${bookingId} with Payment Intent ID: ${paymentIntentId}`);
 //   } catch (error) {
 //     console.error(`[updatePendingBooking] Error updating booking ${bookingId} with Payment Intent ID:`, error);
 //     // Handle error appropriately, maybe log it or notify admin
 //   }
 // }
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createCheckoutSession
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createCheckoutSession, "4097e3b6d26be9a6460352557de41c60a1b9a8a31d", null);
}}),
"[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/services/bookingService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/services/couponService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({});
;
;
;
;
;
;
;
;
;
;
;
}}),
"[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/services/bookingService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/services/couponService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/bookingService.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/couponService.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => "[project]/src/services/bookingService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/services/couponService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
}}),
"[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/services/bookingService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/services/couponService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "4006e8ba16649f98d908108b2e66e3db796ea69c68": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createBooking"]),
    "404a55478edc034a4c5e5045d6eca3eb88530c3630": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBookingsForUser"]),
    "408eb28e78660906ce6dabefafb029a0c856029d33": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createPendingBookingAction"]),
    "4097e3b6d26be9a6460352557de41c60a1b9a8a31d": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createCheckoutSession"]),
    "409966a54d7b64e85efcfdaf60b9dc081d99628819": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBookingById"]),
    "40e27282493dc0101cc37e2a3e7921ba309bfa8a54": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBookingsForProperty"]),
    "6021360a88c359099ff28f4bd1463da3250e44a7ea": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getUnavailableDatesForProperty"]),
    "60cf603f51f57547a295812039ae2618b7620cb422": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBookingStatus"]),
    "60e1671d7cb1dc65a9e38bee9faba5e22c93ae4b99": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBookingPaymentInfo"]),
    "7042f9d68d96277d89a2284ba641903b616efa9e9e": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validateAndApplyCoupon"]),
    "783cf81384dd07b293ddd7dd28aa8db422f521713b": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updatePropertyAvailability"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/bookingService.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/couponService.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => "[project]/src/services/bookingService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/services/couponService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
}}),
"[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/services/bookingService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE1 => \"[project]/src/services/couponService.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE2 => \"[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)\", ACTIONS_MODULE3 => \"[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "4006e8ba16649f98d908108b2e66e3db796ea69c68": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["4006e8ba16649f98d908108b2e66e3db796ea69c68"]),
    "404a55478edc034a4c5e5045d6eca3eb88530c3630": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["404a55478edc034a4c5e5045d6eca3eb88530c3630"]),
    "408eb28e78660906ce6dabefafb029a0c856029d33": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["408eb28e78660906ce6dabefafb029a0c856029d33"]),
    "4097e3b6d26be9a6460352557de41c60a1b9a8a31d": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["4097e3b6d26be9a6460352557de41c60a1b9a8a31d"]),
    "409966a54d7b64e85efcfdaf60b9dc081d99628819": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["409966a54d7b64e85efcfdaf60b9dc081d99628819"]),
    "40e27282493dc0101cc37e2a3e7921ba309bfa8a54": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["40e27282493dc0101cc37e2a3e7921ba309bfa8a54"]),
    "6021360a88c359099ff28f4bd1463da3250e44a7ea": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["6021360a88c359099ff28f4bd1463da3250e44a7ea"]),
    "60cf603f51f57547a295812039ae2618b7620cb422": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["60cf603f51f57547a295812039ae2618b7620cb422"]),
    "60e1671d7cb1dc65a9e38bee9faba5e22c93ae4b99": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["60e1671d7cb1dc65a9e38bee9faba5e22c93ae4b99"]),
    "7042f9d68d96277d89a2284ba641903b616efa9e9e": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["7042f9d68d96277d89a2284ba641903b616efa9e9e"]),
    "783cf81384dd07b293ddd7dd28aa8db422f521713b": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["783cf81384dd07b293ddd7dd28aa8db422f521713b"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => "[project]/src/services/bookingService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/services/couponService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <module evaluation>');
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$check$2f5b$slug$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE1__$3d3e$__$225b$project$5d2f$src$2f$services$2f$couponService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE2__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$booking$2d$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29222c$__ACTIONS_MODULE3__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$create$2d$checkout$2d$session$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/check/[slug]/page/actions.js { ACTIONS_MODULE0 => "[project]/src/services/bookingService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE1 => "[project]/src/services/couponService.ts [app-rsc] (ecmascript)", ACTIONS_MODULE2 => "[project]/src/app/actions/booking-actions.ts [app-rsc] (ecmascript)", ACTIONS_MODULE3 => "[project]/src/app/actions/create-checkout-session.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <exports>');
}}),
"[project]/src/app/favicon.ico.mjs { IMAGE => \"[project]/src/app/favicon.ico (static in ecmascript)\" } [app-rsc] (structured image object, ecmascript, Next.js server component)": ((__turbopack_context__) => {

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/favicon.ico.mjs { IMAGE => \"[project]/src/app/favicon.ico (static in ecmascript)\" } [app-rsc] (structured image object, ecmascript)"));
}}),
"[project]/src/app/layout.tsx [app-rsc] (ecmascript, Next.js server component)": ((__turbopack_context__) => {

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/layout.tsx [app-rsc] (ecmascript)"));
}}),
"[project]/src/lib/utils.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "cn": (()=>cn)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-rsc] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
}}),
"[project]/src/components/ui/button.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Button": (()=>Button),
    "buttonVariants": (()=>buttonVariants)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-slot/dist/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-rsc] (ecmascript)");
;
;
;
;
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground",
            link: "text-primary underline-offset-4 hover:underline"
        },
        size: {
            default: "h-10 px-4 py-2",
            sm: "h-9 rounded-md px-3",
            lg: "h-11 rounded-md px-8",
            icon: "h-10 w-10"
        }
    },
    defaultVariants: {
        variant: "default",
        size: "default"
    }
});
const Button = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, variant, size, asChild = false, ...props }, ref)=>{
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Slot"] : "button";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])(buttonVariants({
            variant,
            size,
            className
        })),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/button.tsx",
        lineNumber: 46,
        columnNumber: 7
    }, this);
});
Button.displayName = "Button";
;
}}),
"[project]/src/components/ui/sheet.tsx (client reference/proxy) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Sheet": (()=>Sheet),
    "SheetClose": (()=>SheetClose),
    "SheetContent": (()=>SheetContent),
    "SheetDescription": (()=>SheetDescription),
    "SheetFooter": (()=>SheetFooter),
    "SheetHeader": (()=>SheetHeader),
    "SheetOverlay": (()=>SheetOverlay),
    "SheetPortal": (()=>SheetPortal),
    "SheetTitle": (()=>SheetTitle),
    "SheetTrigger": (()=>SheetTrigger)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const Sheet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Sheet() from the server but Sheet is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "Sheet");
const SheetClose = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetClose() from the server but SheetClose is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetClose");
const SheetContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetContent() from the server but SheetContent is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetContent");
const SheetDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetDescription() from the server but SheetDescription is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetDescription");
const SheetFooter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetFooter() from the server but SheetFooter is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetFooter");
const SheetHeader = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetHeader() from the server but SheetHeader is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetHeader");
const SheetOverlay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetOverlay() from the server but SheetOverlay is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetOverlay");
const SheetPortal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetPortal() from the server but SheetPortal is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetPortal");
const SheetTitle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetTitle() from the server but SheetTitle is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetTitle");
const SheetTrigger = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetTrigger() from the server but SheetTrigger is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx <module evaluation>", "SheetTrigger");
}}),
"[project]/src/components/ui/sheet.tsx (client reference/proxy)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Sheet": (()=>Sheet),
    "SheetClose": (()=>SheetClose),
    "SheetContent": (()=>SheetContent),
    "SheetDescription": (()=>SheetDescription),
    "SheetFooter": (()=>SheetFooter),
    "SheetHeader": (()=>SheetHeader),
    "SheetOverlay": (()=>SheetOverlay),
    "SheetPortal": (()=>SheetPortal),
    "SheetTitle": (()=>SheetTitle),
    "SheetTrigger": (()=>SheetTrigger)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const Sheet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Sheet() from the server but Sheet is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "Sheet");
const SheetClose = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetClose() from the server but SheetClose is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetClose");
const SheetContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetContent() from the server but SheetContent is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetContent");
const SheetDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetDescription() from the server but SheetDescription is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetDescription");
const SheetFooter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetFooter() from the server but SheetFooter is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetFooter");
const SheetHeader = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetHeader() from the server but SheetHeader is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetHeader");
const SheetOverlay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetOverlay() from the server but SheetOverlay is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetOverlay");
const SheetPortal = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetPortal() from the server but SheetPortal is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetPortal");
const SheetTitle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetTitle() from the server but SheetTitle is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetTitle");
const SheetTrigger = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SheetTrigger() from the server but SheetTrigger is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/sheet.tsx", "SheetTrigger");
}}),
"[project]/src/components/ui/sheet.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$28$client__reference$2f$proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/src/components/ui/sheet.tsx (client reference/proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$28$client__reference$2f$proxy$29$__ = __turbopack_context__.i("[project]/src/components/ui/sheet.tsx (client reference/proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$28$client__reference$2f$proxy$29$__);
}}),
"[project]/src/components/header.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Header": (()=>Header)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/sheet.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/menu.js [app-rsc] (ecmascript) <export default as Menu>"); // Adjusted icons
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/house.js [app-rsc] (ecmascript) <export default as Home>");
;
;
;
;
;
function Header() {
    // This header might become very minimal if each property page has its own navigation.
    // Or it could be a global header with links to properties, login, etc.
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
        className: "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "container flex h-16 items-center justify-between",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                    href: "/",
                    className: "flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                            xmlns: "http://www.w3.org/2000/svg",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: "2",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            className: "h-6 w-6 text-primary",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                    d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/header.tsx",
                                    lineNumber: 15,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                                    points: "9 22 9 12 15 12 15 22"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/header.tsx",
                                    lineNumber: 16,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/header.tsx",
                            lineNumber: 14,
                            columnNumber: 12
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-xl font-bold text-primary",
                            children: "RentalSpot"
                        }, void 0, false, {
                            fileName: "[project]/src/components/header.tsx",
                            lineNumber: 19,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/header.tsx",
                    lineNumber: 12,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                    className: "hidden items-center gap-6 md:flex",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            href: "/",
                            className: "text-sm font-medium text-foreground/70 transition-colors hover:text-foreground",
                            children: "Home"
                        }, void 0, false, {
                            fileName: "[project]/src/components/header.tsx",
                            lineNumber: 24,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            href: "/properties/prahova-mountain-chalet",
                            className: "text-sm font-medium text-foreground/70 transition-colors hover:text-foreground",
                            children: "Prahova Chalet"
                        }, void 0, false, {
                            fileName: "[project]/src/components/header.tsx",
                            lineNumber: 28,
                            columnNumber: 12
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            href: "/properties/coltei-apartment-bucharest",
                            className: "text-sm font-medium text-foreground/70 transition-colors hover:text-foreground",
                            children: "Coltei Apartment"
                        }, void 0, false, {
                            fileName: "[project]/src/components/header.tsx",
                            lineNumber: 31,
                            columnNumber: 12
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/header.tsx",
                    lineNumber: 23,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Sheet"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SheetTrigger"], {
                            asChild: true,
                            className: "md:hidden",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "outline",
                                size: "icon",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$menu$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Menu$3e$__["Menu"], {
                                        className: "h-5 w-5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/header.tsx",
                                        lineNumber: 50,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: "Toggle Menu"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/header.tsx",
                                        lineNumber: 51,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/header.tsx",
                                lineNumber: 49,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/header.tsx",
                            lineNumber: 48,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$sheet$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SheetContent"], {
                            side: "right",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/",
                                    className: "flex items-center gap-2 mb-8",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                            xmlns: "http://www.w3.org/2000/svg",
                                            viewBox: "0 0 24 24",
                                            fill: "none",
                                            stroke: "currentColor",
                                            strokeWidth: "2",
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            className: "h-6 w-6 text-primary",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                    d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/header.tsx",
                                                    lineNumber: 58,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                                                    points: "9 22 9 12 15 12 15 22"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/header.tsx",
                                                    lineNumber: 59,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/header.tsx",
                                            lineNumber: 57,
                                            columnNumber: 16
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-xl font-bold text-primary",
                                            children: "RentalSpot"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/header.tsx",
                                            lineNumber: 61,
                                            columnNumber: 16
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/header.tsx",
                                    lineNumber: 56,
                                    columnNumber: 14
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                                    className: "grid gap-6 text-lg font-medium",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/",
                                            className: "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"], {
                                                    className: "h-5 w-5"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/header.tsx",
                                                    lineNumber: 65,
                                                    columnNumber: 17
                                                }, this),
                                                "Home"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/header.tsx",
                                            lineNumber: 64,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/properties/prahova-mountain-chalet",
                                            className: "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                    xmlns: "http://www.w3.org/2000/svg",
                                                    width: "24",
                                                    height: "24",
                                                    viewBox: "0 0 24 24",
                                                    fill: "none",
                                                    stroke: "currentColor",
                                                    strokeWidth: "2",
                                                    strokeLinecap: "round",
                                                    strokeLinejoin: "round",
                                                    className: "h-5 w-5",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                            d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/header.tsx",
                                                            lineNumber: 70,
                                                            columnNumber: 216
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("polyline", {
                                                            points: "9 22 9 12 15 12 15 22"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/header.tsx",
                                                            lineNumber: 70,
                                                            columnNumber: 274
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/header.tsx",
                                                    lineNumber: 70,
                                                    columnNumber: 18
                                                }, this),
                                                "Prahova Chalet"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/header.tsx",
                                            lineNumber: 68,
                                            columnNumber: 16
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                            href: "/properties/coltei-apartment-bucharest",
                                            className: "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                                    xmlns: "http://www.w3.org/2000/svg",
                                                    width: "24",
                                                    height: "24",
                                                    viewBox: "0 0 24 24",
                                                    fill: "none",
                                                    stroke: "currentColor",
                                                    strokeWidth: "2",
                                                    strokeLinecap: "round",
                                                    strokeLinejoin: "round",
                                                    className: "h-5 w-5",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                            d: "M12 22a7 7 0 0 0 7-7c0-2-1-3-1-3l-4-4-4 4s-1 1-1 3a7 7 0 0 0 7 7Z"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/header.tsx",
                                                            lineNumber: 75,
                                                            columnNumber: 216
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                            d: "M10.76 14.55a.5.5 0 0 0 .74.71l1.09-1.04a.5.5 0 1 0-.7-.74l-1.04 1.09ZM12.5 16.5a.5.5 0 0 0 .5.5h.5a.5.5 0 0 0 .5-.5v-.5a.5.5 0 0 0-.5-.5h-.5a.5.5 0 0 0-.5.5Zm3.79-1.91a.5.5 0 0 0 .71-.7l-1.04-1.09a.5.5 0 1 0-.74.7l1.09 1.04Z"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/header.tsx",
                                                            lineNumber: 75,
                                                            columnNumber: 293
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/header.tsx",
                                                    lineNumber: 75,
                                                    columnNumber: 18
                                                }, this),
                                                "Coltei Apartment"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/header.tsx",
                                            lineNumber: 73,
                                            columnNumber: 16
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/header.tsx",
                                    lineNumber: 63,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/header.tsx",
                            lineNumber: 54,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/header.tsx",
                    lineNumber: 47,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/header.tsx",
            lineNumber: 11,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/header.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, this);
}
}}),
"[project]/src/components/booking/availability-check.tsx (client reference/proxy) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "AvailabilityCheck": (()=>AvailabilityCheck)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const AvailabilityCheck = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AvailabilityCheck() from the server but AvailabilityCheck is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/booking/availability-check.tsx <module evaluation>", "AvailabilityCheck");
}}),
"[project]/src/components/booking/availability-check.tsx (client reference/proxy)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "AvailabilityCheck": (()=>AvailabilityCheck)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const AvailabilityCheck = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AvailabilityCheck() from the server but AvailabilityCheck is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/booking/availability-check.tsx", "AvailabilityCheck");
}}),
"[project]/src/components/booking/availability-check.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$availability$2d$check$2e$tsx__$28$client__reference$2f$proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/src/components/booking/availability-check.tsx (client reference/proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$availability$2d$check$2e$tsx__$28$client__reference$2f$proxy$29$__ = __turbopack_context__.i("[project]/src/components/booking/availability-check.tsx (client reference/proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$availability$2d$check$2e$tsx__$28$client__reference$2f$proxy$29$__);
}}),
"[project]/src/components/footer.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Footer": (()=>Footer)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-rsc] (ecmascript)");
;
;
function Footer() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
        className: "border-t bg-muted/50",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "container py-8 text-center text-sm text-muted-foreground md:flex md:items-center md:justify-between md:py-10",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: [
                        "© ",
                        new Date().getFullYear(),
                        " RentalSpot. All rights reserved."
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/footer.tsx",
                    lineNumber: 8,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                    className: "mt-4 flex justify-center gap-4 md:mt-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            href: "/",
                            className: "hover:text-foreground",
                            children: "Home"
                        }, void 0, false, {
                            fileName: "[project]/src/components/footer.tsx",
                            lineNumber: 10,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                            href: "#contact",
                            className: "hover:text-foreground",
                            children: [
                                " ",
                                "Contact"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/footer.tsx",
                            lineNumber: 20,
                            columnNumber: 12
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/footer.tsx",
                    lineNumber: 9,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/footer.tsx",
            lineNumber: 7,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/footer.tsx",
        lineNumber: 6,
        columnNumber: 5
    }, this);
}
}}),
"[project]/src/components/booking/initial-booking-form.tsx (client reference/proxy) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "InitialBookingForm": (()=>InitialBookingForm)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const InitialBookingForm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call InitialBookingForm() from the server but InitialBookingForm is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/booking/initial-booking-form.tsx <module evaluation>", "InitialBookingForm");
}}),
"[project]/src/components/booking/initial-booking-form.tsx (client reference/proxy)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "InitialBookingForm": (()=>InitialBookingForm)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const InitialBookingForm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call InitialBookingForm() from the server but InitialBookingForm is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/booking/initial-booking-form.tsx", "InitialBookingForm");
}}),
"[project]/src/components/booking/initial-booking-form.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$initial$2d$booking$2d$form$2e$tsx__$28$client__reference$2f$proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/src/components/booking/initial-booking-form.tsx (client reference/proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$initial$2d$booking$2d$form$2e$tsx__$28$client__reference$2f$proxy$29$__ = __turbopack_context__.i("[project]/src/components/booking/initial-booking-form.tsx (client reference/proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$initial$2d$booking$2d$form$2e$tsx__$28$client__reference$2f$proxy$29$__);
}}),
"[project]/src/components/ui/card.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Card": (()=>Card),
    "CardContent": (()=>CardContent),
    "CardDescription": (()=>CardDescription),
    "CardFooter": (()=>CardFooter),
    "CardHeader": (()=>CardHeader),
    "CardTitle": (()=>CardTitle)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-rsc] (ecmascript)");
;
;
;
const Card = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("rounded-lg border bg-card text-card-foreground shadow-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 9,
        columnNumber: 3
    }, this));
Card.displayName = "Card";
const CardHeader = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("flex flex-col space-y-1.5 p-6", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 24,
        columnNumber: 3
    }, this));
CardHeader.displayName = "CardHeader";
const CardTitle = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("text-2xl font-semibold leading-none tracking-tight", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 36,
        columnNumber: 3
    }, this));
CardTitle.displayName = "CardTitle";
const CardDescription = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("text-sm text-muted-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 51,
        columnNumber: 3
    }, this));
CardDescription.displayName = "CardDescription";
const CardContent = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("p-6 pt-0", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 63,
        columnNumber: 3
    }, this));
CardContent.displayName = "CardContent";
const CardFooter = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("flex items-center p-6 pt-0", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 71,
        columnNumber: 3
    }, this));
CardFooter.displayName = "CardFooter";
;
}}),
"[project]/src/components/ui/separator.tsx (client reference/proxy) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Separator": (()=>Separator)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const Separator = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Separator() from the server but Separator is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/separator.tsx <module evaluation>", "Separator");
}}),
"[project]/src/components/ui/separator.tsx (client reference/proxy)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "Separator": (()=>Separator)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const Separator = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call Separator() from the server but Separator is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/ui/separator.tsx", "Separator");
}}),
"[project]/src/components/ui/separator.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$28$client__reference$2f$proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/src/components/ui/separator.tsx (client reference/proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$28$client__reference$2f$proxy$29$__ = __turbopack_context__.i("[project]/src/components/ui/separator.tsx (client reference/proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$28$client__reference$2f$proxy$29$__);
}}),
"[project]/src/components/property/property-page-layout.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
// src/components/property/property-page-layout.tsx
__turbopack_context__.s({
    "PropertyPageLayout": (()=>PropertyPageLayout)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$header$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/header.tsx [app-rsc] (ecmascript)"); // Use the generic header
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$footer$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/footer.tsx [app-rsc] (ecmascript)"); // Use the generic footer
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$initial$2d$booking$2d$form$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/booking/initial-booking-form.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/card.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/separator.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bed$2d$double$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__BedDouble$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bed-double.js [app-rsc] (ecmascript) <export default as BedDouble>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bath$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Bath$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bath.js [app-rsc] (ecmascript) <export default as Bath>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/users.js [app-rsc] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi.js [app-rsc] (ecmascript) <export default as Wifi>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$parking$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ParkingCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-parking.js [app-rsc] (ecmascript) <export default as ParkingCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$tv$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Tv$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/tv.js [app-rsc] (ecmascript) <export default as Tv>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$utensils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Utensils$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/utensils.js [app-rsc] (ecmascript) <export default as Utensils>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clock.js [app-rsc] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check-big.js [app-rsc] (ecmascript) <export default as CheckCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/map-pin.js [app-rsc] (ecmascript) <export default as MapPin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/house.js [app-rsc] (ecmascript) <export default as Home>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mountain$2d$snow$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__MountainSnow$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/mountain-snow.js [app-rsc] (ecmascript) <export default as MountainSnow>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trees$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Trees$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trees.js [app-rsc] (ecmascript) <export default as Trees>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$checks$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ListChecks$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/list-checks.js [app-rsc] (ecmascript) <export default as ListChecks>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wind$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Wind$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wind.js [app-rsc] (ecmascript) <export default as Wind>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Building$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/building.js [app-rsc] (ecmascript) <export default as Building>");
;
;
;
;
;
;
;
;
;
function PropertyPageLayout({ property }) {
    const featuredImage = property.images?.find((img)=>img.isFeatured) || property.images?.[0];
    const galleryImages = property.images?.filter((img)=>!img.isFeatured) || [];
    // Generic mapping for common amenities
    const amenityIcons = {
        wifi: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 26,
            columnNumber: 11
        }, this),
        kitchen: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$utensils$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Utensils$3e$__["Utensils"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 27,
            columnNumber: 14
        }, this),
        parking: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$parking$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ParkingCircle$3e$__["ParkingCircle"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 28,
            columnNumber: 14
        }, this),
        tv: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$tv$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Tv$3e$__["Tv"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 29,
            columnNumber: 9
        }, this),
        fireplace: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 30,
            columnNumber: 16
        }, this),
        'mountain view': /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mountain$2d$snow$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__MountainSnow$3e$__["MountainSnow"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 31,
            columnNumber: 22
        }, this),
        garden: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trees$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Trees$3e$__["Trees"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 32,
            columnNumber: 13
        }, this),
        'air conditioning': /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wind$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Wind$3e$__["Wind"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 33,
            columnNumber: 25
        }, this),
        'washer/dryer': /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__["CheckCircle"], {
            className: "h-4 w-4 mr-1 text-primary"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 34,
            columnNumber: 21
        }, this),
        elevator: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Building$3e$__["Building"], {
            className: "h-4 w-4 mr-1"
        }, void 0, false, {
            fileName: "[project]/src/components/property/property-page-layout.tsx",
            lineNumber: 35,
            columnNumber: 15
        }, this)
    };
    const houseRules = property.houseRules || []; // Ensure houseRules is an array
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-h-screen flex-col bg-background",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$header$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Header"], {}, void 0, false, {
                fileName: "[project]/src/components/property/property-page-layout.tsx",
                lineNumber: 43,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "relative h-[60vh] md:h-[70vh] w-full",
                children: [
                    featuredImage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                        src: featuredImage.url,
                        alt: featuredImage.alt || `Featured image of ${property.name}`,
                        fill: true,
                        style: {
                            objectFit: "cover"
                        },
                        priority: true,
                        className: "brightness-75" // Add slight dimming
                        ,
                        "data-ai-hint": featuredImage['data-ai-hint']
                    }, void 0, false, {
                        fileName: "[project]/src/components/property/property-page-layout.tsx",
                        lineNumber: 48,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-muted flex items-center justify-center",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"], {
                            className: "h-24 w-24 text-muted-foreground/30"
                        }, void 0, false, {
                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                            lineNumber: 59,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/property/property-page-layout.tsx",
                        lineNumber: 58,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 flex items-center justify-center",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Card"], {
                            className: "w-full max-w-md bg-background/90 backdrop-blur-sm shadow-xl border-border p-4 md:p-6 mx-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CardHeader"], {
                                    className: "p-0 mb-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CardTitle"], {
                                            className: "text-xl text-center mb-1",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-2xl font-bold text-foreground",
                                                    children: [
                                                        "$",
                                                        property.pricePerNight
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 66,
                                                    columnNumber: 17
                                                }, this),
                                                " / night"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 65,
                                            columnNumber: 15
                                        }, this),
                                        property.ratings && property.ratings.count > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-sm text-muted-foreground text-center",
                                            children: [
                                                "⭐ ",
                                                property.ratings.average.toFixed(1),
                                                " (",
                                                property.ratings.count,
                                                " reviews)"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 69,
                                            columnNumber: 18
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 64,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CardContent"], {
                                    className: "p-0",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$initial$2d$booking$2d$form$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InitialBookingForm"], {
                                        property: property
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/property/property-page-layout.tsx",
                                        lineNumber: 75,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 74,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                            lineNumber: 63,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/property/property-page-layout.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/property/property-page-layout.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "flex-grow container py-12 md:py-16",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col lg:flex-row gap-8 lg:gap-12",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "lg:w-2/3 space-y-8",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                            className: "text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2",
                                            children: property.name
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 89,
                                            columnNumber: 17
                                        }, this),
                                        property.location && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center text-muted-foreground mb-6",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__["MapPin"], {
                                                    className: "h-4 w-4 mr-1 text-primary"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 94,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        property.location.city,
                                                        ", ",
                                                        property.location.state,
                                                        ", ",
                                                        property.location.country
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 95,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 93,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 88,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "prose max-w-none dark:prose-invert text-foreground/90",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-2xl font-semibold mb-3 text-foreground",
                                            children: "About this property"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 102,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            children: property.description
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 103,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 101,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 106,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-xl font-semibold mb-4 text-foreground",
                                            children: "Key Features"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 110,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"], {
                                                            className: "h-4 w-4 mr-2 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 112,
                                                            columnNumber: 52
                                                        }, this),
                                                        " Max ",
                                                        property.maxGuests,
                                                        " Guests"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 112,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bed$2d$double$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__BedDouble$3e$__["BedDouble"], {
                                                            className: "h-4 w-4 mr-2 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 113,
                                                            columnNumber: 52
                                                        }, this),
                                                        " ",
                                                        property.bedrooms,
                                                        " Bedrooms"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 113,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bed$2d$double$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__BedDouble$3e$__["BedDouble"], {
                                                            className: "h-4 w-4 mr-2 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 114,
                                                            columnNumber: 52
                                                        }, this),
                                                        " ",
                                                        property.beds,
                                                        " Beds"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 114,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bath$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Bath$3e$__["Bath"], {
                                                            className: "h-4 w-4 mr-2 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 115,
                                                            columnNumber: 52
                                                        }, this),
                                                        " ",
                                                        property.bathrooms,
                                                        " Bathrooms"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 115,
                                                    columnNumber: 17
                                                }, this),
                                                property.squareFeet && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"], {
                                                            className: "h-4 w-4 mr-2 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 116,
                                                            columnNumber: 77
                                                        }, this),
                                                        " ",
                                                        property.squareFeet,
                                                        " sqm"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 116,
                                                    columnNumber: 42
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 111,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 109,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 120,
                                    columnNumber: 13
                                }, this),
                                property.amenities && property.amenities.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-xl font-semibold mb-4 text-foreground",
                                            children: "Amenities"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 125,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                            className: "grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm list-none pl-0",
                                            children: property.amenities.map((amenity)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                    className: "flex items-center",
                                                    children: [
                                                        amenityIcons[amenity.toLowerCase()] || /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__["CheckCircle"], {
                                                            className: "h-4 w-4 mr-1 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 129,
                                                            columnNumber: 63
                                                        }, this),
                                                        amenity
                                                    ]
                                                }, amenity, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 128,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 126,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 124,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 137,
                                    columnNumber: 13
                                }, this),
                                houseRules.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    id: "house-rules",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-xl font-semibold mb-4 text-foreground flex items-center",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$list$2d$checks$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__ListChecks$3e$__["ListChecks"], {
                                                    className: "h-5 w-5 mr-2 text-primary"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 143,
                                                    columnNumber: 19
                                                }, this),
                                                " House Rules"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 142,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                            className: "list-none pl-0 space-y-2 text-sm",
                                            children: houseRules.map((rule, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                    className: "flex items-center",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__["CheckCircle"], {
                                                            className: "h-4 w-4 mr-2 text-primary shrink-0"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 148,
                                                            columnNumber: 23
                                                        }, this),
                                                        rule
                                                    ]
                                                }, index, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 147,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 145,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 141,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 156,
                                    columnNumber: 14
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-xl font-semibold mb-3 text-foreground",
                                            children: "Check-in / Check-out"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 160,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex gap-4 text-sm",
                                            children: [
                                                property.checkInTime && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: [
                                                        " ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                                            className: "h-4 w-4 mr-1 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 162,
                                                            columnNumber: 79
                                                        }, this),
                                                        "Check-in: ",
                                                        property.checkInTime
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 162,
                                                    columnNumber: 43
                                                }, this),
                                                property.checkOutTime && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: [
                                                        " ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                                            className: "h-4 w-4 mr-1 text-primary"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                            lineNumber: 163,
                                                            columnNumber: 80
                                                        }, this),
                                                        "Check-out: ",
                                                        property.checkOutTime
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 163,
                                                    columnNumber: 44
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 161,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 159,
                                    columnNumber: 13
                                }, this),
                                property.cancellationPolicy && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 170,
                                            columnNumber: 20
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "text-xl font-semibold mb-3 text-foreground",
                                                    children: "Cancellation Policy"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 172,
                                                    columnNumber: 22
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-muted-foreground",
                                                    children: property.cancellationPolicy
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                    lineNumber: 173,
                                                    columnNumber: 22
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 171,
                                            columnNumber: 20
                                        }, this)
                                    ]
                                }, void 0, true),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 179,
                                    columnNumber: 14
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    id: "location",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-xl font-semibold mb-4 text-foreground",
                                            children: "Location"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 181,
                                            columnNumber: 18
                                        }, this),
                                        property.location && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-muted-foreground mb-4",
                                            children: [
                                                "Located in ",
                                                property.location.city,
                                                ", ",
                                                property.location.state,
                                                ". Exact address provided after booking."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 183,
                                            columnNumber: 22
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "aspect-video bg-muted rounded-lg flex items-center justify-center",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__["MapPin"], {
                                                className: "h-12 w-12 text-muted-foreground/50"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/property/property-page-layout.tsx",
                                                lineNumber: 189,
                                                columnNumber: 22
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 188,
                                            columnNumber: 18
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 180,
                                    columnNumber: 14
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$separator$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Separator"], {}, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 194,
                                    columnNumber: 14
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    id: "contact",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                            className: "text-xl font-semibold mb-4 text-foreground",
                                            children: "Contact Host"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 196,
                                            columnNumber: 18
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-muted-foreground mb-4",
                                            children: "Have questions? Reach out to the property owner."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 197,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Button"], {
                                            variant: "outline",
                                            children: "Contact Owner"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 201,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 195,
                                    columnNumber: 14
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                            lineNumber: 86,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "lg:w-1/3 space-y-4 lg:sticky lg:top-24 lg:self-start",
                            id: "gallery",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-2xl font-semibold text-foreground mb-4",
                                    children: "Gallery"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 207,
                                    columnNumber: 13
                                }, this),
                                galleryImages.length > 0 ? galleryImages.map((image, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                            src: image.url,
                                            alt: image.alt || `Gallery image ${index + 1} of ${property.name}`,
                                            fill: true,
                                            style: {
                                                objectFit: "cover"
                                            },
                                            "data-ai-hint": image['data-ai-hint']
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                                            lineNumber: 211,
                                            columnNumber: 21
                                        }, this)
                                    }, index, false, {
                                        fileName: "[project]/src/components/property/property-page-layout.tsx",
                                        lineNumber: 210,
                                        columnNumber: 18
                                    }, this)) : // Show featured image if no other gallery images exist
                                featuredImage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                        src: featuredImage.url,
                                        alt: featuredImage.alt || `Featured image of ${property.name}`,
                                        fill: true,
                                        style: {
                                            objectFit: "cover"
                                        },
                                        "data-ai-hint": featuredImage['data-ai-hint']
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/property/property-page-layout.tsx",
                                        lineNumber: 224,
                                        columnNumber: 26
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 223,
                                    columnNumber: 21
                                }, this),
                                !featuredImage && galleryImages.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md bg-muted flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"], {
                                        className: "h-12 w-12 text-muted-foreground/50"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/property/property-page-layout.tsx",
                                        lineNumber: 237,
                                        columnNumber: 22
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                                    lineNumber: 236,
                                    columnNumber: 18
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/property/property-page-layout.tsx",
                            lineNumber: 206,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/property/property-page-layout.tsx",
                    lineNumber: 83,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/property/property-page-layout.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$footer$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Footer"], {}, void 0, false, {
                fileName: "[project]/src/components/property/property-page-layout.tsx",
                lineNumber: 245,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/property/property-page-layout.tsx",
        lineNumber: 41,
        columnNumber: 5
    }, this);
}
}}),
"[project]/src/app/properties/[slug]/page.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
// src/app/properties/[slug]/page.tsx
__turbopack_context__.s({
    "default": (()=>PropertyDetailsPage),
    "generateStaticParams": (()=>generateStaticParams),
    "getPropertyBySlug": (()=>getPropertyBySlug)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
// Removed Prahova and Coltei specific layouts
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$property$2f$property$2d$page$2d$layout$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/property/property-page-layout.tsx [app-rsc] (ecmascript)"); // Import the new generic layout
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-rsc] (ecmascript)"); // Import db for data fetching
;
;
;
;
;
async function getPropertyBySlug(slug) {
    try {
        // **** Use Client SDK ****
        const propertiesCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'properties');
        const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["query"])(propertiesCollection, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["where"])('slug', '==', slug));
        const querySnapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(q);
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();
            // Function to safely convert Firestore Timestamps or objects to Dates
            const convertToDate = (timestamp)=>{
                if (!timestamp) return undefined;
                if (timestamp instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"]) {
                    return timestamp.toDate();
                } else if (timestamp && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
                    // Handle Firestore Timestamp-like objects from JSON/serialization
                    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"](timestamp.seconds, timestamp.nanoseconds).toDate();
                } else if (typeof timestamp === 'string') {
                    // Handle ISO strings
                    try {
                        return new Date(timestamp);
                    } catch  {
                        return undefined;
                    }
                } else if (typeof timestamp === 'number') {
                    // Assuming milliseconds since epoch
                    try {
                        return new Date(timestamp);
                    } catch  {
                        return undefined;
                    }
                }
                return undefined;
            };
            // Convert relevant fields
            const propertyData = {
                id: doc.id,
                ...data,
                // Ensure timestamps are converted to Dates or stay as undefined/null
                createdAt: convertToDate(data.createdAt),
                updatedAt: convertToDate(data.updatedAt),
                // Ensure arrays are always present even if missing in Firestore
                images: Array.isArray(data.images) ? data.images : [],
                amenities: Array.isArray(data.amenities) ? data.amenities : [],
                houseRules: Array.isArray(data.houseRules) ? data.houseRules : [],
                // Explicitly cast potentially missing nested objects to ensure type safety
                location: data.location || {},
                ratings: data.ratings || {
                    average: 0,
                    count: 0
                }
            };
            // Ensure nested location coordinates exist
            if (propertyData.location && !propertyData.location.coordinates) {
                propertyData.location.coordinates = {
                    latitude: 0,
                    longitude: 0
                }; // Default coordinates if missing
            }
            return propertyData;
        } else {
            console.warn(`[getPropertyBySlug] Property with slug '${slug}' not found.`);
            return undefined;
        }
    } catch (error) {
        console.error(`❌ Error fetching property with slug ${slug}:`, error);
        return undefined;
    }
}
async function generateStaticParams() {
    try {
        // **** Use Client SDK ****
        const propertiesCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'properties');
        const snapshot = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(propertiesCollection);
        if (snapshot.empty) {
            console.warn("[generateStaticParams] No properties found in Firestore to generate static params.");
            return [];
        }
        const params = snapshot.docs.map((doc)=>({
                slug: doc.data().slug
            })).filter((param)=>typeof param.slug === 'string' && param.slug.length > 0); // Ensure slug is a non-empty string
        console.log(`[generateStaticParams] Generated ${params.length} params:`, params);
        return params;
    } catch (error) {
        console.error("❌ Error fetching properties for generateStaticParams:", error);
        return [];
    }
}
async function PropertyDetailsPage({ params }) {
    // Await the params before accessing slug
    const awaitedParams = params;
    const slug = awaitedParams.slug;
    if (!slug) {
        console.error("[PropertyDetailsPage] Slug is missing from params.");
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    console.log(`[PropertyDetailsPage] Rendering page for slug: ${slug}`);
    // Fetch property data using the slug
    const property = await getPropertyBySlug(slug);
    if (!property) {
        console.warn(`[PropertyDetailsPage] Property not found for slug: ${slug}`);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    console.log(`[PropertyDetailsPage] Property loaded from Firestore: ${property.name} (ID: ${property.id})`);
    // Use the generic PropertyPageLayout for all properties
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$property$2f$property$2d$page$2d$layout$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PropertyPageLayout"], {
        property: property
    }, void 0, false, {
        fileName: "[project]/src/app/properties/[slug]/page.tsx",
        lineNumber: 129,
        columnNumber: 10
    }, this);
}
}}),
"[project]/src/app/booking/check/[slug]/page.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
// src/app/booking/check/[slug]/page.tsx
__turbopack_context__.s({
    "default": (()=>AvailabilityCheckPage),
    "generateMetadata": (()=>generateMetadata)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$header$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/header.tsx [app-rsc] (ecmascript)"); // Assuming a generic header
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$availability$2d$check$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/booking/availability-check.tsx [app-rsc] (ecmascript)"); // Import the new component
// Correct import path: Import directly from the file where it's defined
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$properties$2f5b$slug$5d2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/properties/[slug]/page.tsx [app-rsc] (ecmascript)");
;
;
;
;
;
;
async function generateMetadata({ params }) {
    const property = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$properties$2f5b$slug$5d2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPropertyBySlug"])(params.slug);
    if (!property) {
        return {
            title: 'Availability Check - Not Found'
        };
    }
    return {
        title: `Check Availability - ${property.name}`,
        description: `Check booking availability for ${property.name} for your selected dates.`
    };
}
async function AvailabilityCheckPage({ params, searchParams }) {
    const property = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$properties$2f5b$slug$5d2f$page$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPropertyBySlug"])(params.slug);
    if (!property) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])(); // Property slug is invalid
    }
    // Basic validation for search params (only dates now)
    // Accessing searchParams directly is the standard pattern in page components
    const checkIn = searchParams.checkIn;
    const checkOut = searchParams.checkOut;
    if (!checkIn || !checkOut) {
        // Handle invalid search params, maybe redirect back or show an error
        // For now, we can let the AvailabilityCheck component handle it,
        // or redirect: redirect(`/properties/${params.slug}`);
        console.warn("[AvailabilityCheckPage] Invalid search parameters received:", searchParams);
    // Consider rendering an error state within AvailabilityCheck instead of redirecting immediately
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-h-screen flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$header$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Header"], {}, void 0, false, {
                fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
                lineNumber: 57,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "flex-grow container py-12 md:py-16",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Suspense"], {
                    fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "Loading availability..."
                    }, void 0, false, {
                        fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
                        lineNumber: 61,
                        columnNumber: 29
                    }, void 0),
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$booking$2f$availability$2d$check$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AvailabilityCheck"], {
                        property: property,
                        initialCheckIn: checkIn,
                        initialCheckOut: checkOut
                    }, void 0, false, {
                        fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
                        lineNumber: 62,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
                    lineNumber: 61,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
                className: "border-t bg-muted/50",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "container py-4 text-center text-xs text-muted-foreground",
                    children: [
                        "RentalSpot © ",
                        new Date().getFullYear()
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
                    lineNumber: 72,
                    columnNumber: 10
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
                lineNumber: 71,
                columnNumber: 8
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/booking/check/[slug]/page.tsx",
        lineNumber: 56,
        columnNumber: 5
    }, this);
}
}}),
"[project]/src/app/booking/check/[slug]/page.tsx [app-rsc] (ecmascript, Next.js server component)": ((__turbopack_context__) => {

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/booking/check/[slug]/page.tsx [app-rsc] (ecmascript)"));
}}),

};

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__b83ea882._.js.map