import React from 'react';
import DiscoverQueryEditor from './discover-query-editor';

export default function Lucene({ onQuerying }: { onQuerying?: () => void }) {
    return <DiscoverQueryEditor mode="lucene" onQuerying={() => onQuerying?.()} />;
}
