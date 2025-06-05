// Safari Debug Script - Run in Safari Developer Console
// 1. Open Safari
// 2. Go to http://localhost:9002/login  
// 3. Open Developer Console (Develop > Show JavaScript Console)
// 4. Paste and run this script

console.log('🧭 Safari Authentication Debug Script');
console.log('=======================================');

// Test 1: Browser Detection
console.log('\n📱 Test 1: Browser Detection');
const userAgent = navigator.userAgent;
const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Chromium/.test(userAgent);
console.log('User Agent:', userAgent);
console.log('Is Safari:', isSafari ? '✅ YES' : '❌ NO');

// Test 2: Popup Detection
console.log('\n🪟 Test 2: Popup Blocking');
try {
    const popup = window.open('', '_blank', 'width=1,height=1');
    if (popup) {
        popup.close();
        console.log('Popup Status: ✅ ALLOWED');
    } else {
        console.log('Popup Status: ❌ BLOCKED');
    }
} catch (e) {
    console.log('Popup Status: ❌ ERROR -', e.message);
}

// Test 3: Check if on login page
console.log('\n📍 Test 3: Page Detection');
const currentUrl = window.location.href;
console.log('Current URL:', currentUrl);
console.log('On login page:', currentUrl.includes('/login') ? '✅ YES' : '❌ NO');

// Test 4: Check for Safari warnings on page
console.log('\n⚠️ Test 4: Safari Warning Detection');
const pageContent = document.body.innerText;
const hasSafariWarning = pageContent.includes('Safari User') || pageContent.includes('redirected to Google');
console.log('Safari warning shown:', hasSafariWarning ? '✅ YES' : '❌ NO');

// Test 5: Test Google button
console.log('\n🔘 Test 5: Google Button Test');
const googleButton = document.querySelector('button');
if (googleButton) {
    console.log('Google button found:', '✅ YES');
    console.log('Button text:', googleButton.innerText);
    
    console.log('\n🖱️ MANUAL STEP: Click the Google button and observe:');
    console.log('1. Does a popup open?');
    console.log('2. Does the page redirect?'); 
    console.log('3. Any errors in console?');
    
    // Add click event listener for debugging
    googleButton.addEventListener('click', function() {
        console.log('🖱️ Google button clicked!');
        console.log('Watching for popup or redirect...');
        
        setTimeout(() => {
            const newUrl = window.location.href;
            if (newUrl !== currentUrl) {
                console.log('✅ REDIRECT occurred to:', newUrl);
            } else {
                console.log('❌ No redirect detected');
            }
        }, 2000);
    });
} else {
    console.log('Google button found:', '❌ NO');
}

// Test 6: Manual session creation
console.log('\n🔧 Test 6: Manual Session Creation');
window.createTestSession = async function() {
    const testUser = {
        uid: 'real-safari-console-' + Date.now(),
        email: 'consolesafari@example.com'
    };
    
    try {
        console.log('Creating manual session...');
        const response = await fetch('/api/auth/dev-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: testUser })
        });
        
        const result = await response.json();
        console.log('Session result:', result);
        
        if (result.success) {
            console.log('✅ Session created! Now try accessing /admin');
        }
        
        return result;
    } catch (e) {
        console.log('❌ Session error:', e.message);
    }
};

console.log('\n🎯 INSTRUCTIONS:');
console.log('1. Click the Google sign-in button');
console.log('2. Note popup vs redirect behavior');
console.log('3. Run: createTestSession() to test manual auth');
console.log('4. Navigate to /admin to test access');
console.log('5. Report results back!');

console.log('\n📋 Expected Safari Behavior:');
console.log('✅ Should show "Safari User" warning');
console.log('✅ Should redirect (not popup) to Google');
console.log('✅ Manual session should work');
console.log('✅ Admin access should work with session');