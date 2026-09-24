import { css } from '@emotion/css';
import { Button, IconButton } from '@grafana/ui';
import { Progress } from 'antd';
import { useAtom, useAtomValue } from 'jotai';
import { get } from 'lodash-es';
import { nanoid } from 'nanoid';
import React from 'react';
import { topDataAtom, tableTotalCountAtom, dataFilterAtom, topNConfigAtom, topNEnabledAtom, topNResultFieldsAtom, topNRowsAtom } from 'store/discover';
import { formatFieldDisplayValue, isComplexType } from 'utils/data';
interface JsonObject {
    [key: string]: any;
}

function normalizeTopDataValue(value: any): string {
    return formatFieldDisplayValue(value, 'compact');
}

function countValueDistribution(jsonArray: JsonObject[], key: string): { [value: string]: number } {
    const valueCountMap = new Map<string, number>();

    jsonArray.forEach(obj => {
        const value = normalizeTopDataValue(get(obj, key));
        valueCountMap.set(value, (valueCountMap.get(value) || 0) + 1);
    });

    const result: { [value: string]: number } = {};
    valueCountMap.forEach((times, valueStr) => {
        const value = valueStr;
        result[value] = times;
    });

    return result;
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
    const res: Array<[string, number]> = hasTopNResult
        ? topNRows.map(row => [normalizeTopDataValue(row[field.Field]), Number(row[topNValueField!] || 0)])
        : (Object.entries(countValueDistribution(topData, field.Field)).sort(
            (a: any, b: any) => b[1] - a[1]
          ) as Array<[string, number]>);
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
                    ([value, count], index) =>
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
                                {!isComplexType(field.Type) && (
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
                                                        operator: '=',
                                                        value: [typeof value === 'string' ? value : +value],
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
                                                        operator: '!=',
                                                        value: [typeof value ? value : +value],
                                                        id: nanoid(),
                                                    },
                                                ]);
                                                e.stopPropagation();
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ),
                )}
            </div>
        </div>
    );
}
