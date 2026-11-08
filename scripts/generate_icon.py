import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def generate_torrent_icon(output_dir):
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    
    size = 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer circle gradient emulation / multi-layer glow
    padding = 24
    
    # Shadow layer
    shadow_color = (0, 0, 0, 60)
    draw.ellipse([padding + 6, padding + 12, size - padding + 6, size - padding + 12], fill=shadow_color)
    
    # Green circular background
    # Gradient rings
    center = size / 2
    radius = (size - 2 * padding) / 2
    
    for r in range(int(radius), 0, -1):
        ratio = r / radius
        # Top-left highlight green #34d399 to bottom-right #047857
        red = int(16 + (52 - 16) * ratio)
        green = int(185 + (211 - 185) * ratio)
        blue = int(129 + (153 - 129) * ratio)
        draw.ellipse([center - r, center - r, center + r, center + r], fill=(red, green, blue, 255))
        
    # Draw dark subtle border
    draw.ellipse([padding, padding, size - padding, size - padding], outline=(16, 185, 129, 255), width=4)

    # Stylized "μ" (mu) / uTorrent symbol in pure crisp white
    # Draw left descending tail, left vertical stem, curved base, and right vertical stem
    # We can use thick rounded lines and arcs
    white = (255, 255, 255, 255)
    stem_width = 44
    
    # Left tail: from x=160, y=180 down to y=380
    left_x = 180
    right_x = 332
    top_y = 180
    bottom_y = 310
    tail_bottom = 380
    
    # Left vertical stem extending downwards into the mu descender
    draw.line([(left_x, top_y), (left_x, tail_bottom)], fill=white, width=stem_width)
    draw.ellipse([left_x - stem_width//2, top_y - stem_width//2, left_x + stem_width//2, top_y + stem_width//2], fill=white)
    draw.ellipse([left_x - stem_width//2, tail_bottom - stem_width//2, left_x + stem_width//2, tail_bottom + stem_width//2], fill=white)
    
    # Right vertical stem
    draw.line([(right_x, top_y), (right_x, bottom_y + 10)], fill=white, width=stem_width)
    draw.ellipse([right_x - stem_width//2, top_y - stem_width//2, right_x + stem_width//2, top_y + stem_width//2], fill=white)
    
    # Bottom connecting curve (U-arc connecting left stem to right stem)
    arc_box = [left_x - stem_width//2, top_y, right_x + stem_width//2, bottom_y + stem_width]
    draw.arc(arc_box, start=0, end=180, fill=white, width=stem_width)
    
    # Fill any gap between stems and arc
    draw.rectangle([left_x - stem_width//2, bottom_y - 20, left_x + stem_width//2, bottom_y + 20], fill=white)
    draw.rectangle([right_x - stem_width//2, bottom_y - 20, right_x + stem_width//2, bottom_y + 20], fill=white)
    
    # Small right bottom spur (the little horizontal hook on the right foot of mu)
    draw.line([(right_x, bottom_y + 10), (right_x + 36, bottom_y + 10)], fill=white, width=stem_width)
    draw.ellipse([right_x + 36 - stem_width//2, bottom_y + 10 - stem_width//2, right_x + 36 + stem_width//2, bottom_y + 10 + stem_width//2], fill=white)
    
    # A sleek download arrow accent in the upper-right or top center
    # Let's save 256x256 master PNG
    img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
    png_path = out / "icon.png"
    img_256.save(png_path, "PNG")
    print(f"Saved {png_path}")
    
    # Save multi-size ICO
    ico_path = out / "icon.ico"
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(ico_path, format="ICO", sizes=sizes)
    print(f"Saved {ico_path}")

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "assets"
    generate_torrent_icon(target)
