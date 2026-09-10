import React, { useEffect, useState } from 'react';
import { useMessage } from '@/hooks/useMessage';
import { AnnotationGroupNode, PlanningAnnotation } from '@/utils/interfaces';
import { buildAnnotationTree } from '@/utils/mapper';
import { createLogger } from '@/utils/logger';

const log = createLogger('Wells');

interface WellsProps {
  orgId: string;
  projectId: string;
  sourceTabId: number;
  debugMode: boolean;
  onAnnotationsChange: (annotations: PlanningAnnotation[]) => void;
  onAllAnnotationsChange: (annotations: PlanningAnnotation[]) => void;
}

export function Wells({ orgId, projectId, sourceTabId, debugMode, onAnnotationsChange, onAllAnnotationsChange }: WellsProps) {
  const { getAnnotationGroups } = useMessage(orgId, projectId);

  const [tree, setTree] = useState<AnnotationGroupNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session-only — folder visibility isn't persisted, it's just a filter over
  // what's already in `tree`. Starts empty, so nothing is selected on open.
  const [enabledGroupIds, setEnabledGroupIds] = useState<Set<string>>(new Set());

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rawGroups = await getAnnotationGroups(sourceTabId);
      setTree(buildAnnotationTree(rawGroups));
    } catch (err: any) {
      log.error('Failed to load annotation groups', err);
      setError(err?.message || 'Failed to load annotations from FlightHub.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const collectIds = (node: AnnotationGroupNode): string[] =>
    [node.id, ...node.children.flatMap(collectIds)];

  // Ticking a folder takes its whole subtree with it, the way FlightHub's own
  // tree behaves; untick a child afterwards to carve it back out.
  const toggleGroup = (node: AnnotationGroupNode) => {
    const subtreeIds = collectIds(node);
    setEnabledGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) subtreeIds.forEach(id => next.delete(id));
      else subtreeIds.forEach(id => next.add(id));
      return next;
    });
  };

  useEffect(() => {
    const visible: PlanningAnnotation[] = [];
    const visit = (nodes: AnnotationGroupNode[]) => {
      nodes.forEach(node => {
        if (enabledGroupIds.has(node.id)) visible.push(...node.annotations);
        visit(node.children);
      });
    };
    visit(tree);
    onAnnotationsChange(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, enabledGroupIds]);

  // Every annotation in the project, regardless of selection — the map uses it
  // to frame the field on first load
  useEffect(() => {
    const all: PlanningAnnotation[] = [];
    const visit = (nodes: AnnotationGroupNode[]) => {
      nodes.forEach(node => {
        all.push(...node.annotations);
        visit(node.children);
      });
    };
    visit(tree);
    onAllAnnotationsChange(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const renderNode = (node: AnnotationGroupNode, depth: number) => {
    const checked = enabledGroupIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const partial = !checked && node.children
      .flatMap(collectIds)
      .some(id => enabledGroupIds.has(id));

    return (
      <div key={node.id} style={{ marginLeft: depth * 16 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 0',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            ref={el => { if (el) el.indeterminate = partial; }}
            onChange={() => toggleGroup(node)}
          />
          <span style={{ fontWeight: hasChildren ? 600 : 400 }}>{node.name}</span>
          {node.annotations.length > 0 && (
            <span style={{ color: '#888', fontSize: '12px' }}>({node.annotations.length})</span>
          )}
          {node.is_lock && <span title="Locked in FlightHub" style={{ fontSize: '11px' }}>🔒</span>}
        </label>
        {hasChildren && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="wells-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>Annotations</h3>
        <button
          onClick={loadGroups}
          disabled={isLoading}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#ccc',
            borderRadius: '4px',
            padding: '4px 10px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      {!isLoading && !error && tree.length === 0 && (
        <p style={{ color: '#888' }}>No annotation folders found. Make sure the project is open in FlightHub.</p>
      )}

      <div className="wells-tree">
        {tree.map(node => renderNode(node, 0))}
      </div>
    </div>
  );
}
