import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { Checkbox, FilterInput, IconButton, useStyles2 } from '@grafana/ui';
import { getTracesDatasource } from '../../utils/utils.datasource';
import { toggleFavoriteAttribute, useFavoriteAttributes } from '../../utils/favorites';
import { useQuickwitFields } from './useQuickwitAutocomplete';

export interface AttributesSidebarState extends SceneObjectState {
  /** Attributes shown as extra columns in the traces table. */
  selected: string[];
}

const MAX_VISIBLE_ATTRIBUTES = 50;

// OTEL plumbing fields (span events, links, scope, SDK metadata, raw ids and
// timestamps) are rarely useful as columns — sort them to the bottom.
const LOW_PRIORITY_PREFIXES = [
  'events',
  'links',
  'scope_',
  'trace_id',
  'span_id',
  'parent_span_id',
  'trace_state',
  'span_start_timestamp',
  'span_end_timestamp',
  'span_duration',
  'span_fingerprint',
  'resource_attributes.telemetry.',
];

function isLowPriority(attribute: string): boolean {
  return LOW_PRIORITY_PREFIXES.some((prefix) => attribute === prefix || attribute.startsWith(prefix));
}

/**
 * Left-hand list of the searchable attributes of the traces index. Checked
 * attributes are added as extra columns to the traces table (values joined
 * from raw span documents). Starred attributes are pinned to the top and
 * shared with the breakdown view's attribute picker; OTEL plumbing fields
 * sort to the bottom. Synced to the `columns` URL parameter.
 */
export class AttributesSidebar extends SceneObjectBase<AttributesSidebarState> {
  static Component = AttributesSidebarRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['columns'] });

  public getUrlState() {
    return { columns: this.state.selected.length ? this.state.selected.join(',') : undefined };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.columns === 'string') {
      const selected = values.columns.split(',').filter(Boolean);
      this.setState({ selected });
    }
  }

  public onToggle = (attribute: string) => {
    const { selected } = this.state;
    this.setState({
      selected: selected.includes(attribute)
        ? selected.filter((a) => a !== attribute)
        : [...selected, attribute],
    });
  };
}

function AttributesSidebarRenderer({ model }: SceneComponentProps<AttributesSidebar>) {
  const { selected } = model.useState();
  const styles = useStyles2(getStyles);
  const timeRange = sceneGraph.getTimeRange(model).useState();
  const { fields } = useQuickwitFields(getTracesDatasource()?.uid, timeRange.value);
  const favorites = useFavoriteAttributes();
  const favoriteSet = new Set(favorites);

  const [search, setSearch] = React.useState('');
  const matching = fields.filter((f) => f.text.toLowerCase().includes(search.toLowerCase()));

  // Selected and favorite attributes are always visible, pinned to the top;
  // the rest is capped (OTEL plumbing fields last) — search to narrow.
  const pinned = matching.filter((f) => selected.includes(f.text) || favoriteSet.has(f.text));
  const rest = matching.filter((f) => !selected.includes(f.text) && !favoriteSet.has(f.text));
  const cappedRest = [...rest.filter((f) => !isLowPriority(f.text)), ...rest.filter((f) => isLowPriority(f.text))].slice(
    0,
    MAX_VISIBLE_ATTRIBUTES
  );
  const visibleFields = [...pinned, ...cappedRest];
  const hiddenCount = matching.length - visibleFields.length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>Attributes</div>
      <div className={styles.hint}>Check to add as a column to the traces table; star to pin as a favorite</div>
      <FilterInput placeholder="Search attributes…" value={search} onChange={setSearch} />
      <div className={styles.list}>
        {visibleFields.map((field) => {
          const isFavorite = favoriteSet.has(field.text);
          return (
            <div key={field.text} className={styles.row}>
              <label className={styles.rowLabel} title={field.text}>
                <Checkbox value={selected.includes(field.text)} onChange={() => model.onToggle(field.text)} />
                <span className={styles.fieldName}>{field.text}</span>
              </label>
              <IconButton
                className={styles.star}
                name={isFavorite ? 'favorite' : 'star'}
                variant={isFavorite ? 'primary' : 'secondary'}
                tooltip={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() => toggleFavoriteAttribute(field.text)}
              />
            </div>
          );
        })}
        {hiddenCount > 0 && <div className={styles.noValues}>+{hiddenCount} more — search to narrow</div>}
        {visibleFields.length === 0 && <div className={styles.noValues}>No matching attributes</div>}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: ${theme.spacing(1)};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
  `,
  header: css`
    font-size: ${theme.typography.h6.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  hint: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  list: css`
    flex: 1;
    min-height: 0;
    /* Long dotted attribute paths scroll horizontally instead of being cut off. */
    overflow: auto;
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    width: max-content;
    min-width: 100%;
    padding: ${theme.spacing(0.5)};
    border-radius: ${theme.shape.radius.default};

    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
  rowLabel: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    cursor: pointer;
  `,
  fieldName: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
    white-space: nowrap;
  `,
  star: css`
    margin-left: ${theme.spacing(0.5)};
  `,
  noValues: css`
    padding: ${theme.spacing(0.5)};
    color: ${theme.colors.text.disabled};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
