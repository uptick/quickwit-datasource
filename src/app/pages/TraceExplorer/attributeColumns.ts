import { map, Observable } from 'rxjs';
import { DataFrame, Field, FieldType } from '@grafana/data';
import type { CustomTransformOperator } from '@grafana/scenes';

function fieldByName(frame: DataFrame, name: string): Field | undefined {
  return frame.fields.find((f) => f.name === name);
}

/**
 * Joins extra attribute columns onto the trace-search table: for every trace
 * row, takes the first non-null value of each selected attribute among that
 * trace's raw span documents (fetched by the companion `rawspans` query).
 */
export function attributeColumnsTransform(getSelected: () => string[]): CustomTransformOperator {
  return () => (source: Observable<DataFrame[]>) =>
    source.pipe(
      map((frames) => {
        // Detect frames structurally — the raw frame's refId is not always set.
        const found = frames.find((f) => fieldByName(f, 'traceID'));
        if (!found) {
          return frames;
        }
        // Drop the datasource's built-in Explore link on the trace ID — the
        // panel adds its own "Open in trace viewer" / "Peek trace" links.
        const traceFrame: DataFrame = {
          ...found,
          fields: found.fields.map((f) =>
            f.name === 'traceID' ? { ...f, config: { ...f.config, links: [] } } : f
          ),
        };
        const selected = getSelected();
        const rawFrame = frames.find((f) => f !== found && fieldByName(f, 'trace_id'));
        if (selected.length === 0 || !rawFrame) {
          return [traceFrame];
        }

        const rawTraceIds = fieldByName(rawFrame, 'trace_id')?.values ?? [];

        // First non-null value per trace, for each selected attribute.
        const valuesByAttribute = new Map<string, Map<string, unknown>>();
        for (const attribute of selected) {
          const rawValues = fieldByName(rawFrame, attribute)?.values;
          const byTrace = new Map<string, unknown>();
          if (rawValues) {
            for (let i = 0; i < rawFrame.length; i++) {
              const traceId = String(rawTraceIds[i] ?? '');
              const value = rawValues[i];
              if (traceId && value !== null && value !== undefined && !byTrace.has(traceId)) {
                byTrace.set(traceId, value);
              }
            }
          }
          valuesByAttribute.set(attribute, byTrace);
        }

        const tableTraceIds = fieldByName(traceFrame, 'traceID')?.values ?? [];
        const extraFields: Field[] = selected.map((attribute) => {
          const byTrace = valuesByAttribute.get(attribute)!;
          const values: unknown[] = [];
          for (let row = 0; row < traceFrame.length; row++) {
            values.push(byTrace.get(String(tableTraceIds[row] ?? '')) ?? null);
          }
          const sample = values.find((v) => v !== null && v !== undefined);
          return {
            name: attribute,
            type: typeof sample === 'number' ? FieldType.number : FieldType.string,
            values: typeof sample === 'number' ? values : values.map((v) => (v == null ? null : String(v))),
            config: {},
          } as Field;
        });

        return [{ ...traceFrame, fields: [...traceFrame.fields, ...extraFields] }];
      })
    );
}
