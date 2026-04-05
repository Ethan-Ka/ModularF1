import { useState, useRef } from 'react'
import { useWorkspaceStore } from '../../store/workspaceStore'

export function CanvasTabs() {
  const { tabs, activeTabId, addTab, removeTab, renameTab, setActiveTab } = useWorkspaceStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startRename(tabId: string, currentName: string) {
    setEditingId(tabId)
    setEditValue(currentName)
    setTimeout(() => inputRef.current?.select(), 10)
  }

  function commitRename() {
    if (editingId && editValue.trim()) {
      renameTab(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="animated-slide-down" style={{
      height: 28,
      background: 'transparent',
      borderBottom: 'none',
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
      overflowX: 'auto',
    }}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId
        const isEditing = editingId === tab.id

        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onDoubleClick={() => startRename(tab.id, tab.name)}
            className="stagger-item interactive-chip"
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingInline: '10px 6px',
              gap: 6,
              cursor: 'pointer',
              borderRight: '0.5px solid var(--border)',
              borderBottom: isActive ? '1px solid var(--white)' : '1px solid transparent',
              background: isActive ? 'var(--bg3)' : 'transparent',
              flexShrink: 0,
              minWidth: 0,
              position: 'relative',
              zIndex: 2,
              ['--stagger-delay' as string]: `${Math.min(180, index * 26)}ms`,
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--white)',
                  background: 'var(--bg4)',
                  border: '0.5px solid var(--border2)',
                  borderRadius: 2,
                  padding: '1px 4px',
                  width: Math.max(60, editValue.length * 7),
                  outline: 'none',
                }}
              />
            ) : (
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '0.06em',
                color: isActive ? 'var(--white)' : 'var(--muted)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}>
                {tab.name}
              </span>
            )}

            {/* Close button — only show when there is more than 1 tab */}
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeTab(tab.id)
                }}
                className="interactive-button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted2)',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1,
                  padding: '0 2px',
                  transition: 'color 0.1s',
                  flexShrink: 0,
                }}
                aria-label={`Close ${tab.name}`}
              >
                ×
              </button>
            )}
          </div>
        )
      })}

      {/* Add tab button */}
      <button
        onClick={() => addTab()}
        className="interactive-button"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 10px',
          background: 'none',
          border: 'none',
          borderRight: '0.5px solid var(--border)',
          color: 'var(--muted2)',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
          transition: 'color 0.12s',
        }}
        aria-label="Add canvas tab"
      >
        +
      </button>

      <div style={{ flex: 1 }} />
    </div>
  )
}
