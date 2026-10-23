import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { css } from '@emotion/css';
import { ClipboardButton, useTheme2 } from '@grafana/ui';

interface LongTextCellProps {
    children: ReactNode;
    copyText: string;
    className?: string;
}

export function LongTextCell({ children, copyText, className }: LongTextCellProps) {
    const theme = useTheme2();
    const contentRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    // Wrapping can make a lengthy value fit without making it easy to copy.
    const canCopy = isOverflowing || copyText.length > 120;

    const updateOverflow = useCallback(() => {
        const element = contentRef.current;
        if (!element) {
            return;
        }
        setIsOverflowing(current => {
            const overflows = (node: HTMLElement) => node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight;
            // Selected fields can be ellipsized by a nested span while the
            // outer content container itself still fits.
            const next = overflows(element) || Array.from(element.querySelectorAll<HTMLElement>('*')).some(overflows);
            return current === next ? current : next;
        });
    }, []);

    useEffect(() => {
        setCopyFailed(false);
        updateOverflow();
        const element = contentRef.current;
        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }
        const observer = new ResizeObserver(updateOverflow);
        observer.observe(element);
        return () => observer.disconnect();
    }, [updateOverflow, copyText]);

    const preview = isOverflowing ? (
        <div
            className={css`
                max-width: min(560px, calc(100vw - 32px));
                box-sizing: border-box;
                padding: 12px;
            `}
        >
            <div
                className={css`
                    max-height: 320px;
                    overflow: auto;
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                `}
            >
                {copyText}
            </div>
        </div>
    ) : null;

    return (
        <div
            data-testid="long-text-cell-container"
            onMouseEnter={updateOverflow}
            onFocusCapture={updateOverflow}
            className={css`
                position: relative;
                min-width: 0;
                width: 100%;
                flex: 1 1 0;

                &:hover > .cell-copy-action,
                td:hover & > .cell-copy-action,
                &:focus-within > .cell-copy-action {
                    opacity: 1;
                    pointer-events: auto;
                }
            `}
        >
            <Tooltip title={preview} mouseEnterDelay={0.15}>
                <div ref={contentRef} className={className} data-testid="long-text-cell" onMouseEnter={updateOverflow}>
                    {children}
                </div>
            </Tooltip>
            {canCopy && (
                <div
                    className={`cell-copy-action ${css`
                        position: absolute;
                        top: 2px;
                        right: 2px;
                        z-index: 1;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        opacity: 0;
                        pointer-events: none;
                        border-radius: ${theme.shape.radius.default};
                        background: ${theme.colors.background.primary};

                        @media (hover: none) {
                            opacity: 1;
                            pointer-events: auto;
                        }
                    `}`}
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                    onDoubleClick={event => event.stopPropagation()}
                >
                    {copyFailed && (
                        <span role="alert" style={{ color: theme.colors.error.text, padding: '0 4px', fontSize: theme.typography.bodySmall.fontSize }}>
                            Copy failed
                        </span>
                    )}
                    <ClipboardButton
                        type="button"
                        aria-label="Copy full cell content"
                        title="Copy full cell content"
                        variant="secondary"
                        size="sm"
                        icon="copy"
                        getText={() => copyText}
                        onClipboardCopy={() => setCopyFailed(false)}
                        onClipboardError={() => setCopyFailed(true)}
                    />
                </div>
            )}
        </div>
    );
}
