import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { css } from '@emotion/css';
import { ClipboardButton } from '@grafana/ui';

interface LongTextCellProps {
    children: ReactNode;
    copyText: string;
    className?: string;
}

export function LongTextCell({ children, copyText, className }: LongTextCellProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);

    const updateOverflow = useCallback(() => {
        const element = contentRef.current;
        if (!element) {
            return;
        }
        setIsOverflowing(current => {
            const next = element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
            return current === next ? current : next;
        });
    }, []);

    useEffect(() => {
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
            <div
                className={css`
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 8px;
                    margin-top: 8px;
                `}
            >
                {copyFailed ? <span role="alert">Copy failed</span> : null}
                <ClipboardButton
                    type="button"
                    aria-label="Copy full cell content"
                    variant="secondary"
                    size="sm"
                    getText={() => copyText}
                    onClipboardCopy={() => setCopyFailed(false)}
                    onClipboardError={() => setCopyFailed(true)}
                >
                    Copy
                </ClipboardButton>
            </div>
        </div>
    ) : null;

    return (
        <Tooltip title={preview} mouseEnterDelay={0.15}>
            <div
                ref={contentRef}
                className={className}
                data-testid="long-text-cell"
                onMouseEnter={updateOverflow}
                onFocus={updateOverflow}
            >
                {children}
            </div>
        </Tooltip>
    );
}
