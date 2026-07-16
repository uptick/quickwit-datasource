import React from 'react';
import { css } from '@emotion/css';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

export interface SpanLogsLinkState extends SceneObjectState {
  panel: VizPanel;
}

/**
 * Wraps the trace waterfall panel and intercepts the per-span "Logs for span"
 * links the datasource generates (which normally jump to Explore): clicking
 * one instead filters the in-app trace logs panel to that span.
 */
export class SpanLogsLink extends SceneObjectBase<SpanLogsLinkState> {
  static Component = SpanLogsLinkRenderer;

  /** Assigned by the scene that owns the logs query. */
  public onSelectSpan?: (spanId: string) => void;
}

function SpanLogsLinkRenderer({ model }: SceneComponentProps<SpanLogsLink>) {
  const { panel } = model.useState();

  const onClickCapture = (event: React.MouseEvent) => {
    const anchor = (event.target as HTMLElement).closest?.('a');
    if (!anchor || !anchor.href.includes('/explore?')) {
      return;
    }
    const match = decodeURIComponent(anchor.href).match(/span_id:([0-9a-fA-F]+)/);
    if (!match) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    model.onSelectSpan?.(match[1]);
  };

  return (
    <div
      className={css`
        width: 100%;
        height: 100%;
      `}
      onClickCapture={onClickCapture}
    >
      <panel.Component model={panel} />
    </div>
  );
}
