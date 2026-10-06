# Super Admin Acceptance Criteria

**Status:** Proposed  
**Feature:** Super Admin Governance and Workspace Control

## A. Role and access

- [ ] A user with role `user` cannot render or call admin dashboard functionality.
- [ ] A user with role `admin` can perform ordinary operational admin work.
- [ ] A user with role `admin` cannot open Team management.
- [ ] A user with role `admin` cannot publish workspace settings.
- [ ] A user with role `super_admin` can access Team, Audit Log, and Workspace Settings.
- [ ] Backend authorization remains correct when navigation links and buttons are bypassed.

## B. Administrative identity safety

- [ ] Only a `super_admin` can assign `admin` or `super_admin`.
- [ ] Only a `super_admin` can revoke `admin` or `super_admin`.
- [ ] An actor cannot demote their own administrative account.
- [ ] An actor cannot delete their own administrative account through admin management.
- [ ] The last active `super_admin` cannot be demoted, suspended, or deleted.
- [ ] Two concurrent attempts to remove the last active super admin cannot both succeed.
- [ ] A missing, deleted, or suspended target produces an explicit failure.
- [ ] Role/status changes produce stable API error codes and no partial mutation.

## C. Session behavior

- [ ] The selected role-change session policy is documented.
- [ ] A demoted admin cannot retain privileged access indefinitely through an old token.
- [ ] Refresh behavior after demotion is tested.
- [ ] The dashboard refreshes its user/session state after a role mutation.

## D. Web dashboard delegation

- [ ] Admin navigation does not show Team, Audit Log, or Workspace Settings publish controls.
- [ ] Super-admin navigation shows governance areas.
- [ ] Shared operational pages remain usable by admins.
- [ ] Privileged mutation dialogs display target identity, current state, new state, and consequences.
- [ ] Successful mutations update the UI without a full manual reload.
- [ ] Forbidden API responses produce an actionable error state/toast.
- [ ] A hidden control is not treated as the only authorization mechanism.

## E. Auditability

- [ ] Role grants, role revocations, suspensions, privileged deletions, workspace publishes, and rollbacks create audit events.
- [ ] Each event records actor, action, target, timestamp, request ID, outcome, and before/after values where applicable.
- [ ] Audit events are written transactionally with the protected mutation.
- [ ] Audit events are append-only from the application.
- [ ] Super admins can filter and paginate audit history.
- [ ] Regular admins cannot read unrestricted privileged audit history.

## F. Workspace settings

- [ ] Unknown setting keys are rejected.
- [ ] Invalid types, ranges, and dependencies are rejected before publish.
- [ ] A draft/proposal can be reviewed with a before/after diff.
- [ ] High-impact settings require explicit confirmation and re-authentication.
- [ ] Publishing creates a new version and preserves the previous published version.
- [ ] Rollback restores the selected previous version and creates an audit event.
- [ ] Affected caches/queries are invalidated after publish.
- [ ] No raw integration secret is returned to the browser or stored in workspace settings.
- [ ] Integration settings expose only masked status, rotation metadata, and controlled health checks.

## G. Quality gates

- [ ] Backend unit/service/controller tests pass.
- [ ] Web lint passes with no new errors.
- [ ] Backend build passes.
- [ ] Web build passes.
- [ ] OpenAPI/Swagger output documents new DTOs, routes, roles, and error responses.
- [ ] PostgreSQL migrations apply cleanly to a fresh and existing development database.
- [ ] Browser verification covers both admin and super-admin sessions.
