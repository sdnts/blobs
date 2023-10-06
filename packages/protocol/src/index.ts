export enum SessionMessageCode {
  Keepalive = 1,

  PeerConnected = 10,
  PeerDisconnected,

  TunnelCreate = 100,
  TunnelCreated,
  TunnelUploaderReady,
}
export type SessionMessage =
  | { code: SessionMessageCode.Keepalive }
  | { code: SessionMessageCode.PeerConnected }
  | { code: SessionMessageCode.PeerDisconnected }
  | { code: SessionMessageCode.TunnelCreate }
  | { code: SessionMessageCode.TunnelCreated; tunnelId: string }
  | {
      code: SessionMessageCode.TunnelUploaderReady;
      tunnelId: string;
      name: string; // File name of the blob
      size: number; // Size of the blob
      type: string; // MIME type of the blob
    };

export function serializeSessionMessage(message: SessionMessage): string {
  // Must use string messages here because hibernatable Durable Objects only
  // support string auto-responses currently
  return JSON.stringify(message);
}

export function deserializeSessionMessage(
  message: string
): { err: false; val: SessionMessage } | { err: true; val: string } {
  try {
    return { err: false, val: JSON.parse(message) };
  } catch (e) {
    return { err: true, val: `Deserialization error: ${(e as Error).message}` };
  }
}
