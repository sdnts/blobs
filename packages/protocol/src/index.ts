import { Err, Ok, Result } from "ts-results";

export enum MessageCode {
  Joined = 1,
  Metadata,

  Request,
  Data,
  Sent,

  Keepalive = 255,
}

export type Message =
  | { code: MessageCode.Joined }
  | { code: MessageCode.Metadata; name: string; size: number }
  | { code: MessageCode.Request; name: string }
  | { code: MessageCode.Data; length: number; bytes: Uint8Array }
  | { code: MessageCode.Sent }
  | { code: MessageCode.Keepalive };

/**
 * Taking the DX hit of byte-mangling here because something like MessagePack isn't
 * going to help us out too much. Our messages are either too small to benefit from
 * it, or use raw bytes, which MessagePack won't be able to compress because they
 * are schema-less.
 *
 * Our (de)serialization might be a bit shitty, but it'll be more performant.
 */

/**
 * Serialize a message into a byte array for transporting over the network
 */
export function serialize(message: Message): Uint8Array {
  let serialized: Uint8Array;

  switch (message.code) {
    case MessageCode.Joined: {
      serialized = new Uint8Array([message.code]);
      break;
    }

    case MessageCode.Metadata: {
      const payload = new TextEncoder().encode(
        `${message.size}:${message.name}`
      );

      serialized = new Uint8Array([MessageCode.Metadata, ...payload]);
      break;
    }

    case MessageCode.Request: {
      const payload = new TextEncoder().encode(`${message.name}`);
      serialized = new Uint8Array([message.code, ...payload]);
      break;
    }

    case MessageCode.Data: {
      const payload = new TextEncoder().encode(`${message.length}:`);

      serialized = new Uint8Array([
        MessageCode.Data,
        ...payload,
        ...message.bytes,
      ]);
      break;
    }

    case MessageCode.Sent: {
      serialized = new Uint8Array([message.code]);
      break;
    }

    case MessageCode.Keepalive:
      serialized = new Uint8Array([message.code]);
      break;
  }

  return serialized;
}

/**
 * Construct a message from a byte array that arrived over the network
 */
export function deserialize(message: Uint8Array): Result<Message, string> {
  if (!(message instanceof Uint8Array)) return Err("Expected a Uint8Array");

  const code = message.at(0);
  switch (code) {
    case MessageCode.Joined:
      return Ok({ code });

    case MessageCode.Metadata: {
      const payload = new TextDecoder().decode(message.slice(1));
      const [size, ...name] = payload.split(":");

      try {
        return Ok({
          code: MessageCode.Metadata,
          size: Number(size),
          name: name.join(":"),
        });
      } catch (e) {
        return Err("size is not a Number");
      }
    }

    case MessageCode.Request: {
      const name = new TextDecoder().decode(message.slice(1));
      return Ok({ code, name });
    }

    case MessageCode.Data: {
      const delimiter = 58; // ':' as a byte
      let size: number[] = [];

      // If we haven't found the delimiter after 16 bytes, something's malformed.
      // 16 bytes = 16 digits of `length` (~9PiB)
      for (let i = 1; i <= 16; i++) {
        const byte = message.at(i);
        if (byte === undefined)
          return Err("Message ended before length delimiter");
        if (byte === delimiter) break;

        size.push(byte);
      }

      try {
        return Ok({
          code: MessageCode.Data,
          length: Number(new TextDecoder().decode(new Uint8Array(size))),
          bytes: message.slice(size.length + 2),
        });
      } catch (e) {
        return Err(`length is not a Number: ${size.toString()}`);
      }
    }

    case MessageCode.Sent:
      return Ok({ code });

    case MessageCode.Keepalive:
      return Ok({ code });

    default:
      return Err(`Malformed code byte: ${code}`);
  }
}
