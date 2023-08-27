import { pack } from "msgpackr/pack";
import { unpack } from "msgpackr/unpack";
import { Err, Ok, Result } from "ts-results";

export type BlobMetadata = {
  id: number;
  name: string;
  size: number;
  type: string;
};

export enum MessageCode {
  SecretRequest = 1,
  Secret,

  ReceiverJoined = 10,
  Metadata,

  DataRequest = 101,
  DataChunk,
  DataChunkEnd,

  Keepalive = 255,
}

export type Message =
  | { code: MessageCode.SecretRequest }
  | { code: MessageCode.Secret; secret: string }
  | { code: MessageCode.ReceiverJoined }
  | {
      code: MessageCode.Metadata;
      id: number;
      name: string;
      size: number;
      type: string;
    }
  | { code: MessageCode.DataRequest; id: number }
  | {
      code: MessageCode.DataChunk;
      id: number;
      offset: number;
      bytes: Uint8Array;
    }
  | {
      code: MessageCode.DataChunkEnd;
      id: number;
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
