import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import FieldItem from './field-item';

jest.mock('@grafana/ui', () => ({
    IconButton: ({ name, tooltip, ...props }: any) => <button aria-label={tooltip} data-icon={name} {...props} />,
    Tooltip: ({ children, content, show, placement }: any) => <>{children}{show && <div data-testid="top-data-tooltip" data-placement={placement}>{content}</div>}</>,
    useTheme2: () => ({ colors: { background: { secondary: '#222' }, text: { primary: '#fff', secondary: '#aaa' } } }),
}));

jest.mock('utils/icon', () => ({
    getFieldIcon: (type: string) => <span data-testid={`field-icon-${type}`} />,
}));

jest.mock('./top-data/top-data', () => ({
    TopData: ({ onPointerEnter, onPointerLeave }: any) => <div data-testid="top-data-content" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} />,
}));

describe('VARIANT sidebar field item', () => {
    const field = {
        Field: 'resource_attributes',
        Type: 'VARIANT',
        leafCount: 3,
        children: [
            { Field: 'resource_attributes.app', label: 'app', Type: 'VARCHAR', variantPath: ['resource_attributes', 'app'] },
            { Field: 'resource_attributes.k8s.namespace.name', label: 'k8s.namespace.name', Type: 'VARCHAR', variantPath: ['resource_attributes', 'k8s.namespace.name'] },
            { Field: 'resource_attributes.nested.retries', label: 'nested.retries', Type: 'DOUBLE', variantPath: ['resource_attributes', 'nested', 'retries'] },
        ],
    };

    it('keeps the parent collapsed by default and renders a single flat leaf list when expanded', () => {
        render(<FieldItem type="add" field={field} />);

        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.queryByText('k8s.namespace.name')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

        expect(screen.getByText('app')).toBeInTheDocument();
        expect(screen.getByText('k8s.namespace.name')).toBeInTheDocument();
        expect(screen.getByText('nested.retries')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Collapse' })).toBeInTheDocument();
    });

    it('automatically opens a matching VARIANT parent during sidebar search', () => {
        render(<FieldItem type="add" field={field} searchActive="namespace" />);

        expect(screen.getByText('k8s.namespace.name')).toBeInTheDocument();
        expect(screen.queryByText('app')).not.toBeInTheDocument();
    });

    it('keeps a zero-leaf VARIANT parent expandable and explains the empty state', () => {
        render(<FieldItem type="add" field={{ Field: 'log_attributes', Type: 'VARIANT', children: [], leafCount: 0 }} />);

        expect(screen.getByText('0')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
        expect(screen.getByText('暂无可发现的内部字段')).toBeInTheDocument();
    });
});

describe('Discover field TOP5 hover', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const leafField = { Field: 'service_name', Type: 'VARCHAR' };

    it('waits before opening so a quick pointer pass does not show the tooltip', () => {
        render(<FieldItem type="add" field={leafField} />);
        const row = screen.getByTestId('field-item-row');

        fireEvent.pointerEnter(row);
        act(() => jest.advanceTimersByTime(100));
        fireEvent.pointerLeave(row);
        act(() => jest.advanceTimersByTime(300));

        expect(screen.queryByTestId('top-data-tooltip')).not.toBeInTheDocument();
    });

    it('keeps the tooltip open while entering the panel and closes after leaving both areas', () => {
        render(<FieldItem type="add" field={leafField} />);
        const row = screen.getByTestId('field-item-row');

        fireEvent.pointerEnter(row);
        act(() => jest.advanceTimersByTime(200));
        const tooltip = screen.getByTestId('top-data-tooltip');
        expect(tooltip).toHaveAttribute('data-placement', 'right');

        fireEvent.pointerLeave(row);
        fireEvent.pointerEnter(screen.getByTestId('top-data-content'));
        act(() => jest.advanceTimersByTime(300));
        expect(screen.getByTestId('top-data-tooltip')).toBeInTheDocument();

        fireEvent.pointerLeave(screen.getByTestId('top-data-content'));
        act(() => jest.advanceTimersByTime(249));
        expect(screen.getByTestId('top-data-tooltip')).toBeInTheDocument();
        act(() => jest.advanceTimersByTime(1));
        expect(screen.queryByTestId('top-data-tooltip')).not.toBeInTheDocument();
    });
});
