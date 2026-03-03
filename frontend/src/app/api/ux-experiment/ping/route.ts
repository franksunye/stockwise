import { NextResponse } from 'next/server';



export async function GET(request: Request) {
    const start = Date.now();
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        processing_ms: Date.now() - start,
        platform: 'Edge Runtime',
        region: request.headers.get('cf-ipcountry') || 'global'
    });
}
