# Segment-spread calibration — 2026-08-12

Paths = analyzer-visible set after `prioritizeBlueprintFiles` + `FILE_LIMIT`
(FILE_LIMIT=400), Enrichment OFF — same catalog as blueprint-local.

## Thresholds chosen

- `MAX_SPREAD_FOR_DOMAIN = 2`
- `MIN_SIBLING_DOMAINS = 3`

Rationale: domain folders (e.g. browo `leaves`/`payroll`, erpnext `accounts`/`stock`)
usually have parentSpread ≤ 2 and sit beside ≥2 sibling dirs; repeated layer folders
(`models`/`controllers` in discourse) show parentSpread ≥ 2–many. Modules/app/backend
may still look domain-like by siblings alone — P0-10 must combine path position with these thresholds.

## actual

- files analyzed (capped): 400
- distinct segments: 78
- top-10 median-of-medianSiblings: 3

| segment          | files | spread | medianSiblings | domainCandidate? |
| ---------------- | ----: | -----: | -------------: | :--------------: |
| `packages`       |   398 |      1 |              1 |        no        |
| `src`            |   371 |      3 |              0 |        no        |
| `loot-core`      |   148 |      1 |              4 |       yes        |
| `server`         |   147 |      2 |              1 |        no        |
| `components`     |   123 |      1 |              0 |        no        |
| `desktop-client` |   123 |      1 |              4 |       yes        |
| `sync-server`    |   113 |      1 |              4 |       yes        |
| `budget`         |    98 |      3 |              4 |        no        |
| `app-gocardless` |    56 |      1 |              9 |       yes        |
| `banks`          |    47 |      1 |              2 |       yes        |

## browo-hr

- files analyzed (capped): 400
- distinct segments: 80
- top-10 median-of-medianSiblings: 2.5

| segment           | files | spread | medianSiblings | domainCandidate? |
| ----------------- | ----: | -----: | -------------: | :--------------: |
| `backend`         |   395 |      1 |              1 |        no        |
| `app`             |   394 |      1 |              1 |        no        |
| `modules`         |   394 |      1 |              0 |        no        |
| `internal`        |    99 |     18 |              0 |        no        |
| `auth`            |    72 |      1 |             43 |       yes        |
| `services`        |    51 |      7 |              3 |        no        |
| `users`           |    36 |      1 |             43 |       yes        |
| `time-management` |    30 |      1 |             43 |       yes        |
| `dto`             |    22 |      9 |              2 |        no        |
| `learning`        |    18 |      1 |             43 |       yes        |

## discourse

- files analyzed (capped): 400
- distinct segments: 122
- top-10 median-of-medianSiblings: 0

| segment       | files | spread | medianSiblings | domainCandidate? |
| ------------- | ----: | -----: | -------------: | :--------------: |
| `discourse`   |   400 |     22 |              0 |        no        |
| `frontend`    |   288 |      1 |              1 |        no        |
| `controllers` |   265 |     18 |              0 |        no        |
| `app`         |   158 |      1 |              4 |       yes        |
| `admin`       |   137 |      9 |              0 |        no        |
| `services`    |   122 |     14 |              0 |        no        |
| `assets`      |   112 |     21 |              0 |        no        |
| `javascripts` |   112 |     21 |              0 |        no        |
| `plugins`     |   112 |      1 |              1 |        no        |
| `chat`        |    34 |      2 |            9.5 |       yes        |

## erpnext

- files analyzed (capped): 400
- distinct segments: 141
- top-10 median-of-medianSiblings: 4.25

| segment           | files | spread | medianSiblings | domainCandidate? |
| ----------------- | ----: | -----: | -------------: | :--------------: |
| `erpnext`         |   400 |      1 |              0 |        no        |
| `doctype`         |   356 |      7 |              0 |        no        |
| `accounts`        |   311 |      1 |              9 |       yes        |
| `services`        |    89 |     18 |              0 |        no        |
| `stock`           |    31 |      1 |              9 |       yes        |
| `controllers`     |    22 |      2 |            4.5 |       yes        |
| `manufacturing`   |    18 |      1 |              9 |       yes        |
| `account`         |     9 |      1 |            101 |       yes        |
| `production_plan` |     9 |      1 |              2 |       yes        |
| `stock_entry`     |     9 |      1 |              4 |       yes        |

## formbricks

- files analyzed (capped): 400
- distinct segments: 165
- top-10 median-of-medianSiblings: 1

| segment      | files | spread | medianSiblings | domainCandidate? |
| ------------ | ----: | -----: | -------------: | :--------------: |
| `apps`       |   316 |      1 |              2 |       yes        |
| `web`        |   316 |      1 |              0 |        no        |
| `modules`    |   224 |      1 |              1 |        no        |
| `api`        |   203 |      6 |            2.5 |        no        |
| `v2`         |   115 |      3 |              1 |        no        |
| `ee`         |   111 |      1 |              6 |       yes        |
| `management` |    96 |      5 |              3 |        no        |
| `lib`        |    93 |     39 |              1 |        no        |
| `app`        |    92 |      1 |              1 |        no        |
| `components` |    82 |     13 |              0 |        no        |

## immich

- files analyzed (capped): 400
- distinct segments: 80
- top-10 median-of-medianSiblings: 2

| segment        | files | spread | medianSiblings | domainCandidate? |
| -------------- | ----: | -----: | -------------: | :--------------: |
| `src`          |   396 |      2 |              0 |        no        |
| `server`       |   310 |      1 |              2 |       yes        |
| `schema`       |   145 |      1 |              7 |       yes        |
| `migrations`   |    86 |      1 |              1 |        no        |
| `web`          |    86 |      1 |              2 |       yes        |
| `services`     |    73 |      2 |            3.5 |       yes        |
| `routes`       |    66 |      1 |              1 |        no        |
| `tables`       |    59 |      1 |              1 |        no        |
| `repositories` |    54 |      1 |              7 |       yes        |
| `controllers`  |    42 |      1 |              7 |       yes        |

## mastodon

- files analyzed (capped): 400
- distinct segments: 94
- top-10 median-of-medianSiblings: 3

| segment       | files | spread | medianSiblings | domainCandidate? |
| ------------- | ----: | -----: | -------------: | :--------------: |
| `app`         |   398 |      1 |              1 |        no        |
| `javascript`  |   398 |      1 |              0 |        no        |
| `mastodon`    |   398 |      1 |              0 |        no        |
| `components`  |   305 |     29 |              0 |        no        |
| `features`    |   232 |      1 |              5 |       yes        |
| `ui`          |    64 |      1 |             29 |       yes        |
| `compose`     |    30 |      2 |             15 |       yes        |
| `form_fields` |    23 |      1 |             39 |       yes        |
| `status`      |    23 |      3 |             29 |        no        |
| `containers`  |    21 |      9 |              1 |        no        |

## microservices-demo

- files analyzed (capped): 19
- distinct segments: 11
- top-10 median-of-medianSiblings: 3

| segment                 | files | spread | medianSiblings | domainCandidate? |
| ----------------------- | ----: | -----: | -------------: | :--------------: |
| `src`                   |    18 |      1 |              1 |        no        |
| `emailservice`          |     5 |      1 |              5 |       yes        |
| `recommendationservice` |     5 |      1 |              5 |       yes        |
| `paymentservice`        |     4 |      1 |              5 |       yes        |
| `currencyservice`       |     2 |      1 |              5 |       yes        |
| `components`            |     1 |      1 |              0 |        no        |
| `kustomize`             |     1 |      1 |              1 |        no        |
| `loadgenerator`         |     1 |      1 |              5 |       yes        |
| `scripts`               |     1 |      1 |              0 |        no        |
| `shopping-assistant`    |     1 |      1 |              0 |        no        |

## openproject

- files analyzed (capped): 400
- distinct segments: 183
- top-10 median-of-medianSiblings: 1

| segment         | files | spread | medianSiblings | domainCandidate? |
| --------------- | ----: | -----: | -------------: | :--------------: |
| `src`           |   385 |      2 |              0 |        no        |
| `frontend`      |   382 |      1 |              2 |       yes        |
| `app`           |   217 |      1 |              1 |        no        |
| `features`      |   185 |      1 |              2 |       yes        |
| `stimulus`      |   165 |      1 |              1 |        no        |
| `controllers`   |   164 |      1 |              1 |        no        |
| `work-packages` |   158 |      2 |             12 |       yes        |
| `components`    |   157 |      3 |              1 |        no        |
| `dynamic`       |   132 |      1 |              0 |        no        |
| `wp-fast-table` |    50 |      1 |              9 |       yes        |

## plane

- files analyzed (capped): 400
- distinct segments: 94
- top-10 median-of-medianSiblings: 1.25

| segment    | files | spread | medianSiblings | domainCandidate? |
| ---------- | ----: | -----: | -------------: | :--------------: |
| `apps`     |   336 |      1 |              2 |       yes        |
| `api`      |   171 |      2 |              4 |       yes        |
| `plane`    |   170 |      1 |              0 |        no        |
| `app`      |   168 |      4 |            1.5 |        no        |
| `web`      |   152 |      2 |              4 |       yes        |
| `core`     |   126 |      3 |              1 |        no        |
| `services` |   119 |      3 |              1 |        no        |
| `views`    |    78 |      2 |              3 |       yes        |
| `src`      |    74 |      4 |              0 |        no        |
| `modules`  |    69 |      8 |              0 |        no        |

## Rocket.Chat

- files analyzed (capped): 400
- distinct segments: 72
- top-10 median-of-medianSiblings: 3.5

| segment          | files | spread | medianSiblings | domainCandidate? |
| ---------------- | ----: | -----: | -------------: | :--------------: |
| `server`         |   328 |      5 |              0 |        no        |
| `apps`           |   308 |      2 |              4 |       yes        |
| `src`            |   277 |     11 |              0 |        no        |
| `packages`       |   274 |      2 |            1.5 |        no        |
| `meteor`         |   119 |      1 |              1 |        no        |
| `meteor-methods` |    66 |      1 |              4 |       yes        |
| `accessors`      |    64 |      1 |             13 |       yes        |
| `bridges`        |    36 |      1 |             13 |       yes        |
| `ee`             |    36 |      1 |              3 |       yes        |
| `rooms`          |    33 |      2 |              8 |       yes        |

## saleor

- files analyzed (capped): 400
- distinct segments: 55
- top-10 median-of-medianSiblings: 17

| segment       | files | spread | medianSiblings | domainCandidate? |
| ------------- | ----: | -----: | -------------: | :--------------: |
| `saleor`      |   399 |      1 |              0 |        no        |
| `graphql`     |   353 |      1 |             22 |       yes        |
| `mutations`   |   254 |     15 |              1 |        no        |
| `account`     |    55 |      2 |             10 |       yes        |
| `core`        |    47 |      2 |           19.5 |       yes        |
| `discount`    |    35 |      2 |           19.5 |       yes        |
| `product`     |    35 |      3 |             17 |        no        |
| `checkout`    |    34 |      2 |           19.5 |       yes        |
| `app`         |    32 |      1 |             17 |       yes        |
| `dataloaders` |    25 |      5 |              1 |        no        |

## Spot checks (not only top-10)

### browo-hr

| segment   | files | spread | medianSiblings | domainCandidate? |
| --------- | ----: | -----: | -------------: | :--------------: |
| `leaves`  |     9 |      1 |             43 |       yes        |
| `auth`    |    72 |      1 |             43 |       yes        |
| `modules` |   394 |      1 |              0 |        no        |
| `backend` |   395 |      1 |              1 |        no        |

### discourse

| segment       | files | spread | medianSiblings | domainCandidate? |
| ------------- | ----: | -----: | -------------: | :--------------: |
| `controllers` |   265 |     18 |              0 |        no        |

### erpnext

| segment    | files | spread | medianSiblings | domainCandidate? |
| ---------- | ----: | -----: | -------------: | :--------------: |
| `accounts` |   311 |      1 |              9 |       yes        |
| `stock`    |    31 |      1 |              9 |       yes        |
