import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({ error: "Autonomous trading has been retired." }, { status: 410 }); }
