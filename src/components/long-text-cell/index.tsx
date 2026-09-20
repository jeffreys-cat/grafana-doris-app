import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { css } from '@emotion/css';

type CopyStatus = 'idle' | 'success' | 'error';

interface LongTextCellProps {
    children: ReactNode;
    copyText: string;
    className?: string;
}

export function LongTextCell({ children, copyText, className }: LongTextCellProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

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

    const copyFullText = useCallback(async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard API is unavailable');
            }
            await navigator.clipboard.writeText(copyText);
            setCopyStatus('success');
        } catch {
            setCopyStatus('error');
        }
    }, [copyText]);

    const preview = isOverflowing ? (
        <div
            className={css`
                max-width: min(560px, calc(100vw - 32px));
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
                {copyStatus === 'success' ? <span role="status">Copied</span> : null}
                {copyStatus === 'error' ? <span role="alert">Copy failed</span> : null}
                <button
                    type="button"
                    aria-label="Copy full cell content"
                    onClick={copyFullText}
                    className={css`
                        border: 0;
                        border-radius: 3px;
                        padding: 4px 8px;
                        cursor: pointer;
                    `}
                >
                    Copy
                </button>
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
