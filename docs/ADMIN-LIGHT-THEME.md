# Admin Light Theme

**Date:** 2026-08-03

## Tokens (`apps/admin-web/src/app/globals.css`)

| Token                     | Value                             |
| ------------------------- | --------------------------------- |
| Page background           | `#F6F8FC`                         |
| Sidebar / card / table    | `#FFFFFF`                         |
| Table header              | `#F1F5F9`                         |
| Border                    | `#E2E8F0`                         |
| Primary text              | `#0F172A`                         |
| Secondary text            | `#64748B`                         |
| Muted text                | `#94A3B8`                         |
| Accent                    | cyan/teal (`#0E7490` / `#0891B2`) |
| Success / warning / error | accessible greens/ambers/reds     |

`color-scheme: light` on `:root`. Legacy `--nx-navy-*` aliases remapped to light surfaces so existing `nx-*` utilities stay consistent.

## Components covered

Sidebar, topbar, page background, cards, drawers, modals, forms, inputs, selects, tables, badges, empty states, pagination, tabs, buttons, metrics, timeline, overlays.

## Motion

- Hover/focus ~150ms; drawer ~240ms; modal ~200ms
- `@media (prefers-reduced-motion: reduce)` zeroes durations and disables non-essential transforms

## Verification

- No isolated dark `color-scheme: dark` remains in Admin globals
- Host + Docker Admin builds PASS with light theme CSS
