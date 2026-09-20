import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LongTextCell } from './index';

jest.mock('antd', () => ({
    Tooltip: ({ children, title }: any) => <>{children}{title}</>,
}));

function setOverflow(element: HTMLElement, { width = false, height = false } = {}) {
    Object.defineProperties(element, {
        clientWidth: { configurable: true, value: 100 },
        scrollWidth: { configurable: true, value: width ? 101 : 100 },
        clientHeight: { configurable: true, value: 20 },
        scrollHeight: { configurable: true, value: height ? 21 : 20 },
    });
}

describe('LongTextCell', () => {
    it('does not expose a preview or copy action when the cell fits', () => {
        render(<LongTextCell copyText="short">short</LongTextCell>);
        const cell = screen.getByTestId('long-text-cell');
        setOverflow(cell);
        fireEvent.mouseEnter(cell);

        expect(screen.queryByRole('button', { name: 'Copy full cell content' })).not.toBeInTheDocument();
    });

    it('shows the complete value and copies it when the cell is truncated', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        render(<LongTextCell copyText="the complete value">truncated…</LongTextCell>);
        const cell = screen.getByTestId('long-text-cell');
        setOverflow(cell, { height: true });
        fireEvent.mouseEnter(cell);

        expect(screen.getByText('the complete value')).toBeInTheDocument();
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy full cell content' }));
        });

        expect(writeText).toHaveBeenCalledWith('the complete value');
        expect(screen.getByRole('status')).toHaveTextContent('Copied');
    });

    it('reports an error when copying is unavailable', async () => {
        Object.assign(navigator, { clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
        render(<LongTextCell copyText="the complete value">truncated…</LongTextCell>);
        const cell = screen.getByTestId('long-text-cell');
        setOverflow(cell, { width: true });
        fireEvent.mouseEnter(cell);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy full cell content' }));
        });

        expect(screen.getByRole('alert')).toHaveTextContent('Copy failed');
    });
});
