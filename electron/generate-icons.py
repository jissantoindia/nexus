#!/usr/bin/env python3
"""
Generate all platform-specific icon assets for the Nexus Electron app.

macOS  → flash.icns  (all required sizes including 1024×1024 for Retina)
Windows → flash.ico  (16, 24, 32, 48, 64, 128, 256 multi-resolution)
Linux  → flash_512.png, flash_256.png (standard sizes)
"""

from PIL import Image
import os
import struct
import zlib

SRC  = os.path.join(os.path.dirname(__file__), '../public/flash.png')
DEST = os.path.join(os.path.dirname(__file__), 'icons')
os.makedirs(DEST, exist_ok=True)

src = Image.open(SRC).convert('RGBA')

# ─── macOS HIG: icon content should fill ~80% of canvas (10% padding each side)
# Without this, the icon appears larger than other apps in the Dock.
def with_padding(img, canvas_size, padding_pct=0.10):
    """Place img on a transparent canvas with HIG-compliant padding."""
    pad    = int(canvas_size * padding_pct)
    inner  = canvas_size - 2 * pad
    scaled = img.resize((inner, inner), Image.LANCZOS)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(scaled, (pad, pad), scaled)
    return canvas

# ─── 1. macOS .icns ──────────────────────────────────────────────────────────
# Apple's required sizes: 16,32,64,128,256,512 + @2x variants (32,64,128,256,512,1024)
ICONSET = os.path.join(DEST, 'flash.iconset')
os.makedirs(ICONSET, exist_ok=True)

MAC_SIZES = {
    'icon_16x16.png':      16,
    'icon_16x16@2x.png':   32,
    'icon_32x32.png':      32,
    'icon_32x32@2x.png':   64,
    'icon_128x128.png':   128,
    'icon_128x128@2x.png':256,
    'icon_256x256.png':   256,
    'icon_256x256@2x.png':512,
    'icon_512x512.png':   512,
    'icon_512x512@2x.png':1024,  # ← Critical for Retina displays
}

for fname, size in MAC_SIZES.items():
    img = with_padding(src, size, padding_pct=0.10)
    img.save(os.path.join(ICONSET, fname), 'PNG')
    print(f'  macOS: {fname} ({size}×{size})')

# Convert iconset → .icns using iconutil
import subprocess
icns_path = os.path.join(DEST, 'flash.icns')
result = subprocess.run(
    ['iconutil', '-c', 'icns', ICONSET, '-o', icns_path],
    capture_output=True, text=True
)
if result.returncode == 0:
    print(f'✓ flash.icns created ({os.path.getsize(icns_path):,} bytes)')
else:
    print(f'✗ iconutil error: {result.stderr}')

# ─── 2. Windows .ico ─────────────────────────────────────────────────────────
# ICO format with all standard Windows sizes
WIN_SIZES = [16, 24, 32, 48, 64, 128, 256]

import io

def make_ico(source_img, sizes, output_path):
    """Build a proper multi-resolution .ico file."""
    images = []
    for size in sizes:
        img = with_padding(source_img, size, padding_pct=0.10)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        images.append((size, buf.getvalue()))

    # ICO header
    ico_header = struct.pack('<HHH', 0, 1, len(images))  # reserved, type=1(ICO), count

    # Directory entries come after header + all entries
    dir_size   = len(images) * 16
    header_size = 6 + dir_size
    offset = header_size

    directory = b''
    image_data = b''

    for size, png_bytes in images:
        w = 0 if size == 256 else size   # 256 stored as 0 in ICO spec
        h = 0 if size == 256 else size
        directory += struct.pack('<BBBBHHII',
            w, h,           # width, height (0 = 256)
            0,              # color count (0 = no palette)
            0,              # reserved
            1,              # color planes
            32,             # bits per pixel
            len(png_bytes), # size of image data
            offset          # offset from start of file
        )
        image_data += png_bytes
        offset += len(png_bytes)

    with open(output_path, 'wb') as f:
        f.write(ico_header + directory + image_data)
    print(f'✓ flash.ico created ({len(WIN_SIZES)} sizes: {WIN_SIZES})')

ico_path = os.path.join(DEST, 'flash.ico')
make_ico(src, WIN_SIZES, ico_path)

# ─── 3. Linux PNGs ───────────────────────────────────────────────────────────
for size in [512, 256, 128, 64, 48, 32, 16]:
    img = with_padding(src, size, padding_pct=0.10)
    out = os.path.join(DEST, f'flash_{size}.png')
    img.save(out, 'PNG')

# Also save the main 512 as flash.png (used at runtime)
with_padding(src, 512, padding_pct=0.10).save(os.path.join(DEST, 'flash.png'), 'PNG')
print('✓ Linux PNGs: 16, 32, 48, 64, 128, 256, 512')

print('\n✅ All icon assets generated successfully.')
