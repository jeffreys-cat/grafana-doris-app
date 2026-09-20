import { CustomSchemaSQLSerializerV2, genWhereSQL, parse } from 'utils/query-parser/query-parser';
import { supportsTryCast } from './metaservice';
import { logError } from '@grafana/runtime';
import { toError } from 'utils/errors';

type GetWhereSQLParams = {
    query: string;
    databaseName: string;
    tableName: string;
    connectionId: string;
    implicitColumnExpression?: string;
    datasourceType?: string;
};

export async function getWhereSQLViaLucene({ query, databaseName, tableName, connectionId, implicitColumnExpression, datasourceType }: GetWhereSQLParams): Promise<string> {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
        return '';
    }

    // Probe the actual SQL capability. VERSION() is always 5.7.99 in Doris for
    // MySQL compatibility and cannot identify the Doris release.
    const tryCastSupported = await supportsTryCast({ connectionId, datasourceType });
    const serializer = new CustomSchemaSQLSerializerV2({
        databaseName,
        tableName,
        connectionId,
        implicitColumnExpression,
        datasourceType,
        supportsTryCast: tryCastSupported,
    });

    try {
        const ast = parse(trimmedQuery);
        const whereSQL =  await genWhereSQL(ast, serializer);
        return whereSQL;
    } catch (error) {
        logError(toError(error), { source: 'lucene', action: 'getWhereSQLViaLucene' });
        throw error;
    }
}
