#!/usr/bin/env python3
"""Build dist/hsg-property-client.zip — the CLIENT app only, ready to upload to
the host. Excludes the portal/Supabase backend, the js/lib supabase client, and
all dev tooling. Run:  python scripts/pack-dist.py   (or: npm run pack)"""
import os, shutil, zipfile

ROOT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST  = os.path.join(ROOT, "dist")
STAGE = os.path.join(DIST, "client")
ZIP   = os.path.join(DIST, "hsg-property-client.zip")

# Client PWA + the server-side mail stack — explicit allow-list
# (nothing from portal/ supabase/ js/lib/).
#
# NOTE: mail-config.php is deliberately NOT packed. It holds the SMTP
# password, is .gitignore'd, and is uploaded to the server once by hand.
# Extracting this bundle over a live site therefore leaves the existing
# mail-config.php untouched, which is what we want. See mail-config.example.php.
FILES = ["index.html", "manifest.webmanifest", "sw.js", "submit.php", "hsg-mail.php",
         "leads.php", "tariffs.json", ".nojekyll", ".htaccess", "robots.txt", "sitemap.xml"]
DIRS  = ["css", "assets", "icon"]
JS    = ["app.js", "tariffs.js", "sharecard.js"]  # NOT js/lib (portal-only)

os.makedirs(DIST, exist_ok=True)
if os.path.exists(STAGE): shutil.rmtree(STAGE)
os.makedirs(STAGE)

for f in FILES:
    s = os.path.join(ROOT, f)
    if os.path.exists(s): shutil.copy2(s, os.path.join(STAGE, f))
    else: print("  (skip, missing)", f)
for d in DIRS:
    s = os.path.join(ROOT, d)
    if os.path.isdir(s): shutil.copytree(s, os.path.join(STAGE, d))

# Prune unreferenced brand assets from the stage (keep hsg-logo.png + brand/emblem-mask.png).
PRUNE = ["geo-emblem.svg", "hsg-lockup-black-160.png", "hsg-lockup-white-445.png", "geoafrika-logoHSG-160.png"]
for pf in PRUNE:
    p = os.path.join(STAGE, "assets", "brand", pf)
    if os.path.exists(p): os.remove(p)

os.makedirs(os.path.join(STAGE, "js"))
for jf in JS:
    shutil.copy2(os.path.join(ROOT, "js", jf), os.path.join(STAGE, "js", jf))

if os.path.exists(ZIP): os.remove(ZIP)
n = 0
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(STAGE):
        for name in files:
            full = os.path.join(base, name)
            z.write(full, os.path.relpath(full, STAGE))
            n += 1

print(f"Packaged {n} files -> {os.path.relpath(ZIP, ROOT)} ({round(os.path.getsize(ZIP)/1024,1)} KB)")
