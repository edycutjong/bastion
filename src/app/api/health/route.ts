import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    service: "bastion",
    version: "0.1.0",
    status: "ok",
    network: "casper-test",
    timestamp: new Date().toISOString(),
  });
}
