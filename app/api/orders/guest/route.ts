import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  return NextResponse.json(
    { error: 'Guest order creation is disabled until payment is confirmed' },
    { status: 410 },
  )
}
