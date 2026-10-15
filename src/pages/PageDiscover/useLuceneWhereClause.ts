import { useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import {
    currentDatabaseAtom,
    currentTableAtom,
    searchTypeAtom,
    searchValueAtom,
    selectedDatasourceAtom,
    tableFieldsAtom,
    indexesAtom,
    variantFieldsAtom,
    variantImplicitPathsAtom,
    topDataAtom,
} from 'store/discover';
import { getWhereSQLViaLucene } from 'services/lucene';
import { collectStringVariantPaths, flattenVariantLeaves } from 'utils/variant-fields';

export function useLuceneWhereClause() {
    const inFlight = useRef<{ key: string; promise: Promise<string> } | null>(null);
    const searchType = useAtomValue(searchTypeAtom);
    const searchValue = useAtomValue(searchValueAtom);
    const currentTable = useAtomValue(currentTableAtom);
    const currentDatabase = useAtomValue(currentDatabaseAtom);
    const selectdbDS = useAtomValue(selectedDatasourceAtom);
    const tableFields = useAtomValue(tableFieldsAtom);
    const indexes = useAtomValue(indexesAtom);
    const variantFields = useAtomValue(variantFieldsAtom);
    const variantPathCache = useAtomValue(variantImplicitPathsAtom);
    const topData = useAtomValue(topDataAtom);

    return useCallback((): Promise<string> => {
        if (searchType !== 'Lucene') {
            return Promise.resolve('');
        }

        const trimmedQuery = searchValue?.trim();
        if (!trimmedQuery || !currentTable || !currentDatabase || !selectdbDS) {
            return Promise.resolve('');
        }

        const key = JSON.stringify([selectdbDS.uid, currentDatabase, currentTable, searchValue, tableFields, indexes, variantPathCache]);
        if (inFlight.current?.key === key) {
            return inFlight.current.promise;
        }

        const candidateFieldNames = (tableFields || [])
            .map((field: any) => {
                const rawName = field?.Field ?? field?.value ?? field?.name;
                const type = String(field?.Type ?? '').toUpperCase();
                if (!rawName) {
                    return null;
                }

                if (!type) {
                    return rawName;
                }

                return /(CHAR|TEXT|STRING|JSON)/.test(type) && !/(VARIANT|DATETIME|DATE|TIME|INT|FLOAT|DOUBLE|DECIMAL)/.test(type) ? rawName : null;
            })
            .filter(Boolean) as string[];

        const implicitExpressions = candidateFieldNames.slice(0, 10).map(name => `coalesce(\`${name}\`, '')`);

        let implicitColumnExpression: string | undefined;
        if (implicitExpressions.length > 0) {
            implicitColumnExpression = implicitExpressions.join(',\n');
        }

        const cacheKey = JSON.stringify([selectdbDS.uid, currentDatabase, currentTable]);
        const cachedPaths = variantPathCache[cacheKey] || {};
        const variantImplicitPaths = Object.entries(cachedPaths).reduce<Record<string, string[][]>>((acc, [root, paths]) => {
            acc[root] = [...paths];
            return acc;
        }, {});
        flattenVariantLeaves(variantFields).forEach(field => {
            const path = field.variantPath || [];
            const root = path[0];
            if (root && path.length > 1 && String(field.Type).toUpperCase().includes('CHAR')) {
                const target = (variantImplicitPaths[root] ||= []);
                const childPath = path.slice(1);
                if (!target.some(existing => JSON.stringify(existing) === JSON.stringify(childPath))) target.push(childPath);
            }
        });
        tableFields.filter((field: any) => String(field?.Type ?? '').toUpperCase().startsWith('VARIANT')).forEach((field: any) => {
            const root = String(field.Field);
            const target = (variantImplicitPaths[root] ||= []);
            topData.forEach((row: any) => {
                let value = row?.[root];
                if (typeof value === 'string') {
                    try { value = JSON.parse(value); } catch { return; }
                }
                collectStringVariantPaths(value).forEach(path => {
                    if (!target.some(existing => JSON.stringify(existing) === JSON.stringify(path))) target.push(path);
                });
            });
        });
        Object.keys(variantImplicitPaths).forEach(root => {
            variantImplicitPaths[root] = variantImplicitPaths[root].slice(0, 200);
        });

        const promise = getWhereSQLViaLucene({
            query: trimmedQuery,
            databaseName: currentDatabase,
            tableName: currentTable,
            connectionId: selectdbDS.uid,
            datasourceType: selectdbDS.type,
            implicitColumnExpression,
            columnMeta: {
                columns: (tableFields || []).map((field: any) => ({
                    name: String(field?.Field ?? field?.value ?? field?.name ?? ''),
                    type: String(field?.Type ?? 'Unknown'),
                })).filter((field: { name: string }) => Boolean(field.name)),
                invertedIndexColumns: (indexes || [])
                    .filter((index: any) => String(index?.type ?? '').toLowerCase().includes('inverted'))
                    .map((index: any) => String(index?.columnName ?? index?.Column_name ?? ''))
                    .filter(Boolean),
            },
            variantImplicitPaths,
        }).finally(() => {
            if (inFlight.current?.key === key) inFlight.current = null;
        });
        inFlight.current = { key, promise };
        return promise;
    }, [currentDatabase, currentTable, searchType, searchValue, selectdbDS, tableFields, indexes, variantFields, variantPathCache, topData]);
}
