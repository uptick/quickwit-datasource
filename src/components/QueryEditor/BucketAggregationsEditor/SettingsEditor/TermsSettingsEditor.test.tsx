import { screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';

import { ElasticsearchQuery, Terms, Average, Derivative, TopMetrics, Percentiles } from '@/types';

import { TermsSettingsEditor, createOrderByOptions } from './TermsSettingsEditor';
import { describeMetric } from 'utils';
import { renderWithESProvider } from 'test-helpers/render';

describe('Terms Settings Editor', () => {
  it('Pipeline aggregations should not be in "order by" options', async () => {
    const termsAgg: Terms = {
      id: '1',
      type: 'terms',
    };
    const avg: Average = { id: '2', type: 'avg', field: '@value' };
    const derivative: Derivative = { id: '3', field: avg.id, type: 'derivative' };
    const topMetrics: TopMetrics = { id: '4', type: 'top_metrics' };
    const query: ElasticsearchQuery = {
      refId: 'A',
      query: '',
      bucketAggs: [termsAgg],
      metrics: [avg, derivative, topMetrics],
      filters: [],
    };

    renderWithESProvider(<TermsSettingsEditor bucketAgg={termsAgg} />, { providerProps: { query } });

    const selectEl = screen.getByLabelText('Order By');
    expect(selectEl).toBeInTheDocument();

    selectEvent.openMenu(selectEl);

    // Derivative is a pipeline aggregation, it shouldn't be present in the order by options
    expect(screen.queryByText(describeMetric(derivative))).not.toBeInTheDocument();
    // TopMetrics cannot be used as order by option
    expect(screen.queryByText(describeMetric(topMetrics))).not.toBeInTheDocument();
    // All other metric aggregations can be used in order by
    expect(await screen.findByText(describeMetric(avg))).toBeInTheDocument();
  });

  it('Order by option value for a whole-number percentile should not append ".0"', () => {
    // Quickwit's aggregation engine names the percentile sub-aggregation after the
    // percent value exactly as sent in the request (e.g. "95"), unlike Elasticsearch
    // which requires a ".0" suffix for whole-number bucket paths (e.g. "95.0").
    // Sending an orderBy of "1[95.0]" makes Quickwit fail with
    // "could not find aggregation with name 1[95] in metric sub_aggregations".
    const percentiles: Percentiles = { id: '1', type: 'percentiles', field: '@value', settings: { percents: ['95'] } };

    const options = createOrderByOptions([percentiles]);

    expect(options.some((option) => option.value === '1[95]')).toBe(true);
    expect(options.some((option) => option.value === '1[95.0]')).toBe(false);
  });
});
