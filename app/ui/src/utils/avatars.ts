import md5 from 'md5';

const gravatarCache = new Map<string, string>();

export function gravatarUrl(email?: string) {
    if (!email) return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=100';
    const trimmed = email.trim().toLowerCase();

    if (gravatarCache.has(trimmed)) return gravatarCache.get(trimmed)!;

    const hash = md5(trimmed);
    const url = `https://www.gravatar.com/avatar/${hash}?d=identicon&s=100`;
    gravatarCache.set(trimmed, url);
    return url;
}
