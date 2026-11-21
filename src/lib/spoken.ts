/**
 * What a voice actually says: a leading stage direction such as «(sekin)» stays in the subtitle
 * but is never read aloud. Used by the player and by the pre-render list (tools/voice/lines.mjs),
 * so the backend's cache key is the same text we send.
 */
export const spokenText = (text: string) => text.replace(/^\s*\([^()]{1,24}\)\s*/, '').trim();
