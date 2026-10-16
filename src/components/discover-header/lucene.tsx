import React from 'react';
import DiscoverQueryEditor from './discover-query-editor';

export default function Lucene({ onQuerying }: { onQuerying?: () => void }) {
    return <div style={{ width: '100%' }} title="Attribute values match as whole values. Free-text attribute paths come from sampling; use field:value for a known path."><DiscoverQueryEditor mode="lucene" onQuerying={() => onQuerying?.()} /></div>;
}
