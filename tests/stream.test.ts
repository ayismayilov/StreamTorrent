import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createGateway, parseRange, contiguousBytes } from "../electron/stream";
test("HTTP byte ranges include suffix/open ranges and reject unsafe ranges", () => {
  assert.deepEqual(parseRange("bytes=10-19", 100), {
    start: 10,
    end: 19,
    partial: true,
  });
  assert.deepEqual(parseRange("bytes=90-", 100), {
    start: 90,
    end: 99,
    partial: true,
  });
  assert.deepEqual(parseRange("bytes=-10", 100), {
    start: 90,
    end: 99,
    partial: true,
  });
  assert.deepEqual(parseRange("bytes=0-999", 100), {
    start: 0,
    end: 99,
    partial: true,
  });
  for (const range of [
    "bytes=100-",
    "bytes=20-10",
    "bytes=-0",
    "bytes=0-1,5-6",
    "bytes=-",
    "bytes=9007199254740993-",
    "oops",
  ])
    assert.equal(parseRange(range, 100), null);
});
test("buffer counts contiguous verified pieces and respects file offsets and seeks", () => {
  const file = { offset: 5, length: 30 };
  const has = (n: number) => [0, 1, 3].includes(n);
  assert.equal(contiguousBytes(file, 10, has), 15);
  assert.equal(contiguousBytes(file, 10, has, 15), 0);
  assert.equal(contiguousBytes(file, 10, has, 25), 5);
});
test("gateway returns correct HTTP status/headers and closes streams", async () => {
  const data = Buffer.from("0123456789abcdefghij");
  let requests = 0;
  const g = createGateway((id) =>
    id === "video"
      ? {
          file: {
            name: "test.mp4",
            length: data.length,
            createReadStream: ({ start, end }) =>
              Readable.from([data.subarray(start, end + 1)]),
          },
          paused: false,
          onRequest: () => {
            requests++;
          },
          onClose: () => {
            requests--;
          },
        }
      : undefined,
  );
  await g.start();
  try {
    const url = g.url("video");
    const part = await fetch(url, { headers: { Range: "bytes=5-9" } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), "bytes 5-9/20");
    assert.equal(await part.text(), "56789");
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "20");
    assert.equal(await head.text(), "");
    assert.equal(
      (await fetch(url, { headers: { Range: "bytes=50-" } })).status,
      416,
    );
    assert.equal(
      (await fetch(url, { headers: { Origin: "https://example.com" } })).status,
      403,
    );
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal((await fetch(g.url("missing"))).status, 404);
    assert.equal(
      (await fetch(url.replace(/\/[a-f0-9]{48}\//, "/bad/"))).status,
      404,
    );
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(requests, 0);
  } finally {
    await g.close();
  }
});
