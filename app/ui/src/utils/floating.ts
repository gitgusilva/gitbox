export type Placement = 'top' | 'bottom' | 'left' | 'right';
export type Alignment = 'start' | 'center' | 'end';

export interface FloatingOptions {
    targetRect: DOMRect;
    floatingRect: DOMRect;
    placement?: Placement;
    alignment?: Alignment;
    margin?: number;
    matchWidth?: boolean;
}

export function calculateFloatingPosition({
    targetRect,
    floatingRect,
    placement = 'bottom',
    alignment = 'center',
    margin = 8,
    matchWidth = false
}: FloatingOptions) {
    let top = 0;
    let left = 0;
    let width = matchWidth ? targetRect.width : floatingRect.width;

    let pos = placement;

    // Flip logic based on vertical constraints
    if (pos === 'bottom' && targetRect.bottom + margin + floatingRect.height > window.innerHeight) {
        if (targetRect.top - floatingRect.height - margin > 0) pos = 'top';
    }
    if (pos === 'top' && targetRect.top - floatingRect.height - margin < 0) {
        if (targetRect.bottom + margin + floatingRect.height <= window.innerHeight) pos = 'bottom';
    }

    // Flip logic based on horizontal constraints
    if (pos === 'left' && targetRect.left - width - margin < 0) {
        if (targetRect.right + margin + width <= window.innerWidth) pos = 'right';
    }
    if (pos === 'right' && targetRect.right + margin + width > window.innerWidth) {
        if (targetRect.left - width - margin > 0) pos = 'left';
    }

    // Cross-axis alignment calculation
    switch (pos) {
        case 'bottom':
            top = targetRect.bottom + margin;
            break;
        case 'top':
            top = targetRect.top - floatingRect.height - margin;
            break;
        case 'left':
            left = targetRect.left - width - margin;
            break;
        case 'right':
            left = targetRect.right + margin;
            break;
    }

    if (pos === 'top' || pos === 'bottom') {
        if (alignment === 'start') {
            left = targetRect.left;
        } else if (alignment === 'center') {
            left = targetRect.left + (targetRect.width / 2) - (width / 2);
        } else if (alignment === 'end') {
            left = targetRect.right - width;
        }
    } else if (pos === 'left' || pos === 'right') {
        if (alignment === 'start') {
            top = targetRect.top;
        } else if (alignment === 'center') {
            top = targetRect.top + (targetRect.height / 2) - (floatingRect.height / 2);
        } else if (alignment === 'end') {
            top = targetRect.bottom - floatingRect.height;
        }
    }

    // Final boundary checks to ensure the element doesn't flow off-screen
    if (left < margin) left = margin;
    if (top < margin) top = margin;

    const maxLeft = window.innerWidth - width - margin;
    if (left > maxLeft) left = maxLeft;

    const maxTop = window.innerHeight - floatingRect.height - margin;
    if (top > maxTop) top = maxTop;

    return {
        top: `${top}px`,
        left: `${left}px`,
        width: matchWidth ? `${width}px` : undefined
    };
}
