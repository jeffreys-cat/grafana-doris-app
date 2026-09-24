import React from 'react';
import { useAtomValue } from 'jotai';
import { topNConfigAtom, topNResultFieldsAtom, topNRowsAtom } from 'store/discover';

export default function TopNResults() {
    const fields = useAtomValue(topNResultFieldsAtom);
    const rows = useAtomValue(topNRowsAtom);
    const config = useAtomValue(topNConfigAtom);
    return <div className="h-full overflow-auto" data-testid="discover-top-n-results">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
            <strong>{config.direction === 'ASC' ? 'Bottom' : 'Top'} {config.limit}</strong>
            <span>by {config.groupField}</span>
            <span className="text-secondary">{config.metric === 'COUNT' ? 'Count' : `${config.metric}(${config.metricField})`}</span>
        </div>
        <table className="w-full border-collapse text-sm">
            <thead><tr>{fields.map(field => <th key={field.Field} className="sticky top-0 border-b px-3 py-2 text-left">{field.Field}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={index} className="border-b">
                {fields.map(field => <td key={field.Field} className="px-3 py-2">{row[field.Field] == null ? 'NULL' : String(row[field.Field])}</td>)}
            </tr>)}</tbody>
        </table>
        {rows.length === 0 ? <div className="p-4 text-sm">No results</div> : null}
    </div>;
}
