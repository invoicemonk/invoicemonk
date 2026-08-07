<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Supabase Storage: never move object keys with SQL

Storage resolves a file by `name` **and** `version` from `storage.objects`;
the backend object key is derived from both. Rewriting `name` (or `version`)
with `UPDATE storage.objects ...` leaves the bytes behind at the old key and
permanently orphans the file — this is what broke every business logo on
15 July 2026.

To move or rename a stored object, always use the Storage API
(`supabase.storage.from(bucket).copy(oldKey, newKey)` then `.remove([oldKey])`),
verify the new key downloads, and only then update any URLs in the database.
