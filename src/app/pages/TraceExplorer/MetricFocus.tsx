import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, SceneObjectState, SceneObjectUrlSyncConfig, SceneObjectUrlValues } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

export type MetricKey = 'duration' | 'spans' | 'errors';

export const METRIC_KEYS: MetricKey[] = ['duration', 'spans', 'errors'];

export interface MetricFocusState extends SceneObjectState {
  metric: MetricKey;
}

/**
 * Tracks which metric panel (duration heatmap, span rate, error rate) is
 * focused — i.e. rendered large, with the other two stacked beside it.
 * Synced to the `metric` URL parameter.
 */
export class MetricFocus extends SceneObjectBase<MetricFocusState> {
  static Component = () => null;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metric'] });

  public getUrlState() {
    return { metric: this.state.metric === 'duration' ? undefined : this.state.metric };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const metric = values.metric;
    if (typeof metric === 'string' && METRIC_KEYS.includes(metric as MetricKey)) {
      this.setState({ metric: metric as MetricKey });
    }
  }

  public onFocus = (metric: MetricKey) => {
    if (metric !== this.state.metric) {
      this.setState({ metric });
    }
  };
}

/** Radio dot rendered in each metric panel's header to focus that panel. */
export function FocusRadio({ controller, metric }: { controller: MetricFocus; metric: MetricKey }) {
  const { metric: active } = controller.useState();
  const styles = useStyles2(getStyles);
  return (
    <input
      type="radio"
      className={styles.radio}
      name="qw-metric-focus"
      title="Focus this metric"
      aria-label={`Focus ${metric}`}
      checked={active === metric}
      onChange={() => controller.onFocus(metric)}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  radio: css`
    cursor: pointer;
    width: 14px;
    height: 14px;
    margin: ${theme.spacing(0.5)};
    accent-color: ${theme.colors.primary.main};
  `,
});
