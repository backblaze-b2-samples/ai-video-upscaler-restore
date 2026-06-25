# Example media credits

The sample app ships **no** media in the repo. The demo assets below live in the
B2 bucket (and the engine weights are downloaded at runtime) — they are only what
the README screenshots and the seeded example jobs display. They are reproduced
here with their licenses so anyone reusing this sample knows what is safe to keep.

> Good practice for faces in a public repo: never use identifiable living people
> (you'd need both the photographer's copyright license **and** the subject's
> likeness/publicity rights). Prefer **public-domain** images — a historical
> portrait whose copyright has expired is both legally clean and the textbook
> face-restoration case — or a **synthetic, AI-generated** face that depicts no
> real person.

## Face-restoration example (GFPGAN)

- **Image:** *Abraham Lincoln, O-77 matte collodion print* (1863), photographed by
  Alexander Gardner (d. 1882).
- **License:** **Public domain** — copyright expired. No usage restrictions.
- **Source:** Wikimedia Commons —
  <https://commons.wikimedia.org/wiki/File:Abraham_Lincoln_O-77_matte_collodion_print.jpg>
- **Use here:** downscaled and JPEG-compressed into a degraded low-res "source",
  then restored with GFPGAN (face) + Real-ESRGAN (background) to demonstrate
  face restoration. A historical PD portrait is the canonical old-photo-restore
  case, which is exactly what this example shows.

## Upscale-only examples (no faces)

- **Media:** stills and a short SD clip derived from ***Big Buck Bunny***.
- **License:** **CC BY 3.0** — © 2008, Blender Foundation.
- **Source:** <https://peach.blender.org/>
- **Use here:** an image frame (8×) and an SD clip (4×) upscaled with Real-ESRGAN,
  with face restoration **off** — the non-face counterpart to the portrait example.
