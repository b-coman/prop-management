// Debug cookie encoding/decoding issue

const testData = {
  uid: 'test-1234',
  email: 'test@example.com',
  timestamp: Date.now(),
  mode: 'development'
};

console.log('Original data:', testData);

// Test encoding
const encoded = Buffer.from(JSON.stringify(testData)).toString('base64');
console.log('Encoded:', encoded);
console.log('Encoded length:', encoded.length);

// Test decoding
try {
  const decoded = Buffer.from(encoded, 'base64').toString();
  console.log('Decoded:', decoded);
  
  const parsed = JSON.parse(decoded);
  console.log('Parsed:', parsed);
  
  console.log('✅ Encoding/decoding works correctly');
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test with URL encoding (which might happen with cookies)
const urlEncoded = encodeURIComponent(encoded);
const urlDecoded = decodeURIComponent(urlEncoded);

console.log('\nURL encoding test:');
console.log('URL encoded:', urlEncoded);
console.log('URL decoded equals original:', urlDecoded === encoded);

// Test with potential padding issues
console.log('\nPadding test:');
console.log('Original encoded length:', encoded.length);
console.log('Padded encoded:', encoded + '='.repeat(4 - (encoded.length % 4)));