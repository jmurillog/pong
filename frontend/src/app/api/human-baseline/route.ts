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
    // Try filled version first, then fall back to template
    const filledPath = path.resolve(
      process.cwd(),
      '..',
      '..',
      'data',
      'human_baseline',
      'human_returns.csv'
    );
    const templatePath = path.resolve(
      process.cwd(),
      '..',
      '..',
      'data',
      'human_baseline',
      'human_returns_template.csv'
    );

    let rows: Record<string, string>[] = [];
    let source = 'none';

    if (fs.existsSync(filledPath)) {
      rows = readCSVSafe(filledPath);
      source = 'filled';
    } else if (fs.existsSync(templatePath)) {
      rows = readCSVSafe(templatePath);
      source = 'template';
    }

    // Group by player_id
    const playerMap: Record<string, number[]> = {};
    for (const row of rows) {
      const playerId = row['player_id'] || row['player'] || 'unknown';
      const ret = parseFloat(row['episode_return'] || row['return'] || '0');
      if (isNaN(ret)) continue;
      if (!playerMap[playerId]) playerMap[playerId] = [];
      playerMap[playerId].push(ret);
    }

    const players = Object.entries(playerMap).map(([player_id, returns]) => {
      const n = returns.length;
      const mean = returns.reduce((a, b) => a + b, 0) / n;
      const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1);
      const std = Math.sqrt(variance);
      return {
        player_id,
        mean_return: mean,
        std_return: std,
        n_episodes: n,
        min_return: Math.min(...returns),
        max_return: Math.max(...returns),
      };
    });

    // Overall stats
    const allReturns = rows
      .map((r) => parseFloat(r['episode_return'] || r['return'] || ''))
      .filter((v) => !isNaN(v));

    let overallStats = null;
    if (allReturns.length > 0) {
      const n = allReturns.length;
      const mean = allReturns.reduce((a, b) => a + b, 0) / n;
      const variance = allReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(n - 1, 1);
      const std = Math.sqrt(variance);
      const se = std / Math.sqrt(n);
      overallStats = {
        n_total: n,
        mean_return: mean,
        std_return: std,
        se_return: se,
        min_return: Math.min(...allReturns),
        max_return: Math.max(...allReturns),
        ci95_low: mean - 1.96 * se,
        ci95_high: mean + 1.96 * se,
      };
    }

    return NextResponse.json({ source, players, overallStats, rawRows: rows.slice(0, 5) });
  } catch (error) {
    console.error('Error reading human baseline:', error);
    return NextResponse.json({ source: 'none', players: [], overallStats: null, rawRows: [] });
  }
}
