# `/dev` overlay

This folder backs the **dev version** of the game served at
**http://localhost:3001/dev/** (debug panel: http://localhost:3001/dev/?debug=1).

## How it works

`index.js` serves `/dev` as an *overlay* on top of the shared `public/` files:

1. A request to `/dev/<file>` is served from **`public/dev/<file>`** if it exists.
2. Otherwise it **falls back** to the shared **`public/<file>`**.

So this folder only needs the files that *differ* from the root version —
everything else is shared automatically.

## Making changes

- **Change both versions** (root and `/dev`): edit the file in `public/` as usual.
- **Change `/dev` only**: copy just that one file into `public/dev/`
  (keeping the same relative path, e.g. `public/dev/sketch.js` or
  `public/dev/classes/Foo.js`) and edit the copy here.

The shared `public/assets/` are used by both versions; there is no duplication.
