# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# React Native file uploads

DO NOT use `fetch` + `Blob`, `ArrayBuffer`, or the Supabase storage client for file uploads. These all fail in React Native / Expo Go with "Unsupported FormDataPart implementation" or "Creating blobs from ArrayBuffer are not supported".

The ONLY reliable approach is `XMLHttpRequest` + `FormData` with a file URI object:

```ts
const formData = new FormData();
formData.append("file", {
  uri: fileUri,
  name: "filename.jpg",
  type: "image/jpeg",
} as unknown as Blob);

const xhr = new XMLHttpRequest();
xhr.open("POST", uploadUrl);
xhr.setRequestHeader("Authorization", `Bearer ${token}`);
xhr.send(formData);
```

# Supabase Edge Functions

- Edge functions use Deno runtime — excluded from project tsconfig via `"exclude": ["supabase/functions"]`
- When converting binary to base64 in edge functions, NEVER use `String.fromCharCode(...spread)` — it causes stack overflow for large files. Use a for loop.
- `supabase.functions.invoke` swallows error details on non-2xx responses. Use direct `fetch` to `${supabaseUrl}/functions/v1/<name>` for better error handling.
