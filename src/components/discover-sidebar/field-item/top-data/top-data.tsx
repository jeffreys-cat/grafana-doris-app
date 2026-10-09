import { css } from '@emotion/css';
import { Button, IconButton } from '@grafana/ui';
import { Progress } from 'antd';
import { useAtom, useAtomValue } from 'jotai';
import { get } from 'lodash-es';
import { nanoid } from 'nanoid';
import React from 'react';
import { topDataAtom, tableTotalCountAtom, dataFilterAtom, topNConfigAtom, topNEnabledAtom, topNResultFieldsAtom, topNRowsAtom } from 'store/discover';
import { formatFieldDisplayValue, isComplexType } from 'utils/data';
import { getVariantFieldValue } from 'utils/variant-fields';
interface JsonObject {
    [key: string]: any;
}

function normalizeTopDataValue(value: any): string {
    return formatFieldDisplayValue(value, 'compact');
}

function countValueDistribution(jsonArray: JsonObject[], field: any): Array<[any, number]> {
    const valueCountMap = new Map<string, { value: any; count: number }>();

    jsonArray.forEach(obj => {
        const value = field.variantPath?.length ? getVariantFieldValue(obj, field) : get(obj, field.Field);
        // A missing nested key is not a real "-" value and must not be offered
        // as a filter value.
        if (value === undefined || value === null) {
            return;
        }
        const key = JSON.stringify([typeof value, value]);
        const entry = valueCountMap.get(key);
        if (entry) {
            entry.count += 1;
        } else {
            valueCountMap.set(key, { value, count: 1 });
        }
    });

    return Array.from(valueCountMap.values()).map(({ value, count }) => [value, count]);
}

export function TopData({ field, onTopN, canRunTopN = true, onPointerEnter, onPointerLeave }: any) {
    const topData = useAtomValue(topDataAtom);
    const tableTotalCount = useAtomValue(tableTotalCountAtom);
    const topNEnabled = useAtomValue(topNEnabledAtom);
    const topNConfig = useAtomValue(topNConfigAtom);
    const topNFields = useAtomValue(topNResultFieldsAtom);
    const topNRows = useAtomValue(topNRowsAtom);
    const [dataFilter, setDataFilter] = useAtom(dataFilterAtom);
    const topNValueField = topNFields.find(item => item.Field === '__top_n_value')?.Field;
    const hasTopNResult = topNEnabled && topNConfig.groupField === field.Field && Boolean(topNValueField);
    const res: Array<[any, number]> = hasTopNResult
        ? topNRows.map(row => [field.variantPath?.length ? getVariantFieldValue(row, field) : row[field.Field], Number(row[topNValueField!] || 0)])
        : countValueDistribution(topData, field).sort((a, b) => b[1] - a[1]);
    // COUNT results are percentages of every matching record, rather than only
    // the returned Top N groups. Other aggregation metrics display their value.
    const showRecordPercentage = !hasTopNResult || topNConfig.metric === 'COUNT';
    const resultTotal = showRecordPercentage ? tableTotalCount : topData.length;
    const itemCount = hasTopNResult ? `${topNRows.length} groups from all matches` : `${Math.min(500, tableTotalCount)} Items`;

    return (
        <div
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            className={css`
                width: 300px;
                max-width: min(300px, calc(100vw - 24px));
                box-sizing: border-box;
                max-height: 400px;
                overflow-y: auto;
                padding: 8px;
            `}
        >
            <div className="mb-2 mt-2 break-words text-xs text-n5">
                <span className="mr-2">{field.Field}</span>
                <span>({field.Type})</span>
            </div>
            <div
                className={css`
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                `}
            >
                {canRunTopN && (
                    <Button size="sm" variant="secondary" onClick={() => onTopN?.(field)}>
                        Top {hasTopNResult ? topNConfig.limit : 5}
                    </Button>
                )}
                <small className="text-n2">{itemCount}</small>
            </div>
            <div className="mt-3 space-y-3 text-n5">
                {res.map(
                    ([rawValue, count], index) => {
                        const value = normalizeTopDataValue(rawValue);
                        const canFilterValue = rawValue !== undefined && rawValue !== null && value !== '-';
                        return (
                            index < (hasTopNResult ? topNConfig.limit : 5) && (
                                <div key={index} className="flex items-center justify-between">
                                <div
                                    className={css`
                                        overflow: hidden;
                                        text-overflow: ellipsis;
                                        white-space: nowrap;
                                    `}
                                >
                                    <div
                                        className={css`
                                            display: flex;
                                            align-items: center;
                                            width: 180px;
                                            justify-content: space-between;
                                        `}
                                    >
                                        <div
                                            className={css`
                                                flex: 1 1 0%;
                                                overflow: hidden;
                                                text-overflow: ellipsis;
                                                white-space: nowrap;
                                            `}
                                        >
                                            {value}
                                        </div>
                                        <div
                                            className={css`
                                                margin-left: 20px;
                                                flex-shrink: 0;
                                            `}
                                        >
                                            {showRecordPercentage
                                                ? `${resultTotal ? +((count * 100) / resultTotal).toFixed(1) : 0}%`
                                                : count}
                                        </div>
                                    </div>
                                    <Progress
                                        size={4}
                                        className={css`
                                            .ant-progress-outer {
                                                .ant-progress-inner {
                                                    position: absolute;
                                                    top: 0px;
                                                }
                                            }
                                        `}
                                        style={{ width: '100%', height: '0px' }}
                                        percent={showRecordPercentage && resultTotal ? +((count * 100) / resultTotal).toFixed(1) : 0}
                                        status="normal"
                                        showInfo={false}
                                    />
                                </div>
                                {!isComplexType(field.Type) && canFilterValue && (
                                    <div
                                        className={css`
                                            margin-left: 30px;
                                        `}
                                    >
                                        <IconButton
                                            name="plus-circle"
                                            onClick={e => {
                                                setDataFilter([
                                                    ...dataFilter,
                                                    {
                                                        fieldName: field.Field,
                                                        variantPath: field.variantPath,
                                                        variantRootType: field.variantRootType,
                                                        fieldType: field.Type,
                                                        operator: '=',
                                                        value: [rawValue],
                                                        id: nanoid(),
                                                    },
                                                ]);
                                                e.stopPropagation();
                                            }}
                                            tooltip="Equivalent filtration"
                                        />
                                        <IconButton
                                            name="minus-circle"
                                            style={{ marginLeft: '4px' }}
                                            tooltip="Nonequivalent filtration"
                                            onClick={e => {
                                                setDataFilter([
                                                    ...dataFilter,
                                                    {
                                                        fieldName: field.Field,
                                                        variantPath: field.variantPath,
                                                        variantRootType: field.variantRootType,
                                                        fieldType: field.Type,
                                                        operator: '!=',
                                                        value: [rawValue],
                                                        id: nanoid(),
                                                    },
                                                ]);
                                                e.stopPropagation();
                                            }}
                                        />
                                    </div>
                                )}
                                </div>
                            )
                        );
                    },
                )}
            </div>
        </div>
    );
}
