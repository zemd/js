# Security Policy

The maintainers of the `@zemd/js` monorepo take the security of the published packages seriously. This document sets out the terms under which security research may be conducted against this project and the process by which vulnerabilities must be reported.

## Supported Versions

Security fixes are provided **only for the latest released version** of each package published from this repository. Older releases are considered end-of-life the moment a newer version is published, and no patches, backports, or advisories will be issued for them.

| Package                 | Supported                |
| ----------------------- | ------------------------ |
| `@zemd/std-modules`     | Latest published release |
| `@zemd/http-client`     | Latest published release |
| `@zemd/openapi`         | Latest published release |
| `@zemd/tsconfig`        | Latest published release |
| `logtown`               | Latest published release |
| `@logtown/hono`         | Latest published release |
| `@zemd/figma-rest-api`  | Latest published release |
| `@zemd/flickr-rest-api` | Latest published release |
| Any prior version       | **Not supported**        |

Users are solely responsible for keeping their dependencies current.

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues, pull requests, discussions, or any other public channel.**

Report vulnerabilities through one of the following private channels:

1. **GitHub Private Vulnerability Reporting** (preferred) — open a report at
   <https://github.com/zemd/js/security/advisories/new>.
2. **Email** — <oss@zemd.dev> with the subject line `SECURITY: <package name>`.

To enable triage, your report must include, to the extent known to you:

- The affected package name and exact version(s).
- The runtime and environment in which the issue reproduces (Node.js version, browser, bundler).
- A description of the vulnerability class and the security impact.
- Complete, minimal, and self-contained steps to reproduce, including proof-of-concept code where applicable.
- Any mitigating factors or preconditions required for exploitation.
- Whether the issue has been disclosed to, or is known by, any third party.

Reports that do not contain sufficient information to reproduce and validate the issue may be closed without further action.

## Response Process

The maintainers will use reasonable efforts to:

- Acknowledge receipt of your report.
- Validate the report and determine severity, typically using [CVSS v3.1](https://www.first.org/cvss/).
- Keep you informed of remediation progress.
- Publish a GitHub Security Advisory and request a CVE identifier where the issue warrants it.
- Credit the reporter in the advisory, unless anonymity is requested in writing.

**These are good-faith objectives, not contractual commitments.** No service level, response time, remediation deadline, or guarantee of any kind is created by this document.

## Coordinated Disclosure

By submitting a report, you agree to the following, which constitute conditions of the authorization granted in the Safe Harbor section below:

- You will keep the vulnerability, all related information, and any data obtained during your research strictly confidential until a fix has been released and an advisory has been published, or until **90 (ninety) days** have elapsed from the date of your report, whichever occurs first.
- You will not publish, present, or otherwise disclose the vulnerability to any third party during that period without the prior written consent of the maintainers.
- Where a fix is not feasible within 90 days, you will negotiate an extension in good faith.
- You will delete or destroy all data obtained in the course of your research promptly upon request and, in any event, upon conclusion of the coordinated disclosure process.

## Scope

**In scope:** the source code contained in this repository and the `@zemd/*`, `logtown`, and `@logtown/*` artifacts published to npm from this repository.

**Out of scope**, and expressly excluded from the Safe Harbor below:

- Vulnerabilities in third-party dependencies, transitive or otherwise. Report those to their respective maintainers; you may notify us so that a version bump can be issued.
- Vulnerabilities in third-party services or APIs accessed by the HTTP clients in this repository, including but not limited to the Figma and Flickr APIs.
- Findings that require a compromised host, malicious dependency, physical access, privileged local access, or otherwise depend on an already-compromised environment.
- Insecure usage patterns arising from a consumer's own application code, configuration, secrets management, or deployment.
- Reports generated solely by automated scanners without a demonstrated, exploitable impact.
- Missing security headers, best-practice recommendations, outdated-library notices, or theoretical issues absent a working proof of concept.
- Social engineering, phishing, physical attacks, denial-of-service, resource-exhaustion, spam, or volumetric testing of any kind.
- Attacks against the maintainers' infrastructure, accounts, employees, or any system not owned by this project.

## Safe Harbor

The maintainers will consider security research and vulnerability disclosure activity conducted in accordance with this policy to be authorized conduct, and will not initiate or support legal action against you in respect of such activity, **provided that** you at all times:

- Act in good faith and comply fully with this policy, including its Scope and Coordinated Disclosure sections;
- Comply with all applicable laws and regulations;
- Make a good-faith effort to avoid any privacy violation, degradation, interruption, or destruction of services or data;
- Access, copy, retain, and use only the minimum amount of data strictly necessary to demonstrate the vulnerability, and never access, modify, or exfiltrate data belonging to any third party;
- Do not exploit the vulnerability beyond the extent necessary to confirm its existence, and do not pivot, escalate, or maintain persistence; and
- Do not demand, solicit, or accept payment, consideration, or any other benefit in exchange for withholding, delaying, or disclosing a vulnerability. Any such demand will be treated as extortion and reported to the appropriate authorities.

This authorization is limited to the maintainers of this project and does not, and cannot, bind, waive, or limit the rights of any third party, including npm, GitHub, other users, or any other service provider. Nothing in this policy authorizes you to act in a manner inconsistent with the law or with the terms of service of any third party, and you remain solely responsible for obtaining any authorization required from such third parties. If legal action is initiated by a third party against you in connection with activity conducted under this policy, this section does not constitute a defense, an indemnity, or an undertaking to provide any assistance.

The maintainers reserve the right, in their sole discretion, to determine whether any given activity was conducted in good faith and in compliance with this policy. Conduct that violates this policy is unauthorized, forfeits all protections offered here, and may result in the pursuit of all available civil and criminal remedies.

## No Bug Bounty

This project is maintained on a voluntary, unpaid basis and **does not operate a bug bounty program**. No monetary reward, bounty, swag, compensation, or reimbursement of any kind is offered, promised, or implied for any report. Submission of a report creates no expectation, contract, or obligation of payment.

## Rights in Submissions

By submitting a report, patch, proof of concept, or any other material to the maintainers, you represent and warrant that you have the right to do so and that the submission does not infringe the rights of any third party. You grant the maintainers a perpetual, irrevocable, worldwide, royalty-free, non-exclusive licence to use, reproduce, modify, publish, and distribute the submission for the purposes of analysing, remediating, testing, and publicly documenting the reported issue, including in security advisories, commit history, tests, and release notes. Any contributed code is additionally licensed under the licence applicable to the affected package.

## Disclaimer of Warranty and Limitation of Liability

The packages in this repository are provided **"AS IS", WITHOUT WARRANTY OF ANY KIND**, express or implied, including without limitation any warranty of merchantability, fitness for a particular purpose, title, non-infringement, or security. To the maximum extent permitted by applicable law, in no event shall the maintainers or contributors be liable for any direct, indirect, incidental, special, exemplary, punitive, or consequential damages, or for any loss of data, profits, goodwill, or business interruption, however caused and on any theory of liability, arising out of or in connection with the software, any vulnerability therein, or this policy. This section supplements, and does not limit, the disclaimers and limitations set out in the licence applicable to each package.

## Amendments

The maintainers may amend this policy at any time and without notice. The version published at the default branch of <https://github.com/zemd/js> governs, and applies to any report from the moment it is submitted.
