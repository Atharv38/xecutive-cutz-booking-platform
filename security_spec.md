# Security Specification – Xecutive Cutz Firebase Auth & Profiles

## 1. Data Invariants
1. A `/users/{userId}` document may only be read (`get`), created, or updated by the verified owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`) or a bootstrapped/trusted administrator (`isAdmin()`).
2. No user may list `/users` unless they are a verified administrator; standard users cannot enumerate other customers' PII.
3. No user may inject RBAC fields (`role`, `isAdmin`, `admin`) or shadow fields into `/users/{userId}`.
4. Document IDs (`userId`) must satisfy `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
5. `uid` inside `/users/{userId}` is immutable (`incoming().uid == existing().uid`) and must match `request.auth.uid` on creation.
6. `createdAt` is immutable and must equal `request.time` on creation; `updatedAt` must equal `request.time` on create and update.
7. `/admins/{userId}` is strictly unreadable and unwritable by non-admins; only verified admins may manage `/admins`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read**: `get(/users/uid123)` with `auth = null`.
2. **Cross-user PII read**: `get(/users/victimUid)` signed in as `attackerUid`.
3. **Collection scraping**: `list(/users)` signed in as a standard verified user.
4. **Unverified email write**: `set(/users/uid123, ...)` with `email_verified: false`.
5. **Identity spoofing**: `set(/users/uid123, { uid: "otherUid", ... })` signed in as `uid123`.
6. **Privilege escalation (ghost role field)**: `set(/users/uid123, { ..., role: "admin" })`.
7. **Self-admin creation**: `set(/admins/uid123, { uid: "uid123", email: "attacker@x.com" })`.
8. **ID poisoning**: `set(/users/bad..id$%1500chars, ...)` violating `^[a-zA-Z0-9_\-]+$`.
9. **String resource exhaustion**: `fullName` of 5,000 characters exceeding `maxLength: 120`.
10. **Client-spoofed timestamp**: `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
11. **Update mutating immutable uid**: `update(/users/uid123, { uid: "newUid", updatedAt: serverTimestamp() })`.
12. **Admin email spoofing without verification**: `auth.token.email == "kafareatharv4732@gmail.com"` with `email_verified == false`.
