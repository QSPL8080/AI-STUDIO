import { createFileRoute } from "@tanstack/react-router";

// Website videos: /media/<name>.mp4
//
// The built-in static file server answers every request with the WHOLE file (HTTP 200) and
// ignores "Range" requests. Browsers stream video in small ranges, so with whole-file answers
// videos keep "loading", can't seek, and iPhone / Safari refuses to play them at all.
// This route serves the same files from public/videos with proper byte-range (HTTP 206)
// support and long-lived caching.

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

let videoDirPromise: Promise<string | null> | null = null;

/** Finds public/videos both in local dev and in the built .output folder on the server. */
function findVideoDir(): Promise<string | null> {
  if (!videoDirPromise) {
    videoDirPromise = (async () => {
      const path = await import("node:path");
      const fs = await import("node:fs");
      const { fileURLToPath } = await import("node:url");
      const candidates = [
        path.join(process.cwd(), ".output", "public", "videos"),
        path.join(process.cwd(), "public", "videos"),
      ];
      // Walk up from this compiled file (e.g. .output/server/_ssr/…) to the folder holding public/.
      try {
        let dir = path.dirname(fileURLToPath(import.meta.url));
        for (let i = 0; i < 6; i++) {
          candidates.push(
            path.join(dir, "public", "videos"),
            path.join(dir, "..", "public", "videos"),
          );
          dir = path.dirname(dir);
        }
      } catch {
        /* import.meta.url not a file URL */
      }
      for (const c of candidates) {
        try {
          if (fs.statSync(c).isDirectory()) return c;
        } catch {
          /* try next */
        }
      }
      return null;
    })();
  }
  return videoDirPromise;
}

async function serve(request: Request, file: string, headOnly: boolean) {
  // Only plain file names like "jbl-speaker-ad.mp4" — no folders, no "..".
  const m = /^([A-Za-z0-9][A-Za-z0-9_-]{0,80})\.(mp4|webm|jpg|jpeg|webp)$/.exec(file || "");
  if (!m) return new Response("Not found", { status: 404 });
  const dir = await findVideoDir();
  if (!dir) return new Response("Not found", { status: 404 });

  const path = await import("node:path");
  const fs = await import("node:fs");
  const { Readable } = await import("node:stream");
  const full = path.join(dir, file);
  let size: number;
  let mtime: Date;
  try {
    const st = await fs.promises.stat(full);
    if (!st.isFile()) throw new Error("not a file");
    size = st.size;
    mtime = st.mtime;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const etag = `"${size.toString(16)}-${mtime.getTime().toString(16)}"`;
  const base: Record<string, string> = {
    "Content-Type": TYPES[m[2]!.toLowerCase()] || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=2592000",
    ETag: etag,
    "Last-Modified": mtime.toUTCString(),
  };

  if (request.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers: base });

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = request.headers.get("range");
  if (range) {
    const r = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!r || (r[1] === "" && r[2] === "")) {
      return new Response(null, {
        status: 416,
        headers: { ...base, "Content-Range": `bytes */${size}` },
      });
    }
    if (r[1] === "") {
      // last N bytes
      start = Math.max(0, size - Number(r[2]));
    } else {
      start = Number(r[1]);
      if (r[2] !== "") end = Math.min(Number(r[2]), size - 1);
    }
    if (start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { ...base, "Content-Range": `bytes */${size}` },
      });
    }
    status = 206;
    base["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  base["Content-Length"] = String(end - start + 1);

  if (headOnly) return new Response(null, { status, headers: base });
  const stream = Readable.toWeb(
    fs.createReadStream(full, { start, end }),
  ) as unknown as ReadableStream;
  return new Response(stream, { status, headers: base });
}

export const Route = createFileRoute("/media/$file")({
  server: {
    handlers: {
      GET: ({ request, params }) => serve(request, params.file, false),
      HEAD: ({ request, params }) => serve(request, params.file, true),
    },
  },
});
