# Software Compliance Checklist Evaluation
**Project Name:** FacultyAide (A SMART CLASSROOM AND TIMETABLE ALLOCATION SYSTEM)

---

### 1. Which standards are violated?
Based on the provided compliance template and an analysis of the project directory, the following international standards are currently violated or lacking evidence:
- **ISO/IEC 12207 (Lifecycle Processes):** Violated. There are no defined software lifecycle processes present. The `package.json` contains no test scripts, and there are no CI/CD configurations, testing frameworks (like Jest or Vitest), or deployment pipelines defined.
- **ISO/IEC 27001 (Information Security Controls):** Violated. While Firebase handles basic authentication, there is no documented evidence of structured information security controls, role-based access control (RBAC) diagrams, or documented security rules in the repository.
- **ISO/IEC 25010 (Quality Attributes):** Violated. There is no evidence of a systematic evaluation of performance, security, or usability metrics.
- **ISO 9001 (Quality Management):** Violated. There are no documented quality management systems, issue tracking workflows, or review policies in the repository.

### 2. Which compliance laws are breached?
Given that this is an educational management tool (handling lecturer profiles, departments, and scheduling), it is subject to data privacy regulations.
- **Data Protection Laws (e.g., NDPR, GDPR, FERPA):** The system is at high risk of breaching these regulations because there are no documented Privacy Policies, Data Retention Policies, or Terms of Service. Furthermore, there is no documentation detailing how user data (names, emails, schedules) is encrypted at rest or how explicit consent is handled.

### 3. What quality gaps exist?
- **Absence of Automated Testing:** There are absolutely no unit tests, integration tests, or end-to-end (E2E) testing tools set up in the project. The team relies entirely on manual testing.
- **Missing Linter/Formatter Enforcements:** While ESLint is installed, there are no pre-commit hooks (like Husky) to enforce code quality before pushing code to production.
- **Lack of Error Tracking:** There is no integration with error logging or monitoring services to catch and document runtime crashes in production.

### 4. What documentation failures are visible?
The documentation failures are severe and span all areas of the provided checklist:
- **Requirements Unambiguous/Verifiable (IEEE 29148):** Failed. There are no Software Requirements Specifications (SRS) or User Stories documented anywhere in the repository.
- **Architecture Documentation Complete:** Failed. There are no system workflow diagrams, database schemas, or state management architectures documented.
- **API Documentation Provided:** Failed. There is no API documentation describing how the frontend communicates with Firebase or the Gemini AI model endpoints.
- **Default README:** The `README.md` file still contains the default Vite boilerplate text instead of describing the FacultyAide project, setup instructions, or environment variable requirements.

### 5. What risks exist for users?
- **Data Vulnerability:** Users are at risk of data exploitation due to the lack of documented security policies and backend validation rules.
- **System Instability:** Without automated testing, users are highly susceptible to experiencing regression bugs where new features break existing functionality (e.g., timetable generation failing silently).
- **Usability Frustration:** The lack of User Manuals or help documentation means coordinators and admins may not understand how to properly use the tool or resolve scheduling constraint conflicts.

### 6. What improvements are required?
To bring FacultyAide up to standard, the following steps must be taken immediately:
1. **Draft Core Documentation:** Replace the boilerplate `README.md` with proper project setup instructions. Create an architecture document, a database schema map, and an SRS document (IEEE 29148).
2. **Implement a Testing Strategy:** Install a testing framework (e.g., Vitest + React Testing Library) and write unit tests for core logic, especially around the timetable scheduling constraints.
3. **Document Security & Compliance:** Write a formal Privacy Policy and document the Firebase Firestore security rules ensuring strict role-based access to sensitive data.
4. **Establish Quality Management:** Set up a CI/CD pipeline (e.g., GitHub Actions) to run linters and tests automatically on every commit.
