# MindForge bilingual promo videos

This folder renders two original 30-second vertical 9:16 promotional videos, in English and Vietnamese. They use an illustrated memory challenge, animated brain mascot, music, synchronized effects and captions, plus a QR-code link to MindForge.

## Render automatically

Open **Actions → MindForge bilingual promo videos → Run workflow** or view its pull request run. Download the artifact `mindforge-promo-en-vi-natural-voice` containing `mindforge_promo_en_natural.mp4` and `mindforge_promo_vi_natural.mp4`.

To build locally (requires ffmpeg and DejaVu fonts): `pip install -r scripts/mindforge/promo/requirements.txt` and then `python scripts/mindforge/promo/render.py --language both`. For an offline sound/visual test, pass `--offline`.

The voiceovers use natural English voices (`en-US-JennyNeural`, `en-US-GuyNeural`) and Vietnamese voices (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`) through the open-source `edge-tts` client. No API key is needed. These are **not** the previously generated Runway audio clips, and no signed Runway URLs are published. The third-party service needs network access.

All game visuals are illustrative, not gameplay footage. Messaging avoids unsupported health claims.
