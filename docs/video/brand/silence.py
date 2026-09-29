"""The second story panel: Vouch's five-step line, lit up to Delivered and dark after it. The money never came.
python3 brand/silence.py   (writes img/silence.jpg at the slide-panel aspect 710:750, rendered at 2x)"""
import glob, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1420, 1500
here = os.path.dirname(os.path.abspath(__file__))
fonts = glob.glob(os.path.expanduser('~/.claude/skills/pitch-video/assets/**/*Barlow*Medium*.ttf'), recursive=True) or \
        glob.glob(os.path.expanduser('~/.claude/skills/pitch-video/assets/**/*.ttf'), recursive=True)
font = ImageFont.truetype(fonts[0], 52) if fonts else ImageFont.load_default()
small = ImageFont.truetype(fonts[0], 38) if fonts else font

canvas = Image.new('RGB', (W, H), (11, 12, 14))
glow = Image.new('RGB', (W, H), (11, 12, 14))
ImageDraw.Draw(glow).ellipse((-400, -300, 700, 800), fill=(18, 44, 34))   # muted, colder than the product glow
canvas = Image.blend(canvas, glow.filter(ImageFilter.GaussianBlur(200)), 0.9)
d = ImageDraw.Draw(canvas)
for x in range(0, W, 56):                                                 # faint dot grid
    for y in range(0, H, 56):
        d.point((x, y), fill=(28, 30, 34))

steps = ['Agreed', 'Worked', 'Delivered', 'Reviewed', 'Paid']
xs = [150, 430, 710, 990, 1270]; y = 740
lit = 3                                                                   # Agreed, Worked, Delivered
d.line((xs[0], y, xs[-1], y), fill=(35, 37, 42), width=4)
d.line((xs[0], y, xs[lit - 1], y), fill=(60, 207, 145), width=4)
for i, (x, label) in enumerate(zip(xs, steps)):
    on = i < lit
    if on:
        halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse((x - 50, y - 50, x + 50, y + 50), fill=(60, 207, 145, 110))
        canvas.paste(halo.filter(ImageFilter.GaussianBlur(24)), (0, 0), halo.filter(ImageFilter.GaussianBlur(24)))
        d = ImageDraw.Draw(canvas)
    d.ellipse((x - 28, y - 28, x + 28, y + 28), fill=(60, 207, 145) if on else (11, 12, 14), outline=(60, 207, 145) if on else (47, 50, 56), width=4)
    tw = d.textlength(label, font=font)
    d.text((x - tw / 2, y + 64), label, font=font, fill=(243, 245, 248) if on else (80, 86, 98))
# the message, under the dark half of the line
msg = '"Not what we asked for."'
tw = d.textlength(msg, font=font)
d.text(((xs[3] + xs[4]) / 2 - tw / 2, y - 150), msg, font=font, fill=(183, 192, 204))
sub = 'Then nothing.'
tw = d.textlength(sub, font=small)
d.text(((xs[3] + xs[4]) / 2 - tw / 2, y - 84), sub, font=small, fill=(107, 117, 133))
canvas.save(os.path.join(here, '..', 'img', 'silence.jpg'), quality=92)
print('img/silence.jpg', fonts[0] if fonts else 'default font')
