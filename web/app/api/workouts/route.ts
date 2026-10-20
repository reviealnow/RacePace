import { env } from 'cloudflare:workers';
import { workoutAPI } from '../../../server/workout-api';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => workoutAPI(request, env.DB);
export const POST = (request: Request) => workoutAPI(request, env.DB);
