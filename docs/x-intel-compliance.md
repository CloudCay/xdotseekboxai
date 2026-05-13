# X Intel Compliance Notes

X Battle and Anti-Echo are live social-intelligence surfaces for public X conversations. The production stance is:

- Summarize and score public posts; do not redistribute raw bulk X data.
- Return parsed summaries, themes, counters, paraphrases, post IDs/links, timing, and cost metadata.
- Do not return the gateway raw response text to the browser.
- Do not add CSV/JSON export of raw post collections.
- Show attribution wherever post links or post-derived summaries appear: "Data from X" plus links back to the original X URLs.
- Validate any surfaced source URL to `x.com` or `twitter.com`.
- If a future cache stores full post text, make that cache short-lived and deletion-aware; full text should expire within 24 hours and be removable if the original post disappears or X requests removal.
- Prefer storing summaries, scores, tags, and source IDs/URLs over full post bodies.
- Avoid features that feel like individual user surveillance.
- Revisit X Developer plan/approval before scaling paid access.

Current xdot implementation:

- `/api/x-intel/x-battle` and `/api/x-intel/anti-echo` proxy gateway calls server-side.
- Client bundles do not include the gateway URL or `/v1/chat` request shape.
- API responses omit raw model content and expose only parsed fields.
- Source URLs are sanitized to `x.com` / `twitter.com` before returning to the browser.
