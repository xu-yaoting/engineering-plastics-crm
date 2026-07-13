# Contacts Table Design

**Date:** 2026-07-13

## Goal

Replace the Contacts card grid with a compact operational table that matches the CRM's existing Attio-inspired list pages and supports the team's actual communication habits: WeChat and mobile for domestic contacts, phone and email for overseas contacts.

## Scope

- Replace only the Contacts list presentation and its related filtering/sorting controls.
- Keep the existing contact create/edit side panel and current routes.
- Add a dedicated optional `wechat_id` field. Do not store WeChat IDs in phone or notes fields.
- Make email optional while requiring at least one usable contact method.
- Resolve country/region from the associated company rather than duplicating it on the contact.
- Add no production dependency and perform no destructive migration.

## Table Structure

The desktop table columns are:

1. **Contact**: initials avatar, full name, and compact primary-contact/decision-maker indicators.
2. **Company**: linked company name.
3. **Phone / WeChat**: WeChat ID and mobile/direct phone, using up to two compact lines.
4. **Email**: email address or an em dash when absent.
5. **Country / Region**: inherited from the associated company.
6. **Status**: active or inactive badge.
7. **Actions**: edit, duplicate, and delete menu.

Job title, department, process role, language, notes, and other secondary fields remain available in the edit panel but are not shown in the list.

## Interaction

- Clicking a row opens the existing edit side panel.
- Clicking the company name opens the company detail page without opening the contact panel.
- Search matches contact name, email, phone, WeChat ID, and company name.
- Filters include company and status (`all`, `active`, `inactive`).
- Sorting includes name, company, and last updated date. Name ascending is the default to preserve the current predictable directory behavior.
- The actions cell stops row navigation and retains edit, duplicate, and delete behavior.
- Bottom-row menus use the shared upward-opening table menu rule.
- Loading uses table-row skeletons and empty results remain inside the table surface with a clear new-contact action.

## Responsive Behavior

- The table supports horizontal scrolling when required.
- On medium screens, hide country/region.
- On small screens, also hide email and status, preserving contact, company, phone/WeChat, and actions.
- Text uses truncation and stable column widths so long company names and email addresses do not resize the table.

## Data Model And API

- Add nullable `contacts.wechat_id TEXT` using the project's additive migration helper.
- Include `wechat_id` in contact create and update field handling.
- Extend contact list/detail queries to return the associated company's `country` as `company_country`.
- Existing contact records remain unchanged; missing WeChat IDs display as an em dash.
- CSV export automatically includes the new field through the existing full-record export path.

## Validation

- `first_name` remains required.
- Email is no longer globally required.
- At least one of `email`, `phone_direct`, `phone_mobile`, or `wechat_id` must contain a non-whitespace value on create.
- On update, validation evaluates the merged stored record plus submitted changes so partial updates cannot accidentally make all contact methods empty.
- Invalid submissions return a clear API error and the side panel remains open.

## Visual Rules

- Reuse `page-shell`, `toolbar`, `data-surface`, table typography, status badges, and existing blue accent.
- Use the established 6px surface radius and 40-52px row rhythm.
- Do not add summary cards, gradients, oversized avatars, or decorative dashboard elements.
- Keep semantic color limited to active/inactive status and primary actions.

## Verification

- Add tests for the additive `wechat_id` migration and contact method validation.
- Add UI source tests for the table structure, status filtering, sorting, responsive columns, and WeChat field.
- Run the targeted tests, complete test suite, frontend/server type checks, and production build.
- Run the isolated API smoke test only if its contact fixture is updated to exercise the new validation rule.

