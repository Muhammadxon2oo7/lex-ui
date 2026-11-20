import { handle, ownerToken } from '@/server/http';
import { voiceStatus } from '@/server/voice/provider';

export const GET = handle(async () => voiceStatus(await ownerToken()));
