# Super Admin Implementation Tasks

**Status:** Ready for implementation  
**Source:** [`super-admin-plan.md`](./super-admin-plan.md) and [`super-admin-spec.md`](./super-admin-spec.md)

## Phase 0 — Decisions

- [ ] Decide the minimum number of active break-glass super admins.
- [ ] Decide whether role changes invalidate access tokens immediately.
- [ ] Select the first workspace-setting groups.
- [ ] Select high-impact settings that require re-authentication.
- [ ] Select the initial audit action allowlist.

## Phase 1 — Authorization hardening

- [ ] Add an application-level admin identity policy helper.
- [ ] Pass the authenticated actor into every role/status/delete mutation.
- [ ] Block self-demotion.
- [ ] Block self-delete from admin control.
- [ ] Block demotion, suspension, and deletion of the last active super admin.
- [ ] Make deleted/suspended targets return explicit errors.
- [ ] Add stable error codes and DTO/API documentation.
- [ ] Add backend unit and service tests for all rules.

## Phase 2 — Team management

- [ ] Keep the Team page super-admin-only at route and API levels.
- [ ] Hide or disable role-management controls for regular admins.
- [ ] Add target identity/current state to role mutation confirmation.
- [ ] Add explicit confirmation copy for demotion, suspension, and deletion.
- [ ] Refresh the Team table after successful mutations.
- [ ] Verify the user list does not expose a misleading super-admin option to regular admins.

## Phase 3 — Audit log

- [ ] Add PostgreSQL migration for append-only admin audit events.
- [ ] Add Drizzle schema and indexes for actor, target, action, and timestamp.
- [ ] Add an audit service with typed action names.
- [ ] Write audit events in the same transaction as privileged mutations.
- [ ] Add `GET /admin/audit` with offset/cursor pagination and filters.
- [ ] Add the super-admin Audit Log page.
- [ ] Ensure audit events cannot be edited/deleted through the application.

## Phase 4 — Workspace settings

- [ ] Define the first setting-key registry and value schemas.
- [ ] Add versioned settings storage and migration.
- [ ] Add draft/propose workflow.
- [ ] Add validation for type, range, dependency, and blast radius.
- [ ] Add before/after review UI.
- [ ] Add publish and rollback endpoints.
- [ ] Add cache invalidation after publish.
- [ ] Add re-authentication for high-impact settings.
- [ ] Mask integration secrets and keep secret values outside PostgreSQL/UI.

## Phase 5 — Session and operational verification

- [ ] Implement the selected role-change session policy.
- [ ] Test old access and refresh tokens after demotion.
- [ ] Test concurrent last-super-admin mutations.
- [ ] Test direct API calls that bypass hidden dashboard controls.
- [ ] Run backend tests, lint, build, and web build/lint.
- [ ] Run a browser matrix for admin and super-admin dashboards.
- [ ] Update architecture documentation and the running ship log.

## Explicitly deferred

- Fine-grained permissions for every admin module.
- Approval workflows involving multiple humans.
- External IAM/SSO.
- Separate authorization service.
- Multi-tenant settings isolation.
