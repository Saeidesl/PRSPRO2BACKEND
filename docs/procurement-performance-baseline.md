# Procurement performance baseline

Read-only targets: `/procurement/workspace`, `/procurement/dashboard`, `/procurement/needs`, `/procurement/orders`, and `/procurement/reports`.

Historical authenticated browser audit: workspace average 4,118 ms, median 3,918 ms, p95/max 4,317 ms. This is browser request duration, not a Google Sheets RPC measurement, and is not a post-change baseline.

To measure the live version, open the frontend with `pmsDiagnostics=1`, sign in as an administrator, open procurement, and click **سنجش ۵ مسیر تأمین**. The panel reports browser duration, backend total/access/router duration, and the top repository operation/sheet timings. Repeat the benchmark; request caches reset per HTTP request, so repeated measurements do not imply cross-request cache hits.

Repository timings are method-level measurements and not exact counts of every Sheets RPC. `getAll` already uses a single range read and `insertMany` a batch write; further batching should only be added if live traces demonstrate a repeated expensive call. No post-change live result is claimed yet; the initial 3-second target is not considered met until measured against the deployed version.