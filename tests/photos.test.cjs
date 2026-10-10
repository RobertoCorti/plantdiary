const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadPhotos() {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync('src/lib/photos.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, require(name) {
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

function storageClient({ signedUrl = 'https://signed.example/photo', error = null } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      storage: {
        from(bucket) {
          return {
            async createSignedUrl(path, expiresIn) {
              calls.push({ bucket, path, expiresIn });
              return { data: signedUrl ? { signedUrl } : null, error };
            },
          };
        },
      },
    },
  };
}

test('normalizes legacy public photo URLs to object paths', () => {
  const { photoPathFromReference } = loadPhotos();
  assert.equal(
    photoPathFromReference(
      'https://project.supabase.co/storage/v1/object/public/plant-photos/user-1/folder%20photo.jpg?download=1'
    ),
    'user-1/folder photo.jpg'
  );
});

test('keeps canonical object paths unchanged', () => {
  const { photoPathFromReference } = loadPhotos();
  assert.equal(photoPathFromReference('user-1/123.jpg'), 'user-1/123.jpg');
});

test('rejects empty, malformed, and unrelated references', () => {
  const { photoPathFromReference } = loadPhotos();
  for (const reference of [
    null,
    '',
    'photo.jpg',
    '../user-1/photo.jpg',
    'https://example.com/photo.jpg',
    'user-1/photo.jpg?token=value',
    'user-1/%E0%A4%A.jpg',
  ]) {
    assert.equal(photoPathFromReference(reference), null);
  }
});

test('creates a one-hour signed URL for a normalized photo path', async () => {
  const { createSignedPhotoUrl } = loadPhotos();
  const storage = storageClient();
  const result = await createSignedPhotoUrl(storage.client, 'user-1/123.jpg');
  assert.equal(result, 'https://signed.example/photo');
  assert.deepEqual(storage.calls, [{
    bucket: 'plant-photos',
    path: 'user-1/123.jpg',
    expiresIn: 3600,
  }]);
});

test('returns null for an invalid reference without contacting Storage', async () => {
  const { createSignedPhotoUrl } = loadPhotos();
  const storage = storageClient();
  assert.equal(await createSignedPhotoUrl(storage.client, null), null);
  assert.equal(storage.calls.length, 0);
});

test('surfaces signed URL failures', async () => {
  const { createSignedPhotoUrl } = loadPhotos();
  const storageError = new Error('signing failed');
  const storage = storageClient({ signedUrl: null, error: storageError });
  await assert.rejects(
    createSignedPhotoUrl(storage.client, 'user-1/123.jpg'),
    /signing failed/
  );
});
