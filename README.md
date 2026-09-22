# License Center downloads

Public installers and server packages for Impleo License Center.

**[Download License Center](https://impleotv.github.io/license-center-release/)** ·
**[All releases](https://github.com/impleotv/license-center-release/releases)**

The static site reads published stable releases from GitHub's public API. New
releases appear without a site rebuild. Drafts and prereleases are not displayed.
The website hosts no application server or customer data.

## Website development

Use Node.js 24. Run `npm ci` and `npm test`. Preview with `python preview.py`,
then open `http://127.0.0.1:8769`. The helper sets JavaScript MIME types explicitly
because Windows registry settings can otherwise cause browsers to reject modules.

Pushes to `master` test and deploy the site using GitHub Actions. Configure Pages
to use **GitHub Actions** and allow `master` in the `github-pages` environment.
No deployment secrets are needed. Only site files and assets enter the Pages artifact.

## Releases

The application release process uploads verified packages to a draft here and
publishes only after all downloads have been checked. Each release contains the
Windows desktop installer, three standalone servers, the Debian
deployment package, and `SHA256SUMS.txt`. Signing inputs are never published here.

The Debian package pulls `ghcr.io/impleotv/license-center:vX.Y.Z` anonymously.
This public image supports Linux AMD64 and ARM64. Each tenant still requires
a valid License Center activation.

Public tags refer to this repository's website history. They are not application
source snapshots. Published release files are immutable; corrections use a new
application version. Partial drafts can be resumed by the application publisher.
