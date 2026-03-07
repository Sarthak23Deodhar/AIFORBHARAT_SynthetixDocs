import React, { useCallback, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/* ── Utility: parse Mermaid graph TD syntax into nodes+edges ─────────────── */
const parseMermaid = (code) => {
    if (!code) return { nodes: [], edges: [] };

    const nodes = [];
    const edges = [];
    const nodeMap = {};
    let nodeIdx = 0;

    // Strip "graph TD" or "graph LR" header and backticks
    const lines = code
        .replace(/^```[\w]*\n?/gm, '')
        .replace(/```$/gm, '')
        .replace(/^graph\s+(TD|LR|RL|BT|TB)/im, '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('%%'));

    const getOrCreate = (id, label) => {
        const cleanId = id.trim();
        if (!nodeMap[cleanId]) {
            // Extract label from bracket syntax: A["Label"] or A[Label] or A(Label)
            const labelMatch = label?.match(/["\[({]([^"\]})]+)["\]})]/);
            const finalLabel = labelMatch ? labelMatch[1] : cleanId;
            nodeMap[cleanId] = { id: cleanId, label: finalLabel, idx: nodeIdx++ };
        }
        return nodeMap[cleanId];
    };

    // Parse edges: A --> B, A -- text --> B, A["Label"] --> B["Label"], etc.
    const edgeRe = /^(.+?)\s*(-{1,2}>|--[^>]*-->)\s*(.+)$/;
    lines.forEach((line, i) => {
        const m = line.match(edgeRe);
        if (m) {
            let src = m[1].trim();
            let dst = m[3].trim();
            // Extract id vs label
            const srcIdM = src.match(/^([A-Za-z0-9_]+)\[/);
            const dstIdM = dst.match(/^([A-Za-z0-9_]+)\[/);
            const srcId = srcIdM ? srcIdM[1] : src.replace(/["'[\](){}]/g, '').split(' ')[0];
            const dstId = dstIdM ? dstIdM[1] : dst.replace(/["'[\](){}]/g, '').split(' ')[0];
            const srcNode = getOrCreate(srcId, src);
            const dstNode = getOrCreate(dstId, dst);
            edges.push({ id: `e${i}`, source: srcId, target: dstId });
        }
    });

    // If no edges parsed, try single node definitions
    if (Object.keys(nodeMap).length === 0) {
        lines.forEach((line, i) => {
            const singleIdM = line.match(/^([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\)|{([^}]+)})?/);
            if (singleIdM) {
                const id = singleIdM[1];
                const label = singleIdM[2] || singleIdM[3] || singleIdM[4] || id;
                getOrCreate(id, `[${label}]`);
            }
        });
    }

    // Layout: topological-ish grid
    const cols = Math.ceil(Math.sqrt(Object.keys(nodeMap).length + 1));
    const entries = Object.values(nodeMap);
    entries.forEach((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        nodes.push({
            id: n.id,
            data: { label: n.label },
            position: { x: col * 210, y: row * 110 },
            style: NODE_STYLE,
        });
    });

    return { nodes, edges };
};

const NODE_STYLE = {
    background: 'rgba(99,102,241,0.10)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: '8px',
    color: '#c7d2fe',
    fontSize: '12px',
    fontFamily: "'Inter',sans-serif",
    fontWeight: '600',
    padding: '10px 14px',
    boxShadow: '0 2px 12px rgba(99,102,241,0.15)',
    maxWidth: '180px',
    textAlign: 'center',
};

const EDGE_DEFAULTS = {
    type: 'smoothstep',
    animated: true,
    style: { stroke: 'rgba(99,102,241,0.5)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(99,102,241,0.6)', width: 14, height: 14 },
};

export default function FlowDiagram({ mermaidCode }) {
    const { nodes: initNodes, edges: initEdges } = useMemo(
        () => parseMermaid(mermaidCode),
        [mermaidCode]
    );

    const [nodes, , onNodesChange] = useNodesState(initNodes);
    const [edges, , onEdgesChange] = useEdgesState(
        initEdges.map(e => ({ ...e, ...EDGE_DEFAULTS }))
    );

    if (!mermaidCode || nodes.length === 0) {
        return (
            <div style={styles.empty}>
                <div style={styles.emptyIcon}>🗺️</div>
                <p style={styles.emptyText}>No architecture diagram available yet.</p>
                <p style={styles.emptyHint}>Generate documentation first to visualize the flow.</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.badge}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#818cf8" stroke="none">
                    <circle cx="12" cy="12" r="10" />
                </svg>
                <span>Interactive Flow Diagram · React Flow · drag / scroll to explore</span>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.3}
                maxZoom={2.5}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="rgba(99,102,241,0.12)"
                />
                <Controls
                    showInteractive={false}
                    style={{ bottom: 12, right: 12, left: 'auto', top: 'auto' }}
                />
            </ReactFlow>
        </div>
    );
}

const styles = {
    container: {
        width: '100%', height: '100%', minHeight: 320,
        display: 'flex', flexDirection: 'column', position: 'relative',
    },
    badge: {
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 5,
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.2)',
        fontSize: 9, color: '#818cf8', fontWeight: 600,
        letterSpacing: '0.02em', fontFamily: "'JetBrains Mono',monospace",
    },
    empty: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 260, gap: 8,
    },
    emptyIcon: { fontSize: 36 },
    emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 },
    emptyHint: { fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0, fontFamily: "'JetBrains Mono',monospace" },
};
