import { DataSourceWithBackend } from '@grafana/runtime';
import type { DorisQuery, DorisSSOJsonData } from './types';

export class DataSource extends DataSourceWithBackend<DorisQuery, DorisSSOJsonData> {}
