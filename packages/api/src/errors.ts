import { Err } from "ts-results";

type BlobErrorBase<Type = "Unknown"> = {
  type: Type;
  /* The HTTP status that will be returned for this error */
  status: number;
  /** An external-facing error message */
  message: string;
  /** An internal-only message that might be useful for debugging */
  cause?: string;
};

export type BlobError =
  | BlobErrorBase<"BadRequest">
  | BlobErrorBase<"InternalError">
  | BlobErrorBase<"NotFound">
  | BlobErrorBase<"Unimplemented">
  | BlobErrorBase<"Unknown">;

export const errors = {
  badRequest: (cause: string, message?: string): Err<BlobError> =>
    Err({
      type: "BadRequest",
      status: 400,
      message: cause ?? message ?? `You did not send a valid request`,
    }),

  internalError: (cause: string, message?: string): Err<BlobError> =>
    Err({
      type: "InternalError",
      status: 500,
      message:
        message ?? "An internal error occured while handling that action",
      cause,
    }),

  notFound: (message?: string): Err<BlobError> =>
    Err({
      type: "NotFound",
      status: 404,
      message: message ?? "No room with that ID",
    }),

  serializationError: (cause: string, message?: string): Err<BlobError> =>
    errors.internalError(cause, message),

  unimplemented: (action: string, message?: string): Err<BlobError> =>
    Err({
      type: "Unimplemented",
      status: 501,
      message: message ?? `${action} is not yet implemeted`,
    }),

  unknown: (cause: string, message?: string): Err<BlobError> =>
    Err({
      type: "Unknown",
      status: 500,
      message:
        message ??
        "An unknown internal error occured while handling that action",
      cause,
    }),
};

export const errorToResponse = (error: BlobError): Response => {
  console.error(JSON.stringify(error, null, 2));
  return Response.json(
    { error: error.type, message: error.message },
    { status: error.status }
  );
};
