#!/usr/bin/env node

/**
 * Test Script for FerXxxa Markets Scraper
 *
 * Usage:
 *   npm install
 *   node test-ferxxxa-markets.js
 *
 * This script tests the market scraper locally without needing Vercel
 */

import { getDb } from './api/_db.js';

// Simulate the handler execution
async function testMarketsScraper() {
  console.log('='.repeat(60));
  console.log('FerXxxa Markets Scraper - Test Suite');
  console.log('='.repeat(60));

  try {
    // Test 1: Database Connection
    console.log('\n[TEST 1] Database Connection');
    console.log('-'.repeat(60));
    try {
      const db = await getDb();
      console.log('✅ Database connection successful');
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      console.log('Make sure DATABASE_URL env var is set');
      return;
    }

    // Test 2: Import and validate handler
    console.log('\n[TEST 2] Import Handler');
    console.log('-'.repeat(60));
    try {
      const { default: handler } = await import('./api/ferxxxa-markets.js');
      console.log('✅ Handler imported successfully');

      // Test 3: Simulate HTTP request
      console.log('\n[TEST 3] Simulate Cron Request');
      console.log('-'.repeat(60));

      const mockReq = {
        method: 'GET',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET || 'test_secret'}`
        }
      };

      const mockRes = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
        end() {
          return this;
        },
        setHeader(name, value) {
          if (!this.headers) this.headers = {};
          this.headers[name] = value;
        }
      };

      console.log('Calling handler...');
      console.log(`  Method: ${mockReq.method}`);
      console.log(`  Auth: ${mockReq.headers.authorization.substring(0, 20)}...`);

      const startTime = Date.now();
      await handler(mockReq, mockRes);
      const duration = Date.now() - startTime;

      console.log(`\n✅ Handler executed in ${duration}ms`);
      console.log(`Status Code: ${mockRes.statusCode}`);

      if (mockRes.body) {
        console.log('\nResponse Summary:');
        console.log(`  Success: ${mockRes.body.success}`);
        console.log(`  Source: ${mockRes.body.source}`);
        console.log(`  Markets Count: ${mockRes.body.markets_count || 0}`);
        console.log(`  Data Persisted: ${mockRes.body.data_persisted}`);
        console.log(`  Timestamp: ${mockRes.body.timestamp}`);

        if (mockRes.body.summary) {
          console.log('\nData Quality:');
          console.log(`  Markets Extracted: ${mockRes.body.summary.markets_extracted}`);
          console.log(`  Odds Freshness: ${mockRes.body.summary.odds_freshness_seconds}s`);
          console.log(`  Live Match: ${mockRes.body.summary.live_match}`);
          console.log(`  Score: ${mockRes.body.summary.current_score}`);
          console.log(`  Minute: ${mockRes.body.summary.minute}`);
        }
      }

      // Test 4: Query database results
      console.log('\n[TEST 4] Query Database Results');
      console.log('-'.repeat(60));

      try {
        const db = await getDb();
        const results = await db`
          SELECT
            id,
            topic,
            match_id,
            home_team,
            away_team,
            current_score,
            studied_at,
            (summary_json->>'total_markets_found')::int as markets_count
          FROM zak_intel
          WHERE topic = 'ferxxxa_markets'
          ORDER BY studied_at DESC
          LIMIT 3
        `;

        if (results.length > 0) {
          console.log(`✅ Found ${results.length} recent market records:\n`);
          for (const record of results) {
            console.log(`  ID: ${record.id}`);
            console.log(`  Match: ${record.home_team} vs ${record.away_team}`);
            console.log(`  Score: ${record.current_score}`);
            console.log(`  Markets: ${record.markets_count}`);
            console.log(`  Studied: ${record.studied_at}`);
            console.log();
          }
        } else {
          console.log('ℹ️  No market records found yet (first run?)');
        }
      } catch (err) {
        console.warn('⚠️ Could not query results:', err.message);
      }

      // Test 5: Check environment variables
      console.log('[TEST 5] Environment Variables');
      console.log('-'.repeat(60));
      const envVars = [
        'DORADOBET_USER',
        'DORADOBET_PASS',
        'CRON_SECRET',
        'DATABASE_URL',
        'NODE_ENV'
      ];

      for (const envVar of envVars) {
        const value = process.env[envVar];
        if (value) {
          if (envVar.includes('PASS') || envVar.includes('SECRET') || envVar.includes('DATABASE_URL')) {
            console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`);
          } else {
            console.log(`✅ ${envVar}: ${value}`);
          }
        } else {
          console.log(`⚠️ ${envVar}: NOT SET`);
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('Test Complete');
      console.log('='.repeat(60));
      console.log('\nNext Steps:');
      console.log('1. Review test results above');
      console.log('2. Check database records in zak_intel table');
      console.log('3. Set up cron in vercel.json');
      console.log('4. Deploy to Vercel: vercel --prod');
      console.log('5. Monitor logs: vercel logs --follow');

    } catch (err) {
      console.error('❌ Handler test failed:', err.message);
      console.error('\nStack trace:');
      console.error(err.stack);
    }

  } catch (error) {
    console.error('Fatal test error:', error);
  }
}

// Run tests
testMarketsScraper().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
