# Model pipeline

Turns a WoW 5.4.8 item into a glTF model the storefront can show.

The tool is offline and run by hand. Nothing in the running site depends on it:
the API never opens a client archive, and a production server needs neither the
game files nor this package. What ships is the folder of `.glb` files it
writes into `apps/web/public/models`.

## Running it

Extraction is the one step that has to understand MPQ, and it is deliberately
the only one — everything after it reads loose files.

```bash
pip install mpyq
python tools/model-pipeline/extract/extract.py \
    --data "C:/WoW 5.4.8/Data" --out ./art
```

Then build models for whatever the store is selling:

```bash
pnpm --filter @wowcms/model-pipeline models \
    --art ./art --dbc /path/to/dbc --out ../../apps/web/public/models \
    --from-api http://localhost:3001
```

`--from-api` reads the published catalogue over the public API, so display ids
need not be typed out. Ids can also be passed directly:

```bash
pnpm --filter @wowcms/model-pipeline models \
    --art ./art --dbc /path/to/dbc --out ../../apps/web/public/models 1685 3092
```

Each run rewrites `manifest.json`, which is how the site knows which items have
a model. Items without one keep showing their 2D icon.

## What it can and cannot reach

Roughly a third of `ItemDisplayInfo` — some 24,000 displays — has a model of
its own. The rest is armour drawn as texture onto the character's body, which
needs a character to draw it on and is out of scope here. The tool reports
those as skipped rather than failed, because that is what they are.

Two slots need the recorded name rewritten before anything is found on disk,
and both rules live in `resolve.ts`:

- **Head**: the table names one helmet; the client ships one model per race and
  gender. A helmet is shown on one of them, human male by default, changeable
  with `--character`.
- **Shoulder**: the client splits the pair into `L`- and `R`-prefixed models.
  The left one stands in for both.

Measured against the shipped 5.4.8 client: **22,044 of the 23,975 displays
build**, from 10,919 distinct files — displays sharing a mesh and a texture
share a file — for 831 MB in total.

**Known gap: the last 8%.** The 1,931 displays that do not build are ones whose
art the archives hold as an *incremental patch* rather than a whole file. Their
block carries `MPQ_FILE_PATCH_FILE`, and the payload is a delta against an
earlier version — one weapon reads 78,048 bytes long but occupies 198. Applying
those needs the MPQ patch chain (PTCH headers and BSDIFF records), which `mpyq`
does not implement; StormLib does, through `SFileOpenPatchArchive`. Nothing
downstream would change, since the pipeline only ever sees loose files.

The archives to read were themselves a trap worth recording: the later art
lives in `wow-update-base-*.MPQ` in the root of `Data`, not in the base
archives and not in `Cache`. Indexing only the base archives finds 64% of the
catalogue; adding the update archives takes it to 99.6%.

## Layout

| File | What it does |
|---|---|
| `dbc.ts` | Reads the client's WDBC tables |
| `m2.ts` | Parses M2 models and their external `.skin` profiles |
| `blp.ts` | Decodes BLP2 textures: palettised, DXT1/3/5 and raw BGRA |
| `png.ts` | Writes the decoded texture back out as a PNG |
| `gltf.ts` | Assembles one mesh and one texture into a GLB |
| `resolve.ts` | Turns what the tables record into paths in the art tree |
| `pipeline.ts` | One display id, end to end |
| `manifest.ts` | The list of built displays the site reads |
| `artSource.ts` | Indexes the extracted tree, matching case-insensitively |
| `cli.ts` | The command |

Field indices into the DBC and offsets into the M2 header carry a comment
saying where they were checked, because neither format records what its columns
mean. The models in 5.4.8 report version 272, not the 264 the WotLK
documentation describes, though the header layout is the same.
