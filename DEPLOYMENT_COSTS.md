# BDI LMS — Full Deployment Cost Breakdown

> **Last Updated:** February 2026  
> **App:** BDI LMS (React Native / Expo)  
> **Platforms:** iOS & Android

---

## Table of Contents

1. [Cost Summary](#1-cost-summary)
2. [App Store Fees](#2-app-store-fees)
3. [EAS (Expo Application Services)](#3-eas-expo-application-services)
4. [Supabase (Backend / Database / Auth)](#4-supabase-backend--database--auth)
5. [Vercel (API Hosting)](#5-vercel-api-hosting)
6. [Cloudflare R2 (Media Storage)](#6-cloudflare-r2-media-storage)
7. [Firebase (Push Notifications)](#7-firebase-push-notifications)
8. [Domain & SSL](#8-domain--ssl)
9. [Recommended Starter Budget](#9-recommended-starter-budget)
10. [Scaling Estimates](#10-scaling-estimates)

---

## 1. Cost Summary

| Category | One-Time Cost | Monthly Cost (Starter) |
|---|---|---|
| Apple Developer Account | $99/year | — |
| Google Play Developer Account | $25 (one-time) | — |
| Expo (EAS) | — | $0 (Free) |
| Supabase | — | $0 (Free) |
| Vercel | — | $0 (Free) |
| Cloudflare R2 | — | ~ $5 (Free) |
| Firebase (FCM) | — | $0 (Free) |
| Domain Name | __ | — |
| **TOTAL (Year 1 Estimate)** | **~$134–139** | **$5/mo (Free tiers)** |

---

## 2. App Store Fees

### Apple App Store
| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Program | **$99 USD** | Annual (auto-renewable) |
| App Review / Submission | Free | — |
| TestFlight (beta testing) | Free | — |

**Requirements:**
- Apple ID with two-factor authentication

### Google Play Store
| Item | Cost | Frequency |
|---|---|---|
| Google Play Console registration | **$25 USD** | One-time |

**Requirements:**
- Google account
- Identity verification
- 20 testers for 14+ consecutive days before production (new requirement)

---

## 3. EAS (Expo Application Services)

EAS handles cloud builds, OTA updates, and app store submissions.

| Plan | Monthly Cost | Builds | OTA Update MAUs | Key Features |
|---|---|---|---|---|
| **Free** | **$0** | 15 Android + 15 iOS | 1,000 MAUs | Low-priority queue, 45-min timeout |
| **Starter** | **$19** | $45 build credit | 3,000 MAUs | High-priority queue, large workers |

---

## 4. Supabase (Backend / Database / Auth)

Supabase provides the PostgreSQL database, authentication, and real-time subscriptions.

| Plan | Monthly Cost | Database | Auth MAUs | Storage | Egress |
|---|---|---|---|---|---|
| **Free** | **$0** | 500 MB | 50,000 | 1 GB | 5 GB |
| **Pro** | **$25** | 8 GB (+ $0.125/GB) | 100,000 (+ $0.00325/MAU) | 100 GB (+ $0.021/GB) | 250 GB (+ $0.09/GB) |

---

## 5. Vercel (API Hosting)

Vercel hosts the BDI LMS API (`bdi-lms.vercel.app`).

| Plan | Monthly Cost | Key Inclusions |
|---|---|---|
| **Hobby** | **$0** | 100 GB bandwidth, 1M edge requests, serverless functions |

**Included on Hobby (Free):**

- 100 GB/mo Fast Data Transfer
- 1M edge requests/mo
- Serverless Functions: 4 hrs Active CPU, 1M invocations
- Automatic CI/CD, HTTPS, CDN
- DDoS mitigation

---

## 6. Cloudflare R2 (Media Storage)

R2 stores course videos, images, PDFs, and other media assets.

| Metric | Free Tier | Paid Rate |
|---|---|---|
| **Storage** | 10 GB/mo | $0.015/GB-month |
| **Class A Ops** (writes) | 1M requests/mo | $4.50/million |
| **Class B Ops** (reads) | 10M requests/mo | $0.36/million |
| **Egress** | **Free (always)** | **$0 (no egress fees)** |

**Example monthly cost for a small LMS:**
| Usage Scenario | Estimated Cost |
|---|---|
| 200 GB storage, moderate reads | ~$7.40/mo |

**Key advantage:** R2 has **zero egress fees**, making it extremely cost-effective for media delivery compared to AWS S3 or Google Cloud Storage.

---

## 7. Firebase (Push Notifications)

Firebase Cloud Messaging (FCM) is used for push notifications.

| Service | Cost |
|---|---|
| **Firebase Cloud Messaging (FCM)** | **Free — no limits** |

**Firebase FCM is completely free** with no message limits. This includes:
- Sending to individual devices
- Topic messaging
- Device group messaging
- Both Android and iOS

**Recommendation:** No cost expected. FCM remains free at any scale.

---

## 8. Recommended Starter Budget

### Phase 1: Development & Testing (Free Tier)

| Service | Monthly Cost |
|---|---|
| Expo (EAS Free) | $0 |
| Supabase (Free) | $0 |
| Vercel (Hobby) | $0 |
| Cloudflare R2 (Free) | $0 |
| Firebase FCM | $0 |
| **Monthly Total** | **$0** |

**One-time costs:**

| Item | Cost |
|---|---|
| Apple Developer Account | $99/year |
| Google Play Console | $25 (one-time) |
| Domain name | ~$0/year |
| Expo (EAS Starter) | $19/month |
| **One-Time Total** | **~$124** |

### Phase 2: Production Launch

| Service | Monthly Cost |
|---|---|
| Cloudflare R2 | ~$1–5 |
| **Monthly Total** | **~$5** |

