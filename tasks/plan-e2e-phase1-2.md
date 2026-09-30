# Plan: E2E Encryption — Phase 1 (Schema) + Phase 2 (Key Management Endpoints)

**Spec measured against:** `tasks/spec-e2e-encryption.md` (design §2–3, decisions #1–8).
**Scope:** ONLY the two backend-only, additive phases. No `SendMessageDto`/`ChatService` change (Phase 3), no web crypto (Phase 4). Both phases below ship with **zero behavior change** for any existing client — nothing today reads or writes the new tables/endpoints.

---

## 0. Current state (verified against the code, not the spec's prose)

- Latest migration: `0016_move_chat_tables_to_chat_schema.sql`. Next migration is `0017_<generated-name>.sql` (drizzle-kit names it; not predictable ahead of `db:generate`).
- `chat.schema.ts` currently imports `check, index, text, timestamp, uniqueIndex, uuid` from `drizzle-orm/pg-core` — needs `boolean`, `integer`, `jsonb` added.
- `messages_body_length_max` check is `char_length(body) <= 4000` today (`chat.schema.ts:93`).
- The `SKIP LOCKED` claim idiom this plan reuses for one-time prekeys already exists verbatim in `outbox.service.ts:175-197` (`claim()` — raw `sql` subquery, `for update skip locked`, `.returning()`). Same pattern, new table.
- `chat.module.ts` currently: `controllers: [ChatController]`, `providers: [ChatService, ConnectionRegistry, HeartbeatService, ChatGateway]`.
- Test convention (`chat.service.spec.ts`): a hand-built `makeDb()` mock with `jest.fn()` per Drizzle verb, plus small chain-shape helpers (`limitQuery`, `whereQuery`, ...) matching each query's exact `.from().where()....` shape. New tests follow the same style.

---

## Phase 1 — Schema

### 1.1 `chat.schema.ts` — new tables

Append to the existing file (same `chat` Postgres schema as `conversations`/`messages` — this key material exists only to serve `ChatModule`, same ownership rule as everything else in the file):

```ts
// imports gain: boolean, integer, jsonb

export const userE2eIdentities = chatSchema.table("user_e2e_identities", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  identityKey: text("identity_key").notNull(), // base64 Curve25519 public key
  registrationId: integer("registration_id").notNull(),
  signedPrekeyId: integer("signed_prekey_id").notNull(),
  signedPrekeyPublic: text("signed_prekey_public").notNull(), // base64
  signedPrekeySignature: text("signed_prekey_signature").notNull(), // base64
  signedPrekeyCreatedAt: timestamp("signed_prekey_created_at", {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserE2eIdentityRow = typeof userE2eIdentities.$inferSelect;
export type NewUserE2eIdentity = typeof userE2eIdentities.$inferInsert;

export const userE2eOneTimePrekeys = chatSchema.table(
  "user_e2e_one_time_prekeys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prekeyId: integer("prekey_id").notNull(),
    publicKey: text("public_key").notNull(), // base64
    usedAt: timestamp("used_at", { withTimezone: true }), // null = available
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_e2e_otp_user_prekey_uq").on(t.userId, t.prekeyId),
    // Serves the claim query in E2eKeysService.getBundle: only unused rows,
    // scoped to one user — same partial-index shape as
    // messages_conversation_unread_idx (chat.schema.ts) and
    // users_username_active_uq (users.schema.ts).
    index("user_e2e_otp_available_idx")
      .on(t.userId)
      .where(sql`used_at is null`),
  ],
);

export type UserE2eOneTimePrekeyRow = typeof userE2eOneTimePrekeys.$inferSelect;
export type NewUserE2eOneTimePrekey = typeof userE2eOneTimePrekeys.$inferInsert;
```

### 1.2 `chat.schema.ts` — `messages` table additions

```ts
// New E2eHeader type, exported next to the messages table — same convention
// as FieldDef in categories.schema.ts (a JSONB column's shape defined and
// exported from the schema file, reused by the DTO/service).
export interface E2eHeader {
  v: 1;
  dh: string; // base64 — sender's current ratchet public key
  pn: number; // previous sending chain length
  n: number; // message number in the current sending chain
  // Present only on the first message of a new session (X3DH initial message):
  identityKey?: string;
  ephemeralKey?: string;
  oneTimePrekeyId?: number;
  signedPrekeyId?: number;
}

// messages table — new columns:
isE2e: boolean('is_e2e').default(false).notNull(),
e2eHeader: jsonb('e2e_header').$type<E2eHeader | null>(),
```

**Check constraint update** — replace the existing `messages_body_length_max`:

```ts
// was: check('messages_body_length_max', sql`char_length(body) <= 4000`),
check('messages_body_length_max', sql`char_length(body) <= 24000`),
```

Per spec decision #8: 24000 is a provisional cap (covers worst-case 4000-char multibyte plaintext through AES-GCM + base64 expansion, computed on paper) — applied uniformly to both legacy plaintext and future ciphertext rows rather than branching the constraint on `is_e2e`, since a generous cap on legacy rows costs nothing. Real value gated on the Phase 5 measurement checklist in the spec.

No change to `messages_content_present` or `messages_image_pair` — orthogonal to this addition.

### 1.3 Migration

```bash
pnpm --filter backend db:generate   # produces drizzle/migrations/0017_<name>.sql
```

Read the generated SQL before applying — confirm it's purely additive (2 new tables, 2 new columns with a `not null default false` on `is_e2e` so the `ALTER TABLE` doesn't need a backfill step, and one `DROP CONSTRAINT` + `ADD CONSTRAINT` pair for the check). Then:

```bash
pnpm --filter backend db:migrate
```

**Gate:** migration applies clean against the dev DB; existing `sendMessage` flow (manual smoke test or the existing `chat.service.spec.ts` suite) is untouched — nothing in Phase 1 is referenced by any running code yet, so this is a pure regression check, not new-behavior verification.

### 1.4 Files touched — Phase 1

**Modified:** `apps/backend/src/db/schema/chat.schema.ts` only.
**New:** `apps/backend/drizzle/migrations/0017_<generated>.sql` (+ its `meta/` entry).

---

## Phase 2 — Key management endpoints

### 2.1 Module shape

New subfolder, per the spec's own suggestion once it's more than a couple of methods:

```
apps/backend/src/chat/e2e/
  dto/
    register-e2e-keys.dto.ts
    one-time-prekey.dto.ts
  e2e-keys.types.ts        (E2eKeyBundle response shape)
  e2e-keys.controller.ts
  e2e-keys.service.ts
```

No new Nest module — registered directly in the existing `ChatModule` (same pattern the spec called out: "no new module needed").

### 2.2 DTOs

`dto/one-time-prekey.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Min, MaxLength } from "class-validator";

export class OneTimePrekeyDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  prekeyId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  publicKey: string;
}
```

`dto/register-e2e-keys.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { OneTimePrekeyDto } from "./one-time-prekey.dto";

export class RegisterE2eKeysDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identityKey: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  registrationId: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  signedPrekeyId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  signedPrekeyPublic: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  signedPrekeySignature: string;

  @ApiProperty({ type: [OneTimePrekeyDto] })
  @IsArray()
  @ArrayMaxSize(200) // DoS guard — spec's steady-state batch is ~100
  @ValidateNested({ each: true })
  @Type(() => OneTimePrekeyDto)
  oneTimePrekeys: OneTimePrekeyDto[];
}
```

`e2e-keys.types.ts`:

```ts
export interface E2eKeyBundle {
  identityKey: string;
  registrationId: number;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekey: { prekeyId: number; publicKey: string } | null;
}
```

### 2.3 `e2e-keys.service.ts`

```ts
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../../db/drizzle.provider";
import type { DbClient } from "../../db/drizzle.provider";
import {
  userE2eIdentities,
  userE2eOneTimePrekeys,
} from "../../db/schema/chat.schema";
import type { RegisterE2eKeysDto } from "./dto/register-e2e-keys.dto";
import type { E2eKeyBundle } from "./e2e-keys.types";

@Injectable()
export class E2eKeysService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /**
   * Upserts the identity + signed prekey (a re-registration rotates them —
   * this is also how a second device silently invalidates the first
   * device's sessions, by design: spec decision #2 / design §9) and inserts
   * any one-time prekeys not already present. Public material only —
   * nothing here ever sees a private key.
   */
  async registerKeys(
    userId: string,
    dto: RegisterE2eKeysDto,
  ): Promise<{ accepted: number }> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(userE2eIdentities)
        .values({
          userId,
          identityKey: dto.identityKey,
          registrationId: dto.registrationId,
          signedPrekeyId: dto.signedPrekeyId,
          signedPrekeyPublic: dto.signedPrekeyPublic,
          signedPrekeySignature: dto.signedPrekeySignature,
          signedPrekeyCreatedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: userE2eIdentities.userId,
          set: {
            identityKey: dto.identityKey,
            registrationId: dto.registrationId,
            signedPrekeyId: dto.signedPrekeyId,
            signedPrekeyPublic: dto.signedPrekeyPublic,
            signedPrekeySignature: dto.signedPrekeySignature,
            signedPrekeyCreatedAt: sql`now()`,
            updatedAt: sql`now()`,
          },
        });

      if (dto.oneTimePrekeys.length > 0) {
        await tx
          .insert(userE2eOneTimePrekeys)
          .values(
            dto.oneTimePrekeys.map((k) => ({
              userId,
              prekeyId: k.prekeyId,
              publicKey: k.publicKey,
            })),
          )
          // Matches the partial unique index — a replayed registration call
          // (e.g. a retried request) never duplicates a prekey id.
          .onConflictDoNothing({
            target: [
              userE2eOneTimePrekeys.userId,
              userE2eOneTimePrekeys.prekeyId,
            ],
          });
      }
    });

    return { accepted: dto.oneTimePrekeys.length };
  }

  /**
   * Fetches a bundle to start an X3DH handshake, atomically claiming one
   * one-time prekey in the same shape as OutboxService.claim() — SKIP LOCKED
   * so concurrent callers never claim the same row twice. A null
   * `oneTimePrekey` (pool exhausted) is a graceful degradation, not an
   * error: X3DH can proceed on the signed prekey alone.
   */
  async getBundle(userId: string): Promise<E2eKeyBundle> {
    const [identity] = await this.db
      .select()
      .from(userE2eIdentities)
      .where(eq(userE2eIdentities.userId, userId))
      .limit(1);
    if (!identity)
      throw new NotFoundException("User has not registered E2E keys");

    const [claimed] = await this.db
      .update(userE2eOneTimePrekeys)
      .set({ usedAt: sql`now()` })
      .where(
        sql`${userE2eOneTimePrekeys.id} in (
          select ${userE2eOneTimePrekeys.id} from ${userE2eOneTimePrekeys}
          where ${userE2eOneTimePrekeys.userId} = ${userId}
            and ${userE2eOneTimePrekeys.usedAt} is null
          order by ${userE2eOneTimePrekeys.prekeyId}
          for update skip locked
          limit 1
        )`,
      )
      .returning();

    return {
      identityKey: identity.identityKey,
      registrationId: identity.registrationId,
      signedPrekeyId: identity.signedPrekeyId,
      signedPrekeyPublic: identity.signedPrekeyPublic,
      signedPrekeySignature: identity.signedPrekeySignature,
      oneTimePrekey: claimed
        ? { prekeyId: claimed.prekeyId, publicKey: claimed.publicKey }
        : null,
    };
  }

  async getPrekeyCount(userId: string): Promise<{ available: number }> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userE2eOneTimePrekeys)
      .where(
        and(
          eq(userE2eOneTimePrekeys.userId, userId),
          isNull(userE2eOneTimePrekeys.usedAt),
        ),
      );
    return { available: row?.count ?? 0 };
  }
}
```

### 2.4 `e2e-keys.controller.ts`

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/api-response.types";
import { E2eKeysService } from "./e2e-keys.service";
import { RegisterE2eKeysDto } from "./dto/register-e2e-keys.dto";

@ApiTags("chats")
@ApiBearerAuth()
@Controller("chats/e2e/keys")
export class E2eKeysController {
  constructor(private readonly e2eKeysService: E2eKeysService) {}

  @Post()
  @ApiOperation({ summary: "Register or rotate this account's E2E keys" })
  registerKeys(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterE2eKeysDto,
  ) {
    return this.e2eKeysService.registerKeys(user.id, dto);
  }

  @Get("me/prekey-count")
  @ApiOperation({ summary: "Remaining one-time prekeys for replenishment" })
  getPrekeyCount(@CurrentUser() user: RequestUser) {
    return this.e2eKeysService.getPrekeyCount(user.id);
  }

  @Get(":userId/bundle")
  @ApiOperation({ summary: "Fetch a key bundle to start an X3DH session" })
  getBundle(@Param("userId", ParseUUIDPipe) userId: string) {
    return this.e2eKeysService.getBundle(userId);
  }
}
```

Route order is `me/prekey-count` before `:userId/bundle` — not strictly required here (the two routes have different literal second segments, so there's no actual Express ambiguity), but keeping static-before-dynamic is the safer default and costs nothing.

### 2.5 `chat.module.ts`

```ts
import { E2eKeysController } from "./e2e/e2e-keys.controller";
import { E2eKeysService } from "./e2e/e2e-keys.service";

@Module({
  imports: [AuthModule],
  controllers: [ChatController, E2eKeysController],
  providers: [
    ChatService,
    ConnectionRegistry,
    HeartbeatService,
    ChatGateway,
    E2eKeysService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
```

No export of `E2eKeysService` — nothing outside `ChatModule` needs it (Phase 3's `ChatService` changes are pure DTO/column passthrough, no call into this service).

### 2.6 Tests — `e2e-keys.service.spec.ts`

Same mock style as `chat.service.spec.ts` (`makeDb()` + chain-shape helpers). Cases:

1. **`registerKeys` upserts the identity** — asserts `insert(userE2eIdentities)...onConflictDoUpdate({ target: userE2eIdentities.userId, ... })` is called with the DTO's fields.
2. **`registerKeys` re-registration rotates the signed prekey without touching existing one-time prekeys' `usedAt`** — call twice with overlapping `oneTimePrekeys` ids; assert the second call's insert uses `onConflictDoNothing` targeting `(userId, prekeyId)` (so a duplicate id is silently skipped, never re-inserted/reset).
3. **`registerKeys` with an empty `oneTimePrekeys` array skips the second insert entirely** — a re-registration that's pure prekey-topup-less rotation shouldn't touch the prekey table.
4. **`getBundle` throws `NotFoundException`** when no identity row exists for the target user.
5. **`getBundle` returns `oneTimePrekey: null`** when the identity exists but the claim query returns no row (pool exhausted) — graceful degradation path, not an error.
6. **`getBundle` returns the claimed prekey's `{prekeyId, publicKey}`** when one is available.
7. **`getPrekeyCount` returns `0`** when no rows, and the actual count otherwise.

**Explicitly NOT covered by unit tests (flagged, not silently skipped):** the actual `SKIP LOCKED` concurrency guarantee — that two simultaneous `getBundle` calls for the same user never claim the same prekey — can't be verified against a mocked `db`. That needs an integration test against a real Postgres instance (parallel `Promise.all` of two `getBundle` calls, assert the two returned `oneTimePrekey.prekeyId` values differ). Recommend adding this as a `test:e2e` case once Phase 2 lands; not blocking the unit-test gate below.

### 2.7 Files touched — Phase 2

**New:** `apps/backend/src/chat/e2e/{e2e-keys.controller,e2e-keys.service,e2e-keys.types}.ts`, `apps/backend/src/chat/e2e/dto/{register-e2e-keys,one-time-prekey}.dto.ts`, `apps/backend/src/chat/e2e/e2e-keys.service.spec.ts`.
**Modified:** `apps/backend/src/chat/chat.module.ts`.

---

## Rollout / verification checklist

1. `pnpm --filter backend db:generate` → read the generated SQL → `pnpm --filter backend db:migrate`.
2. `pnpm --filter backend test` — full suite green, including the new `e2e-keys.service.spec.ts`.
3. `pnpm --filter backend build` — type gate.
4. `pnpm --filter backend lint`.
5. Manual smoke test (curl/Postman, real dev DB): `POST /api/v1/chats/e2e/keys` with a fake identity + 3 fake one-time prekeys → `GET /api/v1/chats/e2e/keys/me/prekey-count` returns `3` → `GET /api/v1/chats/e2e/keys/:userId/bundle` (as a second user) returns the bundle with one prekey and consumes it → repeat the count check → `2`.
6. Confirm **zero regression** in existing chat behavior: `pnpm --filter backend test -- --testPathPatterns=chat.service` still fully green, since nothing in Phase 1/2 touches `ChatService`, `SendMessageDto`, or any existing route.

## Explicitly deferred (not in this plan)

- `SendMessageDto`/`ChatService`/`chat.types.ts` changes (`isE2e`/`e2eHeader` passthrough) — Phase 3.
- Any web/client code — Phase 4.
- The real `messages_body_length_max` measurement — Phase 5.
- The `SKIP LOCKED` concurrency integration test named in §2.6 — recommended, not gating.

## Open questions carried from the spec

Same two genuinely-open items as `tasks/spec-e2e-encryption.md` (OQ-4 web key-storage weakness, OQ-5 per-conversation vs per-message `isE2e` framing) — neither affects Phase 1/2, both are Phase 4 concerns.
