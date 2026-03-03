---
trigger: always_on
---

# PROJECT ARCHITECTURE & DEVELOPMENT RULES
Multi-Tenant SaaS Platform – Modular Monolith Standard

Version: 1.0
Status: Mandatory Compliance

---

# 1. PROJECT VISION

This project is a multi-tenant SaaS platform with:

- Company-based data isolation
- Role-based access control
- Skill execution system
- Token consumption tracking
- Automation engine
- Modular structure
- Scalable infrastructure

The system must support growth without architectural redesign.

---

# 2. ARCHITECTURE MODEL

We use:

✔ Modular Monolith Architecture  
✔ Domain separation  
✔ Backend as single source of truth  
✔ Asynchronous job processing  

We do NOT use:

✘ Classic MVC only  
✘ Business logic in controllers  
✘ Business logic in frontend  
✘ Direct database access from frontend  
✘ Microservices (for initial phase)  

---

# 3. CORE PRINCIPLES

1. Multi-tenant isolation is mandatory.
2. Every business table must include `company_id`.
3. RLS must be enabled in Supabase.
4. Backend must re-validate tenant isolation.
5. Company active status must be validated on every critical action.
6. Role permissions must be enforced in backend.
7. All async logic must run via job queues.
8. Token usage must be tracked and limited.
9. Logs must exist for all sensitive actions.
10. No feature may compromise security or scalability.

---

# 4. MANDATORY FOLDER STRUCTURE
Rules:
- No business logic outside modules.
- No cross-module database access.
- Shared utilities must remain generic.

---

# 5. MODULE STRUCTURE RULES

Each module must contain:
Definitions:

Controller → Handles HTTP only  
Service → Contains business logic  
Repository → Database access layer  
Validator → Input validation  
Types → DTOs and interfaces  

No logic inside controllers beyond routing.

---

# 6. MULTI-TENANT RULES

Every business table must include:

- id
- company_id
- created_at

Rules:

- Enable RLS in Supabase.
- Create policy validating `company_id`.
- Backend must validate tenant match.
- No cross-company joins.
- Super Admin bypass must be controlled.

---

# 7. ROLE SYSTEM RULES

Allowed roles:

- Owner
- Admin
- Editor
- Operator
- Viewer

Rules:

- Role validation in backend only.
- Role updates must be logged.
- Frontend must not directly update roles.
- Role escalation must be blocked.

---

# 8. COMPANY STATUS ENFORCEMENT

Before any skill execution or automation:

- Validate company exists.
- Validate company status = active.
- Validate subscription not expired.
- Validate token limit not exceeded.

Suspended companies must not execute any action.

---

# 9. AUTOMATION ENGINE RULES

- All automation must run asynchronously.
- Use Redis queue.
- Prevent infinite loops.
- Limit execution depth.
- Enforce execution timeout.
- Log execution result.

No long-running synchronous requests allowed.

---

# 10. TOKEN CONTROL RULES

For every skill execution:

- Record tokens_used.
- Record estimated_cost.
- Update company monthly usage.
- Block execution if plan exceeded.
- Limit tokens per execution.
- Limit executions per day.

Prevent burst token abuse.

---

# 11. SECURITY RULES

- Never expose service_role keys.
- Never trust frontend validation.
- Validate webhook signatures.
- Implement rate limiting per company.
- Prevent injection attacks.
- Validate all external inputs.
- Protect against privilege escalation.

All sensitive actions must be logged.

---

# 12. ERROR HANDLING

- Never expose internal stack traces.
- Use structured logging.
- Log:
  - user_id
  - company_id
  - action
  - timestamp
  - status
- Critical failures must trigger alerts.

---

# 13. DATABASE RULES (SUPABASE)

- Enable RLS on all tenant tables.
- Index company_id.
- Index foreign keys.
- Use transactions for multi-table writes.
- No direct frontend DB manipulation for business logic.

---

# 14. INFRASTRUCTURE RULES

Deployment must support:

- Separate frontend and backend
- Background workers
- Persistent backend process
- Monitoring system
- Rollback capability
- Environment variable isolation

Production must not share environment with staging.

---

# 15. TESTING REQUIREMENTS

Mandatory tests:

- Company A cannot access Company B data.
- Suspended company cannot execute skills.
- Role restrictions enforced.
- Plan limit enforcement works.
- Webhook signature validation works.
- Automation loop protection works.

No production deployment without validation.

---

# 16. SCALABILITY REQUIREMENTS

The system must support:

- 1 company
- 50 companies
- 500 companies

Without architectural redesign.

Migration to microservices only if:
- Load justifies separation.
- Clear domain boundaries exist.

---

# 17. CODE STANDARDS

- Clear naming conventions.
- No magic strings.
- No hardcoded limits.
- No business logic inside controllers.
- No direct DB access from frontend.
- All modules self-contained.

---

# 18. OBSERVABILITY

System must include:

- Execution logs
- Usage tracking
- Error tracking
- Monitoring
- Performance metrics

Lack of observability is considered architectural failure.

---

# 19. SUPPORTABILITY

The system must allow:

- Viewing company usage
- Viewing execution logs
- Activating/suspending accounts
- Monitoring failures
- Diagnosing automation errors

Support must not require direct DB edits.

---

# 20. FINAL RULE

If a feature compromises:

- Isolation
- Security
- Scalability
- Maintainability

It must be redesigned before implementation.

Architecture integrity is mandatory.

