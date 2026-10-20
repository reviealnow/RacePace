import { env } from 'cloudflare:workers';
import { workoutAPI } from '../../../../server/workout-api';
export const dynamic = 'force-dynamic';
type Context = {params: Promise<{id:string}>};
export const GET = async (request: Request, context: Context) => workoutAPI(request, env.DB, (await context.params).id);
export const DELETE = GET;
