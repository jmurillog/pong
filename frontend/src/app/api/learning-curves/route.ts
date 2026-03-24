import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

function readCSVSafe(filePath: string): Record<string, string>[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parseCSV(raw);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const outputsBase = path.resolve(process.cwd(), '..', 'outputs', 'ppo_pong');

    // Read the summary CSV
    const summaryPath = path.join(outputsBase, 'analysis', 'learning_curve_summary.csv');
    const summary = readCSVSafe(summaryPath);

    // Read per-seed eval_checkpoints.csv files
    const seedData: { file: string; budget: string; seed: string; rows: Record<string, string>[] }[] = [];

    if (fs.existsSync(outputsBase)) {
      const budgetDirs = fs.readdirSync(outputsBase).filter((d) => {
        try {
          return fs.statSync(path.join(outputsBase, d)).isDirectory() && d !== 'analysis';
        } catch {
          return false;
        }
      });

      for (const budgetDir of budgetDirs) {
        const budgetPath = path.join(outputsBase, budgetDir);
        let seedDirs: string[] = [];
        try {
          seedDirs = fs.readdirSync(budgetPath).filter((d) => {
            try {
              return fs.statSync(path.join(budgetPath, d)).isDirectory() && d.startsWith('seed_');
            } catch {
              return false;
            }
          });
        } catch {
          continue;
        }

        for (const seedDir of seedDirs) {
          const checkpointPath = path.join(budgetPath, seedDir, 'eval_checkpoints.csv');
          const rows = readCSVSafe(checkpointPath);
          if (rows.length > 0) {
            seedData.push({
              file: checkpointPath,
              budget: budgetDir,
              seed: seedDir,
              rows,
            });
          }
        }
      }
    }

    return NextResponse.json({ summary, seedData });
  } catch (error) {
    console.error('Error reading learning curves:', error);
    return NextResponse.json({ summary: [], seedData: [] });
  }
}
