export function startMarquee(e: MouseEvent, selector = '.truncate') {
    const container = e.currentTarget as HTMLElement;
    const textEl = container.querySelector(selector) as HTMLElement;

    if (textEl && textEl.scrollWidth > textEl.clientWidth) {
        const distance = textEl.scrollWidth - textEl.clientWidth + 20;
        // Any element tagged `.marquee-icon` (e.g. a leading file icon) slides by
        // the same distance so it travels together with the text instead of
        // staying pinned while the label scrolls out from under it.
        const targets = [textEl, ...Array.from(container.querySelectorAll<HTMLElement>('.marquee-icon'))];
        for (const el of targets) {
            el.style.textOverflow = 'clip';
            el.style.overflow = 'visible';
            el.style.transitionProperty = 'transform';
            el.style.transitionTimingFunction = 'linear';
            el.style.transitionDuration = `${Math.max(1000, distance * 20)}ms`;
            el.style.transform = `translateX(-${distance}px)`;
        }
    }
}

export function stopMarquee(e: MouseEvent, selector = '.truncate') {
    const container = e.currentTarget as HTMLElement;
    const textEl = container.querySelector(selector) as HTMLElement;
    const targets = [textEl, ...Array.from(container.querySelectorAll<HTMLElement>('.marquee-icon'))].filter(Boolean) as HTMLElement[];

    for (const el of targets) {
        el.style.transitionDuration = '200ms';
        el.style.transform = 'translateX(0)';
    }
    setTimeout(() => {
        for (const el of targets) {
            el.style.textOverflow = '';
            el.style.overflow = '';
        }
    }, 200);
}
