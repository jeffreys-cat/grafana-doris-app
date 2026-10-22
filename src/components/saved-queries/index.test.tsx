import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Modal } from 'antd';
import { Provider, createStore } from 'jotai';
import SavedQueries from './index';
import { SavedQuery, savedQueries } from 'services/saved-queries';
import { DiscoverShareState } from 'utils/discover-share-state';

jest.mock('@grafana/ui', () => ({ ...jest.requireActual('@grafana/ui'), Tooltip: ({ children }: any) => <>{children}</> }));
jest.mock('@grafana/runtime', () => ({ config: { bootData: { user: { orgRole: 'Editor' } } } }));
jest.mock('services/saved-queries', () => ({ savedQueries: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } }));
const state: DiscoverShareState = {
    version: 1,
    datasource: 'ds',
    database: 'otel',
    table: 'logs',
    timeField: 'timestamp',
    timeZone: 'UTC',
    mode: 'SQL',
    query: 'level = 1',
    timeRawFrom: 'now-1h',
    timeRawTo: 'now',
    filters: [],
    selectedFields: [],
    columnOrder: [],
    sort: { field: 'timestamp', direction: 'DESC' },
};
const query: SavedQuery = {
    id: 'q1',
    name: 'Errors',
    description: 'Triage',
    state,
    revision: 1,
    author: 'alice',
    createdAt: '2026-10-22T00:00:00Z',
    updatedAt: '2026-10-22T00:00:00Z',
    canEdit: true,
    canDelete: true,
};
beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest
            .fn()
            .mockImplementation(() => ({ matches: false, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() })),
    });
});
afterEach(async () => {
    await act(async () => {
        Modal.destroyAll();
        await new Promise(resolve => setTimeout(resolve, 0));
    });
});
beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    (savedQueries.list as jest.Mock).mockResolvedValue({ items: [query], total: 1, canCreate: true });
    (savedQueries.get as jest.Mock).mockResolvedValue(query);
    (savedQueries.create as jest.Mock).mockResolvedValue(query);
    (savedQueries.update as jest.Mock).mockResolvedValue({ ...query, revision: 2 });
    (savedQueries.delete as jest.Mock).mockResolvedValue({ deleted: true });
});
function setup(snapshot = state) {
    const restore = jest.fn().mockResolvedValue(true),
        store = createStore();
    const view = render(
        <Provider store={store}>
            <SavedQueries snapshot={snapshot} ready restore={restore} />
        </Provider>,
    );
    return {
        ...view,
        restore,
        store,
        change: (next: DiscoverShareState) =>
            view.rerender(
                <Provider store={store}>
                    <SavedQueries snapshot={next} ready restore={restore} />
                </Provider>,
            ),
    };
}

it('saves the current snapshot without executing a query', async () => {
    const { restore } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    fireEvent.change(screen.getByLabelText('Saved query name'), { target: { value: ' Errors ' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedQueries.create).toHaveBeenCalledWith({ name: 'Errors', description: '', state }));
    expect(restore).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save query' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update query' })).not.toBeInTheDocument();
});

it('keeps the name and description after a network failure', async () => {
    (savedQueries.create as jest.Mock).mockRejectedValue(new Error('Storage is unavailable'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    fireEvent.change(screen.getByLabelText('Saved query name'), { target: { value: 'My query' } });
    fireEvent.change(screen.getByLabelText('Saved query description'), { target: { value: 'Keep this draft' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await screen.findByText('Storage is unavailable');
    expect(screen.getByLabelText('Saved query name')).toHaveValue('My query');
    expect(screen.getByLabelText('Saved query description')).toHaveValue('Keep this draft');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
});

it('searches and loads the latest revision through the restore pipeline', async () => {
    const { restore } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Saved queries' }));
    fireEvent.change(screen.getByLabelText('Search saved queries'), { target: { value: 'Err' } });
    await waitFor(() => expect(savedQueries.list).toHaveBeenCalledWith('Err', 1));
    fireEvent.click(await screen.findByRole('button', { name: 'Errors' }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(state));
    expect(savedQueries.get).toHaveBeenCalledWith('q1');
});

it('asks before replacing unsaved changes and does not load on cancel', async () => {
    const { restore, change } = setup();
    change({ ...state, query: 'changed' });
    fireEvent.click(screen.getByRole('button', { name: 'Saved queries' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Errors' }));
    await screen.findAllByText('Discard unsaved query changes?');
    expect(restore).not.toHaveBeenCalled();
    const dialogs = screen.getAllByRole('dialog');
    fireEvent.click(within(dialogs[dialogs.length - 1]).getByRole('button', { name: 'Cancel' }));
    expect(savedQueries.get).not.toHaveBeenCalled();
});

it('renames with revision and preserves input on a conflict', async () => {
    (savedQueries.update as jest.Mock).mockRejectedValue(new Error('This query changed. Reload it before trying again.'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Saved queries' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Saved query name'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedQueries.update).toHaveBeenCalledWith('q1', expect.objectContaining({ name: 'New name', revision: 1 })));
    await screen.findByText('This query changed. Reload it before trying again.');
    expect(screen.getByLabelText('Saved query name')).toHaveValue('New name');
});

it('requires confirmation before deleting for the organization', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Saved queries' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(savedQueries.delete).not.toHaveBeenCalled();
    await screen.findAllByText('Delete “Errors”?');
    const dialogs = screen.getAllByRole('dialog');
    fireEvent.click(within(dialogs[dialogs.length - 1]).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(savedQueries.delete).toHaveBeenCalledWith('q1', 1));
    await act(async () => {
        await Promise.resolve();
    });
});

it('uses server capabilities for Viewer and other authors', async () => {
    (savedQueries.list as jest.Mock).mockResolvedValue({ items: [{ ...query, canEdit: false, canDelete: false }], total: 1, canCreate: false });
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save query' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Saved queries' }));
    await screen.findByRole('button', { name: 'Errors' });
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});

it('does not let a rename overwrite another user’s newer query state', async () => {
    const { change } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    fireEvent.change(screen.getByLabelText('Saved query name'), { target: { value: 'Errors' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    change({ ...state, query: 'my unsaved changes' });
    (savedQueries.list as jest.Mock).mockResolvedValue({ items: [{ ...query, revision: 2, state: { ...state, query: 'another author’s changes' } }], total: 1, canCreate: true });
    (savedQueries.update as jest.Mock).mockResolvedValueOnce({ ...query, name: 'Renamed', revision: 3, state: { ...state, query: 'another author’s changes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Saved queries' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Saved query name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedQueries.update).toHaveBeenCalledWith('q1', expect.objectContaining({ revision: 2, name: 'Renamed' })));
    await waitFor(() => expect(screen.getByLabelText('Saved query name')).not.toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
        expect(savedQueries.update).toHaveBeenLastCalledWith('q1', expect.objectContaining({ revision: 1, state: expect.objectContaining({ query: 'my unsaved changes' }) })),
    );
});

async function saveInitialQuery() {
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    fireEvent.change(screen.getByLabelText('Saved query name'), { target: { value: 'Errors' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

it('defaults to update and enables submission for metadata changes without changing the query', async () => {
    setup();
    await saveInitialQuery();
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    expect(screen.getByRole('radio', { name: 'Update current query' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Saved query name'), { target: { value: 'Renamed errors' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedQueries.update).toHaveBeenCalledWith('q1', expect.objectContaining({ name: 'Renamed errors', revision: 1, state })));
    expect(savedQueries.create).toHaveBeenCalledTimes(1);
});

it('can save an unchanged query as new using the same save icon', async () => {
    setup();
    await saveInitialQuery();
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Save as new query' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedQueries.create).toHaveBeenCalledTimes(2));
    expect(savedQueries.update).not.toHaveBeenCalled();
});

it('only offers save as new for a query owned by another Editor', async () => {
    (savedQueries.get as jest.Mock).mockResolvedValue({ ...query, canEdit: false, canDelete: false });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Saved queries' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Errors' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save query' }));
    expect(screen.queryByRole('radio', { name: 'Update current query' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedQueries.create).toHaveBeenCalledTimes(1));
    expect(savedQueries.update).not.toHaveBeenCalled();
});
