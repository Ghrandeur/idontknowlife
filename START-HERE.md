# NIMELSSA UNIUYO: complete website bundle

This bundle contains the latest Medical Laboratory Science departmental website, using the supplied logo, Inter font and revised copy.

## Open the single HTML version

Open `standalone/NIMELSSA-MLS-Updated-Copy.html` in Chrome or Edge. It opens on the homepage. Admin login is in the footer. This copy works locally; changes stay in your browser and do not update a shared website. Browser storage can be restricted in embedded previews.

The local HTML version retains the login supplied in this conversation. This is a local demonstration, not a secure hosted authentication system.

## Run the complete application

The `nimelssa` folder contains all application source files, public and admin pages, styles, JavaScript, images, fonts, initial content data, tests and deployment starter files.

Python 3.10 or newer is required. From a terminal:

    cd nimelssa
    python server.py --port 3000

Then open http://localhost:3000 in your browser. For shared publishing, run the Faculty Portal backend on port 5000 as described in `nimelssa/README.md`.

NIMELSSA administrator accounts use Firebase Authentication and require the separate NIMELSSA admin claim. Grant initial access from the Faculty Portal backend with:

    npm run set-nimelssa-admin -- your-email@example.com

The standalone HTML login remains browser-local and is not connected to the shared backend.

Read `nimelssa/README.md` for configuration, deployment, content approval and the difference between browser-local and server-backed features.

## Included

* All current website pages and local detail routes
* Administrator login and management interface
* CSS and JavaScript source
* Supplied association logo, University of Uyo crest and laboratory illustration
* Local Inter fonts and font license
* Initial department content and study-resource links
* Python server, Dockerfile, package metadata and smoke tests
* Latest standalone HTML website

Unrelated older drafts, generated dependency folders, development logs, test screenshots, private account databases, old faculty backups and personal data are intentionally excluded. External Google Drive/Docs study materials remain links, not copies of those files. Official email delivery and production hosting are not configured.
