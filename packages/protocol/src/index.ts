import { Err, Ok, Result } from "ts-results";

export enum SessionMessageCode {
  Keepalive = 1,

  PeerConnected = 10,
  PeerDisconnected,

  TunnelCreate = 100,
  TunnelCreated,
  TunnelReady,
}
export type SessionMessage =
  | { code: SessionMessageCode.Keepalive }
  | { code: SessionMessageCode.PeerConnected }
  | { code: SessionMessageCode.PeerDisconnected }
  | { code: SessionMessageCode.TunnelCreate }
  | { code: SessionMessageCode.TunnelCreated; tunnelId: string }
  | {
    code: SessionMessageCode.TunnelReady;
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
): Result<SessionMessage, string> {
  try {
    return Ok(JSON.parse(message));
  } catch (e) {
    return Err(`Deserialization error: ${(e as Error).message}`);
  }
}
