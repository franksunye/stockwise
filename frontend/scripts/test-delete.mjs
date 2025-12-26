
async function testDelete() {
    const userId = 'cfa0eb67-1790-49d2-a59c-c49be977fa56';
    const symbol = '00992';
    console.log(`🧪 Testing delete stock ${symbol} for user ${userId}...`);

    try {
        const response = await fetch(`http://localhost:3000/api/stock-pool?userId=${userId}&symbol=${symbol}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        console.log('✅ Response:', data);
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDelete();
