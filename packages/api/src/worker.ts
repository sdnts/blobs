import { Context } from "./context";
import { errorToResponse, errors } from "./errors";
import { route } from "./router";

export type Env = {
  environment: "production" | "development";
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

    ctx.setTags({
      url: request.url,
      rayId: request.headers.get("cf-ray") ?? undefined,
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
