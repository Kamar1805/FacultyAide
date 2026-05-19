# 4.3 Database implementation (backend)

FacultyAide persists data in **Google Cloud Firestore** with **Firebase Authentication**. Collections below match `firestore.rules` and `src/` usage. **Document IDs:** root collections use auto-IDs unless noted; **`users`** documents use the Firebase Auth **UID** as the ID.

**Note on types:** Firestore stores `timestamp` (native) or ISO **strings** depending on the write path; both represent instants in time.

---

## Table 4.3.1 — `users`

**Purpose:** Profile keyed to Auth UID; drives role, department binding, access revocation, coordinator preferences.

| Field name | Data type | Description |
|------------|-----------|-------------|
| *(document id)* | string | Firebase Auth UID. |
| `uid` | string | Same as Auth UID. |
| `email` | string | Login email. |
| `name` | string | Display name. |
| `role` | string | `admin` or `coordinator`. |
| `department` | string | Faculty department. |
| `staffId` | string | Staff key at signup or `ADMIN_PROVISIONED`. |
| `accessStatus` | string | `active` or `revoked`. |
| `createdAt` | string (ISO 8601) | Creation time. |
| `prefs` | map | `phone`, `officeRoom`, `timezone`, `bio`, `notifyEmailCoordinator`, `notifyWeeklyDigest`, `defaultExportFormat`. |
| `settingsUpdatedAt` | string (ISO 8601) | Last settings save. |
| `lastActiveAt` | string (ISO 8601) | Last shell heartbeat. |
| `lastVisitedPath` | string | Last coordinator route. |
| `revokedAt` | string \| null | Revocation time. |
| `revokedBy` | string \| null | Admin UID. |
| `provisionedBy` | string \| null | Admin UID for provisioned coordinators. |
| `departmentUpdatedAt` | string \| null | Last dept change. |
| `departmentUpdatedBy` | string \| null | Admin UID for dept change. |

---

## Table 4.3.2 — `courses`

**Purpose:** Curriculum catalogue; admin-maintained; consumed by generators and Fcom Bot.

| Field name | Data type | Description |
|------------|-----------|-------------|
| `code` | string | Course code. |
| `title` | string | Course title. |
| `department` | string | Owning department. |
| `level` | string | e.g. `100`. |
| `semester` | string | e.g. `First`. |
| `creditUnit` | string | Credit units as digit string. |
| `type` | string | Theory / Practical / variants. |
| `excludeFromTimetable` | boolean | Skip lecture timetable selection. |
| `excludeFromExamTimetable` | boolean | Skip exam generation when applicable. |
| `createdAt` | string (ISO 8601) | Created. |
| `updatedAt` | string (ISO 8601) | Updated. |

---

## Table 4.3.3 — `lecturers`

| Field name | Data type | Description |
|------------|-----------|-------------|
| `name` | string | Full name. |
| `title` | string | Honorific. |
| `email` | string | Email. |
| `department` | string | Department. |
| `createdAt` | string (ISO 8601) | Created. |
| `updatedAt` | string (ISO 8601) | Updated. |

---

## Table 4.3.4 — `venues`

| Field name | Data type | Description |
|------------|-----------|-------------|
| `name` | string | Room/hall name. |
| `capacity` | number | Integer capacity. |
| `type` | string | Hall / Lab / Theatre. |
| `dept` | string | Department or `General`. |
| `block` | string | Site block (`Congo`, `Limpopo`, …). |
| `status` | string | `available` / `maintenance` / `occupied`. |
| `createdAt` | string (ISO 8601) | Created. |
| `updatedAt` | string (ISO 8601) | Updated. |

---

## Table 4.3.5 — `saved_timetables` (lecture)

| Field name | Data type | Description |
|------------|-----------|-------------|
| `name` | string | Timetable label. |
| `department` | string | Owner department. |
| `schedule` | array\<map\> | Placed slots (course fields + `assignedVenue`, `assignedDay`, `assignedStart`, `assignedEnd`). |
| `conflicts` | array\<map\> | Unplaced courses + `reason`. |
| `coordinatorUid` | string \| null | Author. |
| `coordinatorName` | string | Display cache. |
| `type` | string | `lecture`. |
| `createdAt` / `updatedAt` | string (ISO 8601) | Times. |
| `isActive` | boolean | Dashboard highlight. |
| `published` | boolean | Live publication flag. |
| `status` | string | `draft` / `published`. |
| `publishedAt` | string | When published. |
| `lastReviewThreadId` | string | Linked review thread; publish gate. |

---

## Table 4.3.6 — `exam_timetables`

| Field name | Data type | Description |
|------------|-----------|-------------|
| `name` | string | Label. |
| `department` | string | Owner. |
| `coordinatorUid` / `coordinatorName` | string | Author. |
| `semester` | string | e.g. `First`. |
| `schedule` | array\<map\> | Exam rows (venue, date, time, course, invigilators, …). |
| `stats` | map | Generator stats (`totalExams`, `startDate`, `endDate`, …). |
| `isActive` | boolean | Dashboard active plan. |
| `published` | boolean | Published. |
| `publishedAt` | string | Publication time. |
| `type` | string | `exam`. |
| `createdAt` | timestamp \| string | Create (app may use Firestore `Timestamp`). |
| `updatedAt` | string (ISO 8601) | Updated. |
| `lastReviewThreadId` | string | Review / publish approval link. |

---

## Table 4.3.7 — `constraints`

| Field name | Data type | Description |
|------------|-----------|-------------|
| `kind` | string | e.g. `natural_language`. |
| `title` | string | Short label. |
| `text` | string | Rule body. |
| `department` | string | Scoped department. |
| `createdAt` | string (ISO 8601) | Created. |

---

## Table 4.3.8 — `activity_logs`

| Field name | Data type | Description |
|------------|-----------|-------------|
| `uid` | string \| null | Actor. |
| `userName` | string | Display name. |
| `userRole` | string | Role. |
| `department` | string | Context. |
| `action` | string | Event verb. |
| `targetType` | string | Entity type. |
| `targetId` | string | Document id. |
| `path` | string | App route. |
| `meta` | map | Extra safe metadata. |
| `createdAt` | string (ISO 8601) | Event time. |

---

## Table 4.3.9 — `timetable_review_threads`

| Field name | Data type | Description |
|------------|-----------|-------------|
| `coordinatorUid` | string | Owner. |
| `coordinatorName` / `coordinatorEmail` | string | Cached identity. |
| `department` | string | Department. |
| `kind` | string | `lecture` or `exam`. |
| `title` | string | Inbox title. |
| `snapshot` | map | Embedded `schedule`, `conflicts`, `semester`; lecture extras `nlConstraints`, `courseSelectionIds`; exam extras `stats`. |
| `status` | string | e.g. `submitted`, `approved_for_publish`. |
| `publishApproved` | boolean | Admin approval for publish gate. |
| `approvalNote` | string | Admin note. |
| `approvedAt` | string | Approval time. |
| `linkedSavedLectureId` | string | `saved_timetables` doc id. |
| `linkedExamTimetableId` | string | `exam_timetables` doc id. |
| `pendingAdminAttention` / `pendingCoordinatorAttention` | boolean | Unread flags. |
| `lastMessagePreview` | string | Last message excerpt. |
| `lastMessageRole` | string | `coordinator` or `admin`. |
| `coordinatorLastOpenedAt` / `adminLastOpenedAt` | string | Read receipts. |
| `createdAt` / `updatedAt` | timestamp | Server timestamps. |

---

## Table 4.3.10 — `timetable_review_threads/{id}/messages`

| Field name | Data type | Description |
|------------|-----------|-------------|
| `senderRole` | string | `coordinator` or `admin`. |
| `senderUid` | string \| null | Author UID. |
| `senderName` | string | Display name. |
| `body` | string | Message text. |
| `createdAt` | timestamp | Ordering. |

---

*Generated from FacultyAide repository and Firestore security rules.*
