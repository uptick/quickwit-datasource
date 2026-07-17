import React from 'react';
import { css } from '@emotion/css';

import {
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  sceneGraph,
} from '@grafana/scenes';
import { Combobox, ComboboxOption, InlineField, MultiCombobox } from '@grafana/ui';
import { getDataSourceSrv } from '@grafana/runtime';
import { getTracesDatasource } from '../../utils/utils.datasource';
import { useFavoriteAttributes } from '../../utils/favorites';
import { BreakdownRows } from './BreakdownRows';
import { DatasourceControl } from './DatasourceControl';
import { ExplorerQueryBar, filterOf } from './ExplorerQueryBar';
import { ExplorerTabs } from './ExplorerTabs';
import { useQuickwitFields, QuickwitDatasource } from './useQuickwitAutocomplete';
import { zoomOutHotkeyBehavior } from './zoomOutBehavior';
import {
  attributeTerm,
  buildLuceneQuery,
  durationPercentilesQuery,
  errorRateQuery,
  percentileSeriesName,
  spanRateQuery,
  valueLucene,
  DEFAULT_FILTER,
} from './queries';

const DEFAULT_ATTRIBUTE = 'service_name';
const MAX_VALUES = 200;

const DEFAULT_PERCENTILES = ['50', '95', '99'];
const PERCENTILE_OPTIONS = ['50', '75', '90', '95', '99', '99.9'];
const PERCENTILE_COLORS: Record<string, string> = {
  '50': 'green',
  '75': 'blue',
  '90': 'orange',
  '95': 'yellow',
  '99': 'red',
  '99.9': 'purple',
};

interface DurationLinesState extends SceneObjectState {
  percents: string[];
}

/** Which duration percentile lines to draw, synced to the `pcts` URL parameter. */
class DurationLines extends SceneObjectBase<DurationLinesState> {
  static Component = DurationLinesRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['pcts'] });

  public getUrlState() {
    const joined = this.state.percents.join(',');
    return { pcts: joined === DEFAULT_PERCENTILES.join(',') ? undefined : joined };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.pcts === 'string') {
      const percents = values.pcts.split(',').filter((p) => PERCENTILE_OPTIONS.includes(p));
      if (percents.length && percents.join(',') !== this.state.percents.join(',')) {
        this.setState({ percents });
      }
    }
  }

  public onChange = (percents: string[]) => {
    const sorted = [...percents].sort((a, b) => Number(a) - Number(b));
    this.setState({ percents: sorted.length ? sorted : DEFAULT_PERCENTILES });
  };
}

function DurationLinesRenderer({ model }: SceneComponentProps<DurationLines>) {
  const { percents } = model.useState();
  return (
    <InlineField label="Duration lines" className={comboFieldStyle}>
      <MultiCombobox
        width={26}
        options={PERCENTILE_OPTIONS.map((p) => ({ label: `p${p}`, value: p }))}
        value={percents}
        onChange={(options) => model.onChange(options.map((o) => o.value!))}
      />
    </InlineField>
  );
}

interface BreakdownAttributeState extends SceneObjectState {
  attribute: string;
}

/** Attribute to break the span stream down by, synced to the `by` URL parameter. */
class BreakdownAttribute extends SceneObjectBase<BreakdownAttributeState> {
  static Component = BreakdownAttributeRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['by'] });

  public getUrlState() {
    return { by: this.state.attribute === DEFAULT_ATTRIBUTE ? undefined : this.state.attribute };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.by === 'string' && values.by && values.by !== this.state.attribute) {
      this.setState({ attribute: values.by });
    }
  }

  public onChange = (attribute: string) => {
    if (attribute && attribute !== this.state.attribute) {
      this.setState({ attribute });
    }
  };
}

function BreakdownAttributeRenderer({ model }: SceneComponentProps<BreakdownAttribute>) {
  const { attribute } = model.useState();
  const timeRange = sceneGraph.getTimeRange(model).useState();
  const { fields } = useQuickwitFields(getTracesDatasource()?.uid, timeRange.value);
  const favorites = useFavoriteAttributes();
  const favoriteSet = new Set(favorites);

  // Favorites (shared with the span explorer's attributes sidebar) come first.
  const options: Array<ComboboxOption<string>> = [
    ...fields.filter((f) => favoriteSet.has(f.text)).map((f) => ({ label: `★ ${f.text}`, value: f.text })),
    ...fields.filter((f) => !favoriteSet.has(f.text)).map((f) => ({ label: f.text, value: f.text })),
  ];
  if (!options.some((o) => o.value === attribute)) {
    options.unshift({ label: attribute, value: attribute });
  }

  return (
    <InlineField label="Break down by" className={comboFieldStyle}>
      <Combobox
        width={30}
        placeholder="Select an attribute"
        options={options}
        value={attribute}
        onChange={(option) => option?.value && model.onChange(option.value)}
      />
    </InlineField>
  );
}

const comboFieldStyle = css`
  margin: 0;
`;

export function breakdownScene() {
  const attribute = new BreakdownAttribute({ attribute: DEFAULT_ATTRIBUTE });
  const queryBar = new ExplorerQueryBar(DEFAULT_FILTER);
  const dsControl = new DatasourceControl();
  const durationLines = new DurationLines({ percents: DEFAULT_PERCENTILES });
  const rows = new BreakdownRows();

  // One row of rate / errors / duration-percentile panels per attribute value.
  rows.buildRow = (value: string) => {
    const datasource = getTracesDatasource();
    const lucene = valueLucene(buildLuceneQuery(filterOf(queryBar.state)), attribute.state.attribute, value);

    const ratePanel = PanelBuilders.timeseries()
      .setTitle('Rate')
      .setDescription(`Span rate for ${attribute.state.attribute} = ${value}`)
      .setData(new SceneQueryRunner({ datasource, queries: [spanRateQuery(lucene)], maxDataPoints: 60 }))
      .setCustomFieldConfig('drawStyle', 'bars' as never)
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setColor({ mode: 'fixed', fixedColor: 'green' })
      .setOption('legend', { showLegend: false } as never)
      .build();

    const errorsPanel = PanelBuilders.timeseries()
      .setTitle('Errors')
      .setDescription(`Error rate for ${attribute.state.attribute} = ${value}`)
      .setData(new SceneQueryRunner({ datasource, queries: [errorRateQuery(lucene)], maxDataPoints: 60 }))
      .setCustomFieldConfig('drawStyle', 'bars' as never)
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setColor({ mode: 'fixed', fixedColor: 'red' })
      .setOption('legend', { showLegend: false } as never)
      .build();

    const percents = durationLines.state.percents;
    const durationBuilder = PanelBuilders.timeseries()
      .setTitle(`Duration ${percents.map((p) => `p${p}`).join('/')}`)
      .setDescription(`Span duration percentiles for ${attribute.state.attribute} = ${value}`)
      .setData(
        new SceneQueryRunner({ datasource, queries: [durationPercentilesQuery(lucene, percents)], maxDataPoints: 60 })
      )
      .setUnit('ms')
      .setCustomFieldConfig('fillOpacity', 8)
      .setOption('legend', { showLegend: false } as never)
      .setOverrides((builder) => {
        for (const percent of percents) {
          const color = PERCENTILE_COLORS[percent];
          if (color) {
            builder
              .matchFieldsWithName(percentileSeriesName(percent))
              .overrideColor({ mode: 'fixed', fixedColor: color });
          }
        }
      });
    const durationPanel = durationBuilder.build();

    return new SceneFlexLayout({
      direction: 'row',
      children: [ratePanel, errorsPanel, durationPanel].map(
        (panel) => new SceneFlexItem({ height: 170, body: panel })
      ),
    });
  };

  // Clicking a row's Filter button narrows the query to that value.
  rows.onAddFilter = (value: string) => {
    const term = attributeTerm(attribute.state.attribute, value);
    const current = queryBar.state.query.trim();
    const query = current && current !== '*' ? `${current} AND ${term}` : term;
    queryBar.onApply({ ...filterOf(queryBar.state), query });
  };

  // Loads the attribute's values for the current time range and rebuilds the rows.
  const reloadValues = async () => {
    const by = attribute.state.attribute;
    const uid = getTracesDatasource()?.uid;
    if (!uid) {
      rows.setValues(by, []);
      return;
    }
    try {
      const datasource = (await getDataSourceSrv().get(uid)) as QuickwitDatasource;
      const timeRange = sceneGraph.getTimeRange(rows).state.value;
      const values = await datasource.getTagValues({ key: by, timeRange });
      rows.setValues(
        by,
        values.map((v) => String(v.text)).slice(0, MAX_VALUES),
        values.length > MAX_VALUES
      );
    } catch {
      rows.setValues(by, []);
    }
  };

  rows.addActivationHandler(() => {
    reloadValues();
  });

  attribute.addActivationHandler(() => {
    const sub = attribute.subscribeToState((newState, prevState) => {
      if (newState.attribute !== prevState.attribute) {
        reloadValues();
      }
    });
    return () => sub.unsubscribe();
  });

  durationLines.addActivationHandler(() => {
    const sub = durationLines.subscribeToState((newState, prevState) => {
      if (newState.percents.join(',') !== prevState.percents.join(',')) {
        rows.rebuild();
      }
    });
    return () => sub.unsubscribe();
  });

  queryBar.addActivationHandler(() => {
    const sub = queryBar.subscribeToState((newState, prevState) => {
      if (buildLuceneQuery(filterOf(newState)) !== buildLuceneQuery(filterOf(prevState))) {
        rows.rebuild();
      }
    });
    return () => sub.unsubscribe();
  });

  dsControl.addActivationHandler(() => {
    const sub = dsControl.subscribeToState(() => {
      reloadValues();
      queryBar.forceRender();
      attribute.forceRender();
    });
    return () => sub.unsubscribe();
  });

  return new EmbeddedScene({
    $behaviors: [zoomOutHotkeyBehavior],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({ ySizing: 'content', body: queryBar }),
        new SceneFlexItem({ ySizing: 'content', body: rows }),
      ],
    }),
    controls: [
      new ExplorerTabs({ active: 'breakdown' }),
      dsControl,
      attribute,
      durationLines,
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
  });
}
