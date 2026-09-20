import { CustomSchemaSQLSerializerV2, genWhereSQL, parse } from 'utils/query-parser/query-parser';
import { getDorisMajorVersion } from './metaservice';
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

    // TRY_CAST was introduced in Doris 4.0. Older Doris versions accept CAST
    // but reject TRY_CAST during parsing.
    const dorisMajorVersion = await getDorisMajorVersion({ connectionId, datasourceType });
    const serializer = new CustomSchemaSQLSerializerV2({
        databaseName,
        tableName,
        connectionId,
        implicitColumnExpression,
        datasourceType,
        supportsTryCast: (dorisMajorVersion ?? 0) >= 4,
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
