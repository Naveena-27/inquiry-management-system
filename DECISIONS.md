# DECISIONS

## Assumptions

- The app is for a small team using seeded accounts (one manager, several staff).
- A customer contact is either an email address or a phone number.
- Authentication uses seeded accounts with hashed passwords. After login, a JWT is stored in an httpOnly cookie and verified by middleware on every protected API route. The frontend only reflects what the API allows; it is never the source of security.

## Design Choices

**1. Access rule: the API decides, not the UI.**
Staff can access only the inquiries they created. Managers can access all inquiries and change their status. Access is enforced by the API when querying the database. Staff queries are scoped by owner_id, while managers can access inquiries across all owners. If a user requests an inquiry they cannot access, the API returns the same `404` as for a missing one, so users cannot discover which inquiry IDs exist.

**2. Status rules: a small state machine.**
The normal flow is `New -> In Progress -> Resolved`. `In Progress` can go back to `New`, and `Resolved` can be reopened to `In Progress` because real inquiries may require more work. Direct `New -> Resolved` is blocked because it skips the work stage. Invalid transitions return `422`, and the UI shows the error while keeping the current status.

**3. Duplicates: prevent them in the database.**
A partial unique index based on owner_id, lower(contact), and lower(subject) blocks duplicate open inquiries but allows a new one after the previous inquiry is resolved. I chose a database constraint so a double-click, retry, or concurrent request cannot create the same open inquiry. The API returns `409` with the existing inquiry's ID. Missing or invalid input is validated in the UI for guidance and again in the API with Zod, so the API does not rely on client-side validation.

**4. Stale data: optimistic locking.**
Each inquiry has a `version`. A status update sends the version the user last saw, and the update applies only if it still matches. If the version has changed, the API returns `409` with the latest record. The UI then refreshes the inquiry and tells the user that it changed.

**5. UI states.**
The UI handles loading, empty-list, and failed-save states. Users can narrow the inquiry list using keyword search or a status filter.

## Trade-off Accepted

I used optimistic locking on status changes instead of real-time synchronization. A second browser tab can remain stale until the user acts or reloads, but a stale update is not silently applied; it is detected and explained to the user. This avoids the additional complexity of WebSockets, which is not necessary for a small team.

## Known Limitations

- Duplicates are checked per staff member, so two different staff members can record the same customer issue.
- Contact and subject duplicate matching is case-insensitive, but contact formatting is not normalized. For example, differently formatted versions of the same phone number may not be detected as duplicates.
- Automated backend tests currently use the development database and clean up their generated records afterwards rather than using a separate test database.

## Testing

Backend tests cover authentication enforcement, ownership-based access, validation, invalid IDs, stale-version conflicts, and status transitions. Frontend tests cover form validation and stale-data handling.

End-to-end browser tests and truly simultaneous concurrent updates are not automated.

## Next Improvements

1. Status history log to record who changed what and when.
2. Separate database for automated tests.
3. Login rate limiting.
4. Pagination and inquiry assignment.

## Use of AI
I used Claude and ChatGPT as development assistants during this project, mainly for suggestions on individual components and logic, debugging, code review, and improving tests.
I reviewed the suggested code before using it. I checked how it worked, whether it matched the project requirements, and whether it fit with the rest of the application. I modified or rejected suggestions when necessary and tested the final implementation.

- **Accepted:** I accepted useful suggestions for improving validation and API error handling. I also added more backend tests for authentication, ownership access, stale updates, invalid IDs, and invalid status changes.
- **Changed:** I reviewed the suggested duplicate and stale-data handling and adjusted them to suit the project. I used database-level duplicate protection and version-based optimistic locking. I also found that test inquiries were staying in the database after the tests, so I changed the tests to clean them up automatically.
- **Rejected:** When dependency vulnerabilities were found, `npm audit fix --force` was suggested. I did not use it because it could cause breaking changes. Instead, I updated the affected packages carefully, fixed the Vite and plugin compatibility issue, and checked everything again using tests and a production build.

Finally, I reviewed the project file by file, including the database schema, API routes, validation, frontend components, and tests. AI helped me with coding, reviewing, debugging, and testing, but I reviewed the suggestions and made the final decisions about what to keep or change.