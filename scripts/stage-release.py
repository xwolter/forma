"""Stage the signed Android APK and its update manifest for Firebase Hosting."""

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


root = Path(__file__).resolve().parent.parent
version = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
source = root.parent / "wydanie" / f"FORMA-{version}.apk"
if not source.is_file():
    raise FileNotFoundError(source)
destination = root / "updates-public" / "releases" / source.name
destination.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, destination)
digest = hashlib.sha256()
with destination.open("rb") as stream:
    while chunk := stream.read(1024 * 1024):
        digest.update(chunk)

manifest = {
    "schema": 1,
    "packageName": "pl.forma.dziennik",
    "version": version,
    "versionCode": 21,
    "bytes": destination.stat().st_size,
    "sha256": digest.hexdigest(),
    "url": f"https://forma-mobi-2026-4e7c1a.web.app/releases/{source.name}",
    "releasedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "notes": [
        "Analiza zdjęcia łączy się z usługą przez adres FORMA.",
        "Czytelniejsza informacja przy problemach z połączeniem.",
    ],
}
(destination.parent / "latest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps({key: manifest[key] for key in ("version", "versionCode", "bytes", "sha256", "url")}, indent=2))
