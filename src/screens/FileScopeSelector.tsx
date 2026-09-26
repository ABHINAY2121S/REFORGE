import { useState, useEffect, useMemo, useCallback } from 'react';
import { Device, OperationType, Screen, NavigateOptions } from '../types';
import { apiListDirectory, FileItem } from '../api';
import {
  IconChevronRight, IconChevronDown, IconSearch, IconCheck, IconArrowRight,
  IconFolder, IconDocument, IconX, IconInfo, IconHardDrive, IconRefresh
} from '../components/Icons';

interface FileScopeSelectorProps {
  device?: Device;
  operationType: OperationType;
  navigate: (screen: Screen, options?: NavigateOptions) => void;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: string;
  sizeBytes?: number;
  modified: string;
  children?: FileNode[];
  mimeHint?: string;
  isDrive?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const fileTypeColors: Record<string, string> = {
  xlsx: '#16A34A', pdf: '#DC2626', docx: '#2563EB', txt: '#475569',
  zip: '#D97706', pst: '#4F46E5', img: '#D97706', png: '#D97706',
  jpg: '#D97706', sql: '#DC2626', folder: '#D97706', drive: '#0D9488',
  exe: '#7C3AED', dll: '#64748B', json: '#0D9488', ts: '#2563EB',
  rs: '#EA580C', md: '#475569',
};

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (node: FileNode) => void;
  onSelectFolder: (node: FileNode) => void;
  selectedFolderId: string;
  checked: Set<string>;
}

function TreeNode({ node, depth, expanded, onToggleExpand, onSelectFolder, selectedFolderId, checked }: TreeNodeProps) {
  if (node.type !== 'folder') return null;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedFolderId === node.id;
  const isChecked = checked.has(node.id);

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: `6px 10px 6px ${8 + depth * 14}px`,
          cursor: 'pointer',
          backgroundColor: isSelected ? '#E6FFFA' : 'transparent',
          borderLeft: isSelected ? '3px solid #0D9488' : '3px solid transparent',
          borderRadius: '0 6px 6px 0', margin: '1px 4px 1px 0',
          transition: 'background-color 0.1s ease',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F1F5F9';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node);
          }}
          style={{
            width: 16, height: 16, border: 'none', background: 'none', padding: 0,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {isExpanded
            ? <IconChevronDown size={12} style={{ stroke: '#334155' }} />
            : <IconChevronRight size={12} style={{ stroke: '#334155' }} />
          }
        </button>
        <div
          onClick={() => {
            onSelectFolder(node);
            if (!isExpanded) onToggleExpand(node);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
          }}
        >
          {node.isDrive ? (
            <IconHardDrive size={15} style={{ stroke: isSelected ? '#0D9488' : '#334155', flexShrink: 0 }} />
          ) : (
            <IconFolder size={15} style={{ stroke: isSelected ? '#0D9488' : '#D97706', flexShrink: 0 }} />
          )}
          <span style={{
            fontSize: 13, color: isSelected ? '#0D9488' : '#0F172A',
            fontWeight: isSelected ? 700 : 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.name}
          </span>
          {isChecked && (
            <span style={{
              flexShrink: 0, fontSize: 10, fontWeight: 700,
              backgroundColor: '#0D9488', color: '#fff',
              borderRadius: 8, padding: '1px 5px', marginLeft: 'auto',
            }}>
              ✓
            </span>
          )}
        </div>
      </div>
      {isExpanded && node.children && node.children.length > 0 && (
        node.children.map((child) =>
          child.type === 'folder' ? (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              selectedFolderId={selectedFolderId}
              checked={checked}
            />
          ) : null
        )
      )}
    </div>
  );
}

function FileRow({
  node, checked, onToggle, onOpenFolder,
}: {
  node: FileNode;
  checked: boolean;
  onToggle: () => void;
  onOpenFolder?: () => void;
}) {
  const isFolder = node.type === 'folder';
  const color = isFolder ? fileTypeColors.folder : (fileTypeColors[node.mimeHint ?? ''] ?? '#475569');

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        borderBottom: '1px solid #F1F5F9',
        backgroundColor: checked ? '#F0FDFA' : 'transparent',
        transition: 'background-color 0.1s ease',
        cursor: 'pointer',
      }}
      onClick={isFolder && onOpenFolder ? onOpenFolder : onToggle}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0, width: 16, height: 16, accentColor: '#0D9488', cursor: 'pointer' }}
      />
      <div
        style={{
          width: 32, height: 32, borderRadius: 6, flexShrink: 0,
          backgroundColor: `${color}15`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isFolder
          ? <IconFolder size={16} style={{ stroke: color }} />
          : <span style={{ fontSize: 9, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>
              {node.mimeHint ? node.mimeHint.slice(0, 4) : '—'}
            </span>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 1, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.path}
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', flexShrink: 0, width: 90, textAlign: 'right' }}>
        {isFolder ? 'Folder' : node.size}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 500, color: '#475569', flexShrink: 0, width: 100, textAlign: 'right' }}>
        {node.modified || '—'}
      </div>
    </div>
  );
}

export default function FileScopeSelector({ device, operationType, navigate }: FileScopeSelectorProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [checkedMap, setCheckedMap] = useState<Map<string, FileNode>>(new Map());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [folderContents, setFolderContents] = useState<Record<string, FileNode[]>>({});

  const targetScreen: Screen = operationType === 'recovery' ? 'recovery' : 'erase';

  // Load root drives and initial folder contents
  const initializeRoots = useCallback(async () => {
    setLoading(true);
    try {
      const roots: FileItem[] = await apiListDirectory();
      if (roots && roots.length > 0) {
        const rootNodes: FileNode[] = roots.map((r) => ({
          ...r,
          children: [],
        }));

        setTree(rootNodes);

        // Pick preferred root: match device partitions if available (e.g. D: or C:), otherwise first root
        let initialRoot = rootNodes[0];
        if (device?.partitions && device.partitions.length > 0) {
          const match = rootNodes.find((r) =>
            device.partitions.some((p) => p.label.startsWith(r.path.slice(0, 2)))
          );
          if (match) initialRoot = match;
        }

        setSelectedFolderId(initialRoot.id);
        setExpanded(new Set([initialRoot.id]));

        // Fetch contents of the initial root
        const items = await apiListDirectory(initialRoot.path);
        const childrenNodes: FileNode[] = items.map((it) => ({
          ...it,
          children: it.type === 'folder' ? [] : undefined,
        }));

        setFolderContents((prev) => ({ ...prev, [initialRoot.id]: childrenNodes }));
        setTree((prev) =>
          prev.map((n) => (n.id === initialRoot.id ? { ...n, children: childrenNodes } : n))
        );
      }
    } catch (e) {
      console.warn('Failed to load roots:', e);
    } finally {
      setLoading(false);
    }
  }, [device]);

  useEffect(() => {
    initializeRoots();
  }, [initializeRoots]);

  // Recursively update tree with loaded children
  const updateTreeNodeChildren = (nodes: FileNode[], targetId: string, children: FileNode[]): FileNode[] => {
    return nodes.map((node) => {
      if (node.id === targetId) {
        return { ...node, children };
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: updateTreeNodeChildren(node.children, targetId, children),
        };
      }
      return node;
    });
  };

  // Fetch children for a folder if not already cached
  const ensureFolderLoaded = async (folder: FileNode) => {
    if (folderContents[folder.id]) return folderContents[folder.id];
    try {
      const items = await apiListDirectory(folder.path || folder.id);
      const childNodes: FileNode[] = items.map((it) => ({
        ...it,
        children: it.type === 'folder' ? [] : undefined,
      }));
      setFolderContents((prev) => ({ ...prev, [folder.id]: childNodes }));
      setTree((prev) => updateTreeNodeChildren(prev, folder.id, childNodes));
      return childNodes;
    } catch (e) {
      console.warn(`Failed to list directory for ${folder.id}:`, e);
      return [];
    }
  };

  const handleToggleExpand = async (node: FileNode) => {
    const isNowExpanded = expanded.has(node.id);
    if (!isNowExpanded) {
      await ensureFolderLoaded(node);
      setExpanded((prev) => new Set([...prev, node.id]));
    } else {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
    }
  };

  const handleSelectFolder = async (node: FileNode) => {
    setSelectedFolderId(node.id);
    await ensureFolderLoaded(node);
  };

  // Breadcrumbs parsing
  const breadcrumbSegments = useMemo(() => {
    if (!selectedFolderId) return [];
    // Normalize path separators
    const clean = selectedFolderId.replace(/\\/g, '/');
    const parts = clean.split('/').filter(Boolean);
    const crumbs: { name: string; fullPath: string }[] = [];
    let accum = '';
    parts.forEach((p, idx) => {
      if (idx === 0 && p.endsWith(':')) {
        accum = `${p}\\`;
        crumbs.push({ name: p, fullPath: accum });
      } else {
        accum = `${accum}${accum.endsWith('\\') ? '' : '\\'}${p}`;
        crumbs.push({ name: p, fullPath: accum });
      }
    });
    return crumbs;
  }, [selectedFolderId]);

  // Current items in selected folder
  const currentItems = useMemo(() => {
    const items = folderContents[selectedFolderId] || [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((n) => n.name.toLowerCase().includes(q));
  }, [selectedFolderId, folderContents, search]);

  const toggleItem = (node: FileNode) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
        setCheckedMap((m) => {
          const nm = new Map(m);
          nm.delete(node.id);
          return nm;
        });
      } else {
        next.add(node.id);
        setCheckedMap((m) => new Map(m).set(node.id, node));
      }
      return next;
    });
  };

  const totalSelectedBytes = useMemo(() => {
    let total = 0;
    checkedMap.forEach((node) => {
      total += node.sizeBytes || 0;
    });
    return total;
  }, [checkedMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Page header */}
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Targeted File Scope Selection
          </div>
          <div
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 4,
              backgroundColor: operationType === 'recovery' ? '#E6FFFA' : '#FEF2F2',
              color: operationType === 'recovery' ? '#0D9488' : '#DC2626',
              border: `1px solid ${operationType === 'recovery' ? '#99F6E4' : '#FCA5A5'}`,
            }}
          >
            {operationType === 'recovery' ? 'FOR RECOVERY' : 'FOR ERASE'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>
          <strong style={{ color: '#0F172A' }}>{device?.name ?? 'Live Physical Storage'}</strong>
          <span style={{ margin: '0 8px', color: '#CBD5E1' }}>·</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#334155' }}>
            {device?.serial ?? '—'}
          </span>
          <span style={{ margin: '0 8px', color: '#CBD5E1' }}>·</span>
          <span style={{ color: '#0F172A', fontWeight: 600 }}>{device?.capacity ?? '—'}</span>
        </div>
      </div>

      {/* Main layout: tree + file list */}
      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Folder tree */}
        <div
          style={{
            width: 280, flexShrink: 0,
            backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden',
            border: '1.5px solid #CBD5E1',
            boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{
            padding: '12px 16px', borderBottom: '1.5px solid #CBD5E1',
            backgroundColor: '#F8FAFC', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.05em' }}>
              FILESYSTEM TREE
            </div>
            <button
              onClick={initializeRoots}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, color: '#0D9488',
              }}
            >
              <IconRefresh size={12} style={{ stroke: '#0D9488' }} />
              Refresh
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
            {loading && tree.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: 13, color: '#475569', fontWeight: 500 }}>
                Querying logical drives & mount points…
              </div>
            ) : tree.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: 13, color: '#64748B' }}>
                No active partitions detected.
              </div>
            ) : (
              tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggleExpand={handleToggleExpand}
                  onSelectFolder={handleSelectFolder}
                  selectedFolderId={selectedFolderId}
                  checked={checked}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel: breadcrumb + search + file list */}
        <div
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', flexDirection: 'column',
            backgroundColor: '#FFFFFF', borderRadius: 10,
            border: '1.5px solid #CBD5E1', overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
          }}
        >
          {/* Breadcrumb */}
          <div
            style={{
              padding: '11px 18px', borderBottom: '1px solid #CBD5E1',
              display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flexShrink: 0,
              backgroundColor: '#F8FAFC',
            }}
          >
            {breadcrumbSegments.length === 0 ? (
              <span style={{ fontSize: 12, color: '#64748B' }}>Select a folder to inspect</span>
            ) : (
              breadcrumbSegments.map((seg, i) => (
                <div key={seg.fullPath} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <IconChevronRight size={11} style={{ stroke: '#94A3B8' }} />}
                  <button
                    onClick={() => {
                      setSelectedFolderId(seg.fullPath);
                      ensureFolderLoaded({ id: seg.fullPath, path: seg.fullPath, name: seg.name, type: 'folder', modified: '' });
                    }}
                    style={{
                      fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
                      padding: '3px 6px', borderRadius: 4,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: i === breadcrumbSegments.length - 1 ? '#0F172A' : '#475569',
                      fontWeight: i === breadcrumbSegments.length - 1 ? 700 : 500,
                      backgroundColor: i === breadcrumbSegments.length - 1 ? '#E2E8F0' : 'transparent',
                    }}
                  >
                    {seg.name}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Search bar */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <IconSearch
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', stroke: '#475569', pointerEvents: 'none' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                    display: 'flex', alignItems: 'center', color: '#475569',
                  }}
                >
                  <IconX size={14} style={{ stroke: '#475569' }} />
                </button>
              )}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter current folder by filename or extension (e.g. .pdf, .docx, .zip)…"
                style={{
                  width: '100%', padding: '9px 36px 9px 36px',
                  border: '1.5px solid #CBD5E1', borderRadius: 7,
                  fontSize: 13, color: '#0F172A', fontWeight: 500, backgroundColor: '#FFFFFF', outline: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0D9488')}
                onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
              />
            </div>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC', flexShrink: 0,
            }}
          >
            <div style={{ width: 16, flexShrink: 0 }} />
            <div style={{ width: 32, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em' }}>
              FILE / FOLDER NAME
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', width: 90, textAlign: 'right', letterSpacing: '0.04em' }}>
              SIZE
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', width: 100, textAlign: 'right', letterSpacing: '0.04em', fontFamily: 'JetBrains Mono, monospace' }}>
              DATE MODIFIED
            </div>
          </div>

          {/* File list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {currentItems.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                {search ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                      No matches for "{search}"
                    </div>
                    <div style={{ fontSize: 13, color: '#475569' }}>
                      Try adjusting the search filter or clear the search input.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                      Folder is empty or contents are restricted
                    </div>
                    <div style={{ fontSize: 13, color: '#475569' }}>
                      Select another directory from the left tree pane.
                    </div>
                  </>
                )}
              </div>
            ) : (
              currentItems.map((node) => (
                <FileRow
                  key={node.id}
                  node={node}
                  checked={checked.has(node.id)}
                  onToggle={() => toggleItem(node)}
                  onOpenFolder={() => {
                    setSelectedFolderId(node.id);
                    ensureFolderLoaded(node);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div
        style={{
          flexShrink: 0, marginTop: 14,
          padding: '14px 22px',
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          border: '1.5px solid #CBD5E1',
          boxShadow: '0 2px 6px rgba(15,23,42,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checked.size > 0 ? (
            <>
              <div
                style={{
                  width: 30, height: 30, borderRadius: '50%', backgroundColor: '#0D9488',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconCheck size={16} style={{ stroke: '#fff' }} />
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                  {checked.size} item{checked.size !== 1 ? 's' : ''} targeted
                </span>
                <span style={{ fontSize: 13, color: '#334155', fontWeight: 600, marginLeft: 8 }}>
                  ({formatSize(totalSelectedBytes)})
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 500 }}>
              <IconInfo size={16} style={{ stroke: '#475569' }} />
              <span style={{ fontSize: 13 }}>
                Check items in the list to target them specifically for forensic processing.
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {checked.size > 0 && (
            <button
              onClick={() => {
                setChecked(new Set());
                setCheckedMap(new Map());
              }}
              style={{
                fontSize: 13, color: '#475569', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                padding: '8px 12px', borderRadius: 6, fontWeight: 600,
              }}
            >
              Clear selection
            </button>
          )}
          <button
            disabled={checked.size === 0 && !selectedFolderId}
            onClick={() => {
              const selectedPaths = checkedMap.size > 0
                ? Array.from(checkedMap.values()).map(n => n.path || n.id)
                : checked.size > 0
                  ? Array.from(checked)
                  : selectedFolderId ? [selectedFolderId] : [];
              navigate(targetScreen, { targetScopePaths: selectedPaths });
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
              borderRadius: 8, border: 'none',
              backgroundColor: (checked.size > 0 || selectedFolderId)
                ? (operationType === 'erase' ? '#DC2626' : '#0D9488')
                : '#E2E8F0',
              color: (checked.size > 0 || selectedFolderId) ? '#FFFFFF' : '#64748B',
              fontWeight: 700, fontSize: 14,
              cursor: (checked.size > 0 || selectedFolderId) ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, system-ui, sans-serif',
              boxShadow: (checked.size > 0 || selectedFolderId) ? '0 2px 6px rgba(13,148,136,0.3)' : 'none',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (checked.size > 0) {
                e.currentTarget.style.backgroundColor = operationType === 'erase' ? '#B91C1C' : '#0F766E';
              }
            }}
            onMouseLeave={(e) => {
              if (checked.size > 0) {
                e.currentTarget.style.backgroundColor = operationType === 'erase' ? '#DC2626' : '#0D9488';
              }
            }}
          >
            Continue with Selected Items
            <IconArrowRight size={15} style={{ stroke: checked.size > 0 ? '#fff' : '#64748B' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
