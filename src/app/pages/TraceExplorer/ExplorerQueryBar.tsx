import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneComponentProps,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Button, FilterPill, Input, useStyles2 } from '@grafana/ui';
import { getTracesDatasource } from '../../utils/utils.datasource';
import { LuceneQueryEditor } from '@/components/LuceneQueryEditor';
import { useQuickwitAutocomplete } from './useQuickwitAutocomplete';
import { ExplorerFilter } from './queries';

export interface ExplorerQueryBarState extends SceneObjectState, ExplorerFilter {
  /** Optional extra control rendered after the filter chips (e.g. the Slowest pill). */
  trailing?: SceneObject;
}

export function filterOf(state: ExplorerQueryBarState): ExplorerFilter {
  return {
    query: state.query,
    durationMin: state.durationMin,
    durationMax: state.durationMax,
    errorsOnly: state.errorsOnly,
    rootOnly: state.rootOnly,
  };
}

export function filtersEqual(a: ExplorerFilter, b: ExplorerFilter): boolean {
  return (
    a.query === b.query &&
    a.durationMin === b.durationMin &&
    a.durationMax === b.durationMax &&
    a.errorsOnly === b.errorsOnly &&
    a.rootOnly === b.rootOnly
  );
}

/**
 * The explorer's filter bar: the datasource's CodeMirror Lucene editor
 * (autocomplete via Ctrl-Enter, run via Shift-Enter), a span-duration range
 * and quick filter chips — all kept in sync with the URL so searches are
 * shareable. Scenes subscribe to this object's state to rebuild their queries.
 */
export class ExplorerQueryBar extends SceneObjectBase<ExplorerQueryBarState> {
  static Component = ExplorerQueryBarRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['query', 'durationMin', 'durationMax', 'errors', 'root'],
  });

  public getUrlState() {
    return {
      query: this.state.query || undefined,
      durationMin: this.state.durationMin || undefined,
      durationMax: this.state.durationMax || undefined,
      errors: this.state.errorsOnly ? '1' : undefined,
      root: this.state.rootOnly ? '1' : undefined,
    };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const update: Partial<ExplorerQueryBarState> = {};
    if (typeof values.query === 'string') {
      update.query = values.query;
    }
    if (typeof values.durationMin === 'string') {
      update.durationMin = values.durationMin;
    }
    if (typeof values.durationMax === 'string') {
      update.durationMax = values.durationMax;
    }
    if (values.errors !== undefined) {
      update.errorsOnly = values.errors === '1';
    }
    if (values.root !== undefined) {
      update.rootOnly = values.root === '1';
    }
    if (Object.keys(update).length > 0) {
      this.setState(update);
    }
  }

  public onApply = (filter: ExplorerFilter) => {
    this.setState(filter);
  };
}

function ExplorerQueryBarRenderer({ model }: SceneComponentProps<ExplorerQueryBar>) {
  const state = model.useState();
  const styles = useStyles2(getStyles);
  const timeRange = sceneGraph.getTimeRange(model).useState();
  const { getSuggestions } = useQuickwitAutocomplete(getTracesDatasource()?.uid, timeRange.value);

  const [draft, setDraft] = React.useState<ExplorerFilter>(filterOf(state));
  const [prevFilter, setPrevFilter] = React.useState<ExplorerFilter>(filterOf(state));

  // Reflect external updates (URL navigation, chips, heatmap selection) into the local draft.
  if (!filtersEqual(prevFilter, filterOf(state))) {
    const filter = filterOf(state);
    setPrevFilter(filter);
    setDraft(filter);
  }

  const draftRef = React.useRef(draft);
  React.useEffect(() => {
    draftRef.current = draft;
  });

  const apply = () => model.onApply(draftRef.current);
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      apply();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.editor}>
        <LuceneQueryEditor
          placeholder="Lucene query, e.g. service_name:frontend AND span_attributes.http.method:POST (Shift-Enter to run)"
          value={draft.query}
          autocompleter={getSuggestions}
          onChange={(query) => setDraft((current) => ({ ...current, query }))}
          onSubmit={(query) => model.onApply({ ...draftRef.current, query })}
        />
      </div>
      <FilterPill
        label="Errors only"
        selected={state.errorsOnly}
        onClick={() => model.onApply({ ...filterOf(state), errorsOnly: !state.errorsOnly })}
      />
      <FilterPill
        label="Root spans"
        selected={state.rootOnly}
        onClick={() => model.onApply({ ...filterOf(state), rootOnly: !state.rootOnly })}
      />
      {state.trailing && <state.trailing.Component model={state.trailing} />}
      <Input
        className={styles.durationInput}
        width={13}
        prefix="≥"
        suffix="ms"
        placeholder="0"
        title="Minimum span duration"
        value={draft.durationMin}
        onChange={(e) => setDraft({ ...draft, durationMin: e.currentTarget.value })}
        onKeyDown={onKeyDown}
      />
      <Input
        className={styles.durationInput}
        width={13}
        prefix="≤"
        suffix="ms"
        placeholder="∞"
        title="Maximum span duration"
        value={draft.durationMax}
        onChange={(e) => setDraft({ ...draft, durationMax: e.currentTarget.value })}
        onKeyDown={onKeyDown}
      />
      <Button onClick={apply}>Run query</Button>
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
  editor: css`
    flex: 1;
    min-width: 0;
    min-height: ${theme.spacing(4)};
    border: 1px solid ${theme.components.input.borderColor};
    border-radius: ${theme.shape.radius.default};
    overflow: hidden;

    .cm-editor {
      font-size: ${theme.typography.bodySmall.fontSize};
    }
  `,
  durationInput: css`
    width: auto;
    flex: 0 0 auto;

    input {
      font-family: ${theme.typography.fontFamilyMonospace};
    }
  `,
});
