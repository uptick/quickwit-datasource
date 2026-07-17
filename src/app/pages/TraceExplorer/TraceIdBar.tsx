import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Button, InlineField, Input, useStyles2 } from '@grafana/ui';

export interface TraceIdBarState extends SceneObjectState {
  traceId: string;
}

/**
 * Trace ID lookup input, synced to the `traceId` URL parameter so the explorer
 * table (and external tools) can deep-link straight to a trace.
 */
export class TraceIdBar extends SceneObjectBase<TraceIdBarState> {
  static Component = TraceIdBarRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['traceId'] });

  public getUrlState() {
    return { traceId: this.state.traceId || undefined };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.traceId === 'string' && values.traceId !== this.state.traceId) {
      this.setState({ traceId: values.traceId });
    }
  }

  public onLookup = (traceId: string) => {
    this.setState({ traceId: traceId.trim() });
  };
}

function TraceIdBarRenderer({ model }: SceneComponentProps<TraceIdBar>) {
  const { traceId } = model.useState();
  const styles = useStyles2(getStyles);
  const [draft, setDraft] = React.useState(traceId);
  const [prevTraceId, setPrevTraceId] = React.useState(traceId);

  // Reflect external updates (URL navigation) into the local draft.
  if (prevTraceId !== traceId) {
    setPrevTraceId(traceId);
    setDraft(traceId);
  }

  const apply = () => model.onLookup(draft);

  return (
    <div className={styles.wrapper}>
      <InlineField label="Trace ID" grow className={styles.field}>
        <Input
          className={styles.monoInput}
          placeholder="Paste a trace ID, or click one in the span explorer"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          spellCheck={false}
        />
      </InlineField>
      <Button onClick={apply}>Open trace</Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    align-items: flex-start;
    gap: ${theme.spacing(1)};
    width: 100%;
  `,
  field: css`
    flex: 1;
    margin: 0;
  `,
  monoInput: css`
    input {
      font-family: ${theme.typography.fontFamilyMonospace};
    }
  `,
});
