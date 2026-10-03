import pathlib

src = pathlib.Path(__file__).parent
modules = ["config.js", "renderer.js", "background.js", "ship.js", "bullets.js", "effects.js", "audio.js", "input.js", "mobile.js", "players.js", "formations.js", "enemies.js", "hazards.js", "weapons.js", "menu.js", "main.js"]

script = "\n\n".join((src / m).read_text(encoding="utf-8") for m in modules)
shell = (src / "shell.html").read_text(encoding="utf-8")
output = shell.replace("<!--GAME_SCRIPTS-->", script)

out_path = src.parent.parent / "index.html"
out_path.write_text(output, encoding="utf-8")
print(f"Wrote {out_path} ({len(output)} bytes)")
