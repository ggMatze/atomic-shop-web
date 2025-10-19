# 🖼️ Contributing Item Images

Thank you for helping improve the image quality for the **Atomic Shop Web** project!  
This guide explains how to submit **new** or **replacement** item images.

---

## 📁 Folder Structure

All images are stored in:

[`textures/atx/storefront/`](https://github.com/ggMatze/atomic-shop-web/tree/main/textures/atx/storefront)

Organized by category, for example:
```
textures/atx/storefront/
 └── camp/
     └── kits/
         └── atx_camp_kit_triumphterraceporch_c1.webp
```

Always keep the same folder path when adding or replacing images.

---

## 🏷️ File Naming Rules

Each file follows this pattern:
```
atx_[category]_[subtype]_[itemname]_c[number].webp
```

Example:
```
atx_camp_kit_triumphterraceporch_c1.webp
```

### Adding or Replacing Images

- If `c1` already exists and you want to upload an improved version, **create a new file** with the next number:
  - `c1` → existing  
  - `c2`, `c3`, `c4`, etc. → new or improved versions
- **Do not overwrite existing files.**
- Use **lowercase letters** and **underscores (`_`)** only.
- Keep `.webp` format for consistency.

---

## 🧰 Image Requirements

- Format: **.webp** (lossless or high-quality)
- Keep dimensions 512*512 as the original (don’t upscale)
- Center the subject, dont show unrelated items or clutter and avoid UI elements and watermarks
- Use transparent or clean backgrounds when possible
- Optimize file size (recommended: < 500 KB)

---

## 📨 Submitting a Pull Request

1. **Fork** this repository  
2. Add your new `.webp` file in the correct subfolder  
3. **Do not delete or overwrite** old files  
4. **Open a Pull Request (PR)** and include:
   - A short description of what image you added or replaced  
   - Example:
     > “Added `atx_camp_kit_triumphterraceporch_c2.webp` — improved lighting and centered framing.”

---

Thanks again for contributing and keeping the Atomic Shop Web project looking great! ✨
