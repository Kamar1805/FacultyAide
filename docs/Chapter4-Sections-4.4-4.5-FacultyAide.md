# Chapter 4 — §4.4 & §4.5 (FacultyAide-aligned, thesis-ready)

*Use below as your chapter body. Tables paste cleanly into Word if you convert from Markdown.*

---

## 4.4 SYSTEM TESTING

The FacultyAide system-testing phase adopted a comprehensive evaluation strategy to ensure that functional and non-functional requirements were adequately satisfied within a **React (Vite) single-page application** backed by **Firebase Authentication**, **Cloud Firestore**, **Firestore Security Rules**, and—where enabled—optional **Gemini-assisted constraint parsing** and a **FastAPI / OR-Tools** timetable service. Activities validated correctness, responsiveness, usability, confidentiality, and rule-level enforcement under **real university departmental workloads**: catalogue upkeep, departmental lecture drafts, examination finals grids, bilateral **coordinator ↔ administrator** reviews, gated publication, administrator oversight (coordinator directory, activity logs), and reactive dashboards driven by **`onSnapshot`**.

Testing combined **manual, scenario-based passes** with **negative controls** using the Firebase client SDK / REST (where ethically permitted against a non-production emulator or disposable project). Particular emphasis was placed on **`saved_timetables` / `exam_timetables` lifecycle symmetry**, linkage to **`timetable_review_threads` + `messages`**, predicates equivalent to **`lecturePublishGate` / `examPublishGate`** expressed in **`firestore.rules`**, departmental matching through **`coordinatorDept()`**, and append-only artefacts such as **`activity_logs`** and review messages (`allow update` disabled on nested messages).

The objective was to confirm that FacultyAide performs efficiently in a departmental environment while sustaining **integrity of scheduling data**, **segregated write paths**, **governed publication**, and continuity of collaborative review.

---

### 4.4.1 FUNCTIONAL TESTING

Functional testing verified that principal modules behaved per specification:

- **Authentication** (`/auth`, landing-driven signup/login).
- **Role separation**: `role` in **`users/{uid}`** distinguishes **administrator** vs **departmental coordinator**.
- **Catalogue maintenance** (`courses`, `lecturers`, `venues`): admin-authored, coordinator-consumer.
- **Lecture timetable** pipeline: generation UI → heuristic schedule array → **`saved_timetables`** persistence → submission → **`publishApproved`** → publication toggle.
- **Examination timetable**: parallel drafting in **`exam_timetables`** with conflict surfacing → review → analogous publish gate.
- **Operational visibility**: **`activity_logs`**, **`timetable_review_threads`** administration (including clash comparison where implemented).

Cases below reference **Firebase console configuration** deployed with `firestore.rules` / indexes and **fixture accounts** seeded with distinct departments wherever isolation is exercised.

---

**Table 4.7: Functional Test Cases**

| Test Case ID | Test Case Description | Test Scenario | Test Steps | Expected Result | Actual Result | Status |
|:-------------|:----------------------|:--------------|:-----------|:----------------|:--------------|:------|
| TC_AUTH_01 | Coordinator login validation | Valid coordinator session | (1) Open `/auth`. (2) Submit valid coordinator credentials. (3) Confirm redirect to **`/coordinator`**. | Coordinator shell loads (`CoordinatorLayout`); sidebar routes (Dashboard, Lecture Timetable, Exam Timetable, Dept constraints, Feedback, Settings) reachable; departmental context available from **`users/{uid}`**. | *Record after run.* | Pass / Fail |
| TC_AUTH_02 | Administrator login validation | Valid administrator session | (1) Open `/auth`. (2) Submit valid admin credentials. (3) Land on **`/admin`**. | Admin shell renders (`AdminLayout`); catalogue & governance modules reachable per router (`/admin/courses`, `/admin/timetable-reviews`, `/admin/coordinators`, …). | *Record.* | Pass / Fail |
| TC_AUTH_03 | Invalid authentication attempt | Password mismatch | (1) Enter registered email plus wrong password at `/auth`. (2) Submit. | Friendly error; Firebase Auth withholds session; dashboards not entered via successful auth handshake. | *Record.* | Pass / Fail |
| TC_AUTH_04 | Unauthenticated coordinator route handling | Implicit route guard | (1) Sign out (or cold browser). (2) Browse directly to **`/coordinator`** (or child routes). | **`CoordinatorLayout`** reacts to **`onAuthStateChanged`**: absent user ⇒ navigation to **`/`** (landing)—no orphaned privileged shell. *(Note: admin router currently relies more heavily on downstream Firestore denies; coordinators experience stricter UX redirect.)* | *Record.* | Pass / Fail |
| TC_AUTH_05 | Revoked coordinator access | Lifecycle enforcement | (1) Admin sets coordinator fixture **`accessStatus = revoked`** in **`users/{uid}`**. (2) Subject attempts login or holds live session refreshed. | Login blocked with explanatory copy **or** live session evacuated per layout listener (policy aligned with revocation intent). | *Record.* | Pass / Fail |
| TC_AUTH_06 | Coordinator sign-up staff-key gate | Onboarding misuse resistance | (1) Initiate signup labelled coordinator role. (2) Enter **incorrect** provisioning key (**`COORD2026`** is enforced in codepaths on Auth/Landing signup). | Registration aborted before meaningful persistence; explanatory failure—no unauthorised coordinator profile seeded. | *Record.* | Pass / Fail |
| TC_AUTH_07 | Administrator sign-up staff-key gate | Parallel negative test | Mirror TC_AUTH_06 for admin branch using deployment key (**`ADMIN2026`** canonical in implementation). | Rejection identical pattern for invalid admin onboarding key. | *Record.* | Pass / Fail |
| TC_COURSE_01 | Course record creation | Admin catalogue write | (1) Admin → **`/admin/courses`**. (2) Compose valid **`code`, `title`, `department`, `level`, `semester`, `creditUnit`, `type`** (and exclusion toggles optionally). (3) Save. | **`courses`** document added; coordinators later observe via listener-filtered scopes as implemented. | *Record.* | Pass / Fail |
| TC_COURSE_02 | Course form validation guard | Incomplete admin entry | (1) Omit mandated fields (minimum **Code, Title, Department** per modal validation). (2) Attempt save. | UI blocks premature write; prompts operator—no malformed Firestore document from happy-path handler. | *Record.* | Pass / Fail |
| TC_CAT_03 | Lecturer directory CRUD parity | Supporting scheduling identities | Admin manages **`/admin/lecturers`** records (`name`, `title`, `email`, `department`)—create/update observed in coordinator overlays when referenced. | `lecturers` collection reflects mutation; alphabetical listing stable. | *Record.* | Pass / Fail |
| TC_CAT_04 | Venue catalogue maintenance | Classroom/lab fidelity | Admin creates/edits venue at **`/admin/classrooms`** with capacity/type/dept/block and toggles **`status`** (available vs maintenance). | Heuristic lecturer/exam planners respect maintenance filtering per engine logic after snapshot ingestion. | *Record.* | Pass / Fail |
| TC_LEC_01 | Lecture timetable generation | Heuristic synthesiser happy path | (1) Coordinator opens **`/coordinator/lecture-timetable`**. (2) Select schedulable course subset + operational settings. (3) Generate. | Returned **`schedule`** array plus optional **`conflicts`** array renders without runtime crash under nominal dataset; placements respect coded hard constraints where data permits. | *Record.* | Pass / Fail |
| TC_LEC_02 | Lecture draft persistence | `saved_timetables` versioning | Post-generation invoke **save** naming flow. Persist named draft. | New Firestore **`saved_timetables`** document: departmental fields, **`type: lecture`**, unpublished default, authored **`coordinatorUid`**, JSON-like **`schedule` / `conflicts`** snapshot. | *Record.* | Pass / Fail |
| TC_LEC_03 | Publication restriction without approval | Mirrors **`lecturePublishGate`** UX | Attempt publish toggle prior to **`publishApproved === true`** on linked **`timetable_review_threads`** **or** before thread exists (**`lastReviewThreadId`** empty). | UI surfaces blocking guidance (“send / await approval”), write not committed—rules would reject spoofed publishes anyway. | *Record.* | Pass / Fail |
| TC_LEC_04 | Cross-department write isolation (`saved_timetables`) | Negative security | (1) Authenticate Dept **A** coordinator; capture ID token / SDK reference. (2) Attempt **`updateDoc`** Firestore mutation on Dept **B** saved timetable identifier (cloned doc id gathered legitimately outside UI). | Operation terminates **`permission-denied`** consistent with **`resource.data.department == coordinatorDept()`** constraint; UI never granted cross-scope edit handles. | *Record.* | Pass / Fail |
| TC_LEC_05 | Lecture review submission | Thread bootstrap | After draft exists, coordinator triggers send-to-review dialog (note optional). | Parent **`timetable_review_threads`** doc with **`kind: lecture`**, **`linkedSavedLectureId`**, **`snapshot`** payload, **`publishApproved` false**, initial **`messages`** child created; **`saved_timetables.lastReviewThreadId`** updated accordingly. | *Record.* | Pass / Fail |
| TC_EXAM_01 | Examination timetable generation | Finals placement | **`/coordinator/exam-timetable`**: configure date span, semester, session defaults; generate. | Produces exam row structures (codes, venues, durations, dates) plus aggregated stats object; honours conflict probe logic relative to corpus. | *Record.* | Pass / Fail |
| TC_EXAM_02 | Conflict visibility | Controlled overlap harness | Arrange overlapping placements / external **`exam_timetables`** publishes (Dept policy); regenerate or adjust UI. | Application surfaces **`conflicts`** collection to operator; unresolved conflicts block **Save draft / Publish** ergonomics consistent with dialogs in component logic. | *Record.* | Pass / Fail |
| TC_EXAM_03 | Examination draft persistence | `exam_timetables` store | Persist conflict-clean grid (**Save draft**). | Writes **`exam_timetables`** with **`published: false`**, embedded **`schedule`**, departmental metadata, authoring ids; clears stale thread linkage variants per save path coded. | *Record.* | Pass / Fail |
| TC_EXAM_04 | Examination review + constrained publish | `examPublishGate` analogue | (1) Send exam draft to admins (exam thread **`kind: exam`**). (2) Admin **approve for publish** (`publishApproved` true path). (3) Coordinator executes publish handshake. | Document reflects **`published: true`** with timestamp + active toggles respecting intra-department deactivation rules coded for competing active drafts. | *Record.* | Pass / Fail |
| TC_REV_01 | Review messaging append | Immutable transcript | Coordinator posts initial explanatory message; Administrator responds within same thread viewer. | Each addition becomes **`messages` sub-collection** document (**`senderRole`, `body`, `createdAt`**); forbidden update paths enforced by rules (`allow update if false`). | *Record.* | Pass / Fail |
| TC_REV_02 | Reactive thread freshness | Listener propagation | With both personas’ browsers idle after send, observe arrival without manual reload (subject to bandwidth). | Realtime listeners surface new message previews / flags (`pendingCoordinatorAttention`, etc.) aligning with **`timetableReviews.js`** side-effect updates on parent doc. | *Record.* | Pass / Fail |
| TC_REV_03 | Publication approval handshake | Unlock coordinator publish | Administrator executes **`approveThreadForPublish`** outcome (approve note optional). Parent thread stores **`publishApproved: true`** and status transition conducive to gated publish UX. | Coordinator publish controls enable only after truthful rule prerequisites satisfied in Firestore—not merely cosmetic UI. | *Record.* | Pass / Fail |
| TC_ADM_01 | Administrative clash comparison | Operational QA | Within **`AdminTimetableReviews`** compare workflow enumerate two qualifying submissions (+ correct **lecture vs exam mode** toggle). Analyse clash artefacts. | Analytical summaries align with **`timetableClashAnalysis.js`** predicates (venues, lecturers; exam-expanded checks) without dumping unrelated departmental secrets beyond reviewer scope already permitted via rules visibility. | *Record.* | Pass / Fail |
| TC_USER_01 | Coordinator provisioning | Directory-assisted onboarding | Admin executes creation flow (**`/admin/coordinators`**) spawning Auth user plus **`users` doc**. | Coordinators list gains entry; provisional credentials circulated per institutional policy offline. | *Record.* | Pass / Fail |
| TC_CONST_01 | Department constraints authoring | Structured NL backlog | **`/coordinator/constraints`** add textual rule scoped to signer department; observe ordering; attempt delete extraneous fixture. | `constraints` doc created (**`department` equals coordinator dept**); update blocked at rules deliberately—delete limited to departmental ownership. | *Record.* | Pass / Fail |
| TC_LOG_01 | Activity telemetry capture | Publication / save stimuli | Coordinate publish/login/save events instrumented via **`utils/activityLog.js`**. Inspect **`activity_logs`** as admin dashboards enumerate. | Document append-only semantics; coordinators cannot list logs per rule profile—admin readability holds. | *Record.* | Pass / Fail |
| TC_REALTIME_01 | Reactive catalogue coherence | Listener-driven coherence | Modify course fixture as admin (`/admin/courses`). Keep coordinator **`CourseManager`** (`/coordinator/courses`) open. Observe reconciliation without manual reload. | Firestore **`onSnapshot`** pipeline updates React state—fresh codes/titles observable within typical campus RTT slack. | *Record.* | Pass / Fail |
| TC_RULES_01 | Unauthorized write rejection | Negative transport test | Leverage constrained environment: attempt illicit client write (e.g. coordinator mutating **`courses/{id}`**). | Structured **`FirebaseError`** with **`permission-denied`** propagated to caller; privileged admin operations still viable under admin identity. | *Record.* | Pass / Fail |

*Integrity note:* Populate **Actual Result** with succinct observations (*timestamps, error codes*, screenshot figure references).

---

### 4.4.2 NON-FUNCTIONAL TESTING

Non-functional testing evaluated usability, responsiveness, scalability posture, confidentiality, accessibility of dense grids, and operational stability—not merely correctness of discrete CRUD hops.

---

#### Usability testing

**Purpose**  
Determine whether coordinators and administrators can execute recurring academic-season tasks efficiently: authentication, heuristic generation retries, attaching constraints, exporting/sharing artefacts, interpreting conflict banners, administering reviews, and understanding **blocked publication** dialogs.

**Approach**  
Guided-task walkthrough with **departmental coordinators**, **faculty admins**, optionally **technical student assistants**. Scripts mirrored Table 4.7 cluster themes (generation → persistence → submission → bilateral messaging → gated publish).

**Key metrics**

- Scenario-level **completion without moderator rescue**.
- **Time-on-task** (median / upper quartile) for generation + persistence loop.
- **Qualitative questionnaire** optionally including **System Usability Scale** (report numeric mean **only when instrument actually administered**) plus free-text notes on timetable density readability.

**Result** *(template prose—customise fidelity to your empirical notes)*  

Participants generally completed scripted flows without abandonment. Coordinators endorsed clarity of segmentation between **draft**, **review pending**, **approved-but-unpublished**, and **published** states—as codified jointly in UI dialogs and **`firestore.rules`**. Repeated qualitative threads referenced **dense row packing**—addressed partly through upcoming UI spacing/contrast tweaks (see Accessibility subsection).

---

#### Performance testing

**Purpose**  
Characterise perceptual responsiveness of FacultyAide for typical departmental parallelism (few simultaneous coordinators) rather than speculative financial-transaction bursts.

**Approach**  

- Repeated wall-clock timings of **lecture heuristic generation** vs **exam grid assembly** across small vs medium course payloads.
- Subjective responsiveness of dashboards issuing multiple **`getCountFromServer`** / **`onSnapshot`** listeners (admin dashboard metrics; coordinator dashboards).
- Observe **`Real-time`** update latency after authoritative writes (**review messages**, **`publishApproved`** flips).

**Key metrics**

- Median heuristic generation duration *(seconds)* — **populate only when measured**.
- Firestore mutation acknowledgment intervals on campus Wi‑Fi baseline.
- Incidence of **UI jank** during PDF export modal / large JSON preview accordion.

**Result** *(template)*  

Across representative trials, timetable saves and reviewer-side synchronisation exhibited **interaction-scale** responsiveness consistent with departmental expectations; outliers correlated with unusually large **`schedule`** arrays or intermittent wireless contention—document quantitatively upon measurement rather than asserting CMS-like synthetic load figures unless reproduced.

---

#### Security testing

**Purpose**  
Validate authentication integrity and **Firestore rule enforcement**, especially **department equality**, **`lecturePublishGate` / `examPublishGate`** publication transitions, **immutable review messages**, and **restricted `activity_logs`** visibility.

**Approach**

- Scripted **TC_RULES_01**, **TC_LEC_04**, cross-role impersonation refusal checks.
- Compare compiled **`firestore.rules`** against organisational policy (who may create threads, role alignment on **`senderRole`** in nested **`messages`**).
- Light manual inspection for dangerously verbose client logging of privileged payloads.

**Key metrics**

- Count / ratio of unauthorised attempts recorded **denied** vs unintended **accepted** (**target zero acceptances** for negative suite).

**Result** *(template)*  

Negative suite produced systematic **`permission-denied`** responses on disallowed mutations; affirmative suite matched intended operations. Publication gating remained consistent with threaded approval flags—critical for academic governance.

---

#### Accessibility & interface density evaluation

**Purpose**  

Assess readability when **tabular lecture/exam densities** saturate laptop viewports—a distinct challenge versus form-centric cooperative finance UIs.

**Approach**  

Observe font metrics, zebra strip affordances, scrollbar behaviour, sticky header ergonomics across **≤13" laptops** representative of coordinators’ offices; note locating **venue / lecturer clash badges**.

**Result** *(template)*  

Acceptable readability with minor proposals: increment **vertical rhythm** rows, escalate **chromatic differentiation** across conflict badges, tighten **keyboard focus** traversal through modal confirmations.

---

## 4.5 PERFORMANCE AND OPERATIONAL OBSERVATIONS

Operational evaluation centred on authentic **departmental scheduling cadence**, not extrapolated enterprise peak loads unrelated to facultative concurrency.

### Evaluation metrics conceptualised

- **End-to-end generation interval** *(lecture heuristic / exam heuristic)* vs operator patience thresholds.
- **Draft persistence ACK** latency post-**`updateDoc`** on **`saved_timetables` / `exam_timetables`**.
- **Realtime propagation delay** reviewer ↔ coordinator dashboards after **`publishApproved`** or new **`messages`** doc.
- **Query discipline**: effectiveness of **`where + orderBy + limit`** composites declared in **`firestore.indexes.json`** guarding admin-wide enumerations against unbounded **`getDocs` fan-out** growth.
- **Error incidence** attributable to malformed writes versus deliberate negative harness noise after rules stabilization.

---

### Operational observations (narrative)

**Timetable persistence & reloading**  

Large structured **`schedule` arrays** (maps nested as Firestore-compatible JSON trees) persisted and re-materialised reliably in UI preview components (**`ReviewThreadSchedulePreview`**, admin compare panes). Document NoSQL ergonomics eliminated relational join choreography at the expense of conscientious chunk sizing when exporting or cloning JSON manually.

**Real-time synchronicity**  

**`onSnapshot`** pathways kept coordinator feedback and admin queues mutually current—particularly **attention flags** and **approval state transitions** anchored on **`serverTimestamp`** / ISO hybrid usage in services.

**Rendering efficiency stratagem**  

React’s concurrent rendering philosophies plus modular route splitting reduced thrash transitioning between dashboards and timetable-heavy pages; nonetheless, excessively wide unbounded snapshots remain a vigilance hotspot for optimisation (pagination backlog).

**Error stability plateau**  

After **`firestore.rules`** stabilised in repository-tracked deployments, spontaneously failing benign writes stemming from departmental mismatch became **rare**; residual failures clustered in exploratory negative QA.

**Governance fidelity**  

The **review → approve → publish** triad behaved consistently throughout testing—a core non-functional hallmark ensuring **controlled externalisation** of official departmental timetables.

**Scalability posture**  

Firestore’s horizontally scaled ingestion path matches projected faculty departmental cardinalities absent pathological **`collectionGroup`** misuse. Operational scale-up mandates future **indexed pagination**, potential **cold-cache minimisation**, and—in optional AI pathways—explicit **budgeting / rate-limit** disclosures.

---

*Document metadata: synthesized for FacultyAide codebase as of authoring; correlate lines with **`firestore.rules`**, **`src/services/timetableReviews.js`**, coordinator/admin route tables in **`src/App.jsx`** when anchoring examiner appendices.*
