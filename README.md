# blobs

[Blob City](https://blob.city) is a service that lets you transfer a file from
one browser to another, anywhere in the world. It does so by establishing a WebSocket
tunnel between the two machines, and then beams bytes directly from one place to
the other via a relay.

As long as this connection stays up, you can drop files on either side of the tunnel,
and they will be streamed to the other end.

### Usage

Create a new tunnel by hitting the `New` button. You'll receive a secret.

Then open up a different browser (on your phone perhaps), and press `Join`. Punch
in the secret you received before, and you should both be connected!

Now try dropping a file (you can also tap / click to open up a classic file dialog),
and it should automatically start downloading on the _other_ browser.

### Privacy

I'll preface this by recommending against using this service for truly confidential
stuff, like a scan of your Social Security Card. While I can guarantee that I
don't keep a copy of your files, I am not a security expert.

Tunnels you create are locked behind you. After both parties join, information
about locating the tunnel (its ID) is destroyed, so one else can snoop on your
files. There are 16^32 valid tunnel IDs to discourage brute-forcing.

### Development

1. Install dependencies: `yarn`
2. Run the UI dev server: `yarn ui dev`
3. Run the API dev server: `yarn api dev`

The API is a Cloudflare Worker talking to 2 Durable Object Namespaces and 1 KV
Namespace.

The `Session` Durable Object class represents a file transfer session. When the
UI creates a new session, we generate a 6-digit alphanumeric secret, and store
the session's ID keyed by this secret in our KV namespace (with a 10 minute expiry).
The session's ID is signed and sent back as a session authentication token.
When the same secret is supplied when joining a session, this key is destroyed,
and the same session ID is signed and sent back as a session authentication token.

The UI then establishes WebSocket connections with an instance of this `Session`
Durable Object class, which is located using the authentication token (the signed
session ID).

Every time you drop a file on either connected client, an instance of the `Tunnel`
Durable Object class is created and its ID is relayed to the _other_ client. The
other client then connects to the same `Tunnel` Durable Object, and transfer commences.

To get around Cloudflare's 300MiB request body limit, uploads are done via a
WebSocket connection to the `Tunnel` Durable Object. The download is a regular
HTTP Response. The `Tunnel` Durable Object receives bytes on its WebSocket
connection and writes them to the HTTP Response. The downloader controls backpressure
on this stream, since memory on Durable Objects is limited.
