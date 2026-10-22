# Product requirements

RiskFlow is an industry-neutral, database-backed, multi-tenant enterprise risk management SaaS.

## First pilot MVP capabilities

- a tenant can create and assess risks
- action assignment
- approval of risk treatments
- role-specific dashboards
- customization of risk forms
- enabling entitled modules

All business data is tenant-isolated. Routine tenant configuration does not require vendor work. Model definitions are versionable from day one.

## Definition of done

Every feature must meet these conditions:

- authentication and tenant membership enforced on the server
- authorization checked per operation and record
- Zod validation, typed errors, pagination on lists
- tests: positive, forbidden, wrong tenant, invalid input
- audit events for security-relevant and business writes
- accessibility: labels, focus order, keyboard, contrast, empty/loading/error
- typecheck, lint and tests green; no secrets in the repository

## Sprint 01 delivery

A user can open the prototype shell, switch theme, and navigate placeholder pages. Authentication, tenant data, or authorization are not promised.

## Out of MVP scope

Visual workflow editor, Dashboard Builder, public APIs/webhooks, SAML/SCIM, advanced compliance mapping, third-party risk, BIA/BCM, AI assistant, control library, separate tenant databases, white-label domains, report designer, and enterprise billing. Architecture leaves room for them; they are not implemented early.
