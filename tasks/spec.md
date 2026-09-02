# Chat Module Production Architecture Specification

**Status:** Proposed  
**Target:** Existing NestJS chat module  
**Primary goal:** Evolve the chat/message feature toward a production-grade architecture using PostgreSQL, ScyllaDB, Redis, domain/application boundaries, asynchronous delivery, bounded concurrency, idempotency, observability, and failure-aware design.

---

## 1. Purpose

This specification defines how the existing NestJS chat module should evolve into a high-throughput messaging subsystem.

The architecture separates data by semantics and workload:

```text
PostgreSQL
    = relational business truth

ScyllaDB
    = durable, high-volume message data

Redis
    = ephemeral/live state and fast coordination
```

The system must remain understandable and incrementally adoptable. Distributed infrastructure must only be introduced where the workload or reliability requirement justifies it.

The central rule is:

> Choose storage and concurrency mechanisms according to data semantics, access patterns, consistency requirements, and measured workload—not because the technology is fashionable.

---

## 2. Source Basis

This specification uses the following uploaded references as architectural foundations:

### Functional Programming in Scala

Relevant ideas:

- pure functions and referential transparency
- explicit state transformations
- explicit error values
- separating description from evaluation
- functional parallelism
- property-based testing
- controlled effects and local mutation
- stream processing and resource-safe concurrency

The intended application is not to turn NestJS into Scala. The goal is to apply the reasoning style: keep business decisions deterministic and make effects explicit.

### Patterns of Enterprise Application Architecture — Martin Fowler

Relevant ideas:

- layering
- service/application boundaries
- domain model
- data mapping
- transactions
- concurrency control
- isolation and immutability
- session/state considerations
- messaging and distribution

### Domain-Driven Design with Java

Relevant ideas:

- bounded contexts
- ubiquitous language
- entities and value objects
- aggregates and aggregate roots
- repositories
- domain services
- domain events
- modular boundaries
- distributed-system trade-offs

### Building Modern SaaS Applications with C# and .NET

Relevant ideas:

- idempotent APIs
- decoupling
- design for failure
- monitoring and logging
- scalability
- partitioning and sharding
- caching
- asynchronous communication
- stateless services
- rate limiting
- operational readiness

These references support the architectural principles; concrete NestJS/ScyllaDB/Redis implementation details in this specification are implementation decisions for this project.

---

# 3. Scope

## 3.1 In scope

The chat module includes:

- direct messages
- group/channel messages
- message persistence
- message retrieval
- message edits
- message deletion
- reactions
- read state / read cursors
- presence
- typing indicators
- WebSocket delivery
- message authorization
- rate limiting
- idempotent message submission
- durable event publication
- background processing
- observability
- recovery after process/node failure

## 3.2 Initially out of scope

Do not introduce these unless requirements justify them:

- globally distributed active-active chat
- multi-region writes
- custom consensus systems
- event sourcing of every aggregate
- service mesh
- dozens of microservices
- distributed transactions across databases
- Redis as durable message storage
- ScyllaDB for relational metadata
- Kafka/Pulsar solely because the architecture diagram contains it

---

# 4. Architectural Principles

## 4.1 Three storage responsibilities

| System | Responsibility | Durability |
|---|---|---|
| PostgreSQL | Users, channels, membership, permissions, configuration | Durable |
| ScyllaDB | Messages and high-volume message state | Durable |
| Redis | Presence, typing, rate limits, connection routing, cache, transient fan-out | Ephemeral |

The same conceptual rule applies throughout the module:

```text
"What is true about the business?"
    -> PostgreSQL

"What permanently happened?"
    -> ScyllaDB

"What is happening right now?"
    -> Redis
```

## 4.2 One authoritative owner per data type

Every important data item must have one authoritative store.

Example:

```text
Channel membership
    -> PostgreSQL

Message
    -> ScyllaDB

Presence
    -> Redis
```

Redis may cache PostgreSQL or ScyllaDB data, but cached data must not silently become the authoritative source.

## 4.3 Pure core, effectful shell

Business decisions should be expressed as deterministic operations wherever practical.

Conceptually:

```text
Command
   |
   v
Validate / authorize input
   |
   v
Domain decision
   |
   v
New state + domain events
   |
   v
Infrastructure effects
```

Domain code should not directly call:

- PostgreSQL
- ScyllaDB
- Redis
- WebSocket adapters
- HTTP providers
- clocks
- random generators
- logging infrastructure

Those belong to application/infrastructure boundaries.

## 4.4 Explicit dependencies

Prefer:

```ts
domainDecision(message, channelPolicy, actor)
```

over hidden work such as:

```ts
domainDecision(messageId)
```

where the function secretly performs database/network operations.

## 4.5 At-least-once assumption

The system must assume that asynchronous delivery can happen more than once.

Therefore:

```text
delivery != exactly once
```

Consumers and handlers must be idempotent.

## 4.6 Durable state before transient delivery

The canonical message flow is:

```text
accept command
    |
    v
validate / authorize
    |
    v
persist durable message
    |
    v
record durable publication intent
    |
    v
publish/fan-out
    |
    v
WebSocket clients
```

A transient notification must never be the only copy of a message.

---

# 5. Target Architecture

```text
                         CLIENTS
              HTTP / WebSocket / Mobile / Web
                              |
                              v
                    +-------------------+
                    | API / WS Gateway  |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    | Chat Application   |
                    | Use Cases          |
                    +---------+---------+
                              |
                    +---------+----------+
                    |                    |
                    v                    v
             Domain Core           Authorization
                    |                    |
                    +---------+----------+
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
        PostgreSQL        ScyllaDB           Redis
        metadata          messages          live state
             |                |                |
             +----------------+----------------+
                              |
                              v
                    Event / Delivery Layer
                              |
                              v
                    WebSocket fan-out
```

A more detailed runtime path:

```text
Client
  |
  v
WebSocket Gateway
  |
  v
SendMessageUseCase
  |
  +--> PostgreSQL
  |      authorization / membership
  |
  +--> Domain decision
  |
  +--> ScyllaDB
  |      durable message
  |
  +--> durable event/publication record
  |
  v
Delivery pipeline
  |
  +--> Redis Pub/Sub or broker
  |
  +--> WS-1
  +--> WS-2
  +--> WS-N
```

---

# 6. Module Boundaries in NestJS

The existing module should be organized around business capabilities rather than database technology.

Recommended structure:

```text
src/chat/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── errors/
│   ├── policies/
│   └── services/
│
├── application/
│   ├── commands/
│   ├── queries/
│   ├── handlers/
│   ├── ports/
│   └── dto/
│
├── infrastructure/
│   ├── postgres/
│   ├── scylla/
│   ├── redis/
│   ├── messaging/
│   └── websocket/
│
├── presentation/
│   ├── http/
│   └── websocket/
│
└── chat.module.ts
```

Do not create a structure such as:

```text
chat/
├── postgres/
├── redis/
├── scylla/
└── services/
```

where business logic becomes coupled to storage.

Storage belongs under infrastructure because it is an implementation detail of the application/domain requirements.

---

# 7. Domain Model

## 7.1 Core concepts

The initial domain vocabulary should include:

```text
User
Conversation
Channel
Membership
Message
MessageReaction
ReadCursor
```

The exact aggregate boundaries must follow business invariants.

## 7.2 Message

A message should have a stable identity.

Conceptually:

```ts
type Message = {
  id: MessageId;
  conversationId: ConversationId;
  senderId: UserId;
  clientMessageId: ClientMessageId;
  body: MessageBody;
  createdAt: Instant;
  sequence: MessageSequence;
  version: number;
};
```

The domain should not know that this is stored in ScyllaDB.

## 7.3 Value objects

Prefer value objects for concepts with meaningful validation:

```text
MessageId
ConversationId
UserId
ClientMessageId
MessageSequence
MessageBody
```

Example:

```ts
MessageBody.create(raw)
```

can reject invalid content before persistence.

---

# 8. Aggregate Boundaries

Do not make one enormous:

```text
ChatAggregate
```

containing every message and member.

A conversation with millions of messages cannot be an in-memory aggregate.

Instead:

```text
Conversation
    |
    +-- membership / policy boundary

Message
    |
    +-- individual message lifecycle

ReadCursor
    |
    +-- user's read position
```

The aggregate boundary should protect invariants, not represent every row related to a conversation.

Rule:

> If two pieces of state must change atomically to preserve a business invariant, they probably belong in the same transactional boundary.

---

# 9. PostgreSQL Responsibilities

PostgreSQL owns relational metadata.

Recommended initial entities:

```text
users
conversations
conversation_members
roles
permissions
blocks
channel_settings
```

Potentially:

```text
message_delivery_preferences
```

if the business requires them.

PostgreSQL should answer:

```text
Is this user a member?
Does this user have permission?
Who belongs to this conversation?
What is this conversation?
What policy applies?
```

It should not become the primary high-volume message history store once the system has a justified ScyllaDB workload.

---

# 10. ScyllaDB Responsibilities

ScyllaDB owns durable, high-volume message data.

Potential tables should be designed from query patterns.

Example logical table:

```text
messages_by_conversation_bucket
```

Conceptually:

```text
partition:
    conversation_id
    time_bucket

clustering:
    sequence
```

Fields may include:

```text
message_id
conversation_id
sender_id
client_message_id
sequence
created_at
body
version
edited_at
deleted_at
```

The exact primary key must be validated against expected traffic, partition size, retention, and hot-conversation behavior.

## 10.1 Query-first modeling

Before creating a Scylla table, define:

```text
Q1: latest messages in a conversation
Q2: messages after sequence N
Q3: messages around message ID
Q4: message by ID
Q5: edits/deletions
```

Then design the table.

Do not start with:

```text
Message entity -> table
```

and discover query performance later.

## 10.2 Hot partition prevention

Avoid blindly using:

```text
PRIMARY KEY (conversation_id)
```

for potentially enormous or extremely active conversations.

Consider:

```text
conversation_id + time_bucket
```

and, if necessary, an additional controlled distribution dimension.

The partition strategy must be load-tested using realistic hot-channel traffic.

---

# 11. Redis Responsibilities

Redis is an ephemeral/coordination layer.

Recommended uses:

```text
presence
typing indicators
rate limiting
connection registry
short-lived locks where genuinely needed
hot metadata cache
transient pub/sub fan-out
```

Example:

```text
presence:user:{userId}
typing:{conversationId}:{userId}
connection:user:{userId}
ratelimit:user:{userId}:send-message
```

Every ephemeral key must have a deliberate TTL where appropriate.

Redis failures must not destroy durable message history.

---

# 12. Redis Failure Policy

The system must classify Redis features according to whether they are optional.

Example:

```text
Presence unavailable
    -> presence temporarily unknown/offline

Typing unavailable
    -> typing indicator unavailable

Rate limiter unavailable
    -> fail closed for sensitive operations
       OR use a bounded local fallback
       according to security requirements

Message history unavailable
    -> do not pretend Redis can replace ScyllaDB
```

Do not make Redis a hidden mandatory dependency for durable correctness unless the specific operation truly requires it.

---

# 13. Message Submission

## 13.1 Command

The application layer receives:

```ts
SendMessageCommand {
  actorId
  conversationId
  clientMessageId
  body
}
```

`clientMessageId` is required for idempotent retries.

## 13.2 Processing

```text
1. Authenticate actor
2. Validate command
3. Load required conversation/member metadata
4. Check authorization
5. Check message submission policy/rate limit
6. Execute domain decision
7. Persist durable message
8. Persist publication intent
9. Commit
10. Deliver asynchronously
11. Return message identity/accepted state
```

The exact transaction arrangement depends on the selected event transport.

---

# 14. Idempotent Message Submission

Clients may retry because of:

```text
network timeout
WebSocket reconnect
HTTP retry
mobile backgrounding
server timeout
```

Therefore:

```text
(actorId, conversationId, clientMessageId)
```

must identify one logical submission.

Repeated submission should not create duplicate messages.

Conceptually:

```text
request(clientMessageId=X)
       |
       v
does X already exist?
   |          |
  yes         no
   |          |
return      create
existing      |
message       v
          durable write
```

The uniqueness mechanism must be durable.

Do not implement idempotency only with an in-memory Set.

---

# 15. Message Ordering

Do not assume:

```text
created_at
```

is sufficient for conversation ordering under concurrent writers.

The system should define what "message order" means.

Possible model:

```text
conversation sequence
```

where each durable message receives a sequence value.

The source of the sequence must be explicitly defined and tested under concurrent writers.

Requirements:

- no duplicate sequence for the same ordering domain
- deterministic retrieval order
- reconnect/resume can use sequence
- clients can detect gaps

If strict global ordering is not required, do not pay the cost of enforcing it.

Prefer the weakest ordering guarantee that satisfies the product requirement.

---

# 16. WebSocket Delivery

WebSocket nodes are delivery nodes, not durable message stores.

```text
WS-1
WS-2
WS-3
...
```

must remain horizontally scalable.

Connection-local state should be minimized.

The node should know:

```text
which connections it owns
```

but not become the authoritative owner of messages.

---

# 17. Connection Registry

Redis can map:

```text
userId -> connection/node
```

Example:

```text
connection:user:{userId}
    {
      nodeId,
      connectionId,
      expiresAt
    }
```

The exact data model depends on whether users can have:

- multiple devices
- multiple browser tabs
- multiple simultaneous connections

Assume multiple connections unless product requirements explicitly prohibit them.

---

# 18. Message Fan-Out

Recommended conceptual flow:

```text
Message persisted
       |
       v
MessageCreated event
       |
       v
delivery transport
       |
       v
Redis Pub/Sub or durable broker
       |
       +----> WS-1
       +----> WS-2
       +----> WS-3
```

Redis Pub/Sub should be treated as a transient real-time signal.

It must not be the only representation of the message.

---

# 19. Reconnection and Gap Recovery

Clients must maintain a durable progress marker.

Example:

```text
lastReceivedSequence = 19382
```

After reconnect:

```text
client -> server:
resume conversation X after 19382
```

Server:

```text
ScyllaDB
    |
    v
messages > 19382
```

Then normal real-time delivery resumes.

This makes transient delivery loss recoverable.

---

# 20. Read State

Prefer a read cursor when the business requirement is:

> "What is the latest message the user has read?"

Conceptually:

```text
user_id
conversation_id
last_read_sequence
updated_at
```

This is often preferable to a durable row for every `(user, message)` pair.

If the product explicitly requires per-message receipt semantics, model that separately and estimate its write/storage volume before selecting the persistence strategy.

---

# 21. Typing Indicators

Typing is ephemeral.

Flow:

```text
client
  |
  v
WebSocket
  |
  v
Redis
  |
  v
fan-out
  |
  v
other clients
```

Use TTL-based state.

Example conceptual policy:

```text
typing key TTL = a few seconds
client heartbeat/refresh
```

No PostgreSQL or ScyllaDB write should occur for every typing event.

---

# 22. Presence

Presence should be heartbeat-based.

Conceptually:

```text
client
   |
heartbeat
   |
   v
Redis
   |
TTL
```

If the heartbeat stops:

```text
TTL expires
    |
    v
presence no longer active
```

Do not require an explicit "offline" write for correctness.

The presence system must tolerate stale/unknown states.

---

# 23. Rate Limiting

At minimum define limits for:

```text
messages / second / user
messages / second / conversation
WebSocket connection attempts
authentication attempts
typing events
read updates
```

Redis is the default coordination layer.

The rate limiter must be bounded and should not create unbounded Redis keys.

Every policy needs:

```text
window
limit
key
expiry
failure behavior
```

---

# 24. Domain Events

Domain events represent facts:

```text
MessageSent
MessageEdited
MessageDeleted
ReactionAdded
ReadCursorAdvanced
```

An event should contain:

```text
eventId
eventType
aggregate/entity ID
occurredAt
schemaVersion
payload
```

Events are immutable.

Domain events must not contain infrastructure-specific objects.

Bad:

```ts
MessageSent {
  redisClient,
  scyllaSession,
  socket
}
```

Good:

```ts
MessageSent {
  eventId,
  messageId,
  conversationId,
  senderId,
  sequence,
  occurredAt,
  schemaVersion
}
```

---

# 25. Durable Event Publication

The system must prevent:

```text
message saved
but
event permanently lost
```

Where a transactional relational outbox is available, use:

```text
business state
+
outbox
```

in the same transactional resource.

However, ScyllaDB and PostgreSQL are separate persistence systems. Do not claim that a PostgreSQL outbox transaction automatically makes a ScyllaDB write and PostgreSQL outbox write atomic.

For the chat path, choose and document one of these explicit designs:

### Option A — Scylla-native durable event/publication state

Persist the message and a delivery/publication record in the same Scylla consistency model if the required semantics can be implemented safely.

### Option B — Durable broker/write protocol

Use a messaging mechanism whose delivery semantics are compatible with the message write path.

### Option C — PostgreSQL as command/idempotency/outbox authority

Persist the command/idempotency/publication intent transactionally in PostgreSQL, then write the durable message to ScyllaDB through an idempotent worker.

This introduces a state machine and requires reconciliation.

Do not use a cross-database pseudo-transaction without explicitly implementing its failure/recovery semantics.

---

# 26. Delivery State Machine

Any asynchronous message delivery pipeline should have explicit states.

Example:

```text
PENDING
   |
   v
PUBLISHED
   |
   v
DELIVERED
```

Failure path:

```text
PENDING
   |
   +--> RETRY_WAIT
   |
   +--> FAILED
```

Do not use a generic boolean such as:

```text
processed = true
```

when the system actually has multiple states.

---

# 27. Consumer Idempotency

Every consumer must tolerate duplicates.

Conceptual algorithm:

```text
receive event
   |
   v
check eventId / operationId
   |
   +--> already processed -> acknowledge
   |
   +--> not processed
             |
             v
         perform effect
             |
             v
         record completion
             |
             v
         acknowledge
```

The idempotency record must be durable for the lifetime during which duplicates can occur.

---

# 28. Bounded Concurrency

Do not process an unlimited number of events concurrently.

Use:

```text
bounded queue
+
bounded worker concurrency
```

Conceptually:

```text
consumer
   |
   v
bounded Channel<Job>
   |
   +--> worker 1
   +--> worker 2
   +--> worker 3
   +--> worker N
```

In NestJS/Node.js this can be implemented using appropriate async worker patterns, bounded queues, or broker consumer concurrency.

The critical requirement is the bound, not the specific library.

---

# 29. Channel<T> / In-Memory Queue Rule

An in-memory queue is an execution mechanism.

It is not:

- durable storage
- a source of truth
- a replacement for a broker
- a replacement for ScyllaDB
- a replacement for an outbox

Use it for:

```text
bounded local buffering
backpressure
worker coordination
```

If the process crashes, queued work may disappear.

Therefore all lost work must be recoverable from a durable source.

---

# 30. EventEmitter Rule

NestJS `EventEmitter` may be used for local, non-durable notifications.

Example:

```text
message accepted
    |
    v
local notification
```

Do not use it as the only mechanism for:

```text
message persistence
billing
external delivery
critical audit events
```

If losing the event can violate business correctness, the event must be durably recoverable.

---

# 31. Error Model

Use explicit error categories.

```text
ValidationError
AuthorizationError
DomainError
ConflictError
NotFoundError
InfrastructureError
TransientDependencyError
PermanentDependencyError
```

Examples:

```text
MessageTooLarge
NotConversationMember
MessageAlreadyExists
ConversationNotFound
ScyllaUnavailable
RedisTimeout
BrokerUnavailable
```

Business/domain errors should not be treated as infrastructure retry failures.

---

# 32. Retry Policy

Retry only transient failures.

```text
Transient:
    timeout
    temporary unavailable
    connection reset
    overload

Permanent:
    invalid message
    permission denied
    invalid conversation
    policy violation
```

Use:

```text
bounded retries
exponential backoff
jitter
maximum retry delay
dead-letter/permanent-failure handling
```

Never create infinite retries.

---

# 33. Timeout Policy

Every network dependency must have an explicit timeout.

At minimum:

```text
PostgreSQL timeout
Scylla timeout
Redis timeout
broker timeout
external HTTP timeout
```

Timeouts must be shorter than the overall request deadline where appropriate.

Do not allow one dependency to hold a request indefinitely.

---

# 34. Circuit Breaking / Load Shedding

Only introduce circuit breakers where they solve an observed failure mode.

For expensive dependencies:

```text
dependency unhealthy
    |
    v
fail quickly
```

For non-critical features:

```text
Redis unavailable
    |
    v
disable typing/presence
    |
    v
continue durable messaging
```

This is preferable to allowing an optional subsystem to take down the message path.

---

# 35. Caching

Cache only data that is:

- expensive to fetch
- frequently read
- safe to become temporarily stale

Good candidates:

```text
channel metadata
permission snapshots
user profile fragments
conversation settings
```

Do not cache:

```text
message history
```

unless a measured hot-read workload justifies it.

Cache invalidation must be explicit.

Prefer:

```text
short TTL
+
versioned/invalidation strategy
```

rather than assuming the cache is always correct.

---

# 36. PostgreSQL and Redis Consistency

If:

```text
PostgreSQL = source of truth
Redis = cache
```

then Redis may temporarily disagree.

This is acceptable only when the business operation can tolerate it.

For security-sensitive authorization:

```text
stale allow
```

may be much more dangerous than:

```text
stale deny
```

Therefore authorization caching requires explicit risk analysis.

---

# 37. Scylla Query Rules

Every query must be mapped to a known access pattern.

Avoid arbitrary query generation such as:

```text
WHERE anything
ORDER BY anything
```

unless the schema explicitly supports it.

For every production query document:

```text
partition key
clustering key
expected partition size
expected result size
pagination strategy
hot-key behavior
```

---

# 38. Pagination

Message history must use cursor-based pagination.

Prefer:

```text
beforeSequence
afterSequence
limit
```

over:

```text
OFFSET 500000
```

Example:

```text
GET /conversations/{id}/messages?before=19382&limit=50
```

The cursor must represent a stable ordering boundary.

Never allow clients to request unbounded message history in one response.

---

# 39. Message Size

Define hard limits:

```text
maximum message body size
maximum metadata size
maximum reaction count
maximum attachment metadata
```

Reject oversized requests before expensive processing.

If files/media are supported:

```text
message
    -> metadata/reference

object storage
    -> actual file
```

Do not put large binary payloads directly into the primary message record unless the requirements explicitly justify it.

---

# 40. Attachments

Use object storage for large media:

```text
S3 / compatible object storage
```

Message:

```text
attachmentId
objectKey
contentType
size
checksum
```

The message store contains metadata/references.

The object store contains the actual bytes.

Use signed/pre-signed URLs where appropriate.

---

# 41. Security

Every command must establish:

```text
authenticated actor
+
authorized operation
+
target resource
```

Never trust:

```text
client-provided senderId
```

Use the authenticated principal.

Validate:

```text
conversation membership
block relationships
role/permission
message policy
rate limit
payload size
```

Avoid leaking whether another user/resource exists when the authorization model requires resource concealment.

---

# 42. Tenant Isolation

If the application is multi-tenant, every relevant domain identifier must carry tenant context where appropriate.

Example:

```text
tenantId
conversationId
messageId
```

The system must prevent:

```text
tenant A
    ->
conversation belonging to tenant B
```

This must be enforced at application/domain boundaries and supported by persistence/query design.

---

# 43. Observability

Observability is part of the architecture, not an afterthought.

Capture:

```text
logs
metrics
traces
health checks
alerts
```

Important metrics:

```text
chat_messages_accepted_total
chat_messages_rejected_total

chat_message_write_latency
chat_message_read_latency

scylla_request_latency
postgres_request_latency
redis_request_latency

websocket_connections
websocket_reconnects

message_delivery_latency
message_delivery_failures

consumer_backlog
worker_queue_depth
worker_active_count

rate_limit_rejections
idempotency_duplicates
```

---

# 44. Structured Logging

Every message operation should have correlation information.

Example:

```json
{
  "operation": "send_message",
  "requestId": "...",
  "actorId": "...",
  "conversationId": "...",
  "messageId": "...",
  "clientMessageId": "...",
  "eventId": "...",
  "durationMs": 12
}
```

Never log message bodies by default.

Do not log secrets, access tokens, signed URLs, or unnecessary personal data.

---

# 45. Tracing

A distributed message operation should be traceable:

```text
WebSocket request
    |
    +--> PostgreSQL authorization
    |
    +--> Scylla write
    |
    +--> event publication
    |
    +--> Redis/broker delivery
    |
    +--> WebSocket fan-out
```

Use trace/span IDs to connect these operations.

---

# 46. Health Checks

Separate:

```text
liveness
readiness
dependency health
```

Liveness should answer:

> Is this process alive?

Readiness should answer:

> Should this instance receive traffic?

Do not make liveness fail merely because Scylla is temporarily unavailable.

Otherwise Kubernetes/container orchestration may restart a healthy process unnecessarily and amplify the outage.

---

# 47. Graceful Shutdown

On shutdown:

```text
1. Stop accepting new work
2. Stop new WebSocket connection intake
3. Stop broker consumption
4. Stop local producers
5. Allow bounded work to drain
6. Close Redis
7. Close Scylla
8. Close PostgreSQL
9. Exit
```

Every worker must respond to cancellation.

Never rely on process termination to cleanly finish important work.

---

# 48. WebSocket Scaling

The WebSocket gateway must be horizontally scalable.

```text
                Load Balancer
                      |
        +-------------+-------------+
        |             |             |
       WS-1          WS-2          WS-N
```

Do not store authoritative application state only inside a WS node.

For multi-node fan-out:

```text
Redis Pub/Sub
```

or a durable/streaming broker can distribute events.

The choice depends on whether delivery is:

```text
transient realtime notification
```

or:

```text
durable asynchronous processing
```

---

# 49. Redis Pub/Sub vs Durable Broker

Use Redis Pub/Sub when:

```text
notification is transient
message already exists durably
missing the event can be recovered
latency is more important than replay
```

Use a durable broker when:

```text
consumers must catch up
events need replay
processing must survive consumer downtime
multiple independent consumers exist
backlog must be observable
```

The architecture may use both.

Example:

```text
Scylla durable message
       |
       +--> Redis Pub/Sub -> realtime WebSockets
       |
       +--> durable broker -> search/analytics/audit/etc.
```

---

# 50. Data Lifecycle

Define retention separately for each store.

Example:

```text
ScyllaDB
    messages: long-term retention

PostgreSQL
    metadata: long-term

Redis
    presence: seconds/minutes
    typing: seconds
    rate limits: short windows
```

Do not allow ephemeral data to become permanent accidentally.

---

# 51. Backup and Recovery

Durable stores require documented recovery.

For PostgreSQL:

```text
backup
restore
point-in-time recovery
```

For ScyllaDB:

```text
backup
restore
repair strategy
consistency strategy
```

For Redis:

```text
determine whether persistence is required
```

If Redis is genuinely ephemeral:

```text
loss of Redis
    -> rebuild state
```

should be an expected recovery path.

---

# 52. Failure Scenarios

The system must explicitly handle:

| Failure | Required behavior |
|---|---|
| PostgreSQL unavailable | authorization/metadata operations fail safely |
| Scylla unavailable | durable message operation fails/retries; do not claim success |
| Redis unavailable | ephemeral features degrade according to policy |
| Redis Pub/Sub message missed | client reconnects and recovers from Scylla |
| WebSocket node crashes | client reconnects to another node |
| Worker crashes | durable work remains recoverable |
| Duplicate event | idempotent consumer ignores/reconciles duplicate |
| Process crashes after durable write | recovery mechanism finds publication/delivery work |
| Network timeout after message accepted | client retry does not duplicate message |
| Hot conversation | partition/bucketing strategy prevents uncontrolled hotspot |
| Broker unavailable | durable pending work accumulates safely |
| Slow consumers | bounded queues/backpressure prevent memory exhaustion |

---

# 53. Failure Matrix for SendMessage

The implementation must document behavior at each point:

```text
A. Before authorization
B. After authorization, before message write
C. After message write
D. After publication intent
E. After event publication
F. After WebSocket delivery
```

The desired invariant is:

```text
If the API reports a durable accepted message,
the message must be recoverable from the durable message store.
```

The delivery notification may happen later.

---

# 54. Consistency Model

Document consistency per operation.

Example:

| Operation | Consistency |
|---|---|
| Membership authorization | strong/current enough to enforce security |
| Message write | durable |
| Message history | durable, ordered according to defined sequence |
| Presence | eventually consistent |
| Typing | eventually consistent |
| Rate limit | coordinated/bounded |
| WebSocket fan-out | at least once/transient |
| Search index | eventually consistent |
| Analytics | eventually consistent |

Do not accidentally promise stronger consistency than the architecture provides.

---

# 55. API Contract

The API should expose business semantics rather than storage details.

Example:

```text
POST /conversations/{conversationId}/messages
```

Request:

```json
{
  "clientMessageId": "client-generated-id",
  "body": "Hello"
}
```

Response:

```json
{
  "messageId": "...",
  "conversationId": "...",
  "sequence": 19383,
  "createdAt": "..."
}
```

Do not expose:

```text
scyllaPartition
redisKey
postgresRowId
```

as public API concepts.

---

# 56. WebSocket Events

Define explicit event contracts.

Example:

```text
message.created
message.updated
message.deleted
message.reaction.added
message.reaction.removed
conversation.read
presence.changed
typing.started
typing.stopped
```

Every event should have:

```text
eventId
eventType
schemaVersion
occurredAt
conversationId
payload
```

Clients should be able to safely ignore unknown future event types/fields.

---

# 57. Versioning

Version:

```text
public API contracts
WebSocket event contracts
durable event schemas
```

Do not couple event schema version directly to application version.

Example:

```text
schemaVersion = 1
```

When changing an event:

```text
old consumers must continue working
```

or an explicit migration/versioning strategy must exist.

---

# 58. Testing Strategy

Follow a testing pyramid.

## Unit tests

Test:

```text
value objects
domain decisions
state transitions
authorization policies
validation
pagination rules
sequence rules
idempotency logic
```

These should be fast and mostly dependency-free.

## Integration tests

Test:

```text
PostgreSQL
ScyllaDB
Redis
message transport
WebSocket adapter
```

using realistic schemas and failure conditions.

## End-to-end tests

Test:

```text
client
 -> gateway
 -> application
 -> persistence
 -> delivery
 -> receiving client
```

Test reconnect/gap recovery as well.

---

# 59. Property-Based / Invariant Testing

Important properties include:

```text
Submitting the same clientMessageId twice
    -> one logical message

Reading messages after sequence N
    -> no message <= N

Message pagination
    -> no duplicate or missing records across pages

Applying the same idempotent event twice
    -> same resulting state

Deleting a message
    -> illegal later transitions are rejected

Unauthorized actor
    -> cannot create message

Sequence values
    -> obey defined ordering invariant
```

These are stronger than testing only a few examples.

---

# 60. Load Testing

Do not load test only average traffic.

Test:

```text
normal traffic
peak traffic
burst traffic
hot conversation
many small conversations
large conversations
many concurrent WebSocket connections
reconnect storm
slow consumers
Redis outage
Scylla latency spike
PostgreSQL latency spike
broker backlog
```

Important measurements:

```text
P50
P95
P99
P99.9

throughput
error rate
queue depth
CPU
memory
network
database latency
connection counts
```

---

# 61. Capacity Planning

Define measurable targets before production scaling.

Example template:

```text
messages/sec:
messages/day:
peak messages/sec:
peak multiplier:
concurrent WebSocket connections:
average message size:
P99 send latency target:
P99 history-read latency target:
maximum acceptable delivery latency:
retention:
```

Then derive:

```text
Scylla partitions
Redis memory
PostgreSQL connection pool
WebSocket node count
broker throughput
network capacity
```

Do not choose values like:

```text
5 WS nodes
8 workers
2 Redis replicas
```

without a capacity model.

---

# 62. Connection Management

For Node/NestJS:

```text
HTTP request concurrency
!=
WebSocket connection count
!=
database connection count
```

A server can hold many sockets while having a much smaller database pool.

Never create one PostgreSQL/Scylla connection per WebSocket.

Use pooled/shared database connections.

---

# 63. Backpressure

Every asynchronous boundary must answer:

```text
What happens when the producer is faster than the consumer?
```

Possible answers:

```text
durable backlog
bounded queue
rate limit
drop transient signal
reject request
```

For example:

```text
typing event backlog
    -> drop/coalesce

message persistence backlog
    -> do not silently drop

analytics backlog
    -> durable broker backlog

WebSocket fan-out overload
    -> clients recover through durable sequence
```

---

# 64. Coalescing

Some transient operations do not need every intermediate event.

Typing is an example:

```text
typing
typing
typing
typing
```

can often be represented as:

```text
user is typing
```

rather than four independent durable events.

Use coalescing for ephemeral state when product semantics permit it.

---

# 65. Hot-Path Rule

The synchronous send-message path should remain small.

Preferred:

```text
authenticate
authorize
validate
persist
return
```

Avoid synchronously performing:

```text
search indexing
analytics
notifications
webhooks
media processing
recommendation calculations
```

unless the product requirement explicitly requires the result before responding.

Those belong in asynchronous pipelines.

---

# 66. Event-Driven Side Effects

After:

```text
MessageSent
```

other capabilities may react:

```text
SearchIndexer
NotificationService
AnalyticsConsumer
ModerationConsumer
AuditConsumer
```

The message core should not directly invoke every consumer.

This prevents:

```text
ChatService
  -> Search
  -> Notification
  -> Analytics
  -> Moderation
  -> Audit
```

from becoming one giant synchronous dependency graph.

---

# 67. Avoid Event Abuse

Do not convert every function call into an event.

Use synchronous calls when:

```text
the caller needs the result immediately
the operation is within the same consistency boundary
coupling is acceptable
```

Use events when:

```text
multiple consumers react
processing can be asynchronous
failure isolation is valuable
the event represents a meaningful fact
```

---

# 68. Data Access Ports

Application code should depend on interfaces/ports such as:

```ts
interface ConversationRepository {
  findById(id: ConversationId): Promise<Conversation | null>;
}

interface MessageStore {
  append(message: Message): Promise<void>;
  findAfter(
    conversationId: ConversationId,
    sequence: MessageSequence,
    limit: number,
  ): Promise<readonly Message[]>;
}

interface PresenceStore {
  setOnline(userId: UserId, ttlSeconds: number): Promise<void>;
}
```

Implementations:

```text
PostgresConversationRepository
ScyllaMessageStore
RedisPresenceStore
```

The domain/application layer should not import their concrete database clients.

---

# 69. Dependency Direction

Enforce:

```text
presentation
      |
      v
application
      |
      v
domain

infrastructure
      |
      +---- implements application/domain ports
```

Avoid:

```text
domain
   -> NestJS
   -> Redis
   -> Scylla driver
   -> PostgreSQL ORM
```

Infrastructure depends inward, not the reverse.

---

# 70. Transaction Boundaries

Transactions should be as short as possible while preserving correctness.

Never keep a transaction open while:

```text
waiting for WebSocket delivery
calling an external API
waiting for a broker
waiting for a user
```

A transaction should cover only the state that must change atomically.

This follows the enterprise concurrency principle that transactions are useful isolation boundaries, while long-running transactions can become scalability bottlenecks.

---

# 71. Optimistic Concurrency

Use optimistic concurrency where appropriate.

Example:

```text
message version = 3
```

Update:

```text
WHERE message_id = X
AND version = 3
```

Then:

```text
version -> 4
```

If zero rows are affected:

```text
concurrent modification detected
```

Use this only where the business operation requires conflict detection.

---

# 72. Immutability

Messages should be treated as mostly immutable facts.

Instead of rewriting history excessively:

```text
message created
message edited
message deleted
```

can be represented as explicit state/version changes according to product requirements.

This reduces concurrency complexity and improves auditability.

---

# 73. Caching and Read Path

A typical history read:

```text
Client
  |
  v
Chat API
  |
  v
ScyllaDB
```

Optional metadata:

```text
Redis cache
  |
  +--> channel metadata
  +--> permissions snapshot
```

Avoid:

```text
Client
  |
  v
Redis
  |
  v
if miss -> Scylla
```

for the entire message history unless measured evidence shows it is beneficial.

The durable message store should remain the canonical read source.

---

# 74. Search

Do not force ScyllaDB to become a general full-text search engine.

If full-text search becomes a requirement:

```text
MessageSent
    |
    v
Search indexer
    |
    v
OpenSearch/Elasticsearch
```

Search is eventually consistent.

If the search index is lost:

```text
rebuild from durable message data/events
```

must be possible.

---

# 75. Analytics

Analytics should not run in the synchronous message path.

Use:

```text
MessageSent
    |
    v
event stream
    |
    v
analytics consumer
```

The analytics pipeline can lag without preventing message persistence.

---

# 76. Audit

Security/business audit events should be durable when required.

Do not assume:

```text
Redis Pub/Sub
```

is sufficient for audit.

Audit retention and immutability requirements should determine the storage.

---

# 77. Operational Alerts

Alert on behavior, not merely process existence.

Examples:

```text
P99 message write latency too high
P99 message delivery latency too high
Scylla error rate elevated
PostgreSQL error rate elevated
Redis error rate elevated
consumer backlog growing
worker queue saturated
WebSocket reconnect storm
idempotency duplicate spike
rate-limit rejection spike
memory pressure
connection pool exhaustion
```

A process being "up" does not mean the chat system is healthy.

---

# 78. Deployment Strategy

The first production deployment should not require all infrastructure to be introduced simultaneously.

Recommended progression:

```text
Phase 1
Existing Chat Module
+
PostgreSQL
+
Redis

Phase 2
Strong module boundaries
+
domain/application separation
+
idempotent message commands
+
observability

Phase 3
ScyllaDB message store
+
load testing
+
dual-read/controlled migration if required

Phase 4
Durable asynchronous delivery
+
worker pipeline
+
reconnect/gap recovery

Phase 5
Scale WebSocket cluster
+
advanced caching
+
search
+
analytics
```

Each phase must be independently deployable and observable.

---

# 79. Migration from Existing Chat Module

Do not rewrite the whole module in one change.

Use incremental slices.

## Slice 1 — Document current behavior

Capture:

```text
current endpoints
current WebSocket events
current tables
current queries
current invariants
current failure behavior
```

## Slice 2 — Introduce domain/application boundary

Move:

```text
validation
authorization policy
message state transitions
```

out of controllers/gateways.

## Slice 3 — Add client idempotency

Introduce:

```text
clientMessageId
```

and durable duplicate handling.

## Slice 4 — Introduce Redis for ephemeral state

Move:

```text
presence
typing
rate limiting
```

out of PostgreSQL.

## Slice 5 — Introduce ScyllaDB

Move only message workloads first.

Keep metadata in PostgreSQL.

## Slice 6 — Introduce durable delivery/recovery

Add:

```text
event
delivery state
worker
retry
idempotency
gap recovery
```

## Slice 7 — Scale WebSockets

Add:

```text
multiple WS nodes
Redis/broker fan-out
connection registry
reconnect recovery
```

---

# 80. Dual-Write Migration Warning

Avoid uncontrolled:

```text
write PostgreSQL
write ScyllaDB
```

without a reconciliation strategy.

If migration requires dual writes:

```text
primary source
secondary write
reconciliation
metrics
repair job
cutover condition
rollback plan
```

must be explicitly defined.

A silent failed secondary write is not acceptable.

---

# 81. Reconciliation

Durable systems need repair mechanisms.

Examples:

```text
messages missing delivery record
messages missing search index
stale cache
stale presence
orphaned attachment
incomplete migration
```

A reconciliation job should be able to detect and repair known inconsistencies.

This is especially important when data crosses persistence systems.

---

# 82. Production Invariants

The following are mandatory invariants:

```text
I1. A successful message submission has a durable message record.

I2. Repeating the same clientMessageId does not create another logical message.

I3. Unauthorized users cannot create messages.

I4. Redis loss does not delete message history.

I5. Redis Pub/Sub loss does not delete message history.

I6. WebSocket node failure does not permanently lose messages.

I7. Client reconnect can recover missed messages.

I8. Message history has a deterministic ordering contract.

I9. Pagination does not create duplicate/missing records under the defined consistency model.

I10. Asynchronous consumers are idempotent.

I11. Worker memory is bounded.

I12. Retry loops are bounded.

I13. Graceful shutdown stops new work and handles in-flight work.

I14. Durable data has backup/recovery procedures.

I15. Security authorization does not depend solely on stale cache state.
```

---

# 83. Definition of Done

A chat feature is production-ready only when:

### Correctness

- [ ] business invariants documented
- [ ] aggregate boundaries documented
- [ ] message ordering contract documented
- [ ] idempotency implemented
- [ ] authorization tested
- [ ] duplicate delivery tested

### Persistence

- [ ] authoritative store documented
- [ ] Scylla query patterns documented
- [ ] partition strategy load-tested
- [ ] PostgreSQL constraints defined
- [ ] Redis TTL policies defined
- [ ] backup/restore tested

### Reliability

- [ ] timeout policies defined
- [ ] retry policies defined
- [ ] failure states defined
- [ ] recovery/reconciliation defined
- [ ] graceful shutdown implemented
- [ ] reconnect/gap recovery tested

### Performance

- [ ] P95/P99 targets defined
- [ ] load test completed
- [ ] hot conversation test completed
- [ ] WebSocket connection test completed
- [ ] memory bounded
- [ ] database pools sized

### Observability

- [ ] structured logs
- [ ] metrics
- [ ] traces
- [ ] health checks
- [ ] alerts
- [ ] dashboards

### Security

- [ ] authentication
- [ ] authorization
- [ ] tenant isolation if applicable
- [ ] rate limiting
- [ ] payload limits
- [ ] sensitive logging review

---

# 84. Architecture Decision Records

Every major technology decision should have an ADR.

Template:

```md
# ADR: <decision>

## Context

What problem are we solving?

## Decision

What did we choose?

## Why

Why is this the simplest design that satisfies the requirement?

## Alternatives

What did we reject?

## Consequences

What becomes easier?

What becomes harder?

## Failure Behavior

What happens when dependencies fail?

## Operational Cost

What must be monitored and maintained?

## Revisit When

What evidence would justify changing this decision?
```

Required ADRs:

```text
ADR-001 PostgreSQL ownership
ADR-002 ScyllaDB message storage
ADR-003 Redis ephemeral state
ADR-004 Message ordering
ADR-005 Message idempotency
ADR-006 Event/delivery mechanism
ADR-007 WebSocket fan-out
ADR-008 Reconnect/gap recovery
ADR-009 Partition strategy
```

---

# 85. Architecture Review Checklist

Before merging a feature, ask:

```text
1. What business rule does this implement?
2. What data is authoritative?
3. What must be atomic?
4. What can be asynchronous?
5. What can be lost safely?
6. What must survive a crash?
7. What happens if Redis is down?
8. What happens if Scylla is slow?
9. What happens if the process crashes here?
10. Can the operation be retried?
11. Is the retry idempotent?
12. Is concurrency bounded?
13. Can memory grow without bound?
14. What happens when a WebSocket node disappears?
15. Can the client recover missing messages?
16. How is this observed in production?
17. How is it tested under failure?
18. Is the new abstraction actually required?
```

---

# 86. Anti-Patterns

Avoid:

```text
Redis as message database
```

```text
WebSocket memory as message state
```

```text
EventEmitter as durable event bus
```

```text
unbounded in-memory arrays as queues
```

```text
one database connection per socket
```

```text
OFFSET pagination for huge histories
```

```text
one enormous Conversation aggregate containing all messages
```

```text
synchronous search/analytics/notification work on send-message path
```

```text
blind retry of non-idempotent operations
```

```text
infinite retry loops
```

```text
cache as security authority without analyzing staleness
```

```text
cross-database dual write without reconciliation
```

```text
introducing Kafka/NATS/Scylla/Kubernetes components without a measurable requirement
```

---

# 87. Minimal Production Architecture

If the current system does not yet justify a full distributed event platform, the minimum viable production architecture is:

```text
                    Clients
                       |
                       v
                 NestJS Chat
                       |
          +------------+------------+
          |                         |
          v                         v
    PostgreSQL                   Redis
    metadata                    presence
    membership                  typing
    permissions                 rate limit
          |
          v
       ScyllaDB
       messages
```

Then add:

```text
durable event transport
```

when asynchronous consumers and recovery requirements justify it.

This is intentionally simpler than the full target architecture.

---

# 88. Full Production Architecture

When scale requires it:

```text
                           CLIENTS
                              |
                    +---------+---------+
                    |                   |
                  HTTP              WebSocket
                    |                   |
                    v                   v
              API Gateway         WS Gateway Cluster
                    |                   |
                    |             Redis / Broker
                    |                   |
                    +---------+---------+
                              |
                              v
                     Chat Application
                              |
                 +------------+------------+
                 |            |            |
                 v            v            v
           PostgreSQL      ScyllaDB       Redis
           metadata        messages       ephemeral
                 |            |            |
                 +------------+------------+
                              |
                              v
                       Durable Events
                              |
              +---------------+----------------+
              |               |                |
              v               v                v
          Search          Analytics          Audit
```

The architecture should grow toward this form only when measured requirements justify it.

---

# 89. Key Mental Model

Remember the three storage roles:

```text
PostgreSQL
    "What is true about the business?"

ScyllaDB
    "What permanently happened?"

Redis
    "What is happening right now?"
```

And the delivery roles:

```text
Domain Event
    = business fact

Outbox / durable publication state
    = recoverable intent

Broker
    = cross-process transport

Redis Pub/Sub
    = low-latency transient fan-out

Channel / bounded queue
    = local execution/backpressure

Worker
    = effect execution
```

These are different concepts and should remain separate in the code.

---

# 90. Final Design Principle

The target architecture is not:

```text
NestJS + ScyllaDB + PostgreSQL + Redis + Broker
```

The target architecture is:

```text
clear business boundaries
+
explicit state transitions
+
durable ownership of important data
+
appropriate storage for each workload
+
bounded concurrency
+
idempotent asynchronous processing
+
recoverable transient delivery
+
observable failure behavior
+
incremental evolution
```

The infrastructure exists to support those properties.

Do not add a component unless the component gives the system a concrete capability that is required, measurable, and operationally supportable.
