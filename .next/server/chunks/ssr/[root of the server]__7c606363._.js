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
/* __next_internal_action_entry_do_not_use__ {"4006e8ba16649f98d908108b2e66e3db796ea69c68":"createBooking","404a55478edc034a4c5e5045d6eca3eb88530c3630":"getBookingsForUser","409966a54d7b64e85efcfdaf60b9dc081d99628819":"getBookingById","40e27282493dc0101cc37e2a3e7921ba309bfa8a54":"getBookingsForProperty","6021360a88c359099ff28f4bd1463da3250e44a7ea":"getUnavailableDatesForProperty","60cf603f51f57547a295812039ae2618b7620cb422":"updateBookingStatus","783cf81384dd07b293ddd7dd28aa8db422f521713b":"updatePropertyAvailability"} */ __turbopack_context__.s({
    "createBooking": (()=>createBooking),
    "getBookingById": (()=>getBookingById),
    "getBookingsForProperty": (()=>getBookingsForProperty),
    "getBookingsForUser": (()=>getBookingsForUser),
    "getUnavailableDatesForProperty": (()=>getUnavailableDatesForProperty),
    "updateBookingStatus": (()=>updateBookingStatus),
    "updatePropertyAvailability": (()=>updatePropertyAvailability)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$app$2d$render$2f$encryption$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/app-render/encryption.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zod/lib/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-rsc] (ecmascript)"); // **** Use Client SDK Firestore instance ****
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/eachDayOfInterval.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/date-fns/format.mjs [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/date-fns/subDays.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/booking-sync.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
// Define Zod schema for validation - Updated pricing schema
const CreateBookingDataSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    propertyId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1, {
        message: 'Property ID is required.'
    }),
    guestInfo: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        firstName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1, {
            message: 'Guest first name is required.'
        }),
        lastName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        email: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().email({
            message: 'Invalid guest email address.'
        }),
        phone: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        address: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        city: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        state: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        country: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        zipCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
        userId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional()
    }).passthrough(),
    // Accept ISO string dates for validation
    checkInDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().refine((val)=>!isNaN(Date.parse(val)), {
        message: 'Invalid check-in date format.'
    }),
    checkOutDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().refine((val)=>!isNaN(Date.parse(val)), {
        message: 'Invalid check-out date format.'
    }),
    numberOfGuests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().positive({
        message: 'Number of guests must be positive.'
    }),
    pricing: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        baseRate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Base rate cannot be negative.'
        }),
        numberOfNights: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().positive({
            message: 'Number of nights must be positive.'
        }),
        cleaningFee: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Cleaning fee cannot be negative.'
        }),
        extraGuestFee: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Extra guest fee cannot be negative.'
        }).optional(),
        numberOfExtraGuests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().int().nonnegative({
            message: 'Number of extra guests cannot be negative.'
        }).optional(),
        accommodationTotal: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Accommodation total cannot be negative.'
        }),
        subtotal: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Subtotal cannot be negative.'
        }),
        taxes: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Taxes cannot be negative.'
        }).optional(),
        discountAmount: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Discount amount cannot be negative.'
        }).optional(),
        total: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Total price cannot be negative.'
        })
    }).passthrough(),
    appliedCouponCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].enum([
        'pending',
        'confirmed',
        'cancelled',
        'completed'
    ]).optional(),
    paymentInput: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        stripePaymentIntentId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1, {
            message: 'Stripe Payment Intent ID is required.'
        }),
        amount: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number().nonnegative({
            message: 'Payment amount cannot be negative.'
        }),
        status: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1, {
            message: 'Payment status is required.'
        })
    }).passthrough(),
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
    // Allow for small floating point differences (e.g., $0.01)
    return Math.abs(calculatedTotal - data.pricing.total) < 0.01;
}, {
    message: 'Calculated total does not match provided total price.',
    path: [
        'pricing.total'
    ]
});
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ createBooking(rawBookingData) {
    const paymentIntentId = rawBookingData?.paymentInput?.stripePaymentIntentId || 'N/A';
    console.log(`--- [createBooking] Function called ---`);
    console.log(`[createBooking] Received raw data for Payment Intent [${paymentIntentId}]`);
    let bookingData;
    // Zod Validation
    console.log(`[createBooking] Starting Zod validation for Payment Intent [${paymentIntentId}]...`);
    const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
    if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map((e)=>`${e.path.join('.')}: ${e.message}`).join(', ');
        const validationError = new Error(`Invalid booking data: ${errorMessages}`);
        console.error(`❌ [createBooking] Validation Error for Payment Intent [${paymentIntentId}]:`, validationError.message);
        throw validationError;
    }
    bookingData = validationResult.data;
    console.log(`[createBooking] Data passed validation for Payment Intent [${paymentIntentId}]`);
    try {
        console.log(`[createBooking] Entered main try block for Payment Intent [${paymentIntentId}]`);
        const bookingsCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'bookings'); // Use Client SDK 'db' for booking creation
        // Data Transformation
        console.log(`[createBooking] Transforming data for Firestore for Payment Intent [${paymentIntentId}]...`);
        const checkInDate = new Date(bookingData.checkInDate); // Parse ISO string
        const checkOutDate = new Date(bookingData.checkOutDate); // Parse ISO string
        const checkInTimestamp = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(checkInDate); // Use Client Timestamp
        const checkOutTimestamp = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].fromDate(checkOutDate); // Use Client Timestamp
        const paymentInfo = {
            stripePaymentIntentId: bookingData.paymentInput.stripePaymentIntentId,
            amount: bookingData.paymentInput.amount,
            status: bookingData.paymentInput.status,
            paidAt: bookingData.paymentInput.status === 'succeeded' || bookingData.paymentInput.status === 'paid' ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Timestamp"].now() // Use Client Timestamp
             : null
        };
        // Remove paymentInput before creating the main docData
        const { paymentInput, ...restOfBookingData } = bookingData;
        // Construct the final booking document data, including the updated pricing structure
        const docData = {
            ...restOfBookingData,
            checkInDate: checkInTimestamp,
            checkOutDate: checkOutTimestamp,
            pricing: {
                baseRate: restOfBookingData.pricing.baseRate,
                numberOfNights: restOfBookingData.pricing.numberOfNights,
                cleaningFee: restOfBookingData.pricing.cleaningFee,
                extraGuestFee: restOfBookingData.pricing.extraGuestFee,
                numberOfExtraGuests: restOfBookingData.pricing.numberOfExtraGuests,
                accommodationTotal: restOfBookingData.pricing.accommodationTotal,
                subtotal: restOfBookingData.pricing.subtotal,
                taxes: restOfBookingData.pricing.taxes ?? 0,
                discountAmount: restOfBookingData.pricing.discountAmount,
                total: restOfBookingData.pricing.total
            },
            appliedCouponCode: restOfBookingData.appliedCouponCode,
            paymentInfo: paymentInfo,
            createdAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
            updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])(),
            status: restOfBookingData.status || 'confirmed'
        };
        // Log the prepared data for debugging
        console.log(`[createBooking] Firestore Doc Data Prepared for Payment Intent [${paymentIntentId}]:`, JSON.stringify({
            ...docData,
            checkInDate: `Timestamp(${checkInDate.toISOString()})`,
            checkOutDate: `Timestamp(${checkOutDate.toISOString()})`,
            paidAt: docData.paymentInfo.paidAt ? `Timestamp(${docData.paymentInfo.paidAt.toDate().toISOString()})` : null,
            createdAt: 'ServerTimestamp',
            updatedAt: 'ServerTimestamp'
        }, null, 2));
        // Firestore Operation (Client SDK)
        console.log(`[createBooking] Attempting to add booking document to Firestore (Client SDK) for Payment Intent [${paymentIntentId}]...`);
        const docRef = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["addDoc"])(bookingsCollection, docData);
        const bookingId = docRef.id;
        console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId} for Payment Intent [${paymentIntentId}]`);
        // --- Update Property Availability (Client SDK) ---
        console.log(`[createBooking] Triggering local availability update (Client SDK) for property ${bookingData.propertyId}, booking ${bookingId}`);
        try {
            await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false); // Using Client SDK function
            console.log(`✅ [createBooking] Successfully finished update call for local availability (Client SDK) for property ${bookingData.propertyId}, booking ${bookingId}.`);
        } catch (availabilityError) {
            console.error(`❌ [createBooking] Failed to update local availability (Client SDK) for property ${bookingData.propertyId} after creating booking ${bookingId}:`, availabilityError);
            // Decide if this should block the entire process or just log a warning
            // Re-throwing the error might be safer if availability is critical
            throw availabilityError; // Re-throw to indicate the overall process partially failed
        }
        // --- Synchronize Availability with External Platforms ---
        console.log(`[createBooking] Starting external platform sync for property ${bookingData.propertyId}, booking ${bookingId}...`);
        try {
            const propertyDetails = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPropertyForSync"])(bookingData.propertyId);
            if (propertyDetails) {
                if (propertyDetails.airbnbListingId) {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateAirbnbListingAvailability"])(propertyDetails.airbnbListingId, false, checkInDate, checkOutDate);
                    console.log(`[createBooking Sync] Initiated Airbnb availability update for listing ${propertyDetails.airbnbListingId}.`);
                } else {
                    console.log(`[createBooking Sync] No Airbnb Listing ID found for property ${bookingData.propertyId}. Skipping Airbnb sync.`);
                }
                if (propertyDetails.bookingComListingId) {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBookingComListingAvailability"])(propertyDetails.bookingComListingId, false, checkInDate, checkOutDate);
                    console.log(`[createBooking Sync] Initiated Booking.com availability update for listing ${propertyDetails.bookingComListingId}.`);
                } else {
                    console.log(`[createBooking Sync] No Booking.com Listing ID found for property ${bookingData.propertyId}. Skipping Booking.com sync.`);
                }
            } else {
                console.warn(`[createBooking Sync] Could not retrieve property details for ${bookingData.propertyId} to perform external sync.`);
            }
        } catch (syncError) {
            console.error(`❌ [createBooking Sync] Error synchronizing availability with external platforms for property ${bookingData.propertyId} after creating booking ${bookingId}:`, syncError);
        // Log this but don't necessarily fail the entire booking creation
        }
        console.log(`--- [createBooking] Function returning successfully with booking ID: ${bookingId} ---`);
        return bookingId;
    } catch (error) {
        // Avoid logging validation errors twice
        if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
            console.error(`❌ [createBooking] Error during booking creation process for Payment Intent [${paymentIntentId}]:`, error);
        }
        // Construct a user-friendly error message, hiding internal details unless it's a validation error
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
                const checkIn = booking.checkInDate.toDate();
                const checkOut = booking.checkOutDate.toDate();
                try {
                    // **** Call function using Client SDK ****
                    await updatePropertyAvailability(booking.propertyId, checkIn, checkOut, true);
                    console.log(`✅ [updateBookingStatus] Successfully updated local availability (Client SDK) for cancelled booking ${bookingId}.`);
                } catch (availError) {
                    console.error(`❌ [updateBookingStatus] Failed to update local availability (Client SDK) for cancelled booking ${bookingId}:`, availError);
                }
                // Trigger external sync
                try {
                    const propertyDetails = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPropertyForSync"])(booking.propertyId);
                    if (propertyDetails) {
                        if (propertyDetails.airbnbListingId) {
                            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateAirbnbListingAvailability"])(propertyDetails.airbnbListingId, true, checkIn, checkOut);
                            console.log(`[Sync] Initiated Airbnb date release for ${propertyDetails.airbnbListingId}`);
                        }
                        if (propertyDetails.bookingComListingId) {
                            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$booking$2d$sync$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["updateBookingComListingAvailability"])(propertyDetails.bookingComListingId, true, checkIn, checkOut);
                            console.log(`[Sync] Initiated Booking.com date release for ${propertyDetails.bookingComListingId}`);
                        }
                    } else {
                        console.warn(`[Sync] Could not find property details for ${booking.propertyId} to sync cancellation.`);
                    }
                } catch (syncError) {
                    console.error(`❌ [Sync] Error syncing availability after cancellation for booking ${bookingId}:`, syncError);
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
        console.error("❌ [updatePropertyAvailability - CLIENT SDK] Firestore Client SDK (db) is not initialized. Cannot update availability.");
        throw new Error("Firestore Client SDK is not initialized.");
    }
    if (checkOutDate <= checkInDate) {
        console.warn(`[updatePropertyAvailability] Check-out date (${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(checkOutDate, 'yyyy-MM-dd')}) must be after check-in date (${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(checkInDate, 'yyyy-MM-dd')}). No update performed.`);
        return;
    }
    const datesToUpdate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$eachDayOfInterval$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["eachDayOfInterval"])({
        start: checkInDate,
        end: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$subDays$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["subDays"])(checkOutDate, 1) // Make checkout date exclusive
    });
    if (datesToUpdate.length === 0) {
        console.log("[updatePropertyAvailability - CLIENT SDK] No dates need updating.");
        return;
    }
    console.log(`[updatePropertyAvailability - CLIENT SDK] Dates to update (${datesToUpdate.length}): ${datesToUpdate.map((d)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(d, 'yyyy-MM-dd')).join(', ')}`);
    const updatesByMonth = {};
    datesToUpdate.forEach((date)=>{
        const monthStr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, 'yyyy-MM');
        const dayOfMonth = date.getDate();
        if (!updatesByMonth[monthStr]) {
            updatesByMonth[monthStr] = {};
        }
        updatesByMonth[monthStr][dayOfMonth] = available;
    });
    console.log(`[updatePropertyAvailability - CLIENT SDK] Updates grouped by month:`, JSON.stringify(updatesByMonth));
    const batch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["writeBatch"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"]); // Use clientWriteBatch with client db
    const availabilityCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'availability'); // Use client db
    console.log(`[updatePropertyAvailability - CLIENT SDK] Initialized Firestore Client batch.`);
    try {
        const monthStrings = Object.keys(updatesByMonth);
        console.log(`[updatePropertyAvailability - CLIENT SDK] Processing months: ${monthStrings.join(', ')}`);
        if (monthStrings.length === 0) {
            console.log("[updatePropertyAvailability - CLIENT SDK] No months to process.");
            return;
        }
        // Fetch existing docs using Client SDK 'in' query
        const docIdsToFetch = monthStrings.map((monthStr)=>`${propertyId}_${monthStr}`);
        console.log(`[updatePropertyAvailability - CLIENT SDK] Fetching existing availability docs for ${monthStrings.length} months...`);
        // Split into batches if necessary (max 30 IDs per 'in' query)
        const idBatches = [];
        for(let i = 0; i < docIdsToFetch.length; i += 30){
            idBatches.push(docIdsToFetch.slice(i, i + 30));
        }
        console.log(`[updatePropertyAvailability - CLIENT SDK] Split into ${idBatches.length} query batches due to 'in' operator limit.`);
        const fetchedDocsMap = new Map();
        await Promise.all(idBatches.map(async (batchIds, index)=>{
            if (batchIds.length === 0) return;
            console.log(`[updatePropertyAvailability - CLIENT SDK] Executing query for batch ${index + 1}: ${batchIds.join(', ')}`);
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
            console.log(`[updatePropertyAvailability Batch Prep] Processing month ${monthStr} (Doc ID: ${availabilityDocId}). Updates needed for days: ${Object.keys(updatesByMonth[monthStr]).join(', ')}`);
            const availabilityDocRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["doc"])(availabilityCollection, availabilityDocId); // Use client db
            const updatesForDay = updatesByMonth[monthStr];
            const updatePayload = {}; // Use SerializableTimestamp for serverTimestamp
            for(const day in updatesForDay){
                updatePayload[`available.${String(day)}`] = updatesForDay[day];
            }
            updatePayload.updatedAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])(); // Use Client serverTimestamp
            console.log(`[updatePropertyAvailability Batch Prep] Prepared update payload for ${availabilityDocId}:`, JSON.stringify({
                ...updatePayload,
                updatedAt: 'ServerTimestamp'
            }));
            const existingDoc = fetchedDocsMap.get(availabilityDocId);
            if (existingDoc) {
                console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} exists. Adding UPDATE operation to client batch.`);
                batch.update(availabilityDocRef, updatePayload);
            } else {
                console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} DOES NOT exist. Creating initial data for month ${monthStr}.`);
                const [year, month] = monthStr.split('-').map(Number);
                const daysInMonth = new Date(year, month, 0).getDate();
                const initialAvailableMap = {};
                for(let day = 1; day <= daysInMonth; day++){
                    initialAvailableMap[day] = updatesForDay[day] !== undefined ? updatesForDay[day] : true; // Apply update if exists, else default to true
                }
                console.log(`[updatePropertyAvailability Batch Prep] Calculated initial availability map for ${daysInMonth} days in ${monthStr}.`);
                const newDocData = {
                    propertyId: propertyId,
                    month: monthStr,
                    available: initialAvailableMap,
                    updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["serverTimestamp"])()
                };
                console.log(`[updatePropertyAvailability Batch Prep] New doc data for ${availabilityDocId}:`, JSON.stringify({
                    ...newDocData,
                    updatedAt: 'ServerTimestamp'
                }));
                console.log(`[updatePropertyAvailability Batch Prep] Adding SET operation (merge: true) to client batch for ${availabilityDocId}.`);
                batch.set(availabilityDocRef, newDocData, {
                    merge: true
                }); // Use merge: true to avoid overwriting existing fields if any
            }
        });
        // Commit the Client SDK batch write
        console.log(`[updatePropertyAvailability - CLIENT SDK] Preparing to commit client batch for property ${propertyId}, months: ${monthStrings.join(', ')}...`);
        await batch.commit();
        console.log(`✅ [updatePropertyAvailability - CLIENT SDK] Successfully committed batch updates for local availability for property ${propertyId}.`);
        console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function finished successfully ---`);
    } catch (error) {
        // This error might be due to Firestore security rules denying the write.
        console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
        console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function throwing error ---`);
        throw new Error(`Failed to update local property availability using Client SDK: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ getUnavailableDatesForProperty(propertyId, monthsToFetch = 12) {
    const unavailableDates = [];
    console.log(`--- [getUnavailableDatesForProperty] Function called ---`);
    console.log(`[getUnavailableDatesForProperty] Fetching for property ${propertyId} for the next ${monthsToFetch} months.`);
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"]) {
        console.error("❌ [getUnavailableDatesForProperty] Firestore Client SDK (db) is not initialized. Cannot fetch availability.");
        return []; // Return empty array if DB not ready
    }
    const availabilityCollection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["collection"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'availability'); // Use Client SDK 'db'
    const today = new Date();
    // Use UTC for consistency when dealing with dates across potential timezones
    const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    console.log(`[getUnavailableDatesForProperty] Today (UTC): ${today.toISOString()}, Current Month Start (UTC): ${currentMonthStart.toISOString()}`);
    try {
        const monthDocIds = [];
        for(let i = 0; i < monthsToFetch; i++){
            // Calculate target month correctly in UTC
            const targetMonth = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1));
            const monthStr = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(targetMonth, 'yyyy-MM');
            monthDocIds.push(`${propertyId}_${monthStr}`);
        }
        console.log(`[getUnavailableDatesForProperty] Querying for document IDs: ${monthDocIds.join(', ')}`);
        const queryBatches = [];
        for(let i = 0; i < monthDocIds.length; i += 30){
            queryBatches.push(monthDocIds.slice(i, i + 30));
        }
        console.log(`[getUnavailableDatesForProperty] Split into ${queryBatches.length} query batches due to 'in' operator limit.`);
        if (monthDocIds.length === 0) {
            console.log("[getUnavailableDatesForProperty] No month document IDs to query. Returning empty array.");
            return [];
        }
        // Execute queries using Client SDK
        const allQuerySnapshots = await Promise.all(queryBatches.map(async (batchIds, index)=>{
            console.log(`[getUnavailableDatesForProperty] Executing query for batch ${index + 1}: ${batchIds.join(', ')}`);
            const q = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["query"])(availabilityCollection, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["where"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["documentId"])(), 'in', batchIds)); // Use documentId() for client query
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDocs"])(q);
        }));
        console.log(`[getUnavailableDatesForProperty] Fetched results from ${allQuerySnapshots.length} batches.`);
        allQuerySnapshots.forEach((querySnapshot, batchIndex)=>{
            console.log(`[getUnavailableDatesForProperty] Processing batch ${batchIndex + 1}: Found ${querySnapshot.docs.length} documents.`);
            querySnapshot.forEach((doc)=>{
                const data = doc.data();
                const docId = doc.id;
                console.log(`[getUnavailableDatesForProperty] Processing doc: ${docId}`);
                const monthStrFromId = docId.split('_')[1];
                const monthStrFromData = data.month;
                // Prefer month from data if available, fallback to parsing from ID
                const monthStr = monthStrFromData || monthStrFromId;
                if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                    console.warn(`[getUnavailableDatesForProperty] Could not determine valid month string for doc ${docId}. Skipping.`);
                    return;
                }
                if (data.available && typeof data.available === 'object') {
                    const [year, monthIndex] = monthStr.split('-').map((num)=>parseInt(num, 10));
                    const month = monthIndex - 1; // JS months are 0-indexed
                    console.log(`[getUnavailableDatesForProperty] Doc ${docId} (Month: ${monthStr}): Processing availability map...`);
                    for(const dayStr in data.available){
                        const day = parseInt(dayStr, 10);
                        if (!isNaN(day) && data.available[day] === false) {
                            try {
                                if (year > 0 && month >= 0 && month < 12 && day > 0 && day <= 31) {
                                    const date = new Date(Date.UTC(year, month, day)); // Work in UTC
                                    if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                        const todayUtcStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                                        if (date >= todayUtcStart) {
                                            console.log(`   - Found unavailable date: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, 'yyyy-MM-dd')}`);
                                            unavailableDates.push(date);
                                        } else {
                                            console.log(`   - Found past unavailable date: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(date, 'yyyy-MM-dd')}. Ignoring.`);
                                        }
                                    } else {
                                        console.warn(`[getUnavailableDatesForProperty] Invalid date created for ${year}-${monthStr}-${dayStr} in doc ${docId}. Skipping.`);
                                    }
                                } else {
                                    console.warn(`[getUnavailableDatesForProperty] Invalid year/month/day components found in doc ${docId}: year=${year}, month=${monthIndex}, day=${dayStr}. Skipping.`);
                                }
                            } catch (dateError) {
                                console.warn(`[getUnavailableDatesForProperty] Error creating date for ${year}-${monthStr}-${dayStr} in doc ${docId}:`, dateError, `. Skipping.`);
                            }
                        }
                    }
                } else {
                    console.warn(`[getUnavailableDatesForProperty] Document ${docId} has missing or invalid 'available' data. Skipping.`);
                }
            });
        });
        unavailableDates.sort((a, b)=>a.getTime() - b.getTime());
        console.log(`[getUnavailableDatesForProperty] Total unavailable dates found for property ${propertyId}: ${unavailableDates.length}`);
        console.log(`[getUnavailableDatesForProperty] Returning sorted unavailable dates: ${unavailableDates.map((d)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$date$2d$fns$2f$format$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["format"])(d, 'yyyy-MM-dd')).join(', ')}`);
        console.log(`--- [getUnavailableDatesForProperty] Function finished successfully ---`);
        return unavailableDates;
    } catch (error) {
        console.error(`❌ Error fetching unavailable dates for property ${propertyId}:`, error);
        console.log(`--- [getUnavailableDatesForProperty] Function finished with error ---`);
        return []; // Return empty array on error
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    createBooking,
    getBookingById,
    updateBookingStatus,
    getBookingsForProperty,
    getBookingsForUser,
    updatePropertyAvailability,
    getUnavailableDatesForProperty
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(createBooking, "4006e8ba16649f98d908108b2e66e3db796ea69c68", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBookingById, "409966a54d7b64e85efcfdaf60b9dc081d99628819", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updateBookingStatus, "60cf603f51f57547a295812039ae2618b7620cb422", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBookingsForProperty, "40e27282493dc0101cc37e2a3e7921ba309bfa8a54", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getBookingsForUser, "404a55478edc034a4c5e5045d6eca3eb88530c3630", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(updatePropertyAvailability, "783cf81384dd07b293ddd7dd28aa8db422f521713b", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getUnavailableDatesForProperty, "6021360a88c359099ff28f4bd1463da3250e44a7ea", null);
}}),
"[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
/* __next_internal_action_entry_do_not_use__ {"4074b4e8542bd2e2abcdaa0017eebc387b19e6e5cd":"simulateWebhookSuccess"} */ __turbopack_context__.s({
    "simulateWebhookSuccess": (()=>simulateWebhookSuccess)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$app$2d$render$2f$encryption$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/app-render/encryption.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zod/lib/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/bookingService.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$firebase$2f$firestore$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/firebase/firestore/dist/index.mjs [app-rsc] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@firebase/firestore/dist/index.node.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/firebase.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
;
;
;
// Schema to validate input parameters from the success page URL
const SimulationInputSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    sessionId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1),
    propertyId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().min(1),
    checkInDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().datetime(),
    checkOutDate: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().datetime(),
    numberOfGuests: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].coerce.number().int().positive(),
    numberOfNights: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].coerce.number().int().positive(),
    totalPrice: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].coerce.number().positive(),
    appliedCouponCode: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    discountPercentage: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].coerce.number().optional()
});
async function /*#__TURBOPACK_DISABLE_EXPORT_MERGING__*/ simulateWebhookSuccess(params// Accept unknown first for safe parsing
) {
    console.log('[Simulate Webhook] Action called.');
    // Only run in development environment
    if ("TURBOPACK compile-time falsy", 0) {
        "TURBOPACK unreachable";
    }
    // Validate input parameters
    const validationResult = SimulationInputSchema.safeParse(params);
    if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map((e)=>`${e.path.join('.')}: ${e.message}`).join(', ');
        console.error('[Simulate Webhook] Invalid input parameters:', errorMessages);
        return {
            success: false,
            error: `Invalid simulation parameters: ${errorMessages}`
        };
    }
    const { sessionId, propertyId, checkInDate, checkOutDate, numberOfGuests, numberOfNights, totalPrice, appliedCouponCode, discountPercentage } = validationResult.data;
    console.log(`[Simulate Webhook] Processing simulation for Session ID: ${sessionId}, Property ID: ${propertyId}`);
    try {
        // 1. Fetch Property Details (needed for pricing calculation) - Optional but good practice
        //    In a real webhook, you'd get this from metadata, but here we fetch for accuracy
        const propertyRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["doc"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$firebase$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"], 'properties', propertyId);
        const propertySnap = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$firebase$2f$firestore$2f$dist$2f$index$2e$node$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getDoc"])(propertyRef);
        if (!propertySnap.exists()) {
            throw new Error(`Property with ID ${propertyId} not found for simulation.`);
        }
        const propertyData = propertySnap.data();
        const baseRate = propertyData.pricePerNight || 0;
        const cleaningFee = propertyData.cleaningFee || 0;
        const extraGuestFee = propertyData.extraGuestFee || 0;
        const baseOccupancy = propertyData.baseOccupancy || 1;
        // 2. Reconstruct Pricing Details (as webhook would)
        const numberOfExtraGuests = Math.max(0, numberOfGuests - baseOccupancy);
        const accommodationTotal = baseRate * numberOfNights + extraGuestFee * numberOfExtraGuests * numberOfNights;
        const subtotal = accommodationTotal + cleaningFee;
        const discountAmount = discountPercentage ? subtotal * (discountPercentage / 100) : 0;
        const taxes = Math.max(0, totalPrice - (subtotal - discountAmount)); // Calculate taxes based on final price
        // 3. Construct Mock Booking Data
        const mockBookingData = {
            propertyId: propertyId,
            guestInfo: {
                firstName: "DevSim",
                lastName: "User",
                email: `devsim_${Date.now()}@example.com`,
                userId: "dev-sim-user",
                phone: "+15559998877"
            },
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            numberOfGuests: numberOfGuests,
            pricing: {
                baseRate: baseRate,
                numberOfNights: numberOfNights,
                cleaningFee: cleaningFee,
                extraGuestFee: extraGuestFee,
                numberOfExtraGuests: numberOfExtraGuests,
                accommodationTotal: accommodationTotal,
                subtotal: subtotal,
                taxes: taxes,
                discountAmount: discountAmount,
                total: totalPrice
            },
            appliedCouponCode: appliedCouponCode,
            paymentInput: {
                stripePaymentIntentId: `sim_${sessionId}`,
                amount: totalPrice,
                status: "succeeded"
            },
            status: 'confirmed',
            source: 'dev-simulation',
            notes: `Simulated booking via success page for session ${sessionId}.`
        };
        console.log('[Simulate Webhook] Mock booking data constructed:', JSON.stringify(mockBookingData, null, 2));
        // 4. Call createBooking
        console.log('[Simulate Webhook] Calling createBooking...');
        const bookingId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bookingService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createBooking"])(mockBookingData);
        console.log(`[Simulate Webhook] createBooking finished. Booking ID: ${bookingId}`);
        return {
            success: true,
            bookingId: bookingId
        };
    } catch (error) {
        console.error(`❌ [Simulate Webhook] Error during simulation for session ${sessionId}:`, error);
        return {
            success: false,
            error: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    simulateWebhookSuccess
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(simulateWebhookSuccess, "4074b4e8542bd2e2abcdaa0017eebc387b19e6e5cd", null);
}}),
"[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({});
;
}}),
"[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$success$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
}}),
"[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <exports>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "4074b4e8542bd2e2abcdaa0017eebc387b19e6e5cd": (()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["simulateWebhookSuccess"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$success$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
}}),
"[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "4074b4e8542bd2e2abcdaa0017eebc387b19e6e5cd": (()=>__TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$success$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__["4074b4e8542bd2e2abcdaa0017eebc387b19e6e5cd"])
});
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$success$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <module evaluation>');
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$booking$2f$success$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$simulate$2d$webhook$2d$success$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$exports$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/booking/success/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/simulate-webhook-success.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <exports>');
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
"[project]/src/app/booking/success/page.tsx (client reference/proxy) <module evaluation>": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>__TURBOPACK__default__export__)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/src/app/booking/success/page.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/app/booking/success/page.tsx <module evaluation>", "default");
}}),
"[project]/src/app/booking/success/page.tsx (client reference/proxy)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>__TURBOPACK__default__export__)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server-edge.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2d$edge$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/src/app/booking/success/page.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/app/booking/success/page.tsx", "default");
}}),
"[project]/src/app/booking/success/page.tsx [app-rsc] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$booking$2f$success$2f$page$2e$tsx__$28$client__reference$2f$proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/src/app/booking/success/page.tsx (client reference/proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$booking$2f$success$2f$page$2e$tsx__$28$client__reference$2f$proxy$29$__ = __turbopack_context__.i("[project]/src/app/booking/success/page.tsx (client reference/proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$booking$2f$success$2f$page$2e$tsx__$28$client__reference$2f$proxy$29$__);
}}),
"[project]/src/app/booking/success/page.tsx [app-rsc] (ecmascript, Next.js server component)": ((__turbopack_context__) => {

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/booking/success/page.tsx [app-rsc] (ecmascript)"));
}}),

};

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__7c606363._.js.map