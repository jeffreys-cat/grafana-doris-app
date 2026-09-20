import { of, throwError } from 'rxjs';

jest.mock('@grafana/runtime', () => {
    const backendSrv = { fetch: jest.fn() };
    return { getBackendSrv: jest.fn(() => backendSrv), logError: jest.fn() };
});

jest.mock('components/with-error-handler/withErrorHandler', () => ({
    withErrorHandler: jest.fn(response => response),
}));

import { getBackendSrv } from '@grafana/runtime';
import { supportsTryCast } from '../metaservice';

describe('supportsTryCast', () => {
    const fetch = getBackendSrv().fetch as jest.Mock;

    beforeEach(() => {
        fetch.mockReset();
    });

    it('detects TRY_CAST support once per datasource and caches the result', async () => {
        fetch.mockReturnValue(of({
            ok: true,
            data: { results: { probeTryCast: { frames: [{}] } } },
        }));

        await expect(supportsTryCast({ connectionId: 'doris-4', datasourceType: 'velodb-doris-datasource' })).resolves.toBe(true);
        await expect(supportsTryCast({ connectionId: 'doris-4', datasourceType: 'velodb-doris-datasource' })).resolves.toBe(true);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                queries: [expect.objectContaining({
                    refId: 'probeTryCast',
                    rawSql: 'SELECT TRY_CAST(1 AS BIGINT) AS try_cast_supported',
                })],
            }),
        }));
    });

    it('falls back to CAST when the probe query fails', async () => {
        fetch.mockReturnValue(throwError(() => new Error('TRY_CAST is not supported')));

        await expect(supportsTryCast({ connectionId: 'doris-3', datasourceType: 'velodb-doris-datasource' })).resolves.toBe(false);
    });
});
