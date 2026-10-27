# Website URLs for the Vercel release

The current React source is the sibling `scrollsnooze-web` folder. Follow its
`VERCEL_DEPLOY.md`. The older Sites origin is not the target for the new deployment.

Production website: https://scrollsnooze.vercel.app

Configured app links: privacy `/privacy/`, deletion `/delete-account/`, terms `/terms/`, support `/support/`.

Website build configuration:

- Vercel: `SITE_URL=https://scrollsnooze.vercel.app`
- Expo Production (or eas.json production.env): `EXPO_PUBLIC_WEBSITE_URL=https://scrollsnooze.vercel.app`

Rebuild/redeploy after changing these build-time settings. Keep the API URL pointing to AWS.

| Page / Play Console field | Path on the production website |
| --- | --- |
| Website | `/` |
| Privacy policy | `/privacy/` |
| Account deletion | `/delete-account/` |
| Terms | `/terms/` |
| Support | `/support/` |

Website deletion requests are email based. The user prepares and sends a message;
support must monitor siddiqkolimi.dev@gmail.com, verify ownership and fulfill deletion.
The website does not automatically delete data. In-app authenticated deletion is separate.
