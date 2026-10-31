# 3D Model Manager for Home Assistant

Custom integration for 3D Model Manager (tdmm). Work in progress.

## Releasing

1. Bump `version` in `custom_components/tdmm/manifest.json`.
2. Open a PR and merge to `main`.
3. The release workflow tags `v<version>`, builds the cards, zips the integration (bundle included) as `tdmm.zip` and publishes a GitHub release. HACS installs that zip.

Tags are never moved; an existing version tag means no release is made.
