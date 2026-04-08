---
name: code-evolution-ops
description: Engineering Quality & Code Evolution. Standards for safe incremental upgrades, type safety (Zero Any), ES module patterns, and code simplification.
---

# Code Evolution & Engineering Quality

This skill defines the standards for code quality, architectural consistency, and the safety of system upgrades in the StockWise codebase. It ensures that every logic change is predictable and type-safe.

## 1. Incremental Upgrade Strategy

To avoid "breaking old features while implementing new ones," follow these core principles:

### 1.1 The Golden Rule: Add, Don't Replace
- **Incremental Additions**: Build on top of existing logic first.
- **Side-by-Side Validation**: Keep the new and old logic running in parallel if possible until the new path is fully verified.
- **Preservation**: Never delete or "simplify" logic you don't 100% understand.

### 1.2 Type Safety (Zero Tolerance for `any`)
TypeScript's value lies in its predictability.
- **Strict Interfaces**: Define precise interfaces for all props, API responses, and database rows.
- **Use `unknown` over `any`**: If a type is truly unknown, force yourself to use a type guard later.
- **No Suppression**: Resolve ESLint errors and TS warnings instead of using `eslint-disable` or `@ts-ignore`.

---

## 2. Code Simplification & Refactoring

Refactoring should improve clarity and maintainability without altering functionality.

### 2.1 Refinement Principles
- **Clarity over Brevity**: Explicit code (like a clear `switch` or `if/else`) is often better than a dense single-line ternary.
- **Reduce Nesting**: Flatten logic where possible to improve scanability.
- **Consistent Exports**: Use ES modules. Use the `function` keyword for top-level component/logic definitions unless an arrow function is logically superior.
- **Consolidate Logic**: Group related state or helper functions to reduce file sprawl.

### 2.2 Staged Migration Workflow
1.  **Define Phase**: Create new interfaces/types.
2.  **Implementation Phase**: Insert new logic while keeping existing steps (e.g., Service Worker registration, Permission checks).
3.  **Verification Phase**: Run builds and manual/auto tests.
4.  **Cleanup Phase**: Safely remove deprecated code only after the feature is stable in production.

---

## 3. Component Standards (React/Next.js)

- **Explicit Props**: Always define an `interface Props` for components.
- **Server vs Client**: Be mindful of the `'use client'` directive. Minimize its scope to specific leaf components.
- **Error Boundaries**: Wrap high-risk UI sections in error boundaries.
- **Custom Hooks**: Extract complex lifecycle logic (fetching, state orchestration) from components into custom hooks.

---

## 🛠️ Engineering Checklist
- [ ] No `any` introduced in the current change.
- [ ] All `setXxx` calls point to valid state variables (no "ghost references").
- [ ] Build success locally (`npm run build`).
- [ ] ESLint passes.
