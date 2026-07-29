# DHV TapAttend Performance Baseline

## Implemented

- Recharts is dynamically loaded only on the dashboard route.
- Route-level skeletons and error boundaries keep navigation responsive.
- Dashboard counts use estimated count for the large `scan_events` table.
- Weekly chart points are computed from real events, not synthetic values.
- Recent activity selects only the four fields it renders.
- Live attendance uses Realtime first and reconciles every 20 seconds only while
  the tab is visible; background refreshes no longer replace the table with a
  loading skeleton.
- Attendance reports are aggregated by PostgreSQL and exported as UTF-8 CSV
  without shipping a heavy spreadsheet library to the browser.
- Health checks are cached for 15 seconds and the navbar polls once per minute.
- Android rejects duplicate NFC reads for 3.5 seconds and allows only one request in flight.
- Android uses `lifecycleScope` so scanner requests are cancelled with the Activity.
- Android polls the signed room-scoped active-session endpoint every 10 seconds;
  operators do not manually type a session ID for each class.
- Face verification frames are resized to a maximum width of 640 px and JPEG quality 82 before upload.
- `202607290002_performance_indexes.sql` adds indexes for the busiest filters and sort orders.

## Production targets

| Surface | Target |
| --- | --- |
| Web LCP | under 2.5 seconds at p75 |
| Web INP | under 200 ms at p75 |
| Web CLS | under 0.1 |
| Dashboard API | under 500 ms at p95 |
| NFC validation response | under 800 ms at p95 on campus network |
| Face verification | under 2.5 seconds at p95 |

## Rollout checks

1. Apply both security and performance migrations on staging, in filename order.
2. Run `EXPLAIN (ANALYZE, BUFFERS)` for recent scans, live records, and session lists after representative data is loaded.
3. Inspect Vercel function duration and Supabase slow-query logs for one week.
4. Measure the fixed scanner on the actual campus Wi-Fi, not only an emulator.
5. Keep `next dev` stopped while running `next build`; both write to `.next`.
