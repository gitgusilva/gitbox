import i18n from '../i18n';
import { generalSettings } from '../services/settingsService';

export function renderMessageLinks(message: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let html = message.replace(urlRegex, '<a href="#" data-url="$1" class="text-blue-400 hover:text-blue-300 underline underline-offset-2">$1</a>');

    // Bold conventional commit prefixes
    const prefixRegex = /^((?:feat|fix|docs|refactor|test|chore|build|ci|perf|style|revert)(?:\([^\)]+\))?!?:)/i;
    html = html.replace(prefixRegex, '<span class="font-bold text-white">$1</span>');

    return html;
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

export function formatStashDate(timestamp: number) {
    const d = new Date(timestamp * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function parseStashMessage(message: string) {
    // Git stash messages often look like: "WIP on branch: message" or "On branch: message"
    const match = message.match(/^(WIP on |On )(.+?): (.*)$/);
    if (match) {
        return { branch: match[2], message: match[3] };
    }
    return { branch: '', message };
}

export function formatDate(timestamp: number | string | Date, fmt?: string) {
    let now: Date;
    if (timestamp instanceof Date) {
        now = timestamp;
    } else if (typeof timestamp === 'string') {
        now = new Date(timestamp);
    } else {
        now = new Date(timestamp * 1000);
    }

    if (!fmt) {
        fmt = generalSettings.value.dateFormat;
    }

    if (fmt === 'relative') {
        return formatRelativeDate(now);
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    const monthShortKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthName = i18n.global.t(`time.months_short.${monthShortKeys[now.getMonth()]}`);

    return (fmt as string)
        .replace('yyyy', String(year))
        .replace('MMM', monthName)
        .replace('MM', month)
        .replace('dd', day)
        .replace('d', String(now.getDate()))
        .replace('HH', hours)
        .replace('mm', mins)
        .replace('ss', secs);
}

/**
 * Human-friendly relative time: "Just now", "5 mins ago", "2 hours ago",
 * "Yesterday 14:30", "3 days ago". Anything older than a week falls back to a
 * compact absolute date so distant commits stay unambiguous.
 */
function formatRelativeDate(date: Date): string {
    const t = i18n.global.t;
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);

    const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    if (diffMs < 45 * 1000) return t('time.just_now');
    if (diffMin < 60) return diffMin === 1 ? t('time.min_ago') : t('time.mins_ago', { count: diffMin });

    // Compare by calendar day so "yesterday" is correct across midnight.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfDate = new Date(date);
    startOfDate.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

    if (dayDiff <= 0) {
        if (diffHour < 1) return t('time.mins_ago', { count: Math.max(1, diffMin) });
        if (diffHour < 12) return diffHour === 1 ? t('time.hour_ago') : t('time.hours_ago', { count: diffHour });
        return t('time.today', { time: hhmm });
    }
    if (dayDiff === 1) return t('time.yesterday', { time: hhmm });
    if (dayDiff < 7) return t('time.days_ago', { count: dayDiff });

    return formatDate(date, 'MMM d yyyy');
}
