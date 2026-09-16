import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ColumnDef, ColumnSizingState, SortingState } from '@tanstack/react-table';
import SDCollapsibleTable from './index';

type RowData = { time: string; message: string };

const columns: Array<ColumnDef<RowData>> = [
    {
        id: '__expand',
        header: '',
        cell: () => null,
        size: 48,
        minSize: 48,
        maxSize: 48,
        enableSorting: false,
        enableResizing: false,
    },
    {
        id: 'time',
        accessorKey: 'time',
        header: 'Time',
        enableSorting: true,
        sortDescFirst: false,
    },
    {
        id: 'message',
        accessorKey: 'message',
        header: 'Message',
        enableSorting: true,
        sortDescFirst: false,
    },
];

function TableHarness({
    data = [{ time: '2026-08-03', message: 'hello' }],
    emptyContent,
    allRowsExpanded,
}: {
    data?: RowData[];
    emptyContent?: React.ReactNode;
    allRowsExpanded?: boolean;
}) {
    const [sorting, setSorting] = React.useState<SortingState>([{ id: 'time', desc: true }]);
    const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({ time: 240, message: 240 });
    return (
        <SDCollapsibleTable
            data={data}
            columns={columns}
            getRowCanExpand={() => true}
            renderSubComponent={({ row }) => <div>Details for {row.original.message}</div>}
            allRowsExpanded={allRowsExpanded}
            columnOrder={['__expand', 'time', 'message']}
            onColumnOrderChange={() => {}}
            columnSizing={columnSizing}
            onColumnSizingChange={setColumnSizing}
            sorting={sorting}
            onSortingChange={setSorting}
            enableColumnReordering
            emptyContent={emptyContent}
        />
    );
}

describe('SDCollapsibleTable column interactions', () => {
    it('expands all rows by default when requested', () => {
        render(<TableHarness allRowsExpanded />);

        expect(screen.getByText('Details for hello')).toBeInTheDocument();
    });

    it('keeps rows collapsed when the preference is disabled', () => {
        render(<TableHarness allRowsExpanded={false} />);

        expect(screen.queryByText('Details for hello')).not.toBeInTheDocument();
    });

    it('exposes sorting state and toggles a sortable header', () => {
        render(<TableHarness />);
        const timeHeader = screen.getByText('Time').closest('th');
        expect(timeHeader).toHaveAttribute('aria-sort', 'descending');

        fireEvent.click(screen.getByText('Time').closest('[role="button"]') as HTMLElement);

        expect(timeHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('renders accessible drag handles and applies a resized width', async () => {
        render(<TableHarness />);
        expect(screen.getByRole('button', { name: 'Move column time' })).toBeInTheDocument();

        const separator = screen.getByRole('separator', { name: 'Resize column time' });
        fireEvent.mouseDown(separator, { clientX: 240 });
        fireEvent.mouseMove(document, { clientX: 340 });
        fireEvent.mouseUp(document);

        await waitFor(() => expect(screen.getByText('Time').closest('th')).toHaveStyle({ width: '340px' }));
    });

    it('renders caller-provided empty-state content', () => {
        render(<TableHarness data={[]} emptyContent={<div>Query succeeded — no results</div>} />);
        expect(screen.getByText('Query succeeded — no results')).toBeInTheDocument();
        expect(screen.queryByText('No Data')).not.toBeInTheDocument();
    });
});
