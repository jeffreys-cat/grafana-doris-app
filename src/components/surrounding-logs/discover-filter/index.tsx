import React from 'react';
import { DiscoverFilterWrapper } from 'components/discover-filter/discover-filter.style';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { dataFilterAtom, tableFieldsAtom, variantFieldsAtom } from 'store/discover';
import { getFilterSQL } from 'utils/data';
import { enrichStructuredFilterTypes } from 'utils/sql-filter';
import { flattenVariantLeaves } from 'utils/variant-fields';
import { css } from '@emotion/css';
import { Badge, useTheme2 } from '@grafana/ui';

/** A read-only projection of the filters that constrain the surrounding query. */
export default function SurroundingDiscoverFilter() {
    const dataFilter = useAtomValue(dataFilterAtom);
    const tableFields = useAtomValue(tableFieldsAtom);
    const variantFields = useAtomValue(variantFieldsAtom);
    const { t } = useTranslation();
    const theme = useTheme2();

    return (
        <DiscoverFilterWrapper
            className={css`
                background-color: ${theme.isDark ? 'rgb(24, 27, 31)' : '#FFF'};
                padding: 1rem;
                padding-bottom: 1.5rem;
                margin-top: 1px;
                border-radius: 0 0 0.25rem 0.25rem;
            `}
        >
            <div className="text-xs font-medium">{t`Filter`}</div>
            <div className="filter-tag">
                {dataFilter.map((dataFilterValue, index) => {
                    const displayFilter = enrichStructuredFilterTypes(
                        [dataFilterValue],
                        [...tableFields, ...flattenVariantLeaves(variantFields)],
                    )[0];
                    return (
                        <div
                            key={index.toString()}
                            className={css`
                                margin-left: 8px;
                            `}
                        >
                            <Badge
                                key={index}
                                text={dataFilterValue.label || getFilterSQL(displayFilter)}
                                color="blue"
                            />
                        </div>
                    );
                })}
            </div>
        </DiscoverFilterWrapper>
    );
}
