#!/usr/bin/env bash
set -euo pipefail
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ ! -f "$MANIFEST" ]; then
  echo "Pas de projet android. Lance: npx cap add android && npx cap sync android"
  exit 1
fi
python3 -c '
from pathlib import Path
p = Path("android/app/src/main/AndroidManifest.xml")
c = p.read_text()
perms = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.CAMERA",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.VIBRATE",
]
for perm in perms:
    if perm not in c:
        c = c.replace("<application", f"    <uses-permission android:name=\"{perm}\" />\n    <application", 1)
p.write_text(c)
print("OK", p)
'
