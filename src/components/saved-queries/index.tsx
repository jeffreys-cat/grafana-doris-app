import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, ConfigProvider, Drawer, Empty, Input, List, Modal, Pagination, Radio, Space, Tag, Typography, theme as antdTheme } from 'antd';
import { Button as GrafanaButton, Tooltip, useTheme2 } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { useStore } from 'jotai';
import { SavedQuery, savedQueries } from 'services/saved-queries';
import { DiscoverShareState } from 'utils/discover-share-state';
import { snapshotKey, validateSavedQueryState } from 'utils/saved-query-state';
import { discoverSnapshotAtom } from 'store/discover-snapshot';

type Props = { snapshot: DiscoverShareState; ready: boolean; restore: (state: DiscoverShareState) => Promise<boolean> };
type Editor = {
    kind: 'create' | 'update' | 'rename';
    name: string;
    description: string;
    target?: SavedQuery;
    source?: SavedQuery;
    snapshot?: DiscoverShareState;
    snapshotChanged?: boolean;
};

export default function SavedQueries({ snapshot, ready, restore }: Props) {
    const store = useStore();
    const theme = useTheme2();
    const [modal, modalContext] = Modal.useModal();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<SavedQuery[]>([]);
    const [total, setTotal] = useState(0);
    const [canCreate, setCanCreate] = useState(['Editor', 'Admin'].includes(config.bootData?.user?.orgRole || ''));
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [editorError, setEditorError] = useState('');
    const [editor, setEditor] = useState<Editor>();
    const [active, setActive] = useState<SavedQuery>();
    const [baseline, setBaseline] = useState('');
    const [reload, setReload] = useState(0);
    const initial = useRef<string | undefined>(undefined);
    if (ready && initial.current === undefined) {
        initial.current = snapshotKey(snapshot);
    }
    const dirty = initial.current !== undefined && snapshotKey(snapshot) !== (active ? baseline : initial.current);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        // The server is authoritative; the boot role only avoids a disabled
        // button while loading capabilities on the first render.
        let cancelled = false;
        void savedQueries
            .list('', 1)
            .then(result => {
                if (!cancelled) {
                    setCanCreate(result.canCreate);
                }
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }
        let cancelled = false;
        setLoading(true);
        const timer = window.setTimeout(() => {
            void savedQueries
                .list(search, page)
                .then(result => {
                    if (cancelled) {
                        return;
                    }
                    setItems(result.items);
                    setTotal(result.total);
                    setCanCreate(result.canCreate);
                    setError('');
                    if (page > 1 && !result.items.length) {
                        setPage(Math.max(1, Math.ceil(result.total / 20)));
                    }
                })
                .catch(error => {
                    if (!cancelled) {
                        setError(error.message);
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setLoading(false);
                    }
                });
        }, 200);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [open, search, page, reload]);

    const beginSave = (kind: 'create' | 'update') => {
        try {
            validateSavedQueryState(snapshot);
        } catch (error) {
            setError((error as Error).message);
            setOpen(true);
            return;
        }
        setEditorError('');
        setEditor({
            kind,
            name: active?.name || '',
            description: active?.description || '',
            target: kind === 'update' ? active : undefined,
            source: active,
            snapshot,
            snapshotChanged: dirty,
        });
    };

    const unchanged =
        editor?.kind === 'update' && !editor.snapshotChanged && editor.name.trim() === editor.target?.name && editor.description.trim() === editor.target?.description;
    const save = async () => {
        if (!editor || busy || unchanged || !editor.name.trim()) {
            return;
        }
        setBusy(true);
        setEditorError('');
        try {
            const input = { name: editor.name.trim(), description: editor.description.trim(), state: editor.kind === 'rename' ? undefined : editor.snapshot };
            const result = editor.target ? await savedQueries.update(editor.target.id, { ...input, revision: editor.target.revision }) : await savedQueries.create(input);
            if (!mounted.current) {
                return;
            }
            if (editor.kind !== 'rename') {
                setActive(result);
                setBaseline(snapshotKey(result.state));
            } else {
                setActive(previous =>
                    previous?.id === result.id
                        ? {
                              ...previous,
                              name: result.name,
                              description: result.description,
                              // Renaming a newer list revision must not authorize
                              // overwriting a state change this editor never loaded.
                              revision: previous.revision === editor.target?.revision ? result.revision : previous.revision,
                              updatedAt: result.updatedAt,
                          }
                        : previous,
                );
            }
            setEditor(undefined);
            setReload(n => n + 1);
        } catch (error) {
            if (mounted.current) {
                setEditorError((error as Error).message);
            }
        } finally {
            if (mounted.current) {
                setBusy(false);
            }
        }
    };

    const load = async (item: SavedQuery) => {
        setBusy(true);
        setError('');
        try {
            const latest = await savedQueries.get(item.id);
            if (!mounted.current) {
                return;
            }
            validateSavedQueryState(latest.state);
            if (await restore(latest.state)) {
                if (!mounted.current) {
                    return;
                }
                setActive(latest);
                setBaseline(snapshotKey(store.get(discoverSnapshotAtom)));
                setOpen(false);
            } else if (mounted.current) {
                setError('The query could not be restored. See the details in Discover.');
            }
        } catch (error) {
            if (mounted.current) {
                setError((error as Error).message);
            }
        } finally {
            if (mounted.current) {
                setBusy(false);
            }
        }
    };

    const confirmLoad = (item: SavedQuery) => {
        if (dirty) {
            modal.confirm({
                title: 'Discard unsaved query changes?',
                content: 'Loading this query replaces the current query and display settings.',
                okText: 'Discard and load',
                onOk: () => load(item),
            });
        } else {
            void load(item);
        }
    };

    const remove = (item: SavedQuery) =>
        modal.confirm({
            title: `Delete “${item.name}”?`,
            content: 'This removes the saved query for everyone in this organization.',
            okText: 'Delete',
            okButtonProps: { danger: true },
            onOk: async () => {
                setBusy(true);
                try {
                    await savedQueries.delete(item.id, item.revision);
                    if (!mounted.current) {
                        return;
                    }
                    if (active?.id === item.id) {
                        setActive(undefined);
                        setBaseline('');
                        initial.current = snapshotKey(snapshot);
                    }
                    setReload(n => n + 1);
                } catch (error) {
                    if (mounted.current) {
                        setError((error as Error).message);
                    }
                } finally {
                    if (mounted.current) {
                        setBusy(false);
                    }
                }
            },
        });

    return (
        <ConfigProvider theme={{ algorithm: theme.isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm, token: { colorPrimary: theme.colors.primary.main } }}>
            {modalContext}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <Tooltip content={active ? `Save query: ${active.name}${dirty ? ' (Modified)' : ''}` : 'Save query'}>
                    <span style={{ display: 'inline-flex', position: 'relative' }}>
                        <GrafanaButton
                            aria-label="Save query"
                            variant="secondary"
                            icon="save"
                            onClick={() => beginSave(active?.canEdit ? 'update' : 'create')}
                            disabled={(!canCreate && !active?.canEdit) || !ready || busy}
                        />
                        {dirty && (
                            <span
                                role="status"
                                aria-label="Unsaved query changes"
                                style={{
                                    position: 'absolute',
                                    top: 3,
                                    right: 3,
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: theme.colors.warning.main,
                                    pointerEvents: 'none',
                                }}
                            />
                        )}
                    </span>
                </Tooltip>
                <Tooltip content="Saved queries">
                    <GrafanaButton aria-label="Saved queries" variant="secondary" icon="folder-open" onClick={() => setOpen(true)} />
                </Tooltip>
            </div>
            <Drawer title="Saved queries" open={open} onClose={() => setOpen(false)} width={560}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Typography.Text type="secondary">Shared with members of this Grafana organization. Data access uses your own permissions.</Typography.Text>
                    <Input.Search
                        aria-label="Search saved queries"
                        placeholder="Search by name"
                        allowClear
                        value={search}
                        onChange={event => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                    />
                    {error && (
                        <Alert
                            type="error"
                            showIcon
                            message={error}
                            action={
                                <Button size="small" onClick={() => setReload(n => n + 1)}>
                                    Retry
                                </Button>
                            }
                        />
                    )}
                    <List
                        loading={loading}
                        dataSource={items}
                        locale={{ emptyText: <Empty description="No saved queries" /> }}
                        renderItem={item => (
                            <List.Item>
                                <div style={{ width: '100%' }}>
                                    <Button
                                        type="link"
                                        style={{ padding: 0, maxWidth: '100%', height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
                                        disabled={busy}
                                        onClick={() => confirmLoad(item)}
                                    >
                                        {item.name}
                                    </Button>
                                    {item.description && (
                                        <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                                            {item.description}
                                        </Typography.Paragraph>
                                    )}
                                    <div>
                                        <Tag>{item.state?.mode}</Tag>
                                        <Typography.Text type="secondary">
                                            {item.state?.database}.{item.state?.table}
                                        </Typography.Text>
                                    </div>
                                    <Typography.Text type="secondary">
                                        {item.author} · {new Date(item.updatedAt).toLocaleString()}
                                    </Typography.Text>
                                    <div>
                                        <Space>
                                            {item.canEdit && (
                                                <Button
                                                    size="small"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        setEditorError('');
                                                        setEditor({ kind: 'rename', name: item.name, description: item.description, target: item });
                                                    }}
                                                >
                                                    Rename
                                                </Button>
                                            )}
                                            {item.canDelete && (
                                                <Button size="small" danger disabled={busy} onClick={() => remove(item)}>
                                                    Delete
                                                </Button>
                                            )}
                                        </Space>
                                    </div>
                                </div>
                            </List.Item>
                        )}
                    />
                    <Pagination current={page} pageSize={20} total={total} showSizeChanger={false} onChange={setPage} />
                </Space>
            </Drawer>
            <Modal
                title={editor?.kind === 'rename' ? 'Rename saved query' : 'Save query'}
                open={Boolean(editor)}
                onCancel={() => {
                    if (!busy) {
                        setEditor(undefined);
                    }
                }}
                onOk={() => {
                    void save();
                }}
                okText="Save"
                confirmLoading={busy}
                okButtonProps={{ disabled: !editor?.name.trim() || unchanged }}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    {editor?.kind !== 'rename' && editor?.source?.canEdit && canCreate && (
                        <Radio.Group
                            aria-label="Save query action"
                            value={editor.kind}
                            onChange={event =>
                                setEditor(previous => previous && { ...previous, kind: event.target.value, target: event.target.value === 'update' ? previous.source : undefined })
                            }
                        >
                            <Radio value="update">Update current query</Radio>
                            <Radio value="create">Save as new query</Radio>
                        </Radio.Group>
                    )}
                    <label>
                        Name
                        <Input
                            aria-label="Saved query name"
                            value={editor?.name || ''}
                            maxLength={120}
                            onChange={event => setEditor(previous => previous && { ...previous, name: event.target.value })}
                        />
                    </label>
                    <label>
                        Description
                        <Input.TextArea
                            aria-label="Saved query description"
                            value={editor?.description || ''}
                            maxLength={2000}
                            onChange={event => setEditor(previous => previous && { ...previous, description: event.target.value })}
                        />
                    </label>
                    {editorError && <Alert type="error" showIcon message={editorError} />}
                </Space>
            </Modal>
        </ConfigProvider>
    );
}
