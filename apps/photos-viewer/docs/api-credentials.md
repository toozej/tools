# API credentials for Photos Viewer

This guide covers Reddit, Flickr, and Imgur. Lomography does not need an API key. Configure only the sources you plan to use.

The viewer reads credentials on the server. Do not put them in a `NEXT_PUBLIC_` variable, a browser setting, or a Git commit.

| Source | Required settings | What the viewer uses |
| --- | --- | --- |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | An application OAuth token for public subreddit listings |
| Flickr | `FLICKR_API_KEY` | A key for public photo search |
| Imgur | `IMGUR_CLIENT_ID` | A Client ID for public gallery search |

## Get Reddit access

Reddit requires **explicit approval before Data API access**, including access to public data. Photos Viewer is an external website, so the Devvit signup flow does not supply the credentials that this app uses. Read the [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) and the [Data API access guide](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data) before you apply.

1. Sign in to the Reddit account that will own the application.
2. Submit the [Data API access request](https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=14868593862164). Describe Photos Viewer as an external, read-only photo viewer. State the subreddits you expect to access, the audience, and why Devvit does not fit this use case.
3. Wait for Reddit's explicit approval and follow its instructions for application registration. The [application settings page](https://www.reddit.com/prefs/apps) may be part of that process. Opening that page alone does not grant Data API approval.
4. Obtain a **client ID** and **client secret** for the approved application. This app uses the `client_credentials` OAuth flow. It cannot use an application type that has no client secret.
5. Set a unique user agent that identifies your app and Reddit account. For example, use `web:photos-viewer:v1.0 (by /u/YOUR_REDDIT_USERNAME)`. Replace the username with the account that owns the application. Reddit's [user agent guidance](https://ads-api.reddit.com/docs/v3/) describes this format.

Photos Viewer obtains its access token from Reddit when it needs one. Do not enter a Reddit password or a manually generated access token. If Reddit approves a different authentication flow, the app code must change before those credentials can work.

## Get a Flickr API key

Flickr requires an application key for its API. It distinguishes non-commercial and commercial requests. Review the [Flickr API key page](https://www.flickr.com/services/api/misc.api_keys.html) and [API terms](https://www.flickr.com/help/terms/api) for your intended use.

1. Create a Flickr account or sign in to the account that will own the key.
2. Select **Apply for your key online now** on the [API key page](https://www.flickr.com/services/api/misc.api_keys.html).
3. Select the application type that matches your use. Describe the viewer's public photo search and how you plan to display photos.
4. Copy the issued **API key** to `FLICKR_API_KEY`. Do not use the API secret in that setting.

Photos Viewer searches public photos. It does not ask Flickr users to sign in, so it does not use a Flickr user OAuth token.

## Get an Imgur Client ID

Imgur's [API documentation](https://apidocs.imgur.com/) describes application registration and `Client-ID` authorization for public, read-only requests. Photos Viewer needs the **Client ID**. It does not use the client secret or a user access token.

1. [Create an Imgur account](https://help.imgur.com/hc/en-us/articles/26512093810715-Create-an-Account) or sign in.
2. Open Imgur's [application registration page](https://api.imgur.com/oauth2/addclient). If it redirects, check the [Applications section of account settings](https://imgur.com/account/settings/apps) after you sign in.
3. Register Photos Viewer if Imgur presents a registration form. The viewer does not use an OAuth callback. If the form offers an option without a callback URL, select it.
4. Copy the issued **Client ID** to `IMGUR_CLIENT_ID`.

The registration URL redirected to the Imgur homepage during this guide's review. If neither signed-in page offers registration, do not substitute another user's Client ID. Check Imgur's current API documentation or contact Imgur support for access.

## Install the settings

### Docker Compose

Create `apps/photos-viewer/app.env` in the repository root. Add only the settings for sources you plan to use:

```dotenv
REDDIT_CLIENT_ID=PASTE_REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET=PASTE_REDDIT_CLIENT_SECRET
REDDIT_USER_AGENT="web:photos-viewer:v1.0 (by /u/YOUR_REDDIT_USERNAME)"
FLICKR_API_KEY=PASTE_FLICKR_API_KEY
IMGUR_CLIENT_ID=PASTE_IMGUR_CLIENT_ID
```

Replace every placeholder that you keep. Remove lines for sources that you do not configure. Restrict the file to your account with `chmod 600 apps/photos-viewer/app.env`. The repository ignores `*.env` files.

Both Compose files load `apps/photos-viewer/app.env` when it exists. They also accept the old `apps/lomo-homes-viewer/app.env` file. The new file takes precedence when both define the same setting.

Restart the service after you change its settings. For an existing development stack, run:

```bash
docker compose -f docker-compose-dev.yml --profile runtime up -d --force-recreate photos-viewer
```

For a production stack that uses `docker-compose-prod.yml`, run:

```bash
docker compose -f docker-compose-prod.yml up -d --force-recreate photos-viewer
```

The repository's `make up` command uses `docker-compose.yml`. Copy the production Compose file to that name before you use `make up`, as the root README describes.

### Direct Next.js development

If you run `bun run dev` inside `apps/photos-viewer`, put the same settings in `apps/photos-viewer/.env.local`. Next.js loads [`.env.local`](https://nextjs.org/docs/app/guides/environment-variables) for local development. It does not load Compose's `app.env` file by itself. Restart the development server after you edit the file.

## Check access

1. Open `/photos-viewer` on your running server.
2. Select each configured source and load a query such as `analog` for Reddit or `photography` for Flickr and Imgur.
3. If the viewer says `Set ... to use ...`, check the setting name and restart the server.
4. If Reddit returns an authentication or access error, check the client ID, client secret, user agent, and approval status.
5. If Flickr or Imgur rejects a request, check the issued key or Client ID and the provider's account status.

Do not paste credentials into bug reports or terminal output that you plan to share. Rotate a credential in its provider account if it becomes public.
