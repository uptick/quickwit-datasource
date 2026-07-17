import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { Drawer, LinkButton, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { PLUGIN_BASE_URL, ROUTES } from '../../constants';
import { getLogsDatasource, getTracesDatasource } from '../../utils/utils.datasource';
import { LogsFilter, LogsFilterControls } from './SpanFilter';
import { SpanLogsLink } from './SpanLogsLink';
import { traceLogsQuery, traceLookupQuery } from './queries';

type PeekTab = 'waterfall' | 'logs';

export interface TracePeekDrawerState extends SceneObjectState {
  traceId: string;
  activeTab: PeekTab;
  /** Span restriction (waterfall log icons) and free-text search for the logs tab. */
  logsFilter: LogsFilter;
  waterfall: SpanLogsLink;
  logsPanel: VizPanel;
}

/**
 * Right-hand drawer showing a trace without leaving the explorer, with two
 * tabs: the waterfall and the trace's correlated logs. Clicking a span's log
 * icon in the waterfall switches to the logs tab filtered to that span.
 * Opened by the "Peek trace" data link on the traces table (URL `peek=`).
 */
export class TracePeekDrawer extends SceneObjectBase<TracePeekDrawerState> {
  static Component = TracePeekDrawerRenderer;

  private _traceRunner: SceneQueryRunner;
  private _logsRunner: SceneQueryRunner;
  /** Suppresses the filter subscription while setTraceId resets the filters itself. */
  private _resettingFilter = false;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['peek', 'peekTab'] });

  public constructor() {
    const traceRunner = new SceneQueryRunner({
      datasource: getTracesDatasource(),
      queries: [traceLookupQuery('')],
    });
    const logsRunner = new SceneQueryRunner({
      datasource: getLogsDatasource(),
      queries: [traceLogsQuery('')],
    });

    const waterfallPanel = PanelBuilders.traces().setTitle('Waterfall').setData(traceRunner).build();
    const waterfall = new SpanLogsLink({ panel: waterfallPanel });

    const logsFilter = new LogsFilter({ spanId: '', text: '' });

    const logsPanel = PanelBuilders.logs()
      .setTitle('Trace logs')
      .setData(logsRunner)
      .setOption('showTime', true)
      .setOption('wrapLogMessage', true)
      .setOption('enableLogDetails', true)
      .build();

    super({ traceId: '', activeTab: 'waterfall', logsFilter, waterfall, logsPanel });

    this._traceRunner = traceRunner;
    this._logsRunner = logsRunner;
    waterfall.onSelectSpan = this.onSelectSpan;

    this.addActivationHandler(() => {
      const sub = logsFilter.subscribeToState((newState, prevState) => {
        if (
          !this._resettingFilter &&
          (newState.spanId !== prevState.spanId || newState.text !== prevState.text)
        ) {
          this.applyLogsQuery(this.state.traceId, newState.spanId, newState.text);
        }
      });
      return () => sub.unsubscribe();
    });
  }

  public getUrlState() {
    return {
      peek: this.state.traceId || undefined,
      peekTab: this.state.traceId && this.state.activeTab === 'logs' ? 'logs' : undefined,
    };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.peek === 'string' && values.peek !== this.state.traceId) {
      this.setTraceId(values.peek);
    }
    if (this.state.traceId && values.peekTab !== undefined) {
      this.setState({ activeTab: values.peekTab === 'logs' ? 'logs' : 'waterfall' });
    }
  }

  public onClose = () => {
    this.setTraceId('');
  };

  public onChangeTab = (tab: PeekTab) => {
    this.setState({ activeTab: tab });
  };

  public onSelectSpan = (spanId: string) => {
    this.setState({ activeTab: 'logs' });
    // The filter subscription re-runs the logs query.
    this.state.logsFilter.onChangeSpan(spanId);
  };

  public refreshDatasource() {
    this._traceRunner.setState({ datasource: getTracesDatasource() });
    this._logsRunner.setState({ datasource: getLogsDatasource() });
    if (this.state.traceId) {
      this._traceRunner.runQueries();
      this._logsRunner.runQueries();
    }
  }

  private setTraceId(traceId: string) {
    const prevTraceId = this.state.traceId;
    this.setState({ traceId, activeTab: 'waterfall' });
    if (prevTraceId && traceId !== prevTraceId) {
      // Closing or switching traces invalidates the log filters. On the initial
      // deep-linked open (prevTraceId empty) the filters may already hold
      // URL-restored values, so leave them alone.
      this._resettingFilter = true;
      this.state.logsFilter.clear();
      this._resettingFilter = false;
    }
    if (traceId) {
      // Always re-run: the runners keep the previous trace's data while the
      // drawer is closed (panels unmounted), and scenes would otherwise show
      // that stale result when the drawer re-opens for a different trace.
      this._traceRunner.setState({ queries: [traceLookupQuery(traceId)] });
      this._traceRunner.runQueries();
      const { spanId, text } = this.state.logsFilter.state;
      this.applyLogsQuery(traceId, spanId, text);
    }
  }

  private applyLogsQuery(traceId: string, spanId: string, text: string) {
    this._logsRunner.setState({ queries: [traceLogsQuery(traceId, spanId, text)] });
    if (traceId) {
      this._logsRunner.runQueries();
    }
  }
}

function TracePeekDrawerRenderer({ model }: SceneComponentProps<TracePeekDrawer>) {
  const { traceId, activeTab, logsFilter, waterfall, logsPanel } = model.useState();
  const styles = useStyles2(getStyles);

  if (!traceId) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  params.delete('peek');
  params.set('traceId', traceId);

  return (
    <Drawer
      title={`Trace ${traceId}`}
      size="lg"
      onClose={model.onClose}
      subtitle={
        <LinkButton
          size="sm"
          variant="secondary"
          icon="external-link-alt"
          href={`${PLUGIN_BASE_URL}/${ROUTES.Trace}?${params.toString()}`}
        >
          Open full view
        </LinkButton>
      }
      tabs={
        <TabsBar>
          <Tab
            label="Waterfall"
            active={activeTab === 'waterfall'}
            onChangeTab={() => model.onChangeTab('waterfall')}
          />
          <Tab label="Logs" active={activeTab === 'logs'} onChangeTab={() => model.onChangeTab('logs')} />
        </TabsBar>
      }
    >
      {/* The waterfall stays mounted on the logs tab so span expansion state survives tab switches. */}
      <div className={activeTab === 'waterfall' ? styles.tabContent : styles.hidden}>
        <waterfall.Component model={waterfall} />
      </div>
      {activeTab === 'logs' && (
        <div className={styles.tabContent}>
          <div className={styles.filterRow}>
            <LogsFilterControls controller={logsFilter} />
          </div>
          <div className={styles.panel}>
            <logsPanel.Component model={logsPanel} />
          </div>
        </div>
      )}
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    height: 100%;
  `,
  hidden: css`
    display: none;
  `,
  filterRow: css`
    flex: 0 0 auto;
  `,
  panel: css`
    flex: 1;
    min-height: 0;
  `,
});
