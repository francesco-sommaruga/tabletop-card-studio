import { useState, useRef, useEffect, useMemo } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  MoreHorizontal,
  Plus,
  BookOpen,
  Copy,
  Pencil,
  Trash2,
  Braces,
  BarChart3,
  Columns3,
  Tag,
  Images,
  FileText,
  Settings,
  Github,
  Archive,
  CircleHelp,
  FileSpreadsheet,
  ArrowDownToLine,
  FolderPlus,
  Sparkles,
  X,
  Search,
  ChevronDown,
  ArrowRight,
  Check,
} from 'lucide-react'
import type {
  ProjectSnapshot,
  ProjectSummary,
  Card,
  WorkbookMergePreview,
  GitStatus,
  GitHubAuthStatus,
  CardStatus,
  ColumnDefinition,
  ProjectVariable,
  ImportPlan,
} from './types'
import type { View } from './lib/view'
import {
  defaultTableColumnIds,
  tableMetaColumns,
  tableMetaFieldIds,
  internalFieldName,
  defaultTableColumnWidth,
  minimumTableColumnWidth,
  maximumTableColumnWidth,
  statuses,
} from './lib/tableColumns'
import { ensureGeneratedIdValues } from './generatedIds'
import { resolveConditionalValues } from './conditional'
import { blankCard } from './lib/cards'
import { slug, formatDate } from './lib/format'
import { ProjectChooser } from './views/ProjectChooser'
import { MarkdownPage } from './views/markdown/MarkdownPage'
import { GitHubPage } from './views/GitHubPage'
import { AssetsPage } from './views/AssetsPage'
import { VariablesPage } from './views/variables/VariablesPage'
import { ProjectSettingsPage } from './views/ProjectSettingsPage'
import { ImportLanding } from './components/import/ImportLanding'
import { StatisticsPage } from './views/StatisticsPage'
import { InlineTableCell } from './components/fields/InlineTableCell'
import { preview } from './components/cards/cardPreview'
import { VariableTextPreview } from './components/fields/VariableTextPreview'
import { ColumnsPage } from './views/ColumnsPage'
import { CardEditor } from './components/cards/CardEditor'
import { ImportWizard } from './components/import/ImportWizard'
import { MergeWizard } from './components/import/MergeWizard'
import { ExportChoiceDialog } from './components/dialogs/ExportChoiceDialog'
import { NativeSetLinkDialog } from './components/dialogs/NativeSetLinkDialog'
import { RenameSetDialog } from './components/dialogs/RenameSetDialog'
import { NativeNameConflictDialog } from './components/dialogs/NativeNameConflictDialog'
import { MoveCardDialog } from './components/dialogs/MoveCardDialog'

function App() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [view, setView] = useState<View>('cards')
  const [selected, setSelected] = useState<Card | null>(null)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [toast, setToast] = useState('')
  const [filterStatus, setFilterStatus] = useState('Tutti gli stati')
  const [propertyFilterField, setPropertyFilterField] = useState('')
  const [propertyFilterValue, setPropertyFilterValue] = useState('')
  const [sortField, setSortField] = useState('meta_title')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [importOpen, setImportOpen] = useState(false)
  const [nativeLinkOpen, setNativeLinkOpen] = useState(false)
  const [newSetFlow, setNewSetFlow] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [mergePreview, setMergePreview] = useState<WorkbookMergePreview | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [movingCard, setMovingCard] = useState<Card | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [githubAuth, setGithubAuth] = useState<GitHubAuthStatus | null>(null)
  const [fieldsDirty, setFieldsDirty] = useState(false)
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  const [tableColumnPrefs, setTableColumnPrefs] = useState<{ key: string; ids: string[] } | null>(null)
  const [tableColumnWidths, setTableColumnWidths] = useState<{ key: string; widths: Record<string, number> } | null>(
    null,
  )
  const cardsTableRef = useRef<HTMLDivElement>(null)
  const columnResizeRef = useRef<{
    pointerId: number
    fieldId: string
    startX: number
    startWidth: number
    widths: Record<string, number>
  } | null>(null)

  const refreshProjects = () => window.cardCms.listProjects().then(setProjects)
  useEffect(() => {
    void refreshProjects()
  }, [])
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2800)
      return () => clearTimeout(timer)
    }
  }, [toast])
  useEffect(() => window.cardCms.onNotice((message) => setToast(message)), [])
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void window.cardCms.writeDiagnostic('uncaught-error', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error instanceof Error ? event.error.stack : '',
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      void window.cardCms.writeDiagnostic('unhandled-rejection', {
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : '',
      })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  useEffect(() => {
    if (!fieldsDirty) return
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [fieldsDirty])

  const cards = snapshot?.cards ?? []
  const columns = snapshot?.columns ?? []
  const activeSet = snapshot?.sets.find((set) => set.id === snapshot.activeSetId)
  const linkedNativeKeys = new Set(
    (snapshot?.sets ?? [])
      .filter((set) => set.nativeSetFile && set.nativeSetIndex !== undefined)
      .map((set) => `${set.nativeSetFile}:${set.nativeSetIndex}`),
  )
  const availableNativeSets = (snapshot?.nativeSets ?? []).filter(
    (nativeSet) => !linkedNativeKeys.has(`${nativeSet.file}:${nativeSet.index}`),
  )
  const tableColumnKey =
    snapshot && activeSet ? `tabletop-card-studio:visible-columns:${snapshot.projectPath}:${activeSet.id}` : ''
  const tableColumnWidthsKey = tableColumnKey ? `${tableColumnKey}:widths` : ''
  useEffect(() => {
    if (!tableColumnKey) {
      setTableColumnPrefs(null)
      return
    }
    try {
      const stored = window.localStorage.getItem(tableColumnKey)
      const ids = stored ? JSON.parse(stored) : defaultTableColumnIds
      setTableColumnPrefs({
        key: tableColumnKey,
        ids: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : defaultTableColumnIds,
      })
    } catch {
      setTableColumnPrefs({ key: tableColumnKey, ids: defaultTableColumnIds })
    }
  }, [tableColumnKey])
  useEffect(() => {
    if (!tableColumnWidthsKey) {
      setTableColumnWidths(null)
      return
    }
    try {
      const stored = window.localStorage.getItem(tableColumnWidthsKey)
      const parsed = stored ? (JSON.parse(stored) as Record<string, unknown>) : {}
      const widths = Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
        ),
      )
      setTableColumnWidths({ key: tableColumnWidthsKey, widths })
    } catch {
      setTableColumnWidths({ key: tableColumnWidthsKey, widths: {} })
    }
  }, [tableColumnWidthsKey])
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    cards.forEach((card) => card.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [cards])
  const listColumns = columns.filter(
    (column, index, all) =>
      column.type !== 'image' && all.findIndex((item) => item.fieldId === column.fieldId) === index,
  )
  const availableTableColumns = [
    ...tableMetaColumns,
    ...columns
      .filter(
        (column, index, all) =>
          !tableMetaFieldIds.has(column.fieldId) && all.findIndex((item) => item.fieldId === column.fieldId) === index,
      )
      .map((column) => ({
        fieldId: column.fieldId,
        header: internalFieldName(column),
        label: internalFieldName(column),
        className: 'col-custom',
        type: column.type ?? 'text',
        definition: column,
      })),
  ]
  const visibleTableColumnIds = tableColumnPrefs?.key === tableColumnKey ? tableColumnPrefs.ids : defaultTableColumnIds
  const visibleTableColumns = availableTableColumns.filter((column) => visibleTableColumnIds.includes(column.fieldId))
  const storedTableWidths = tableColumnWidths?.key === tableColumnWidthsKey ? tableColumnWidths.widths : null
  const hasCustomTableWidths = Boolean(storedTableWidths && Object.keys(storedTableWidths).length)
  const defaultGridTemplate = [
    ...visibleTableColumns.map((column) =>
      column.fieldId === 'meta_title'
        ? 'minmax(200px,2fr)'
        : column.fieldId === 'meta_tags'
          ? 'minmax(140px,1.3fr)'
          : column.fieldId === 'meta_status'
            ? 'minmax(105px,.8fr)'
            : column.fieldId === 'meta_quantity'
              ? '62px'
              : column.fieldId === 'meta_updated'
                ? 'minmax(120px,.9fr)'
                : column.type === 'number'
                  ? 'minmax(85px,.65fr)'
                  : 'minmax(125px,1fr)',
    ),
    '22px',
  ].join(' ')
  const tableGridTemplate = hasCustomTableWidths
    ? [
        ...visibleTableColumns.map(
          (column) =>
            `${storedTableWidths?.[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type)}px`,
        ),
        '22px',
      ].join(' ')
    : defaultGridTemplate
  const tableGridMinWidth = hasCustomTableWidths
    ? `${visibleTableColumns.reduce((sum, column) => sum + (storedTableWidths?.[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type)), 22) + visibleTableColumns.length * 10 + 20}px`
    : '100%'
  const tableGridStyle = {
    '--card-grid-template': tableGridTemplate,
    '--card-grid-min-width': tableGridMinWidth,
  } as CSSProperties
  const getVisibleTableWidths = () => {
    const measured: Record<string, number> = {}
    cardsTableRef.current?.querySelectorAll<HTMLElement>('.table-head-cell').forEach((cell) => {
      const fieldId = cell.dataset.fieldId
      if (fieldId) measured[fieldId] = cell.getBoundingClientRect().width
    })
    return Object.fromEntries(
      visibleTableColumns.map((column) => [
        column.fieldId,
        Math.round(
          storedTableWidths?.[column.fieldId] ??
            measured[column.fieldId] ??
            defaultTableColumnWidth(column.fieldId, column.type),
        ),
      ]),
    )
  }
  const makeFixedGridTemplate = (widths: Record<string, number>) =>
    [
      ...visibleTableColumns.map(
        (column) => `${widths[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type)}px`,
      ),
      '22px',
    ].join(' ')
  const applyLiveTableWidths = (widths: Record<string, number>) => {
    const root = cardsTableRef.current
    if (!root) return
    root.style.setProperty('--card-grid-template', makeFixedGridTemplate(widths))
    const minWidth =
      visibleTableColumns.reduce(
        (sum, column) => sum + (widths[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type)),
        22,
      ) +
      visibleTableColumns.length * 10 +
      20
    root.style.setProperty('--card-grid-min-width', `${minWidth}px`)
  }
  const saveTableColumnWidths = (widths: Record<string, number>) => {
    if (!tableColumnWidthsKey) return
    setTableColumnWidths({ key: tableColumnWidthsKey, widths })
    window.localStorage.setItem(tableColumnWidthsKey, JSON.stringify(widths))
  }
  const startColumnResize = (fieldId: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const widths = getVisibleTableWidths()
    const startWidth = widths[fieldId] ?? minimumTableColumnWidth(fieldId)
    columnResizeRef.current = { pointerId: event.pointerId, fieldId, startX: event.clientX, startWidth, widths }
    event.currentTarget.setPointerCapture(event.pointerId)
    cardsTableRef.current?.classList.add('is-column-resizing')
  }
  const moveColumnResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = columnResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    const width = Math.min(
      maximumTableColumnWidth,
      Math.max(minimumTableColumnWidth(resize.fieldId), Math.round(resize.startWidth + event.clientX - resize.startX)),
    )
    resize.widths = { ...resize.widths, [resize.fieldId]: width }
    applyLiveTableWidths(resize.widths)
  }
  const finishColumnResize = (pointerId: number) => {
    const resize = columnResizeRef.current
    if (!resize || resize.pointerId !== pointerId) return
    columnResizeRef.current = null
    cardsTableRef.current?.classList.remove('is-column-resizing')
    saveTableColumnWidths(resize.widths)
  }
  const resizeTableColumnByKeyboard = (fieldId: string, delta: number) => {
    const column = visibleTableColumns.find((item) => item.fieldId === fieldId)
    if (!column) return
    const widths = getVisibleTableWidths()
    widths[fieldId] = Math.min(
      maximumTableColumnWidth,
      Math.max(
        minimumTableColumnWidth(fieldId),
        (widths[fieldId] ?? defaultTableColumnWidth(fieldId, column.type)) + delta,
      ),
    )
    applyLiveTableWidths(widths)
    saveTableColumnWidths(widths)
  }
  const onColumnResizeKeyDown = (fieldId: string, event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    resizeTableColumnByKeyboard(fieldId, (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 50 : 10))
  }
  const toggleTableColumn = (fieldId: string) => {
    if (!tableColumnKey) return
    const ids = visibleTableColumnIds.includes(fieldId)
      ? visibleTableColumnIds.filter((id) => id !== fieldId)
      : [...visibleTableColumnIds, fieldId]
    setTableColumnPrefs({ key: tableColumnKey, ids })
    window.localStorage.setItem(tableColumnKey, JSON.stringify(ids))
  }
  const resetTableColumns = () => {
    if (!tableColumnKey) return
    setTableColumnPrefs({ key: tableColumnKey, ids: defaultTableColumnIds })
    window.localStorage.setItem(tableColumnKey, JSON.stringify(defaultTableColumnIds))
    setTableColumnWidths({ key: tableColumnWidthsKey, widths: {} })
    window.localStorage.removeItem(tableColumnWidthsKey)
  }
  const toggleSort = (fieldId: string) => {
    if (sortField === fieldId) setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(fieldId)
      setSortDirection('asc')
    }
  }
  const sortIndicator = (fieldId: string) => (sortField === fieldId ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '')
  const propertyFilterOptions = useMemo(() => {
    if (!propertyFilterField) return []
    if (propertyFilterField === 'meta_tags') return tags.map(([tag]) => tag)
    if (propertyFilterField === 'meta_status')
      return [...new Set(cards.map((card) => card.status))].sort((a, b) => a.localeCompare(b, 'it'))
    if (propertyFilterField === 'meta_quantity')
      return [...new Set(cards.map((card) => String(card.quantity)))].sort((a, b) => Number(a) - Number(b))
    const column = listColumns.find((item) => item.fieldId === propertyFilterField)
    return [
      ...new Set([
        ...cards
          .map((card) => card.values[propertyFilterField]?.trim())
          .filter((value): value is string => Boolean(value)),
        ...(column?.options ?? []),
      ]),
    ].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
  }, [propertyFilterField, tags, cards, listColumns])
  const filteredCards = useMemo(
    () =>
      cards
        .filter((card) => {
          const text =
            `${card.title} ${card.tags.join(' ')} ${Object.values(card.values).join(' ')}`.toLocaleLowerCase()
          const propertyMatches =
            !propertyFilterField ||
            !propertyFilterValue ||
            (propertyFilterField === 'meta_tags'
              ? card.tags.includes(propertyFilterValue)
              : propertyFilterField === 'meta_status'
                ? card.status === propertyFilterValue
                : propertyFilterField === 'meta_quantity'
                  ? String(card.quantity) === propertyFilterValue
                  : card.values[propertyFilterField]?.trim() === propertyFilterValue)
          return (
            (!search || text.includes(search.toLocaleLowerCase())) &&
            (!activeTag || card.tags.includes(activeTag)) &&
            (filterStatus === 'Tutti gli stati' || card.status === filterStatus) &&
            propertyMatches
          )
        })
        .sort((a, b) => {
          const value = (card: Card) => {
            if (sortField === 'meta_title') return card.title
            if (sortField === 'meta_tags') return [...card.tags].sort((x, y) => x.localeCompare(y, 'it')).join(', ')
            if (sortField === 'meta_status') return card.status
            if (sortField === 'meta_quantity') return card.quantity
            if (sortField === 'meta_updated') return new Date(card.updatedAt).getTime() || 0
            const raw = card.values[sortField]?.trim() ?? ''
            const sortColumn = listColumns.find((column) => column.fieldId === sortField)
            return sortColumn?.type === 'number' && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw
          }
          const left = value(a),
            right = value(b)
          const comparison =
            typeof left === 'number' && typeof right === 'number'
              ? left - right
              : String(left).localeCompare(String(right), 'it', { numeric: true, sensitivity: 'base' })
          return comparison === 0
            ? a.title.localeCompare(b.title, 'it')
            : comparison * (sortDirection === 'asc' ? 1 : -1)
        }),
    [
      cards,
      search,
      activeTag,
      filterStatus,
      propertyFilterField,
      propertyFilterValue,
      sortField,
      sortDirection,
      listColumns,
    ],
  )
  const progress = cards.length
    ? Math.round((cards.filter((card) => card.status === 'Ready').length / cards.length) * 100)
    : 0
  const confirmDiscardFields = () => {
    if (!fieldsDirty) return true
    const discard = window.confirm('Ci sono modifiche a campi o variabili non salvate. Vuoi scartarle?')
    if (discard) setFieldsDirty(false)
    return discard
  }
  const navigateView = (nextView: View) => {
    if (nextView === view || confirmDiscardFields()) setView(nextView)
  }

  const updateCards = (next: Card[]) => {
    if (!snapshot) return
    const resolved = ensureGeneratedIdValues(
      next.map((card) => resolveConditionalValues(columns, card)),
      columns,
      () => crypto.randomUUID(),
    )
    setSnapshot({
      ...snapshot,
      cards: resolved,
      sets: snapshot.sets.map((set) =>
        set.id === snapshot.activeSetId ? { ...set, cardCount: resolved.length } : set,
      ),
    })
    void window.cardCms
      .saveCards(resolved)
      .catch((error) => setToast(error instanceof Error ? error.message : 'Impossibile salvare le carte'))
  }
  const saveInlineField = (card: Card, fieldId: string, value: string) => {
    const updated: Card = { ...card, updatedAt: new Date().toISOString() }
    if (fieldId === 'meta_title') updated.title = value
    else if (fieldId === 'meta_tags')
      updated.tags = [
        ...new Set(
          value
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ]
    else if (fieldId === 'meta_status') updated.status = value as CardStatus
    else if (fieldId === 'meta_quantity') updated.quantity = Math.max(1, Number(value) || 1)
    else updated.values = { ...card.values, [fieldId]: value }
    updateCards(cards.map((item) => (item.id === card.id ? updated : item)))
  }
  const updateColumns = (next: ColumnDefinition[]) => {
    if (!snapshot) return
    const nextCards = ensureGeneratedIdValues(
      snapshot.cards.map((card) => resolveConditionalValues(next, card)),
      next,
      () => crypto.randomUUID(),
    )
    setSnapshot({ ...snapshot, columns: next, cards: nextCards })
    void window.cardCms
      .saveColumns(next)
      .then(() => window.cardCms.saveCards(nextCards))
      .catch((error) => setToast(error instanceof Error ? error.message : 'Impossibile salvare le modifiche'))
  }
  const updateVariables = async (next: ProjectVariable[]) => {
    const updated = await window.cardCms.saveVariables(next)
    setSnapshot(updated)
    setFieldsDirty(false)
    setToast('Variabili salvate in Tabletop Creator')
  }
  const resetListControls = () => {
    setSearch('')
    setActiveTag('')
    setFilterStatus('Tutti gli stati')
    setPropertyFilterField('')
    setPropertyFilterValue('')
    setSortField('meta_title')
    setSortDirection('asc')
  }
  const openPath = async (projectPath: string) => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.openProjectPath(projectPath)
    if (result) {
      setSnapshot(result)
      setView('cards')
      resetListControls()
      setSelected(null)
      await refreshProjects()
    }
  }
  const addProject = async () => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.openProject()
    if (result) {
      setSnapshot(result)
      setView('cards')
      resetListControls()
      setSelected(null)
      await refreshProjects()
      const pending = result.workbooks.some((book) => !result.sets.some((set) => set.sourceFile === book.file))
      if (pending) setImportOpen(true)
    }
  }
  const switchProject = async () => {
    if (!confirmDiscardFields()) return
    await refreshProjects()
    setSnapshot(null)
    setSelected(null)
    setView('cards')
  }
  const addCard = () => {
    const next = resolveConditionalValues(columns, blankCard(columns))
    updateCards([next, ...cards])
    setSelected(next)
  }
  const saveCard = (next: Card) => {
    next = resolveConditionalValues(columns, next)
    updateCards(cards.map((card) => (card.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : card)))
    setSelected(null)
    setToast('Carta aggiornata')
  }
  const exportCards = () => setExportOpen(true)
  const performExport = async (cardIds?: string[]) => {
    setExporting(true)
    try {
      const result = await window.cardCms.exportExcel(cardIds)
      if (result) setToast(`Esportate ${result.count} carte in ${result.path.split(/[\\/]/).pop()}`)
      setExportOpen(false)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile esportare il set')
    } finally {
      setExporting(false)
    }
  }
  const saveSetName = async (name: string) => {
    if (!renameTarget) return
    try {
      const next = await window.cardCms.renameSet(renameTarget.id, name)
      setSnapshot(next)
      setRenameTarget(null)
      setToast('Nome del set aggiornato')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile rinominare il set')
    }
  }
  const createSet = async () => {
    if (!snapshot || !confirmDiscardFields()) return
    const result = await window.cardCms.createSet(`Set ${snapshot.sets.length + 1}`)
    setSnapshot(result)
    setNewSetFlow(true)
    setNativeLinkOpen(true)
    setView('cards')
  }
  const deleteSet = async (id: string, name: string, cardCount: number) => {
    if (!snapshot || !confirmDiscardFields()) return
    const detail = cardCount ? ` Contiene ${cardCount} ${cardCount === 1 ? 'carta' : 'carte'}.` : ''
    if (
      !window.confirm(
        `Eliminare il set “${name}”?${detail}\n\nIl set sarà rimosso da Card Studio, ma il file Excel originale resterà nella cartella del progetto.`,
      )
    )
      return
    try {
      const result = await window.cardCms.deleteSet(id)
      setSnapshot(result)
      setSelected(null)
      setView('cards')
      resetListControls()
      setToast(`Set “${name}” eliminato`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile eliminare il set')
    }
  }
  const chooseSet = async (id: string) => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.selectSet(id)
    setSnapshot(result)
    resetListControls()
  }
  const duplicateSet = async (id: string) => {
    if (!confirmDiscardFields()) return
    try {
      const result = await window.cardCms.duplicateSet(id)
      setSnapshot(result)
      setSelected(null)
      setView('cards')
      resetListControls()
      setToast('Set duplicato con tutte le sue carte')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile duplicare il set')
    }
  }
  const moveCard = async (card: Card, targetSetId: string) => {
    try {
      const result = await window.cardCms.moveCard(card.id, targetSetId, card)
      setSnapshot(result)
      setSelected(null)
      setMovingCard(null)
      setView('cards')
      resetListControls()
      setToast(`Carta spostata in ${result.sets.find((set) => set.id === result.activeSetId)?.name ?? 'un altro set'}`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile spostare la carta')
    }
  }
  const linkNativeSet = async (file: string, index: number) => {
    if (!snapshot) return
    try {
      let setId = snapshot.activeSetId
      if (!setId) {
        const created = await window.cardCms.createSet('Nuovo set')
        setSnapshot(created)
        setId = created.activeSetId
      }
      if (!setId) return
      const result = await window.cardCms.linkNativeSet(setId, file, index)
      setSnapshot(result)
      setNativeLinkOpen(false)
      setSelected(null)
      resetListControls()
      setView('cards')
      setToast(`Set collegato: ${result.columns.length} campi importati dal blueprint e dai dati nativi`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile collegare il set nativo')
    }
  }
  const createNativeSet = async (name: string, blueprintName: string, fieldHeaders: string[] = []) => {
    if (!snapshot) return
    try {
      let setId = snapshot.activeSetId
      if (!setId) {
        const created = await window.cardCms.createSet('Nuovo set')
        setSnapshot(created)
        setId = created.activeSetId
      }
      if (!setId) return
      const blueprintPeers = snapshot.sets.filter((set) => set.blueprintName === blueprintName)
      if (!blueprintPeers.length && fieldHeaders.length) {
        const generated = fieldHeaders.map((header) => ({
          id: `column_${slug(header)}`,
          header,
          fieldId: slug(header),
          type: /color/i.test(header)
            ? ('color' as const)
            : /image|icon/i.test(header)
              ? ('image' as const)
              : ('text' as const),
        }))
        await window.cardCms.saveColumns(generated)
      }
      const result = await window.cardCms.createNativeSet(setId, name, blueprintName)
      setSnapshot(result)
      setNativeLinkOpen(false)
      setSelected(null)
      resetListControls()
      setView('cards')
      setToast('Nuovo set Tabletop Creator creato e collegato alle carte CMS')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile creare il set nativo')
    }
  }
  const openNativeLink = async (setId: string) => {
    if (!snapshot || !confirmDiscardFields()) return
    const target = snapshot.sets.find((set) => set.id === setId)
    if (!target) return
    if (target.nativeSetFile) {
      setToast('Scollega prima il set nativo dalle impostazioni di progetto')
      return
    }
    try {
      const result = await window.cardCms.selectSet(setId)
      setSnapshot(result)
      setNewSetFlow(false)
      setNativeLinkOpen(true)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile aprire i collegamenti')
    }
  }
  const unlinkNativeSet = async (setId: string, setName: string) => {
    if (!confirmDiscardFields()) return
    if (
      !window.confirm(
        `Scollegare “${setName}” dal set Tabletop Creator associato? I due set e i loro file restano intatti; viene rimossa solo l’associazione.`,
      )
    )
      return
    try {
      const result = await window.cardCms.unlinkNativeSet(setId)
      setSnapshot(result)
      setToast(`Collegamento di “${setName}” rimosso`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile scollegare il set')
    }
  }
  const saveBlueprintAssignments = async (assignments: Record<string, string>) => {
    const result = await window.cardCms.saveBlueprintAssignments(assignments)
    setSnapshot(result)
    setToast('Associazioni ai blueprint salvate; i campi sono condivisi tra i set associati')
  }
  const refreshWorkbooks = async () => {
    if (!snapshot || !confirmDiscardFields()) return
    const workbooks = await window.cardCms.scanWorkbooks()
    setSnapshot({ ...snapshot, workbooks })
    setImportOpen(true)
  }
  const finishImport = async (plans: ImportPlan[]) => {
    const result = await window.cardCms.importWorkbooks(plans)
    setSnapshot(result)
    setImportOpen(false)
    setView('cards')
    setToast(`${plans.length} set importati`)
    await refreshProjects()
  }
  const openMergePreview = async (
    file: string,
    setId: string,
    matchFieldId?: string,
    fieldIds?: string[],
    restoreFieldIds?: string[],
  ) => {
    setImportOpen(false)
    try {
      setMergePreview(await window.cardCms.previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds))
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile confrontare il foglio')
    }
  }
  const applyMerge = async (token: string, resolutions: Record<string, 'excel' | 'set'>) => {
    try {
      const result = await window.cardCms.applyWorkbookMerge(token, resolutions)
      setSnapshot(result)
      setMergePreview(null)
      setView('cards')
      setToast('Merge applicato al set')
      await refreshProjects()
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossibile applicare il merge')
    }
  }
  const addAssets = async () => {
    if (!snapshot) return
    const assets = await window.cardCms.importAssets()
    setSnapshot({ ...snapshot, assets })
    setToast('Libreria asset aggiornata')
  }
  const refreshGit = async () => {
    const [status, auth] = await Promise.all([window.cardCms.gitStatus(), window.cardCms.githubAuthStatus()])
    setGitStatus(status)
    setGithubAuth(auth)
    return status
  }
  const createGithubRepository = async (name: string, isPrivate: boolean) => {
    const result = await window.cardCms.githubCreateRepository(name, isPrivate)
    setGitStatus(result.status)
    setGithubAuth(await window.cardCms.githubAuthStatus())
    setToast(
      result.warning ? `Repository creato: ${result.warning}` : `Repository ${result.name} creato e progetto caricato`,
    )
    return result
  }
  const runGitAction = async (action: () => Promise<GitStatus>) => {
    const status = await action()
    setGitStatus(status)
    setToast(status.error ? status.error : 'Stato Git aggiornato')
  }

  return (
    <div className="app-shell">
      {snapshot && (
        <aside className="sidebar">
          <div className="brand">
            <img className="brand-logo" src="./tabletop-card-studio-logo.svg" alt="Tabletop Card Studio" />
          </div>
          <div className="side-caption project-switch-caption">
            <span>PROGETTO</span>
            <button onClick={switchProject} title="Cambia progetto">
              <MoreHorizontal size={15} />
            </button>
          </div>
          <div className="sidebar-project-name" title={snapshot.projectPath}>
            {snapshot.projectName}
          </div>
          <div className="side-caption sets-caption">
            <span>
              SET DI CARTE <b>{snapshot.sets.length}</b>
            </span>
            <button onClick={createSet} title="Crea un set">
              <Plus size={14} />
            </button>
          </div>
          <div className="set-list">
            {snapshot.sets.map((set) => (
              <div className="set-nav-row" key={set.id}>
                <button
                  className={`set-nav ${set.id === snapshot.activeSetId ? 'active' : ''}`}
                  onClick={() => void chooseSet(set.id)}
                >
                  <span className="set-nav-icon">
                    <BookOpen size={15} />
                  </span>
                  <span className="set-nav-copy">
                    <strong>{set.name}</strong>
                    <small>{set.nativeSetFile ? `TC · ${set.nativeSetFile}` : set.sourceFile || 'Creato qui'}</small>
                  </span>
                  <span className="set-count">{set.cardCount}</span>
                </button>
                <button
                  className="set-nav-duplicate"
                  aria-label={`Duplica il set ${set.name}`}
                  title={`Duplica ${set.name}`}
                  onClick={() => void duplicateSet(set.id)}
                >
                  <Copy size={12} />
                </button>
                <button
                  className="set-nav-rename"
                  aria-label={`Rinomina il set ${set.name}`}
                  title={`Rinomina ${set.name}`}
                  onClick={() => {
                    if (confirmDiscardFields()) setRenameTarget({ id: set.id, name: set.name })
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="set-nav-delete"
                  aria-label={`Elimina il set ${set.name}`}
                  title={`Elimina ${set.name}`}
                  onClick={() => void deleteSet(set.id, set.name, set.cardCount)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {!snapshot.sets.length && <div className="set-empty-note">Importa un foglio per creare il primo set.</div>}
          </div>
          <button
            type="button"
            className="native-set-link"
            onClick={() => activeSet && void openNativeLink(activeSet.id)}
            disabled={!activeSet || Boolean(activeSet.nativeSetFile)}
          >
            <Braces size={14} />
            <span>{activeSet?.nativeSetFile ? 'Set nativo collegato' : 'Collega un set nativo'}</span>
            <small>{availableNativeSets.length}</small>
          </button>
          <nav className="sidebar-navigation" aria-label="Navigazione progetto e set">
            <section className="sidebar-nav-group" aria-label="Set corrente">
              <div className="side-caption nav-group-heading">SET CORRENTE</div>
              <button
                className={`nav-item ${view === 'cards' ? 'active' : ''}`}
                onClick={() => navigateView('cards')}
                disabled={!activeSet}
              >
                <BookOpen size={17} />
                <span>Carte</span>
                <span className="nav-count">{activeSet?.cardCount ?? 0}</span>
              </button>
              <button
                className={`nav-item ${view === 'stats' ? 'active' : ''}`}
                onClick={() => navigateView('stats')}
                disabled={!activeSet}
              >
                <BarChart3 size={17} />
                <span>Statistiche</span>
              </button>
              <button
                className={`nav-item ${view === 'columns' ? 'active' : ''}`}
                onClick={() => navigateView('columns')}
                disabled={!activeSet}
              >
                <Columns3 size={17} />
                <span>Campi e colonne</span>
              </button>
              <div className="side-caption tag-heading">
                <span>TAG DEL SET</span>
                <Tag size={13} />
              </div>
              <div className="tag-list">
                {tags.length ? (
                  tags.map(([tag, count]) => (
                    <button
                      key={tag}
                      className={`tag-filter ${activeTag === tag ? 'selected' : ''}`}
                      onClick={() => {
                        if (!confirmDiscardFields()) return
                        setActiveTag(activeTag === tag ? '' : tag)
                        setView('cards')
                      }}
                    >
                      <span className="tag-dot" />
                      <span>{tag}</span>
                      <span className="tag-count">{count}</span>
                    </button>
                  ))
                ) : (
                  <div className="tag-empty">I tag delle carte compariranno qui.</div>
                )}
              </div>
            </section>
            <div className="sidebar-nav-divider" />
            <section className="sidebar-nav-group" aria-label="Strumenti del progetto">
              <div className="side-caption nav-group-heading">PROGETTO</div>
              <button
                className={`nav-item ${view === 'assets' ? 'active' : ''}`}
                onClick={() => navigateView('assets')}
              >
                <Images size={17} />
                <span>Asset di progetto</span>
                <span className="nav-count">{snapshot.assets.length}</span>
              </button>
              <button
                className={`nav-item ${view === 'variables' ? 'active' : ''}`}
                onClick={() => navigateView('variables')}
              >
                <Braces size={17} />
                <span>Variabili</span>
                <span className="nav-count">{snapshot.variables.length}</span>
              </button>
              <button
                className={`nav-item ${view === 'markdown' ? 'active' : ''}`}
                onClick={() => navigateView('markdown')}
              >
                <FileText size={17} />
                <span>Documenti Markdown</span>
              </button>
              <button
                className={`nav-item ${view === 'settings' ? 'active' : ''}`}
                onClick={() => navigateView('settings')}
              >
                <Settings size={17} />
                <span>Impostazioni progetto</span>
              </button>
              <button
                className={`nav-item ${view === 'github' ? 'active' : ''}`}
                onClick={() => {
                  if (view !== 'github' && !confirmDiscardFields()) return
                  setView('github')
                  void refreshGit()
                }}
              >
                <Github size={17} />
                <span>GitHub</span>
                {gitStatus?.isRepo && (
                  <span className={`github-nav-dot ${gitStatus.changedFiles.length ? 'has-changes' : ''}`} />
                )}
              </button>
            </section>
          </nav>
          <div className="sidebar-bottom">
            <div className="project-mini">
              <div className="project-icon">
                <Archive size={16} />
              </div>
              <div className="project-mini-copy">
                <strong>
                  {snapshot.sets.length} set · {cards.length} carte
                </strong>
                <span>{snapshot.workbooks.length} file Excel nel progetto</span>
              </div>
              <button className="icon-button mini-more" aria-label="Cambia progetto" onClick={switchProject}>
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="sidebar-foot">
              <span>STUDIO EDITION</span>
              <CircleHelp size={15} />
            </div>
          </div>
        </aside>
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span className={snapshot ? 'crumb-action' : ''} onClick={() => snapshot && void switchProject()}>
              Progetti
            </span>
            {snapshot && (
              <>
                <span className="crumb-slash">/</span>
                <strong>{snapshot.projectName}</strong>
                {activeSet && (
                  <>
                    <span className="crumb-slash">/</span>
                    <button className="crumb-current-set" onClick={() => navigateView('cards')}>
                      {activeSet.name}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          <div className="top-actions">
            {snapshot ? (
              <>
                <button className="button button-quiet" onClick={() => void refreshWorkbooks()}>
                  <FileSpreadsheet size={16} />
                  Importa Excel <span className="button-count">{snapshot.workbooks.length}</span>
                </button>
                {activeSet && (
                  <button
                    className="button button-primary"
                    onClick={exportCards}
                    disabled={fieldsDirty}
                    title={fieldsDirty ? 'Salva i campi prima di esportare' : 'Esporta set'}
                  >
                    <ArrowDownToLine size={16} />
                    Esporta set
                  </button>
                )}
              </>
            ) : (
              <button className="button button-primary" onClick={addProject}>
                <FolderPlus size={16} />
                Aggiungi progetto
              </button>
            )}
          </div>
        </header>
        {!snapshot ? (
          <ProjectChooser
            projects={projects}
            onOpen={(projectPath) => void openPath(projectPath)}
            onAdd={addProject}
            onOpenSnapshot={(result) => {
              setSnapshot(result)
              setView('cards')
              resetListControls()
              setSelected(null)
              void refreshProjects()
            }}
          />
        ) : view === 'markdown' ? (
          <MarkdownPage
            onList={() => window.cardCms.markdownList()}
            onRead={(file) => window.cardCms.markdownRead(file)}
            onSave={(file, content) => window.cardCms.markdownSave(file, content)}
            onCreate={(file) => window.cardCms.markdownCreate(file)}
            onRename={(file, name) => window.cardCms.markdownRename(file, name)}
            onDelete={(file) => window.cardCms.markdownDelete(file)}
            onSaved={async () => {
              await runGitAction(window.cardCms.gitStatus)
            }}
          />
        ) : view === 'github' ? (
          <GitHubPage
            key={snapshot.projectPath}
            projectName={snapshot.projectName}
            status={gitStatus}
            auth={githubAuth}
            onAuthChange={setGithubAuth}
            onRefresh={async () => {
              await refreshGit()
            }}
            onCreateRepository={createGithubRepository}
            onInit={() => runGitAction(window.cardCms.gitInit)}
            onConnect={(url) => runGitAction(() => window.cardCms.gitConnect(url))}
            onCommit={(message) => runGitAction(() => window.cardCms.gitCommit(message))}
            onPull={() => runGitAction(window.cardCms.gitPull)}
            onPush={() => runGitAction(() => window.cardCms.gitPush())}
            onBranchSwitch={(name) => runGitAction(() => window.cardCms.gitSwitchBranch(name))}
            onBranchCreate={(name, commit) => runGitAction(() => window.cardCms.gitCreateBranch(name, commit))}
            onBranchDelete={(name) => runGitAction(() => window.cardCms.gitDeleteBranch(name))}
            onCommitFiles={(hash) => window.cardCms.gitCommitFiles(hash)}
            onCommitFile={(hash, file) => window.cardCms.gitCommitFile(hash, file)}
            onOpenGitHub={() => void window.cardCms.openGitHub()}
            onGithubLoginStart={() => window.cardCms.githubStartLogin()}
            onGithubLoginPoll={() => window.cardCms.githubPollLogin()}
            onGithubLoginCancel={() => window.cardCms.githubCancelLogin()}
            onGithubLogout={() => window.cardCms.githubLogout()}
            onOpenGithubLogin={() => window.cardCms.openGitHubDeviceLogin()}
            onOpenGithubInstall={() => window.cardCms.openGitHubAppInstall()}
            onOpenGithubRepository={(url) => window.cardCms.openGitHubRepository(url)}
          />
        ) : view === 'assets' ? (
          <AssetsPage assets={snapshot.assets} onAdd={addAssets} />
        ) : view === 'variables' ? (
          <VariablesPage
            key={snapshot.projectPath}
            projectPath={snapshot.projectPath}
            variables={snapshot.variables}
            onSave={updateVariables}
            onDirty={setFieldsDirty}
          />
        ) : view === 'settings' ? (
          <ProjectSettingsPage
            projectName={snapshot.projectName}
            projectPath={snapshot.projectPath}
            sets={snapshot.sets}
            nativeSets={snapshot.nativeSets}
            blueprints={snapshot.blueprints}
            onLink={(setId) => void openNativeLink(setId)}
            onUnlink={(setId, name) => void unlinkNativeSet(setId, name)}
            onSaveBlueprints={saveBlueprintAssignments}
            onDirty={setFieldsDirty}
            onOpenLog={() =>
              void window.cardCms
                .openDiagnosticLog()
                .then((file) => setToast(`Log aperto: ${file}`))
                .catch((error) => setToast(error instanceof Error ? error.message : 'Impossibile aprire il log'))
            }
          />
        ) : !activeSet ? (
          <ImportLanding snapshot={snapshot} onImport={() => void refreshWorkbooks()} onCreate={createSet} />
        ) : view === 'stats' ? (
          <StatisticsPage key={snapshot.activeSetId} cards={cards} columns={columns} />
        ) : view === 'cards' ? (
          <div className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-line" />
                  SET · {activeSet.name.toLocaleUpperCase()}
                </div>
                <h1>
                  Le tue carte<span className="heading-period">.</span>
                </h1>
                <p>
                  {activeSet.nativeSetFile
                    ? `Collegato al set nativo data/sets/${activeSet.nativeSetFile}.`
                    : activeSet.sourceFile
                      ? `Importate da ${activeSet.sourceFile}.`
                      : 'Un tavolo ordinato per le idee in movimento.'}
                </p>
              </div>
              <button className="button button-primary add-button" onClick={addCard}>
                <Plus size={17} />
                Nuova carta
              </button>
            </div>
            <section className="overview-strip">
              <div className="overview-cell total-cell">
                <span className="metric-label">CARTE NEL SET</span>
                <div className="metric-line">
                  <strong>{String(cards.length).padStart(2, '0')}</strong>
                  <span>carte</span>
                </div>
              </div>
              <div className="overview-cell">
                <span className="metric-label">IN PLAYTEST</span>
                <div className="metric-line">
                  <strong>{String(cards.filter((card) => card.status === 'Playtest').length).padStart(2, '0')}</strong>
                  <span>carte</span>
                </div>
              </div>
              <div className="overview-cell">
                <span className="metric-label">PRONTE</span>
                <div className="progress-line">
                  <div className="progress-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <strong>{progress}%</strong>
                </div>
                <span className="metric-foot">
                  {cards.filter((card) => card.status === 'Ready').length} di {cards.length} carte complete
                </span>
              </div>
              <div className="overview-note">
                <Sparkles size={17} />
                <span>
                  {snapshot.sets.length} set nel progetto
                  <br />
                  {snapshot.workbooks.length} file Excel rilevati
                </span>
              </div>
            </section>
            <div className="list-toolbar">
              <div className="list-title">
                <h2>Archivio</h2>
                <span>
                  {filteredCards.length} di {cards.length} {cards.length === 1 ? 'carta' : 'carte'}
                </span>
                {activeTag && (
                  <button className="active-filter" onClick={() => setActiveTag('')}>
                    <Tag size={12} />
                    {activeTag}
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="list-controls">
                <label className="search-box">
                  <Search size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cerca una carta…"
                  />
                </label>
                <label className="select-wrap" title="Filtra per stato">
                  <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                    <option>Tutti gli stati</option>
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <label className="select-wrap" title="Filtra per campo">
                  <select
                    value={propertyFilterField}
                    onChange={(event) => {
                      setPropertyFilterField(event.target.value)
                      setPropertyFilterValue('')
                    }}
                  >
                    <option value="">Filtra campo…</option>
                    <option value="meta_tags">Tag</option>
                    {listColumns.map((column) => (
                      <option key={column.id} value={column.fieldId}>
                        {column.header}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                {propertyFilterField && (
                  <label className="select-wrap" title="Valore del filtro">
                    <select
                      value={propertyFilterValue}
                      onChange={(event) => setPropertyFilterValue(event.target.value)}
                    >
                      <option value="">Tutti i valori</option>
                      {propertyFilterOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                )}
                <div className="table-columns-menu">
                  <button
                    type="button"
                    className={`table-columns-trigger ${columnsMenuOpen ? 'active' : ''}`}
                    onClick={() => setColumnsMenuOpen((open) => !open)}
                    aria-expanded={columnsMenuOpen}
                  >
                    <Columns3 size={14} />
                    Colonne <span>{visibleTableColumns.length}</span>
                  </button>
                  {columnsMenuOpen && (
                    <section className="table-columns-popover" aria-label="Colonne visibili">
                      <header>
                        <strong>Colonne visibili</strong>
                        <button type="button" onClick={resetTableColumns}>
                          Predefinite
                        </button>
                      </header>
                      <div>
                        {availableTableColumns.map((column) => (
                          <label key={column.fieldId}>
                            <input
                              type="checkbox"
                              checked={visibleTableColumnIds.includes(column.fieldId)}
                              onChange={() => toggleTableColumn(column.fieldId)}
                            />
                            <span>{column.label}</span>
                          </label>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
            <div
              ref={cardsTableRef}
              className={`cards-table ${columnResizeRef.current ? 'is-column-resizing' : ''}`}
              style={tableGridStyle}
            >
              <div className="table-head">
                {visibleTableColumns.map((column) => (
                  <div key={column.fieldId} className="table-head-cell" data-field-id={column.fieldId}>
                    <button
                      type="button"
                      className={`table-sort ${column.className}`}
                      onClick={() => toggleSort(column.fieldId)}
                      aria-label={`Ordina per ${column.label}${sortIndicator(column.fieldId)}`}
                      title={`Ordina per ${column.label}`}
                    >
                      {column.header.toLocaleUpperCase()}
                      {sortIndicator(column.fieldId)}
                    </button>
                    <div
                      className="table-resize-handle"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Ridimensiona la colonna ${column.label}`}
                      aria-valuenow={Math.round(
                        storedTableWidths?.[column.fieldId] ?? defaultTableColumnWidth(column.fieldId, column.type),
                      )}
                      aria-valuemin={minimumTableColumnWidth(column.fieldId)}
                      aria-valuemax={maximumTableColumnWidth}
                      tabIndex={0}
                      title="Trascina per ridimensionare · Frecce per regolare"
                      onPointerDown={(event) => startColumnResize(column.fieldId, event)}
                      onPointerMove={moveColumnResize}
                      onPointerUp={(event) => finishColumnResize(event.pointerId)}
                      onPointerCancel={(event) => finishColumnResize(event.pointerId)}
                      onLostPointerCapture={(event) => finishColumnResize(event.pointerId)}
                      onKeyDown={(event) => onColumnResizeKeyDown(column.fieldId, event)}
                    />
                  </div>
                ))}
                <span className="col-action" />
              </div>
              {filteredCards.length ? (
                filteredCards.map((card, index) => (
                  <div key={card.id} className="card-row">
                    {visibleTableColumns.map((column) => {
                      if (column.fieldId === 'meta_title')
                        return (
                          <InlineTableCell
                            key={column.fieldId}
                            fieldId={column.fieldId}
                            value={card.title}
                            assets={snapshot.assets}
                            variables={snapshot.variables}
                            projectPath={snapshot.projectPath}
                            onSave={(value) => saveInlineField(card, column.fieldId, value)}
                            display={
                              <span className="card-name col-card">
                                <span className={`card-index tone-${index % 4}`}>
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                                <span>
                                  <strong>{card.title || 'Carta senza titolo'}</strong>
                                  <small>
                                    {preview(card, columns, snapshot.assets, snapshot.variables, snapshot.projectPath)}
                                  </small>
                                </span>
                              </span>
                            }
                          />
                        )
                      if (column.fieldId === 'meta_tags')
                        return (
                          <InlineTableCell
                            key={column.fieldId}
                            fieldId={column.fieldId}
                            value={card.tags.join(', ')}
                            assets={snapshot.assets}
                            variables={snapshot.variables}
                            projectPath={snapshot.projectPath}
                            onSave={(value) => saveInlineField(card, column.fieldId, value)}
                            display={
                              <span className="col-tags row-tags">
                                {card.tags.length ? (
                                  card.tags.slice(0, 3).map((tag) => (
                                    <span className="tag-pill" key={tag}>
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="muted-dash">—</span>
                                )}
                                {card.tags.length > 3 && <span className="tag-extra">+{card.tags.length - 3}</span>}
                              </span>
                            }
                          />
                        )
                      if (column.fieldId === 'meta_status')
                        return (
                          <InlineTableCell
                            key={column.fieldId}
                            fieldId={column.fieldId}
                            value={card.status}
                            assets={snapshot.assets}
                            variables={snapshot.variables}
                            projectPath={snapshot.projectPath}
                            onSave={(value) => saveInlineField(card, column.fieldId, value)}
                            display={
                              <span className="col-status">
                                <span className={`status-pill status-${card.status.toLowerCase()}`}>
                                  <i />
                                  {card.status}
                                </span>
                              </span>
                            }
                          />
                        )
                      if (column.fieldId === 'meta_quantity')
                        return (
                          <InlineTableCell
                            key={column.fieldId}
                            fieldId={column.fieldId}
                            value={String(card.quantity)}
                            assets={snapshot.assets}
                            variables={snapshot.variables}
                            projectPath={snapshot.projectPath}
                            onSave={(value) => saveInlineField(card, column.fieldId, value)}
                            display={<span className="col-qty quantity">{String(card.quantity).padStart(2, '0')}</span>}
                          />
                        )
                      if (column.fieldId === 'meta_updated')
                        return (
                          <InlineTableCell
                            key={column.fieldId}
                            fieldId={column.fieldId}
                            value={card.updatedAt}
                            assets={snapshot.assets}
                            variables={snapshot.variables}
                            projectPath={snapshot.projectPath}
                            onSave={() => undefined}
                            display={<span className="col-updated updated">{formatDate(card.updatedAt)}</span>}
                          />
                        )
                      const definition = columns.find((item) => item.fieldId === column.fieldId)
                      const value = card.values[column.fieldId]?.trim() ?? ''
                      const asset =
                        definition?.type === 'image'
                          ? snapshot.assets.find((item) => item.path === value || item.name === value)
                          : undefined
                      const textLikeField =
                        !definition?.type ||
                        definition.type === 'text' ||
                        definition.type === 'longtext' ||
                        definition.type === 'variable'
                      const variablePreview =
                        textLikeField && /\{[^{}]+\}/.test(value) ? (
                          <VariableTextPreview
                            value={value}
                            variables={snapshot.variables}
                            projectPath={snapshot.projectPath}
                            className="row-variable-preview"
                            inline
                          />
                        ) : null
                      const display =
                        definition?.type === 'image' && asset?.previewUrl ? (
                          <span className="table-image-cell" title={asset.name}>
                            <img src={asset.previewUrl} alt="" />
                            <small>{asset.name}</small>
                          </span>
                        ) : definition?.type === 'color' && value ? (
                          <span className="table-custom-cell" title={value}>
                            <i className="table-color-swatch" style={{ backgroundColor: value }} />
                            <span>{value}</span>
                          </span>
                        ) : variablePreview ? (
                          <span className="table-custom-cell table-variable-cell" title={value}>
                            {variablePreview}
                          </span>
                        ) : (
                          <span className="table-custom-cell" title={value || '—'}>
                            {value || <span className="muted-dash">—</span>}
                          </span>
                        )
                      return (
                        <InlineTableCell
                          key={column.fieldId}
                          fieldId={column.fieldId}
                          value={value}
                          display={display}
                          definition={definition}
                          assets={snapshot.assets}
                          variables={snapshot.variables}
                          projectPath={snapshot.projectPath}
                          onSave={(next) => saveInlineField(card, column.fieldId, next)}
                        />
                      )
                    })}
                    <button
                      type="button"
                      className="col-action row-chevron inline-row-open"
                      onClick={() => setSelected(card)}
                      aria-label={`Apri ${card.title} nell'editor`}
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-list">
                  <div className="empty-mark">
                    <BookOpen size={21} />
                  </div>
                  <strong>
                    {search || activeTag || filterStatus !== 'Tutti gli stati' || propertyFilterValue
                      ? 'Nessuna carta corrisponde.'
                      : 'Il set comincia da qui.'}
                  </strong>
                  <span>
                    {cards.length
                      ? 'Prova a cambiare i filtri oppure aggiungi una carta.'
                      : 'Importa un foglio o crea una nuova carta.'}
                  </span>
                  {!cards.length && (
                    <div className="empty-actions">
                      <button className="button button-primary" onClick={addCard}>
                        <Plus size={15} />
                        Crea carta
                      </button>
                      <button className="text-button" onClick={() => void refreshWorkbooks()}>
                        <FileSpreadsheet size={15} />
                        Importa Excel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <footer className="page-foot">
              <span>
                <span className="live-dot" />
                SALVATAGGIO AUTOMATICO
              </span>
              <span>{snapshot.projectPath}</span>
            </footer>
          </div>
        ) : (
          <ColumnsPage
            key={snapshot.activeSetId}
            columns={columns}
            assets={snapshot.assets}
            variables={snapshot.variables}
            blueprintName={activeSet?.blueprintName}
            blueprint={snapshot.blueprints.find((item) => item.name === activeSet?.blueprintName)}
            sharedSetCount={
              activeSet?.blueprintName
                ? snapshot.sets.filter((set) => set.blueprintName === activeSet.blueprintName).length
                : 1
            }
            onReloadBlueprints={async () => {
              const updated = await window.cardCms.reloadBlueprints()
              setSnapshot(updated)
              setToast('Blueprint riletti dal progetto')
            }}
            onSave={updateColumns}
            onDirty={setFieldsDirty}
            onExport={exportCards}
          />
        )}
      </main>
      {selected && snapshot && (
        <CardEditor
          card={selected}
          columns={columns}
          assets={snapshot.assets}
          variables={snapshot.variables}
          blueprints={snapshot.blueprints}
          blueprintName={activeSet?.blueprintName ?? ''}
          projectPath={snapshot.projectPath}
          canMove={snapshot.sets.length > 1}
          onMove={setMovingCard}
          onClose={() => setSelected(null)}
          onSave={saveCard}
          onDelete={() => {
            updateCards(cards.filter((card) => card.id !== selected.id))
            setSelected(null)
            setToast('Carta rimossa dal set')
          }}
        />
      )}
      {importOpen && snapshot && (
        <ImportWizard
          workbooks={snapshot.workbooks}
          sets={snapshot.sets}
          onRefresh={async () => {
            const found = await window.cardCms.scanWorkbooks()
            setSnapshot({ ...snapshot, workbooks: found })
            return found
          }}
          onClose={() => setImportOpen(false)}
          onImport={finishImport}
          onMerge={openMergePreview}
        />
      )}
      {mergePreview && (
        <MergeWizard
          preview={mergePreview}
          onPreview={(file, setId, matchFieldId, fieldIds, restoreFieldIds) =>
            window.cardCms.previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds)
          }
          onClose={() => setMergePreview(null)}
          onApply={applyMerge}
        />
      )}
      {exportOpen && (
        <ExportChoiceDialog
          filteredCount={filteredCards.length}
          totalCount={cards.length}
          exporting={exporting}
          onClose={() => setExportOpen(false)}
          onExportView={() => void performExport(filteredCards.map((card) => card.id))}
          onExportAll={() => void performExport()}
        />
      )}
      {nativeLinkOpen && snapshot && (
        <NativeSetLinkDialog
          nativeSets={availableNativeSets}
          blueprints={snapshot.blueprints}
          sets={snapshot.sets}
          preferCreate={newSetFlow}
          targetName={activeSet?.name ?? 'Nuovo set'}
          alreadyLinked={Boolean(activeSet?.nativeSetFile)}
          onClose={() => setNativeLinkOpen(false)}
          onLink={linkNativeSet}
          onCreate={createNativeSet}
        />
      )}
      {renameTarget && (
        <RenameSetDialog name={renameTarget.name} onClose={() => setRenameTarget(null)} onSave={saveSetName} />
      )}
      {snapshot &&
        (() => {
          const conflict = snapshot.sets
            .map((set) => ({
              set,
              native: snapshot.nativeSets.find(
                (item) => item.file === set.nativeSetFile && item.index === set.nativeSetIndex,
              ),
            }))
            .find((item) => item.native && item.native.name !== item.set.name)
          return conflict ? (
            <NativeNameConflictDialog
              cmsName={conflict.set.name}
              nativeName={conflict.native!.name}
              onResolve={async (resolution) => {
                try {
                  const next = await window.cardCms.resolveNativeSetNameConflict(conflict.set.id, resolution)
                  setSnapshot(next)
                  setToast('Nomi dei set sincronizzati')
                } catch (error) {
                  setToast(error instanceof Error ? error.message : 'Impossibile risolvere il conflitto')
                }
              }}
            />
          ) : null
        })()}
      {movingCard && snapshot && (
        <MoveCardDialog
          card={movingCard}
          sets={snapshot.sets}
          activeSetId={snapshot.activeSetId}
          onClose={() => setMovingCard(null)}
          onMove={(targetSetId) => moveCard(movingCard, targetSetId)}
        />
      )}
      {toast && (
        <div className="toast">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
