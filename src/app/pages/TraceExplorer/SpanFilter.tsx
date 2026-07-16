import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Icon, Input, Tag, useStyles2 } from '@grafana/ui';

export interface LogsFilterState extends SceneObjectState {
  /** Restrict log lines to one span of the trace. */
  spanId: string;
  /** Free-text search within the trace's log lines. */
  text: string;
}

/** Filters applied to the trace logs panel, synced to `spanId` / `logq` URL parameters. */
export class LogsFilter extends SceneObjectBase<LogsFilterState> {
  static Component = () => null;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['spanId', 'logq'] });

  public getUrlState() {
    return { spanId: this.state.spanId || undefined, logq: this.state.text || undefined };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const update: Partial<LogsFilterState> = {};
    if (typeof values.spanId === 'string' && values.spanId !== this.state.spanId) {
      update.spanId = values.spanId;
    }
    if (typeof values.logq === 'string' && values.logq !== this.state.text) {
      update.text = values.logq;
    }
    if (Object.keys(update).length > 0) {
      this.setState(update);
    }
  }

  public onChangeSpan = (spanId: string) => {
    if (spanId !== this.state.spanId) {
      this.setState({ spanId });
    }
  };

  public onChangeText = (text: string) => {
    if (text !== this.state.text) {
      this.setState({ text });
    }
  };

  public clear = () => {
    this.setState({ spanId: '', text: '' });
  };
}

/** Logs panel header controls: text search plus the active span filter chip. */
export function LogsFilterControls({ controller }: { controller: LogsFilter }) {
  const { spanId, text } = controller.useState();
  const styles = useStyles2(getStyles);
  const [draft, setDraft] = React.useState(text);
  const [prevText, setPrevText] = React.useState(text);

  // Reflect external updates (URL navigation, clear) into the local draft.
  if (prevText !== text) {
    setPrevText(text);
    setDraft(text);
  }

  return (
    <div className={styles.wrapper}>
      {spanId && (
        <Tag
          name={`span: ${spanId} ✕`}
          colorIndex={9}
          title="Showing logs for this span only — click to clear"
          onClick={() => controller.onChangeSpan('')}
        />
      )}
      <Input
        className={styles.search}
        width={26}
        prefix={<Icon name="search" />}
        placeholder="Filter logs… (Enter)"
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && controller.onChangeText(draft.trim())}
        onBlur={() => controller.onChangeText(draft.trim())}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
  search: css`
    input {
      font-family: ${theme.typography.fontFamilyMonospace};
    }
  `,
});
