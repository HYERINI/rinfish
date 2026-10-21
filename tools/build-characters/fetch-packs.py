"""Quaternius 무료(Standard) 팩을 itch.io 에서 받는다. 로그인 없이 '0원 다운로드' 흐름을 쓴다.
사용: python3 fetch-packs.py   → .cache/<slug>.zip 을 받고 .cache/<slug>/ 에 푼다"""
import http.cookiejar
import json
import os
import re
import urllib.parse
import urllib.request
import zipfile

# slug, 업로드 이름에 들어 있어야 하는 글자 (Standard 판)
PACKS = [
    ("universal-base-characters", "Standard"),
    ("modular-character-outfits-fantasy", "Standard"),
    ("universal-animation-library", "Standard"),
]
CACHE = os.path.join(os.path.dirname(__file__), ".cache")


def fetch(slug, name_filter):
    zip_path = os.path.join(CACHE, f"{slug}.zip")
    if not os.path.exists(zip_path):
        jar = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        opener.addheaders = [("User-Agent", "Mozilla/5.0")]
        base = f"https://quaternius.itch.io/{slug}"

        def get(url, data=None):
            body = urllib.parse.urlencode(data).encode() if data is not None else None
            return opener.open(url, body).read()

        def csrf(html):
            return re.search(r'name="csrf_token" value="([^"]*)"', html).group(1)

        page = get(base + "/purchase").decode()
        download_page_url = json.loads(get(base + "/download_url", {"csrf_token": csrf(page)}))["url"]
        download_page = get(download_page_url).decode()
        uploads = re.findall(r'data-upload_id="(\d+)"[\s\S]*?title="([^"]*)"', download_page)
        upload_id = next(uid for uid, title in uploads if name_filter in title)
        file_info = json.loads(get(f"{base}/file/{upload_id}?source=game_download", {"csrf_token": csrf(download_page)}))
        with open(zip_path, "wb") as f:
            f.write(opener.open(file_info["url"]).read())
    out_dir = os.path.join(CACHE, slug)
    if not os.path.exists(out_dir):
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(out_dir)
    print(slug, "→", out_dir)


os.makedirs(CACHE, exist_ok=True)
for slug, name_filter in PACKS:
    fetch(slug, name_filter)
