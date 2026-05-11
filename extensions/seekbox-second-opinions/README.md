# SeekBox Second Opinions

Private MVP Chrome extension.

## Load Locally

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Pick this folder:

   `/Users/cloudsherpasadmin/SeekBoxLocal/xdotseekboxai/extensions/seekbox-second-opinions`

`Chrome` = browser. `Load unpacked` = use a local extension folder.

## Use

- Open any normal web page.
- Optional: highlight text.
- Click the SeekBox Second Opinions extension.
- Click `Get second opinion` for the cheap rotating route.
- Click `Ask 4/5 reads` for the multi-read route.
- Click `Open in SeekBox` to open the same prompt in the full SeekBox page.

## Sign-In Bookmarking

Signed-in bookmarking is intentionally explicit.

1. Click `Account` in the extension.
2. Sign in to SeekBox.
3. While the SeekBox tab is active, open the extension and click `Sync sign-in`.

The extension stores the short-lived Supabase access token in Chrome local extension storage. It does not store API keys.

## Backend

The extension calls:

`https://x.seekboxai.com/api/second-opinion`

Server-side route controls model choice:

- `SEEKBOX_SECOND_OPINION_QUICK_PROVIDER=chatgpt`
- `SEEKBOX_SECOND_OPINION_ROTATION=chatgpt,gemini`
- `SEEKBOX_SECOND_OPINION_COMPARE_PROVIDERS=chatgpt,claude,gemini,groksearch`

The route uses `VITE_BACKEND_URL` or `EXPO_PUBLIC_BACKEND_URL` to call the existing SeekBox search backend. No LLM provider key is bundled in the extension.
