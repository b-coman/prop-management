# RentalSpot TODO List

This document lists pending tasks and future enhancements for the RentalSpot application.

## High Priority Tasks

- [ ] Complete unit tests for booking components
- [ ] Finalize property admin dashboard
- [ ] Add support for more payment methods

## Medium Priority Tasks

- [ ] **Implement hold expiration cleanup**: Create a scheduled Cloud Function to automatically mark expired holds and release dates. See [implementation plan](docs/implementation/hold-expiration.md).
- [ ] Add property analytics dashboard
- [ ] Implement guest messaging system

## Low Priority Tasks

- [ ] Support for multiple languages
- [ ] Integrate with more external booking platforms
- [ ] Enhanced SEO optimizations for property pages

## Completed Tasks

- [x] Implement booking form with React Hook Form
- [x] Create hold payments workflow
- [x] Fix input field issues in booking forms
- [x] Add email confirmation for holds
- [x] Integrate with Stripe for payments