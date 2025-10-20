# user-friendly Atomic Shop

This project is an accurate recreation of the Fallout 76 Atomic Shop, but with user-friendly presentation in mind, to inform about current offers and sales in the game.
It shows how the shop could look if images, labels, and prices were properly organized and easy to understand.

---

## Project Goals

- Recreate the Atomic Shop using HTML, CSS, and JavaScript  
- Use correct and properly ordered images for all bundles and items  
- Include clear label explanations (for example, `NEW*` → item not actually new; Clown Icon → huge messups on offers by bethesda)  
- Display prices in real-world currencies (€, $, etc.) instead of Atoms  

---

## Technical Overview

- Built with HTML, CSS, and Vanilla JavaScript  
- Dynamic tile system for bundles and items  
- Label system for NEW, SALE, 1ST, and other tags  
- Correct image order and consistent presentation
- Overlay with prices, title, description, image carousel, and item list

---

## Background

The original in-game Atomic Shop contains several presentation issues:

- Missing or incorrect images  
- Images showing unrelated or confusing content  
- Unsorted or inconsistent item layouts  
- Misleading labels on previously released items  
- Prices shown only in Atoms

---

## Contributing

If you'd like to help improve images or submit better product/media assets, please read the short guide below.

<details>
<summary><strong>Contributing alternative product images</strong> — click to expand</summary>

## Contributing item images (required workflow)

Thanks for helping improve images. IMPORTANT: before you upload, you MUST browse the repository folders and find the exact subfolder where the existing image for that item lives. Do not just upload into random folders.

### 1) Browse subfolders first (required)

- Open `textures/atx/storefront/` and navigate the subfolders until you find the item or category that matches your image. This prevents duplicate or misplaced files.
- If you find an existing filename for the item, use that naming pattern and add the next `_cN` suffix (see below).
- If you cannot find a suitable folder, open an Issue and ask for guidance before uploading.

### 2) File naming and versioning (required)

- Use the pattern exactly: `atx_[category]_[subtype]_[itemname]_c[number].webp`
- If `c1` exists, add `c2` (or the next number). Never overwrite an existing file.

Example:

- `textures/atx/storefront/camp/kits/atx_camp_kit_triumphterraceporch_c1.webp`

### 3) Image requirements (required)

- File format: **.webp** only (do not use PNG).  
- Image dimensions: **always 512 px** (storefront/thumb size). Do not upscale images.
- Center the subject, avoid clutter with other items and avoid UI overlays or text in the image. 

### 4) How to upload (non-technical, web UI)

1. Browse to the exact subfolder in `textures/atx/storefront/...` where you located the existing file.
2. Click **Add file → Upload files** and upload your `.webp` file with the correct `_cN` filename. (N = Number)
3. In the **Commit changes** message list the file path and the reason (short). Example:

   `Add textures/atx/storefront/camp/kits/atx_camp_kit_triumphterraceporch_c2.webp — improved framing`

4. Create a branch and open a Pull Request. If you need help where to place the file, open an Issue instead of uploading.

### 5) Pull request content (required)

In the PR description include:

- Files added (paths)
- Short reason for change
- Source statement (e.g. "In-game screenshot; used for non-commercial fan purposes")
- Optional: before/after screenshots

### More details

If you want a full checklist and a longer explanation, see `CONTRIBUTING.md` at the repo root for the authoritative guide.

</details>
