import { pack } from "msgpackr/pack";
import { unpack } from "msgpackr/unpack";
import { Err, Ok, Result } from "ts-results";

export type PeerId = string;
export type BlobId = { owner: PeerId; id: string };
export type BlobMetadata = {
  id: BlobId;
  name: string; // File name of the blob
  size: number; // Size of the blob
  type: string; // MIME type of the blob
};

export enum MessageCode {
  PeerConnected = 1,
  PeerDisconnected,

  Metadata = 11,

  DataRequest = 101,
  DataChunk,
  DataChunkEnd,

  Keepalive = 255,
}

export type Message =
  | { code: MessageCode.PeerConnected }
  | { code: MessageCode.PeerDisconnected }
  | ({ code: MessageCode.Metadata } & BlobMetadata)
  | {
      code: MessageCode.DataRequest; // Announces that a blob is being requested to download
      id: BlobId;
    }
  | {
      code: MessageCode.DataChunk; // Indicates a single chunk of a blob
      id: BlobId;
      offset: number; // Byte-offset of this blob chunk
      bytes: Uint8Array; // Raw chunk bytes
    }
  | {
      code: MessageCode.DataChunkEnd; // Marks the blob's chunk boundary
      id: BlobId;
    }
  | { code: MessageCode.Keepalive };

export function serialize(message: Message): Uint8Array {
  return new Uint8Array(pack(message));
}

export function deserialize(
  message: ArrayBuffer | Uint8Array
): Result<Message, string> {
  const buffer =
    message instanceof ArrayBuffer ? new Uint8Array(message) : message;

  try {
    return Ok(unpack(buffer));
  } catch (e) {
    return Err(`Deserialization error: ${(e as Error).message}`);
  }
}
