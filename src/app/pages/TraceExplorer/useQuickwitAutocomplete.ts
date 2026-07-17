import { useCallback, useEffect, useState } from 'react';
import { DataSourceApi, MetricFindValue, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Suggestion } from '@/components/LuceneQueryEditor';

// Quickwit datasource instance methods used for autocomplete. Same contract as
// the datasource's own query editor (datasource/utils.ts useDatasourceFields).
export type QuickwitDatasource = DataSourceApi & {
  getTagKeys: (options: { searchable: boolean; timeRange: TimeRange }) => Promise<MetricFindValue[]>;
  getTagValues: (options: { key: string; timeRange: TimeRange }) => Promise<MetricFindValue[]>;
};

/** Resolves the datasource instance and its searchable fields for a time range. */
export function useQuickwitFields(datasourceUid: string | undefined, range: TimeRange) {
  const [datasource, setDatasource] = useState<QuickwitDatasource>();
  const [fields, setFields] = useState<MetricFindValue[]>([]);

  useEffect(() => {
    if (!datasourceUid) {
      return;
    }
    getDataSourceSrv()
      .get(datasourceUid)
      .then((ds) => setDatasource(ds as QuickwitDatasource))
      .catch(() => setDatasource(undefined));
  }, [datasourceUid]);

  // Refresh the field list at minute granularity, like the datasource editor.
  const fromMinute = range.from.startOf('minute').valueOf();
  const toMinute = range.to.startOf('minute').valueOf();

  useEffect(() => {
    if (!datasource?.getTagKeys) {
      return;
    }
    datasource
      .getTagKeys({ searchable: true, timeRange: range })
      .then(setFields)
      .catch(() => setFields([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasource, fromMinute, toMinute]);

  return { datasource, fields };
}

export function useQuickwitAutocomplete(datasourceUid: string | undefined, range: TimeRange) {
  const { datasource, fields } = useQuickwitFields(datasourceUid, range);

  const getSuggestions = useCallback(
    async (word: string): Promise<Suggestion> => {
      let suggestions: Suggestion = { from: 0, options: [] };
      if (!datasource) {
        return suggestions;
      }

      const wordIsField = word.match(/([^:\s]+):"?([^"\s]*)"?/);
      if (wordIsField?.length) {
        const [, fieldName] = wordIsField;
        const candidateValues = await datasource.getTagValues({ key: fieldName, timeRange: range });
        suggestions.from = fieldName.length + 1; // Replace only the value part
        suggestions.options = candidateValues.map((v) => ({
          type: 'text',
          label: typeof v.text === 'number' ? `${v.text}` : `"${v.text}"`,
        }));
      } else {
        suggestions.from = 0;
        suggestions.options = fields.map((f) => ({
          type: 'variable',
          label: f.text,
          detail: f.value !== undefined ? `${f.value}` : '',
        }));
      }
      return suggestions;
    },
    [datasource, fields, range]
  );

  return { getSuggestions };
}
