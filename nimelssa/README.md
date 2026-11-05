# NIGERIAN MEDICAL LABORATORY SCIENCE STUDENTS ASSOCIATION (UNIUYO)

## Departmental website — NIMELSSA UNIUYO

This is the website for the Medical Laboratory Science student association at the University of Uyo. It is not a faculty-wide portal. The primary name, as supplied by the site owner, is:

**NIGERIAN MEDICAL LABORATORY SCIENCE STUDENTS ASSOCIATION (UNIUYO)**

The interface uses the supplied association logo, Inter (the former website's typeface), deep green, yellow and cream. The homepage opens first; administrator access remains in the footer.

## Deliverables

- `NIMELSSA-MLS-Department.html`: self-contained, single-file departmental website with local admin workspace. Open it in a browser; no server is required. Its admin interface manages only this browser's copy. It does not secure or publish data on a hosted site.
- `NIMELSSA-complete-website.zip`: the complete site source, including a Python-based local preview server. Production content, admin access and uploads use the shared Faculty Portal backend described below.

## Run the application source

Python 3.10 or newer, standard library only, for local website preview:

```sh
cd nimelssa
python server.py --port 3000
```

Open http://localhost:3000. No frontend build step is required. For shared content, administrator access, submissions and media uploads, also run the Faculty Portal backend on port 5000; NIMELSSA calls its API directly. A deployed NIMELSSA site uses the deployed Faculty Portal API by default.

## Shared Faculty Portal backend

NIMELSSA has a separate admin workspace and separate Firestore collections, but uses the Faculty Portal's existing Firebase project and the same configured remote storage bucket. NIMELSSA records are namespaced (`nimelssa_content_*`, `nimelssa_submissions`, `nimelssa_subscribers`, and `nimelssa_admins`) so the two sites do not overwrite one another's content. Media is uploaded through the shared upload service under `uploads/nimelssa/`.

1. Configure and deploy `FacultyPortalWebsite/backend` with its existing Firebase Admin credentials, Firebase project, and storage settings. Keep `FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET` set to the Faculty Portal's existing values. The backend's existing CORS middleware allows the NIMELSSA site to call the API.
2. Run the Faculty Portal backend locally on port 5000 when previewing NIMELSSA locally. `platform.js` uses `http://localhost:5000/api/nimelssa` on localhost; change `window.NIMELSSA_API_URL` before `platform.js` loads if using a different API URL. Production defaults to `https://facultyportalwebsite-3.onrender.com/api/nimelssa`.
3. Create or use a Firebase Authentication account for the first NIMELSSA administrator, then run this command from `FacultyPortalWebsite/backend`:

   ```sh
   npm run set-nimelssa-admin -- your-official-email@example.com
   ```

   This grants the account the separate `nimelssaAdmin` custom claim. Sign out and back in after granting access. NIMELSSA administrators can then grant or remove NIMELSSA-only access from their own team page.
4. On the first authorized NIMELSSA admin sign-in, the starter data in `data/seed.json` is copied into missing NIMELSSA content records. Existing NIMELSSA records are not overwritten.
5. Confirm the backend reports remote Firebase Storage or S3 uploads as available. NIMELSSA uploads fail visibly if the shared remote bucket is unavailable; an ephemeral local upload is not treated as a successful shared upload.

The Firebase client module is loaded from the Faculty Portal backend and uses that project's existing Firebase Auth configuration. No service-account key or other private credential belongs in the NIMELSSA frontend. The standalone single-file HTML remains a browser-local demonstration and does not connect to the shared backend.

## Deploy the full site to Vercel

The full application can be hosted as a static Vercel site. The included `vercel.json` disables framework detection, dependency installation and build commands, and serves the application files from this directory. `404.html` is the branded not-found page. The local Python preview server, local SQLite database and local upload directory are intentionally not deployed.

### Deploy from the Vercel dashboard

1. Import the repository that contains this folder into Vercel.
2. Choose **Root Directory** based on the repository contents shown in Vercel:
   - If the repository root contains `index.html` and `vercel.json`, leave **Root Directory** as `.` (the NIMELSSA folder itself).
   - If the repository root contains a `nimelssa` subfolder with `index.html`, set **Root Directory** to `nimelssa`. The outer bundle folder also has a Vercel configuration that publishes that subfolder.
   - Do not set the root to `FacultyPortalWebsite/backend`.
3. Use the **Other** framework preset. The configuration at the selected root disables framework detection, install and build commands, and points Vercel at the static site files.
4. Deploy the project. No Vercel environment variables are required for the current production API URL.
5. Open the deployment and verify `/`, `/pages/about.html`, `/admin/login.html`, and a missing URL. Add the deployed Vercel hostname and any custom domain to the Firebase Authentication authorized domains.

### Deploy with the Vercel CLI

Run these commands from this `nimelssa` directory:

```sh
npx vercel
npx vercel --prod
```

The first command links the folder to a Vercel project and makes a preview deployment; the second publishes to production.

### Backend and storage requirements

Vercel hosts only the static NIMELSSA frontend. It does not deploy the Faculty Portal API, Firebase project, or storage bucket. The frontend currently calls `https://facultyportalwebsite-3.onrender.com/api/nimelssa` and loads Firebase client configuration from that backend. Keep the Faculty Portal backend online, with its existing Firebase project and remote storage bucket configured. If the backend URL changes, update the production API URL in `platform.js` (or set `window.NIMELSSA_API_URL` before that script loads).

The Faculty Portal backend must allow browser requests from the Vercel deployment and custom domain. The current backend CORS middleware allows cross-origin requests; if that policy is restricted later, add the deployed domains. Firebase Authentication also requires the Vercel and custom domains in its authorized-domain list. NIMELSSA administrator accounts still need the `nimelssaAdmin` claim granted from the backend as described above.

`data/seed.json` is intentionally included in the static deployment: it provides the public fallback content and is used to initialize missing NIMELSSA records on the first authorized admin sign-in. It contains starter/public site content only; never put credentials or private data in it.

## Pages and navigation

- `/`: full association identity, laboratory illustration, student links and calendar
- `/pages/about.html`: about NIMELSSA, its purpose and student community
- `/pages/department.html`: Medical Laboratory Science and introductory discipline descriptions
- `/pages/leaders.html`: approved association executive profiles
- `/pages/parliamentarians.html`: approved student representative profiles
- `/pages/past-questions.html`: study materials, subject search and level filters
- `/pages/documents.html`: approved departmental documents
- `/pages/newsletter-login.html`: newsletter registration
- `/pages/newsletter.html`: published association updates
- `/pages/marketplace.html`: student marketplace and submissions
- `/pages/companion.html`: community questions, replies and help resources
- `/pages/gallery.html`: approved departmental activity photographs
- `/pages/archive.html`: association stories and event records
- `/pages/social-handles.html`: official channels and contact details
- Individual detail pages for profiles, photographs, archive stories, marketplace items and community questions
- `/admin/login.html`, `/admin/dashboard.html`: administration
- `/404.html`: branded missing-page screen

The former `/pages/faculty.html` and `/pages/departments.html` paths remain as compatibility aliases, but their displayed content is now departmental. Main navigation uses the new About NIMELSSA and Our department URLs. Internal navigation never redirects to the old faculty website.

## Content and accuracy

The previous faculty-wide seed records are not used as NIMELSSA department records. The executive and representative directories, event gallery, archive, documents, inherited social contacts and marketplace start empty until the association publishes approved information. No faculty executive has been relabelled as a departmental executive. Old faculty records were backed up privately in the development workspace, not distributed as approved NIMELSSA content.

The department directory contains one department: Medical Laboratory Science. The department page introduces six broad scientific disciplines: clinical chemistry, haematology, medical microbiology, histopathology, immunology/serology and transfusion science. These are introductory descriptions, not an official UNIUYO curriculum, unit list, accreditation statement or examination schedule.

Twenty-nine study-support resources from the earlier library are retained for MLS and the supporting sciences. The explicitly Nursing-labelled NSC resource was removed. Resource availability, course codes, level relevance and permissions must be confirmed by the department. Google Drive/Docs resources open externally; they have not been copied or rewritten.

Introductory, purpose and vision copy is newly authored and should be approved by the association. Official founding history, appointments, contact information and academic dates have not been invented.

## Identity and imagery

The uploaded association logo is bundled unchanged as `assets/nimelssa-logo.jpg`. It is used in the header, footer, browser icon and homepage badge. The University of Uyo crest is retained in the footer from the previous project.

`assets/mls-laboratory.jpg` is an AI-generated illustration of a teaching laboratory. It is not a verified photograph of the department, its facilities, students or staff. Replace it with approved real photography when available. It is not used as an event record or individual leadership profile. Unrelated former faculty photographs and unused stock imagery are not bundled in this departmental source package.

The active typeface is Inter, locally bundled with its SIL Open Font License. The green-and-yellow palette and cream background preserve the requested visual direction.

## Working features

- Responsive desktop/mobile layout and shared departmental navigation
- Homepage calendar, resource search and support highlights
- Study-resource subject and level filters
- Local detail pages and honest empty states
- Shared Firestore newsletter registration storage (not email delivery)
- Marketplace, question and reply submission queues
- Administrator content creation, editing, deletion and media uploads
- Administrator approval/rejection of public submissions
- Newsletter edition publication and subscriber CSV export
- Editorial account management
- Firebase Authentication with a dedicated NIMELSSA administrator claim
- Separate NIMELSSA Firestore content, submission, subscriber and administrator namespaces on the shared Faculty Portal backend
- Media uploads through the Faculty Portal's configured remote storage bucket
- Preview-compatible form event handling, visible errors and 12-second request timeouts

## Standalone HTML mode

The HTML file embeds its pages, fonts, logo and illustration. It opens on the homepage and includes email/password fields when Admin login is selected. In this local mode, edits are stored only in browser storage when permitted. If the viewer blocks storage, edits last only for the current session and the interface says so. It is a local demonstration, not a secure shared authentication or publishing system. Do not put sensitive information in it.

The departmental version uses a new browser-storage namespace so the old faculty-wide content is not silently restored from an earlier file. The old namespace is not deleted. Browser-local edits from the earlier faculty version are not automatically transferred to this departmental copy.

## Before public launch

1. Supply and approve the departmental executive/representative list, event photos, official contacts, founding history and any formal policy documents.
2. Review the full association name, the introductory text and the resource library for accuracy and permission to publish.
3. Replace illustrative lab imagery with official photographs if required.
4. Connect an email service, consent/retention procedures and an unsubscribe workflow before sending newsletter campaigns. The current app stores registrations only.
5. Confirm academic dates with the department. The calendar is a date browser, not an official events feed.
6. Use a production hosting architecture with HTTPS, durable storage, backups, logging, monitoring, abuse controls and security/privacy review. Python's standard-library development server is not a security-audited production deployment.
7. Confirm that the Faculty Portal Firebase service account and storage bucket are configured in its backend deployment. NIMELSSA's local Python preview database is not the shared production store.
8. Add production upload scanning, storage quotas and appropriate moderation policies before accepting public uploads.

## Container starter

```sh
docker build -t nimelssa .
docker run -p 3000:3000 -v nimelssa-data:/app/.data -v nimelssa-uploads:/app/assets/user-uploads nimelssa
```

The server binds to `0.0.0.0`, with `PORT` defaulting to 3000. This container is for serving the NIMELSSA site preview; shared administration and publishing still require the Faculty Portal backend.

## Quality checks

The self-contained departmental file was tested in Chromium at desktop and mobile widths. It opens on the homepage, uses Inter, displays the full association name, has no horizontal overflow on the tested routes, contains no public cross-department profiles, and shows six introductory discipline cards. The full-site admin requires a provisioned Firebase NIMELSSA claim. Approved leadership records begin empty; the admin department record count is one. Source JavaScript syntax was checked.

## Copy refinement
Public headings and service cards now use direct departmental wording rather than broad promotional slogans. Resource descriptions explain the action available in each section. Dashes were removed from visible prose; technical identifiers, URLs and date values are unchanged. The association name, logo and Inter typeface remain the same.
