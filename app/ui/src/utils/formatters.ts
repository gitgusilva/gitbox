import i18n from '../i18n';

export function renderMessageLinks(message: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return message.replace(urlRegex, '<a href="#" data-url="$1" class="text-blue-400 hover:text-blue-300 underline underline-offset-2">$1</a>');
}

export function handleLinkClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.tagName === 'A') {
        event.preventDefault();
        const url = target.getAttribute('data-url');
        if (url && (window as any).gitbox?.openExternal) {
            (window as any).gitbox.openExternal(url);
        }
    }
}

export function formatDistanceToNow(timestamp: number) {
    const diff = Math.floor(Date.now() / 1000 - timestamp);
    const t = i18n.global.t;
    if (diff < 60) return t('time.just_now');
    if (diff < 3600) return t('time.mins_ago', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hours_ago', { count: Math.floor(diff / 3600) });
    return t('time.days_ago', { count: Math.floor(diff / 86400) });
}

export function formatFullDate(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString();
}
