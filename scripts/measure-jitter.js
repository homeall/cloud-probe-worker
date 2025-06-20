#!/usr/bin/env node

import https from 'https';
import { createInterface } from 'readline';
import { stdout, stdin } from 'process';

// Simple ANSI color helpers
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};
const colorize = (txt, clr) => `${COLORS[clr] ?? ''}${txt}${COLORS.reset}`;

// Configuration
const ENDPOINT = 'https://cb.apigw.io/ping';
const REQUESTS = 20; // Number of requests to make
const INTERVAL = 200; // ms between requests

// Statistics
const latencies = [];
let completed = 0;
let startTime = Date.now();

// Create readline interface for progress updates
const rl = createInterface({
  input: stdin,
  output: stdout
});

// Function to make a single request
function makeRequest() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    
    const req = https.get(ENDPOINT, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const latencyNs = end - start;
        const latencyMs = Number(latencyNs) / 1_000_000; // Convert to ms
        
        try {
          const json = JSON.parse(data);
          const rtt = json.cf?.clientTcpRtt || 0;
          latencies.push({
            requestLatency: latencyMs,
            tcpRtt: rtt,
            timestamp: new Date().toISOString(),
            colo: json.cf?.colo || 'unknown'
          });
        } catch (e) {
          console.error('Error parsing response:', e.message);
        }
        
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.error('Request error:', e.message);
      resolve();
    });
    
    req.end();
  });
}

// Calculate statistics
function calculateStats() {
  if (latencies.length === 0) return null;
  
  const rtts = latencies.map(l => l.tcpRtt);
  const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
  
  // Calculate standard deviation (jitter)
  const squareDiffs = rtts.map(rtt => Math.pow(rtt - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);
  
  return {
    totalRequests: REQUESTS,
    successfulRequests: latencies.length,
    averageLatency: avg,
    minLatency: Math.min(...rtts),
    maxLatency: Math.max(...rtts),
    jitter: stdDev,
    colo: latencies[0]?.colo || 'unknown',
    duration: (Date.now() - startTime) / 1000
  };
}

// Print results
function printResults() {
  const stats = calculateStats();
  if (!stats) {
    console.log('No successful requests to analyze');
    return;
  }
  
  console.log(`\n${colorize('🌐  Network Performance Analysis', 'bold')}`);
  console.log(colorize(`📍  Data Center : ${stats.colo}`, 'green'));
  console.log(colorize(`📊  Requests    : ${stats.successfulRequests}/${stats.totalRequests} ✅`, 'green'));
  console.log(colorize(`⏱️  Duration    : ${stats.duration.toFixed(2)}s`, 'green'));

  console.log(`\n${colorize('⚡ Latency (ms)', 'bold')}`);
  console.log(`   • Average : ${colorize(stats.averageLatency.toFixed(2), 'green')}`);
  console.log(`   • Minimum : ${colorize(stats.minLatency.toFixed(2), 'green')}`);
  console.log(`   • Maximum : ${colorize(stats.maxLatency.toFixed(2), 'yellow')}`);

  console.log(`\n${colorize('📈 Jitter', 'bold')}`);
  console.log(colorize(`   • Std Dev : ${stats.jitter.toFixed(2)} ms`, 'red'));

  let verdict;
  if (stats.jitter < 5) {
    verdict = `${colorize('🎉  Excellent – very stable connection', 'green')}`;
  } else if (stats.jitter < 15) {
    verdict = `${colorize('👍  Good – stable connection', 'cyan')}`;
  } else if (stats.jitter < 30) {
    verdict = `${colorize('⚠️  Acceptable – some variation', 'yellow')}`;
  } else {
    verdict = `${colorize('🔥  High jitter – unstable connection', 'red')}`;
  }
  console.log(`\n${verdict}`);

  console.log(`\n${colorize('ℹ️  Lower values are better for both latency and jitter', 'yellow')}`);
}

// Main function
async function main() {
  console.log(colorize(`🚀  Testing ${ENDPOINT}`, 'cyan'));
  console.log(colorize(`🔄  Making ${REQUESTS} requests...\n`, 'yellow'));
  
  // Make requests with interval
  for (let i = 0; i < REQUESTS; i++) {
    process.stdout.write(`\r${colorize('⏳  Progress:', 'yellow')} ${colorize(i + 1 + '/' + REQUESTS, 'cyan')} `);
    await makeRequest();
    if (i < REQUESTS - 1) await new Promise(r => setTimeout(r, INTERVAL));
  }
  
  // Clear progress line
  stdout.clearLine(0);
  stdout.cursorTo(0);
  
  // Print results
  printResults();
  
  // Close readline
  rl.close();
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nTest interrupted. Showing results for completed requests...\n');
  printResults();
  process.exit(0);
});

// Run the test
main().catch(console.error);
