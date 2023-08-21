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
  | BlobErrorBase<"Unauthorized">
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

  notFound: (message: string): Err<BlobError> =>
    Err({
      type: "NotFound",
      status: 404,
      message,
    }),

  serializationError: (cause: string, message?: string): Err<BlobError> =>
    errors.internalError(cause, message),

  unauthorized: (message?: string): Err<BlobError> =>
    Err({
      type: "Unauthorized",
      status: 403,
      message: message ?? `You aren't allowed to see that`,
    }),

  unknown: (cause: string, message?: string): Err<BlobError> =>
    Err({
      type: "Unknown",
      status: 500,
      message:
        message ??
        "An unknown internal error occured while handling your request",
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
