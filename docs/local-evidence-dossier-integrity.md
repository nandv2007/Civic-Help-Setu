# Local Evidence Dossier Integrity Verification (#947)

A citizen assembling a complaint dossier needs to know two things before they send it anywhere:

1. **Which files are in the dossier** — what each one is, and what it shows.
2. **Whether any of them changed** since the dossier was put together.

This workspace answers both without uploading anything. It builds a local **evidence manifest**: a JSON file with the file name, size, format, a SHA-256 digest and an optional note for every piece of evidence. Later, the same files can be selected again and compared against the manifest.

Route: `/evidence-manifest` (also `/evidence-integrity`, `/services/evidence-manifest`)

Code:

| File | Purpose |
| --- | --- |
| `src/data/evidenceManifestContract.js` | Schema constants, limits, wording, file validation |
| `src/services/evidenceManifestService.js` | Hashing, manifest build/parse/serialise, comparison, CSV export |
| `src/services/evidenceManifestStorage.js` | Optional local save of the manifest + last check summary |
| `src/pages/EvidenceManifestWorkspace.jsx` | The two-tab workspace (build, verify) |
| `src/components/evidence/*` | Builder table, verifier result table, states, disclaimers, styles |

## Local-only by design

- File bytes are read **once**, in the browser, only to compute a digest. The `File` object is discarded afterwards.
- Nothing is uploaded. There is no API route, no Firebase write and no third-party call.
- Only metadata and digests are kept. Local storage holds the manifest (never file contents) and only when the citizen presses **Save on this device**.
- The exported `.json` file is the portable copy; importing it restores the manifest on any device.

## What a manifest records

```json
{
  "kind": "civic-help-setu.evidence-manifest",
  "schemaVersion": "1.0.0",
  "hashAlgorithm": "SHA-256",
  "title": "Streetlight complaint — Ward 42",
  "createdAt": "2026-11-18T09:12:00.000Z",
  "fileCount": 1,
  "files": [
    {
      "id": "entry-3f7a…-20481",
      "fileName": "pole-photo.jpg",
      "sizeBytes": 20481,
      "mimeType": "image/jpeg",
      "extension": "jpg",
      "digest": "9f2c…64 hex characters…",
      "addedAt": "2026-11-18T09:11:52.000Z",
      "description": "Pole outside gate 4, dark at 7pm"
    }
  ]
}
```

Entries are sorted by key so two identical manifests serialise identically, and the export ends with a newline for clean diffs.

## Limits

| Limit | Value |
| --- | --- |
| Files per manifest | 25 |
| Size per file | 10 MB |
| Formats | PDF, JPG/JPEG, PNG, WEBP, TXT |
| Manifest file size accepted on import | 512 KB |
| File name length | 160 characters |
| Description length | 200 characters |
| Manifest title length | 120 characters |

Limits are enforced in `validateEvidenceFile()` and in `parseManifest()`, so both the picker and an imported file are checked the same way. A file whose extension is known is accepted when the browser reports no usable MIME type (`''` or `application/octet-stream`), because some file managers do that; an extension that contradicts the reported MIME type is rejected.

## Verification results

`compareManifestToFiles()` is a pure function with four outcomes:

| Status | Meaning |
| --- | --- |
| `verified` | Same name **and** same digest — the bytes are unchanged. |
| `changed` | Same name, different digest — the bytes changed after the manifest was made. The size difference is shown. |
| `missing` | Listed in the manifest but not among the files selected now. |
| `extra` | Selected now but not listed in the manifest — probably added later. |

Matching is by file name; a renamed file therefore shows up as `missing` **and** `extra` rather than being guessed at. That asymmetry is deliberate: the tool reports what it can actually see.

The "created" stamp is stable: renaming a dossier, or re-exporting an unchanged one, keeps the original `createdAt`. Adding, removing or re-hashing a file starts a new stamp (`resolveManifestCreatedAt()`).

Entry ids include a short slug of the file name, so the same bytes under two different names still get distinct ids (they are React keys as well as records) — the duplicate warning links the pair instead of the table collapsing two rows into one.

`findDuplicateEntries()` separately flags byte-identical files (same digest under different names) and repeated file names, both while building and while verifying.

## Accessibility and failure handling

- Both long-running steps (hashing on add, hashing on verify) show progress with `role="progressbar"`, `aria-valuenow` / `aria-valuetext`, and a polite live region naming the file being processed.
- Errors use `role="alert"`; per-file rejections are listed individually with the reason and are dismissible.
- Verification completes even if some files fail, and those files are reported separately — they are never silently counted as unchanged.
- The red "mismatch" digest colour is reserved for `changed` rows; a file that is merely absent or unlisted is never painted as a conflict.
- The description counter measures the stored (sanitised) value, so the number matches what the exported manifest contains.
- Status is shown with an icon and a word ("Unchanged", "Changed", "Missing", "Not in manifest"), not colour alone.
- The tabs use `role="tablist"` / `role="tabpanel"` with `aria-selected` and `aria-controls`.
- When Web Crypto (`crypto.subtle`) is unavailable the service throws a clear error instead of falling back to a weaker hash, and the page shows an error state.
- Offline use works: nothing needs the network, and an offline notice explains that.

## Honest limits (shown in the UI, not just here)

- A matching digest proves **integrity** — the bytes are identical to those recorded. It does not prove **authenticity**: who issued the document, whether it is genuine or legally valid, or when a photo was actually taken.
- Timestamps come from the browser clock and can be edited, so `addedAt` records when the file was added to the manifest, not an independent proof of capture time.
- A manifest is a plain JSON file and can be hand-edited. Someone who changes both a file and its digest will still pass the check, so citizens are told to keep the exported manifest somewhere they trust.
- Hashing is not a substitute for an official acknowledgement, receipt or forensic process.

## Tests

```bash
npm test -- --run src/services/evidenceManifestService.test.js   # contract limits, hashing, parse/compare, storage
npm test -- --run src/pages/EvidenceManifestWorkspace.test.jsx   # workspace, builder, verifier and state components
```

Coverage highlights: tampered files (`changed` + size delta), missing files, files added later, renamed files, duplicate bytes and duplicate names, oversized/empty/wrong-format files, malformed manifests (non-JSON, wrong `kind`, missing/old/new schema version, unsupported algorithm, bad digest, impossible timestamp, negative size, oversized file), storage quota failure, corrupt saved manifest, and unavailable `crypto.subtle`.
