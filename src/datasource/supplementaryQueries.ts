import {
  DataQueryRequest,
  DataSourceWithSupplementaryQueriesSupport,
  SupplementaryQueryType,
} from '@grafana/data';
import { cloneDeep } from "lodash";
import { BucketAggregation, ElasticsearchQuery } from '@/types';
import { BaseQuickwitDataSourceConstructor } from './base';

export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
export const REF_ID_STARTER_LOG_SAMPLE = 'log-sample-';

const DEFAULT_LOG_SAMPLE_LIMIT = 50;

// Metric types whose queries already return documents — a log sample adds nothing.
const DOCUMENT_METRIC_TYPES = ['logs', 'raw_data', 'raw_document', 'trace_search', 'traces'];

export function withSupplementaryQueries<T extends BaseQuickwitDataSourceConstructor> ( Base: T ){
  return class DSWithSupplementaryQueries extends Base implements DataSourceWithSupplementaryQueriesSupport<ElasticsearchQuery> {

  /**
   * Returns a DataQueryRequest for the supplementary query type.
   * Grafana's Explore layer handles the Observable lifecycle.
   */
  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<ElasticsearchQuery>
  ): DataQueryRequest<ElasticsearchQuery> | undefined {
    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return this.getLogsVolumeRequest(request);
      case SupplementaryQueryType.LogsSample:
        return this.getLogsSampleRequest(request);
      default:
        return undefined;
    }
  }

  /**
   * Returns supplementary query types that data source supports.
   */
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume, SupplementaryQueryType.LogsSample];
  }

  /**
   * Returns a supplementary query to be used to fetch supplementary data based on the provided type and original query.
   * If provided query is not suitable for provided supplementary query type, undefined should be returned.
   */
  getSupplementaryQuery(options: { type: SupplementaryQueryType; limit?: number }, query: ElasticsearchQuery): ElasticsearchQuery | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(options.type)) {
      return undefined;
    }

    switch (options.type) {
      case SupplementaryQueryType.LogsVolume: {
        // it has to be a logs-producing range-query
        const isQuerySuitable = !!(query.metrics?.length === 1 && query.metrics[0].type === 'logs');
        if (!isQuerySuitable) {
          return undefined;
        }
        const bucketAggs: BucketAggregation[] = [];
        const timeField = this.timeField ?? 'timestamp';

        if (this.logLevelField) {
          bucketAggs.push({
            id: '2',
            type: 'terms',
            settings: {
              min_doc_count: '0',
              size: '0',
              order: 'desc',
              orderBy: '_count',
            },
            field: this.logLevelField,
          });
        }
        bucketAggs.push({
          id: '3',
          type: 'date_histogram',
          settings: {
            interval: 'auto',
            min_doc_count: '0',
            trimEdges: '0',
          },
          field: timeField,
        });

        return {
          refId: `${REF_ID_STARTER_LOG_VOLUME}${query.refId}`,
          query: query.query,
          metrics: [{ type: 'count', id: '1' }],
          bucketAggs,
          filters: query.filters,
        };
      }

      case SupplementaryQueryType.LogsSample: {
        // Only aggregation (metric) queries get a sample of their underlying documents.
        const firstMetricType = query.metrics?.[0]?.type;
        const isQuerySuitable = !!(
          query.metrics?.length &&
          firstMetricType &&
          !DOCUMENT_METRIC_TYPES.includes(firstMetricType) &&
          query.bucketAggs?.some((agg) => agg.type === 'date_histogram')
        );
        if (!isQuerySuitable) {
          return undefined;
        }

        return {
          refId: `${REF_ID_STARTER_LOG_SAMPLE}${query.refId}`,
          query: query.query,
          metrics: [
            { type: 'logs', id: '1', settings: { limit: String(options.limit ?? DEFAULT_LOG_SAMPLE_LIMIT) } },
          ],
          filters: query.filters,
        };
      }

      default:
        return undefined;
    }
  }

  private getLogsVolumeRequest(
    request: DataQueryRequest<ElasticsearchQuery>
  ): DataQueryRequest<ElasticsearchQuery> | undefined {
    const logsVolumeRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((target) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, target))
      .filter((query): query is ElasticsearchQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    return { ...logsVolumeRequest, targets };
  }

  private getLogsSampleRequest(
    request: DataQueryRequest<ElasticsearchQuery>
  ): DataQueryRequest<ElasticsearchQuery> | undefined {
    const logsSampleRequest = cloneDeep(request);
    const targets = logsSampleRequest.targets
      .map((target) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample }, target))
      .filter((query): query is ElasticsearchQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    return { ...logsSampleRequest, targets };
  }
  };
}
