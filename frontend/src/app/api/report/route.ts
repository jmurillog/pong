import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const reportPath = path.resolve(process.cwd(), '..', 'outputs', 'ppo_pong', 'analysis', 'report.json');

    if (!fs.existsSync(reportPath)) {
      return NextResponse.json({});
    }

    const raw = fs.readFileSync(reportPath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading report.json:', error);
    return NextResponse.json({});
  }
}
