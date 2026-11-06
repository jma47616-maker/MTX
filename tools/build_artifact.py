#!/usr/bin/env python3
"""Bundle the app into one self-contained HTML file (for hosts such as
claude.ai Artifacts that serve a single page without the rest of the site).

Usage:
    python3 tools/build_artifact.py [output.html]

Inlines the CSS, the three JS modules (as scoped functions instead of ES
modules), the content JSON and images. The output has no <html>/<head>/<body>
wrapper because the artifact host adds its own.
"""
import base64
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODULES = ["js/calc-core.js", "js/calculators.js", "js/app.js"]  # dependency order
IMPORT = re.compile(r'import\s*\{([^}]*)\}\s*from\s*"\./([\w-]+)\.js";\s*', re.S)
EXPORT = re.compile(r"^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)", re.M)


def read(path, mode="r"):
    with open(os.path.join(ROOT, path), mode) as f:
        return f.read()


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(read(path, "rb")).decode()


def bundle_js():
    out = []
    for path in MODULES:
        src = read(path)
        name = os.path.basename(path)[:-3].replace("-", "_")
        imports = []
        for m in IMPORT.finditer(src):
            names = ", ".join(n.strip() for n in m.group(1).split(",") if n.strip())
            imports.append(f"const {{ {names} }} = __mod_{m.group(2).replace('-', '_')};")
        src = IMPORT.sub("", src)
        exports = EXPORT.findall(src)
        src = re.sub(r"^export\s+", "", src, flags=re.M)
        out.append(f"const __mod_{name} = (() => {{\n" + "\n".join(imports) + "\n" + src
                   + f"\nreturn {{ {', '.join(exports)} }};\n}})();")
    return "\n".join(out)


def bundle_data():
    guideline = json.loads(read("content/guideline.json"))
    media = {}
    for fname in os.listdir(os.path.join(ROOT, "content/media")):
        media[f"content/media/{fname}"] = data_uri(f"content/media/{fname}", "image/png")
    for p in guideline["pages"]:
        for k, v in media.items():
            p["html"] = p["html"].replace(k, v)
    data = {
        "guideline": guideline,
        "resources": json.loads(read("content/resources.json")),
        "national": json.loads(read("content/national.json")),
        "pregnancy": json.loads(read("content/national-pregnancy.json")),
    }
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def main(out_path, standalone=False):
    index = read("index.html")
    title = re.search(r"<title>.*?</title>", index).group(0)
    fonts = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', index).group(0)
    body = re.search(r"<body>(.*)</body>", index, re.S).group(1)
    body = re.sub(r'\s*<script type="module"[^>]*></script>', "", body)
    body = body.replace('src="icons/icon.svg"', f'src="{data_uri("icons/icon.svg", "image/svg+xml")}"')
    parts = [
        title,
        '<meta name="claude:viewport-fit-sides" content="cover">',
        fonts,
        f"<style>\n{read('css/app.css')}\n</style>",
        body.strip(),
        f"<script>window.__DMARD_DATA__ = {bundle_data()};</script>",
        f"<script>\n{bundle_js()}\n</script>",
    ]
    if standalone:
        # A complete document that opens from a double-click, no server needed.
        icon = data_uri("icons/icon.svg", "image/svg+xml")
        parts = ['<!doctype html>', '<html lang="en-GB">', '<head>', '<meta charset="utf-8">',
                 '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
                 f'<link rel="icon" href="{icon}">', *parts[:4], '</head>', '<body>', *parts[4:], '</body>', '</html>']
    html = "\n".join(parts)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Wrote {out_path} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--standalone"]
    main(args[0] if args else os.path.join(ROOT, "dist", "yorkshire-dmard-guide.html"), standalone="--standalone" in sys.argv)
