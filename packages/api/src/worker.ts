import { Context } from "./context";
import { errorToResponse, errors } from "./errors";
import { route } from "./router";

export type Env = {
  environment: "production" | "development";
  allowedOrigins: string[];
  secret: string;
  metadata: KVNamespace;
  sessions: DurableObjectNamespace;
};

export default {
  async fetch(
    request: Request,
    env: Env,
    executionCtx: ExecutionContext
  ): Promise<Response> {
    const ctx = new Context(env, executionCtx.waitUntil);
    const url = new URL(request.url);

    ctx.setTags({
      rayId: request.headers.get("cf-ray") ?? undefined,
      method: request.method,
      path: url.pathname,
    });

    try {
      const routeResult = await route(request, ctx);
      if (routeResult.err) return errorToResponse(routeResult.val);

      const actorId = routeResult.val;
      ctx.setTags({ actorId: actorId.toString() });

      return env.sessions.get(actorId).fetch(request);
    } catch (e) {
      const error = e as Error;
      return errorToResponse(
        errors.internalError(`Uncaught error: ${error.message}`).val
      );
    } finally {
      ctx.ship();
    }
  },
};

export { Session } from "./session";
