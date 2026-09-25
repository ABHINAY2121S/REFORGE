import { useState, useMemo } from 'react';
import { Device, OperationType, Screen } from '../types';
import {
  IconChevronRight, IconChevronDown, IconSearch, IconCheck, IconArrowRight,
  IconFolder, IconDocument, IconX, IconInfo
} from '../components/Icons';

interface FileScopeSelectorProps {
  device?: Device;
  operationType: OperationType;
  navigate: (screen: Screen) => void;
}

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: string;
  sizeBytes?: number;
  modified: string;
  children?: FileNode[];
  mimeHint?: string;
}

const fileTree: FileNode[] = [
  {
    id: 'users', name: 'Users', type: 'folder', modified: '2024-11-01', children: [
      {
        id: 'users-admin', name: 'Administrator', type: 'folder', modified: '2024-11-03', children: [
          {
            id: 'users-admin-docs', name: 'Documents', type: 'folder', modified: '2024-11-08', children: [
              { id: 'f1', name: 'Q3_Financial_Report_2024.xlsx', type: 'file', size: '2.4 MB', sizeBytes: 2516582, modified: '2024-10-31', mimeHint: 'xlsx' },
              { id: 'f2', name: 'Contract_MeridianCorp_v3.pdf', type: 'file', size: '890 KB', sizeBytes: 911360, modified: '2024-11-02', mimeHint: 'pdf' },
              { id: 'f3', name: 'HR_Investigation_Notes.docx', type: 'file', size: '128 KB', sizeBytes: 131072, modified: '2024-11-07', mimeHint: 'docx' },
              { id: 'f4', name: 'Board_Resolution_Q4.pdf', type: 'file', size: '420 KB', sizeBytes: 430080, modified: '2024-10-15', mimeHint: 'pdf' },
            ]
          },
          {
            id: 'users-admin-desktop', name: 'Desktop', type: 'folder', modified: '2024-11-06', children: [
              { id: 'f5', name: 'backup_keys_encrypted.zip', type: 'file', size: '44.2 KB', sizeBytes: 45261, modified: '2024-11-01', mimeHint: 'zip' },
              { id: 'f6', name: 'meeting_notes_nov.txt', type: 'file', size: '12 KB', sizeBytes: 12288, modified: '2024-11-06', mimeHint: 'txt' },
              { id: 'f7', name: 'Meridian_Org_Chart.png', type: 'file', size: '1.1 MB', sizeBytes: 1153433, modified: '2024-10-28', mimeHint: 'img' },
            ]
          },
          {
            id: 'users-admin-appdata', name: 'AppData', type: 'folder', modified: '2024-11-08', children: [
              {
                id: 'users-admin-appdata-local', name: 'Local', type: 'folder', modified: '2024-11-08', children: [
                  { id: 'f8', name: 'email_export_nov_2024.pst', type: 'file', size: '18.7 MB', sizeBytes: 19607101, modified: '2024-11-08', mimeHint: 'pst' },
                  { id: 'f9', name: 'outlook_archive_2023.pst', type: 'file', size: '44.8 MB', sizeBytes: 46990131, modified: '2024-01-15', mimeHint: 'pst' },
                ]
              },
            ]
          },
        ]
      },
      {
        id: 'users-rk', name: 'rk_sharma', type: 'folder', modified: '2024-09-10', children: [
          {
            id: 'users-rk-docs', name: 'Documents', type: 'folder', modified: '2024-09-10', children: [
              { id: 'f10', name: 'personal_budget_2024.xlsx', type: 'file', size: '340 KB', sizeBytes: 348160, modified: '2024-09-08', mimeHint: 'xlsx' },
              { id: 'f11', name: 'resignation_draft.docx', type: 'file', size: '18 KB', sizeBytes: 18432, modified: '2024-09-09', mimeHint: 'docx' },
            ]
          },
          {
            id: 'users-rk-downloads', name: 'Downloads', type: 'folder', modified: '2024-09-07', children: [
              { id: 'f12', name: 'CompanySourceCode_v2.zip', type: 'file', size: '112 MB', sizeBytes: 117440512, modified: '2024-09-05', mimeHint: 'zip' },
              { id: 'f13', name: 'database_dump_prod.sql', type: 'file', size: '8.2 MB', sizeBytes: 8597299, modified: '2024-09-04', mimeHint: 'sql' },
            ]
          },
        ]
      },
    ]
  },
  {
    id: 'program-files', name: 'Program Files', type: 'folder', modified: '2024-08-15', children: [
      { id: 'f14', name: 'Microsoft Office', type: 'folder', modified: '2024-07-01', children: [] },
      { id: 'f15', name: 'Adobe', type: 'folder', modified: '2024-05-10', children: [] },
    ]
  },
  {
    id: 'windows', name: 'Windows', type: 'folder', modified: '2024-11-01', children: []
  },
  {
    id: 'recycler', name: '$RECYCLE.BIN', type: 'folder', modified: '2024-11-08', children: [
      { id: 'f16', name: '$R4H7PP2.xlsx', type: 'file', size: '2.4 MB', sizeBytes: 2516582, modified: '2024-11-01', mimeHint: 'xlsx' },
      { id: 'f17', name: '$RBKP91A.zip', type: 'file', size: '44.2 KB', sizeBytes: 45261, modified: '2024-11-01', mimeHint: 'zip' },
    ]
  },
];

function flattenIds(nodes: FileNode[]): string[] {
  return nodes.flatMap((n) =>
    n.type === 'folder'
      ? [n.id, ...flattenIds(n.children ?? [])]
      : [n.id]
  );
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((n) =>
    n.type === 'folder' ? flattenFiles(n.children ?? []) : [n]
  );
}

function totalSize(nodes: FileNode[], checked: Set<string>): number {
  return flattenFiles(nodes)
    .filter((f) => checked.has(f.id))
    .reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const fileTypeColors: Record<string, string> = {
  xlsx: '#2E9E5B', pdf: '#C6394A', docx: '#4C5FC7', txt: '#647184',
  zip: '#B8862E', pst: '#4C5FC7', img: '#B8862E', sql: '#C6394A',
  folder: '#B8862E',
};

function findNodeById(nodes: FileNode[], id: string): FileNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findPath(nodes: FileNode[], targetId: string, path: FileNode[] = []): FileNode[] | null {
  for (const n of nodes) {
    const next = [...path, n];
    if (n.id === targetId) return next;
    if (n.children) {
      const found = findPath(n.children, targetId, next);
      if (found) return found;
    }
  }
  return null;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelectFolder: (id: string) => void;
  selectedFolderId: string;
  checked: Set<string>;
}

function TreeNode({ node, depth, expanded, onToggleExpand, onSelectFolder, selectedFolderId, checked }: TreeNodeProps) {
  if (node.type !== 'folder') return null;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedFolderId === node.id;
  const childIds = flattenIds(node.children ?? []);
  const checkedCount = childIds.filter((id) => checked.has(id)).length;

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: `5px 12px 5px ${12 + depth * 14}px`,
          cursor: 'pointer',
          backgroundColor: isSelected ? '#E8F5F2' : 'transparent',
          borderRadius: 4, margin: '1px 6px',
          transition: 'background-color 0.1s ease',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F5F7FA';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
        }}
      >
        <button
          onClick={() => node.children?.length ? onToggleExpand(node.id) : undefined}
          style={{
            width: 14, height: 14, border: 'none', background: 'none', padding: 0,
            cursor: node.children?.length ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {(node.children?.length ?? 0) > 0
            ? isExpanded
              ? <IconChevronDown size={11} style={{ stroke: '#647184' }} />
              : <IconChevronRight size={11} style={{ stroke: '#647184' }} />
            : <span style={{ display: 'inline-block', width: 11 }} />
          }
        </button>
        <div
          onClick={() => { onSelectFolder(node.id); if (!isExpanded) onToggleExpand(node.id); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
          }}
        >
          <IconFolder size={14} style={{ stroke: isSelected ? '#1E8F7A' : '#B8862E', flexShrink: 0 }} />
          <span style={{
            fontSize: 13, color: isSelected ? '#1E8F7A' : '#1A2330',
            fontWeight: isSelected ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.name}
          </span>
          {checkedCount > 0 && (
            <span style={{
              flexShrink: 0, fontSize: 10, fontWeight: 600,
              backgroundColor: '#1E8F7A', color: '#fff',
              borderRadius: 8, padding: '1px 5px', marginLeft: 2,
            }}>
              {checkedCount}
            </span>
          )}
        </div>
      </div>
      {isExpanded && node.children?.map((child) =>
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
      )}
    </div>
  );
}

function FileRow({
  node, checked, onToggle,
}: {
  node: FileNode;
  checked: boolean;
  onToggle: () => void;
}) {
  const isFolder = node.type === 'folder';
  const color = isFolder ? fileTypeColors.folder : (fileTypeColors[node.mimeHint ?? ''] ?? '#647184');
  const childCount = isFolder ? flattenFiles(node.children ?? []).length : 0;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        borderBottom: '1px solid #F0F3F6',
        backgroundColor: checked ? '#F8FDFB' : 'transparent',
        transition: 'background-color 0.1s ease',
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0 }}
      />
      <div
        style={{
          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
          backgroundColor: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isFolder
          ? <IconFolder size={14} style={{ stroke: color }} />
          : <span style={{ fontSize: 8, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
              {node.mimeHint ?? '—'}
            </span>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1A2330', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </div>
        {isFolder && childCount > 0 && (
          <div style={{ fontSize: 11, color: '#647184', marginTop: 1 }}>
            {childCount} item{childCount !== 1 ? 's' : ''} — selecting this folder includes all sub-items
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#647184', flexShrink: 0, width: 80, textAlign: 'right' }}>
        {isFolder ? '—' : node.size}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#B0BAC9', flexShrink: 0, width: 90, textAlign: 'right' }}>
        {node.modified}
      </div>
    </div>
  );
}

export default function FileScopeSelector({ device, operationType, navigate }: FileScopeSelectorProps) {
  const [selectedFolderId, setSelectedFolderId] = useState('users-admin-docs');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['users', 'users-admin', 'users-admin-docs']));
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading] = useState(false);

  const targetScreen: Screen = operationType === 'recovery' ? 'recovery' : 'erase';

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const currentFolderNode = findNodeById(fileTree, selectedFolderId);
  const breadcrumbPath = findPath(fileTree, selectedFolderId) ?? [];

  const currentItems: FileNode[] = useMemo(() => {
    const folder = currentFolderNode;
    if (!folder?.children) return [];
    let items = folder.children;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((n) => n.name.toLowerCase().includes(q));
    }
    return [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [selectedFolderId, search, currentFolderNode]);

  const toggleItem = (node: FileNode) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const ids = node.type === 'folder' ? flattenIds(node.children ?? []) : [node.id];
      const allChecked = ids.every((id) => next.has(id));
      if (allChecked) {
        ids.forEach((id) => next.delete(id));
        if (node.type === 'folder') next.delete(node.id);
      } else {
        ids.forEach((id) => next.add(id));
        if (node.type === 'folder') next.add(node.id);
      }
      return next;
    });
  };

  const isItemChecked = (node: FileNode): boolean => {
    if (node.type === 'file') return checked.has(node.id);
    const ids = flattenIds(node.children ?? []);
    return ids.length > 0 && ids.every((id) => checked.has(id));
  };

  const isItemIndeterminate = (node: FileNode): boolean => {
    if (node.type === 'file') return false;
    const ids = flattenIds(node.children ?? []);
    const c = ids.filter((id) => checked.has(id)).length;
    return c > 0 && c < ids.length;
  };

  const checkedItemCount = checked.size;
  const checkedBytes = totalSize(fileTree, checked);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Page header */}
      <div style={{ marginBottom: 18, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2330', letterSpacing: '-0.02em' }}>
            Select Files & Folders
          </div>
          <div
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
              backgroundColor: operationType === 'recovery' ? '#E8F5F2' : '#FEF2F3',
              color: operationType === 'recovery' ? '#1E8F7A' : '#C6394A',
            }}
          >
            {operationType === 'recovery' ? 'FOR RECOVERY' : 'FOR ERASE'}
          </div>
        </div>
        <div style={{ fontSize: 14, color: '#647184' }}>
          {device?.name ?? 'Selected Device'}
          <span style={{ margin: '0 6px', color: '#DDE3EA' }}>·</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {device?.serial ?? '—'}
          </span>
          <span style={{ margin: '0 6px', color: '#DDE3EA' }}>·</span>
          <span>{device?.capacity ?? '—'}</span>
        </div>
      </div>

      {/* Main layout: tree + file list */}
      <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Folder tree */}
        <div
          style={{
            width: 240, flexShrink: 0,
            backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden',
            border: '1px solid #DDE3EA',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #DDE3EA', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', letterSpacing: '0.05em' }}>
              FOLDER TREE
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
            {loading ? (
              <div style={{ padding: '16px 18px', fontSize: 13, color: '#647184' }}>
                Reading file structure…
              </div>
            ) : (
              fileTree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onSelectFolder={setSelectedFolderId}
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
            border: '1px solid #DDE3EA', overflow: 'hidden',
          }}
        >
          {/* Breadcrumb */}
          <div
            style={{
              padding: '11px 18px', borderBottom: '1px solid #DDE3EA',
              display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flexShrink: 0,
              backgroundColor: '#F5F7FA',
            }}
          >
            <button
              onClick={() => setSelectedFolderId('users')}
              style={{
                fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                color: '#647184', fontFamily: 'JetBrains Mono, monospace',
                borderRadius: 3,
              }}
            >
              /
            </button>
            {breadcrumbPath.map((seg, i) => (
              <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconChevronRight size={11} style={{ stroke: '#B0BAC9' }} />
                <button
                  onClick={() => setSelectedFolderId(seg.id)}
                  style={{
                    fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 5px', borderRadius: 3,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: i === breadcrumbPath.length - 1 ? '#1A2330' : '#647184',
                    fontWeight: i === breadcrumbPath.length - 1 ? 500 : 400,
                    backgroundColor: i === breadcrumbPath.length - 1 ? '#E8F5F2' : 'transparent',
                  }}
                >
                  {seg.name}
                </button>
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid #F0F3F6', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <IconSearch
                size={14}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', stroke: '#647184', pointerEvents: 'none' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                    display: 'flex', alignItems: 'center', color: '#647184',
                  }}
                >
                  <IconX size={13} style={{ stroke: '#647184' }} />
                </button>
              )}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by filename or file type (e.g. .pdf, .xlsx)…"
                style={{
                  width: '100%', padding: '8px 32px 8px 32px',
                  border: '1px solid #DDE3EA', borderRadius: 7,
                  fontSize: 13, color: '#1A2330', backgroundColor: '#FFFFFF', outline: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#1E8F7A')}
                onBlur={(e) => (e.target.style.borderColor = '#DDE3EA')}
              />
            </div>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
              borderBottom: '1px solid #F0F3F6',
              backgroundColor: '#F8FAFB', flexShrink: 0,
            }}
          >
            <div style={{ width: 16, flexShrink: 0 }} />
            <div style={{ width: 30, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#647184', letterSpacing: '0.04em' }}>
              NAME
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', width: 80, textAlign: 'right', letterSpacing: '0.04em' }}>
              SIZE
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#647184', width: 90, textAlign: 'right', letterSpacing: '0.04em', fontFamily: 'JetBrains Mono, monospace' }}>
              MODIFIED
            </div>
          </div>

          {/* File list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '24px 20px', fontSize: 14, color: '#647184' }}>
                Reading file structure…
              </div>
            ) : currentItems.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                {search
                  ? <>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1A2330', marginBottom: 4 }}>
                        No results for "{search}"
                      </div>
                      <div style={{ fontSize: 13, color: '#647184' }}>
                        Try a different filename or file extension.
                      </div>
                    </>
                  : <>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#1A2330', marginBottom: 4 }}>
                        This folder is empty
                      </div>
                      <div style={{ fontSize: 13, color: '#647184' }}>
                        No files or sub-folders found in this location.
                      </div>
                    </>
                }
              </div>
            ) : (
              currentItems.map((node) => (
                <FileRow
                  key={node.id}
                  node={node}
                  checked={isItemChecked(node)}
                  onToggle={() => toggleItem(node)}
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
          padding: '14px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          border: `1px solid ${checkedItemCount > 0 ? '#D0EBE6' : '#DDE3EA'}`,
          boxShadow: checkedItemCount > 0 ? '0 0 0 3px rgba(30,143,122,0.08)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checkedItemCount > 0 ? (
            <>
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%', backgroundColor: '#1E8F7A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconCheck size={14} style={{ stroke: '#fff' }} />
              </div>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2330' }}>
                  {checkedItemCount} item{checkedItemCount !== 1 ? 's' : ''} selected
                </span>
                <span style={{ fontSize: 13, color: '#647184', marginLeft: 8 }}>
                  {formatSize(checkedBytes)} total
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#647184' }}>
              <IconInfo size={15} style={{ stroke: '#B0BAC9' }} />
              <span style={{ fontSize: 13 }}>
                Check items in the file list to select them for this operation.
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checkedItemCount > 0 && (
            <button
              onClick={() => setChecked(new Set())}
              style={{
                fontSize: 13, color: '#647184', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                padding: '8px 12px', borderRadius: 6,
              }}
            >
              Clear selection
            </button>
          )}
          <button
            disabled={checkedItemCount === 0}
            onClick={() => navigate(targetScreen)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
              borderRadius: 8, border: 'none',
              backgroundColor: checkedItemCount > 0
                ? (operationType === 'erase' ? '#C6394A' : '#1E8F7A')
                : '#DDE3EA',
              color: checkedItemCount > 0 ? '#FFFFFF' : '#B0BAC9',
              fontWeight: 600, fontSize: 14,
              cursor: checkedItemCount > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (checkedItemCount > 0) {
                e.currentTarget.style.backgroundColor = operationType === 'erase' ? '#A82F3F' : '#178269';
              }
            }}
            onMouseLeave={(e) => {
              if (checkedItemCount > 0) {
                e.currentTarget.style.backgroundColor = operationType === 'erase' ? '#C6394A' : '#1E8F7A';
              }
            }}
          >
            Continue with Selected Items
            <IconArrowRight size={15} style={{ stroke: checkedItemCount > 0 ? '#fff' : '#B0BAC9' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
