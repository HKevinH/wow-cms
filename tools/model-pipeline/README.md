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

**Known gap.** `mpyq` cannot read the listfile of the patch archives, so only
base art is reachable. Measured over a random sample of 400 displays, that
leaves out about one Pandaria item in five — Siege of Orgrimmar gear and PvP
seasons 2 and 3 among them. Closing it means extracting with StormLib instead;
the rest of the pipeline needs no change, since it only ever sees loose files.

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
