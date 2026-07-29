# DHV TapAttend Security Baseline

## Attendance trust model

An attendance record is trusted only when all checks pass:

1. The fixed scanner is paired with a one-time code and owns the Android Keystore private key.
2. Every request has a fresh timestamp, UUID request ID, body hash, and RSA-SHA256 signature.
3. The scanner is approved and, when configured, assigned to the session room.
4. The card and student are active, and the student is enrolled in the course section.
5. Server time is inside the session window. Client time never decides attendance status.
6. The student completes a random liveness action.
7. The face matches the enrolled CompreFace subject above `FACE_MATCH_THRESHOLD`.
8. The database transaction confirms there is no overlapping attendance.

If a face-protected scanner is offline, TapAttend does not create an unverified `PRESENT` record. Staff must use the review workflow.

## Biometric data

- Supabase stores profile state, consent version, a random provider subject ID, similarity score, and audit metadata.
- TapAttend does not persist verification frames. Android deletes its temporary JPEG immediately after encoding.
- CompreFace stores enrollment examples in its own data volume. Encrypt that volume, restrict it to the campus network, and apply the school's retention policy.
- Revoking a profile deletes the subject samples from CompreFace before marking the database profile revoked.
- Never use a face mismatch as the sole basis for discipline. Staff must review the alert and provide an appeal/manual verification path.

The included ML Kit flow performs active liveness using eye state and head pose. It raises the cost of using a printed photo, but it is not a certified Presentation Attack Detection product. Before high-stakes deployment, test printed photos, replayed videos, masks, twins, lighting variation, and demographic groups. For stronger protection, use a fixed depth/IR camera or a PAD provider evaluated against ISO/IEC 30107-3.

## Database deployment

1. Back up the Supabase database.
2. Test `supabase/migrations/202607290001_security_hardening.sql` on a staging copy.
3. Confirm each Auth user maps to one `public.users.auth_user_id`.
4. Confirm lecturer profiles have `lecturers.user_id`; otherwise scoped lecturer pages intentionally return no class data.
5. Apply the migration during a maintenance window.
6. Set all variables from `apps/web/.env.example`.
7. Deploy web, then create a one-time pairing code under **Thiết bị** for every scanner.
8. Register biometric samples only after the privacy notice and recorded consent.

## Role boundaries

| Role | Allowed workflow |
| --- | --- |
| `ADMIN` / `TRAINING_OFFICE` | Create courses and course sections, assign lecturers, manage student rosters, cards, biometrics, scanners, security review and reports. |
| `LECTURER` | View only assigned course sections, view their roster, create/open/close attendance sessions and perform attendance review/override for those sessions. |
| `STUDENT` | View their own attendance and submit an adjustment request for their own attendance record. |

Role checks are enforced in server layouts and server actions/API handlers. Hiding a
menu item is only a usability layer; it is not the security boundary.

## Operational controls

- Rotate `CARD_HMAC_SECRET` only with a planned card re-hash migration.
- Rotate `DEVICE_PAIRING_SECRET` independently of paired scanner keys.
- Block a lost or tampered scanner immediately.
- Review `CRITICAL` and `HIGH` alerts daily.
- Trigger random re-scans in selected classes. A missed re-scan creates an alert, not an automatic disciplinary conclusion.
- Keep Supabase service-role and CompreFace keys server-side.
- Enable administrator MFA in Supabase Auth.
- Put rate limiting/WAF rules before `/api/devices/pair`, `/api/nfc/scans`, and `/api/face/verify`.
- Use Android kiosk/managed-device mode and a private release signing key. Never deploy the debug APK as a production scanner.

## Required external setup

- Apply the migration before using the new routes.
- Deploy CompreFace and create a Recognition Service API key.
- Configure a production Android release keystore and managed device policy.
- Select certified anti-spoofing hardware/software if the university requires stronger PAD than the included baseline.
