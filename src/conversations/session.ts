import {ConversationAccessError, type ConversationStore, getConversationStore} from './store.ts';

const COOKIE = 'nlui_session';
export const conversationSession = (request: Request, store: ConversationStore = getConversationStore()) =>
{
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) throw new ConversationAccessError(403, 'Cross-origin session requests are not allowed.');
    const token = new Bun.CookieMap(request.headers.get('Cookie') ?? '').get(COOKIE);
    const session = store.session(token ?? undefined);
    const headers = new Headers({'Cache-Control': 'no-store', Vary: 'Cookie'});
    if (session.token) headers.set('Set-Cookie', new Bun.Cookie(COOKIE, session.token, {
        httpOnly: true, sameSite: 'strict', path: '/', maxAge: 7 * 86400,
        secure: new URL(request.url).protocol === 'https:'
    }).serialize());
    return {owner: session.owner, headers};
};
