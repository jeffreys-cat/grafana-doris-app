import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Button, Drawer, Field, Icon, Input, RadioButtonGroup, Select, useTheme2 } from '@grafana/ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { tableFieldsAtom, topNConfigAtom, topNConfigurationFieldAtom, topNEnabledAtom, topNRunRequestAtom } from 'store/discover';
import { getFieldType, isComplexType } from 'utils/data';
import { FieldStatisticsField, TopNAggregation } from 'types/type';
import TopNResults from 'components/discover-content/top-n-results';
import { useTopNData } from './useTopNData';
import { useTopNPreferences } from './useTopNPreferences';

function ConfigurationForm({ field, onClose, preferences }: { field: FieldStatisticsField; onClose: () => void; preferences: ReturnType<typeof useTopNPreferences> }) {
    const theme = useTheme2();
    const fields = useAtomValue(tableFieldsAtom);
    const setConfig = useSetAtom(topNConfigAtom);
    const { config, update } = preferences;
    const setEnabled = useSetAtom(topNEnabledAtom);
    const requestRun = useSetAtom(topNRunRequestAtom);
    const numericFields = fields.filter(item => getFieldType(item.Type) === 'NUMBER' && !isComplexType(item.Type) && !item.variantPath?.length);
    const [invalidLimitText, setInvalidLimitText] = useState<string | null>(null);
    const limitText = invalidLimitText ?? String(config.limit);
    const { metric, direction } = config;
    const metricField = config.metricField || numericFields[0]?.Field || '';
    const setLimitText = (text: string) => {
        const value = Number(text);
        if (text.trim() && Number.isInteger(value) && value >= 1 && value <= 10000) {
            update({ limit: value });
            setInvalidLimitText(null);
        } else {
            setInvalidLimitText(text);
        }
    };
    const fieldStyle = css`
        margin-bottom: 0;
    `;
    const resultState = useTopNData(field.Field);
    const limit = Number(limitText);
    const invalidLimit = !Number.isInteger(limit) || limit < 1 || limit > 10000;
    const invalidMetricField = metric !== 'COUNT' && !numericFields.some(item => item.Field === metricField);
    const unavailableField = !fields.some(item => item.Field === field.Field);

    return (
        <Drawer title={`Top N 统计：${field.Field}`} width="min(640px, calc(100vw - 32px))" onClose={onClose}>
            <div
                data-testid="top-n-sidebar"
                className={css`
                    padding: ${theme.spacing(0, 1, 2)};
                    display: grid;
                    gap: ${theme.spacing(4)};
                `}
            >
                <form
                    onSubmit={event => {
                        event.preventDefault();
                        if (invalidLimit || invalidMetricField || unavailableField) {
                            return;
                        }
                        setConfig({ groupField: field.Field, metric, metricField: metric === 'COUNT' ? '' : metricField, direction, limit });
                        setEnabled(true);
                        requestRun(value => value + 1);
                    }}
                    className={css`
                        display: grid;
                        gap: ${theme.spacing(2.5)};
                    `}
                >
                    <p
                        className={css`
                            margin: 0;
                            color: ${theme.colors.text.secondary};
                            line-height: 1.6;
                        `}
                    >
                        统计当前时间范围与查询条件下的全部匹配记录，按 {field.Field} 分组。
                    </p>
                    <div
                        className={css`
                            display: grid;
                            gap: ${theme.spacing(1.5)};
                        `}
                    >
                        <Field
                            className={fieldStyle}
                            label="返回分组数量（N）"
                            htmlFor="top-n-limit"
                            description="输入 1–10,000 的整数，或选择常用数量。"
                            invalid={invalidLimit}
                            error={invalidLimit ? 'N 必须是 1–10,000 的整数' : undefined}
                        >
                            <Input
                                id="top-n-limit"
                                autoFocus
                                aria-label="返回分组数量（N）"
                                type="number"
                                min={1}
                                max={10000}
                                step={1}
                                value={limitText}
                                onChange={event => setLimitText(event.currentTarget.value)}
                                invalid={invalidLimit}
                            />
                        </Field>
                        <RadioButtonGroup
                            aria-label="常用 Top N 数量"
                            value={invalidLimitText === null ? config.limit : undefined}
                            options={[5, 10, 20, 50, 100].map(value => ({ label: String(value), ariaLabel: `Top ${value}`, value }))}
                            onChange={value => setLimitText(String(value))}
                            fullWidth
                            size="sm"
                        />
                    </div>
                    <Field label="聚合方式" htmlFor="top-n-metric" className={fieldStyle}>
                        <Select
                            inputId="top-n-metric"
                            aria-label="聚合方式"
                            value={metric}
                            options={[
                                { label: '记录数（COUNT）', value: 'COUNT' },
                                { label: '求和（SUM）', value: 'SUM', isDisabled: !numericFields.length },
                                { label: '平均值（AVG）', value: 'AVG', isDisabled: !numericFields.length },
                                { label: '最小值（MIN）', value: 'MIN', isDisabled: !numericFields.length },
                                { label: '最大值（MAX）', value: 'MAX', isDisabled: !numericFields.length },
                            ]}
                            onChange={option => {
                                if (option.value) {
                                    const nextMetric = option.value as TopNAggregation;
                                    update({ metric: nextMetric, metricField: nextMetric === 'COUNT' ? config.metricField : metricField });
                                }
                            }}
                        />
                    </Field>
                    {metric !== 'COUNT' && (
                        <Field
                            label="指标字段"
                            htmlFor="top-n-metric-field"
                            className={fieldStyle}
                            invalid={invalidMetricField}
                            error={invalidMetricField ? '请选择可用的数值字段' : undefined}
                        >
                            <Select
                                inputId="top-n-metric-field"
                                aria-label="指标字段"
                                value={metricField}
                                options={numericFields.map(item => ({ label: item.Field, value: item.Field }))}
                                onChange={option => update({ metricField: option.value || '' })}
                            />
                        </Field>
                    )}
                    <Field label="排序方向" htmlFor="top-n-direction" className={fieldStyle}>
                        <Select
                            inputId="top-n-direction"
                            aria-label="排序方向"
                            value={direction}
                            options={[
                                { label: '从高到低（Top）', value: 'DESC' },
                                { label: '从低到高（Bottom）', value: 'ASC' },
                            ]}
                            onChange={option => {
                                if (option.value === 'ASC' || option.value === 'DESC') {
                                    update({ direction: option.value });
                                }
                            }}
                        />
                    </Field>
                    {unavailableField && <p role="alert">该分组字段已不可用，请关闭配置后重新选择字段。</p>}
                    <div
                        className={css`
                            display: grid;
                            gap: ${theme.spacing(1.5)};
                            border-top: 1px solid ${theme.colors.border.weak};
                            padding-top: ${theme.spacing(2.5)};
                        `}
                    >
                        <div
                            className={css`
                                display: flex;
                                gap: ${theme.spacing(1)};
                            `}
                        >
                            <Button type="submit" icon="play" disabled={invalidLimit || invalidMetricField || unavailableField || resultState.loading}>
                                {resultState.loading ? '统计中…' : '运行聚合'}
                            </Button>
                            <Button type="button" variant="secondary" onClick={onClose}>
                                关闭
                            </Button>
                        </div>
                        <span
                            className={css`
                                display: flex;
                                align-items: center;
                                gap: ${theme.spacing(0.5)};
                                color: ${theme.colors.text.secondary};
                                font-size: ${theme.typography.bodySmall.fontSize};
                            `}
                        >
                            <Icon name="check" size="sm" /> 配置自动保存，刷新后保留
                        </span>
                    </div>
                </form>
                <TopNResults {...resultState} />
            </div>
        </Drawer>
    );
}

export default function TopNConfiguration() {
    const [field, setField] = useAtom(topNConfigurationFieldAtom);
    const preferences = useTopNPreferences(field?.Field || '');
    return field ? <ConfigurationForm key={preferences.key || field.Field} field={field} preferences={preferences} onClose={() => setField(undefined)} /> : null;
}
