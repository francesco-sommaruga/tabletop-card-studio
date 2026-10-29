import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowDownToLine, ArrowRight, BarChart3, BookOpen, Braces, Check, ChevronDown, CircleHelp, CircleAlert, Columns3, Download, ExternalLink, EyeOff, FileImage, FileSpreadsheet, FolderPlus, GitBranch, Github, GripVertical, Images, MoreHorizontal, Palette, Pencil, Plus, RefreshCw, Search, Sparkles, Tag, Upload, X } from 'lucide-react'
import type { Card, CardStatus, ColumnDefinition, GitStatus, ImportPlan, ProjectAsset, ProjectSnapshot, ProjectSummary, ProjectVariable, WorkbookMergePreview, WorkbookInfo } from './types'
import { resolveConditionalValues } from './conditional'

type View = 'cards' | 'columns' | 'assets' | 'github' | 'stats' | 'variables'
const statuses: CardStatus[] = ['Idea', 'Design', 'Playtest', 'Ready']
const metaFields = [
  { id: 'meta_title', label: 'Titolo carta' },
  { id: 'meta_quantity', label: 'Quantità' },
  { id: 'meta_status', label: 'Stato CMS' },
  { id: 'meta_tags', label: 'Tag CMS' },
]
const slug = (value: string) => `field_${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'nuovo_campo'}`
function normalizeAssetReference(value: string) {
  const normalized = value.trim().replace(/\\/g, '/')
  const lower = normalized.toLocaleLowerCase()
  const tabletopReference = (reference: string) => reference.startsWith('images/card-studio/') ? reference.slice('images/'.length) : reference
  const marker = lower.lastIndexOf('/assets/')
  if (marker >= 0) return tabletopReference(normalized.slice(marker + '/assets/'.length))
  if (lower.startsWith('assets/')) return tabletopReference(normalized.slice('assets/'.length))
  if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) return normalized.split('/').filter(Boolean).pop() ?? ''
  return tabletopReference(normalized.replace(/^\.\//, '').replace(/^\/+/, ''))
}
const iconPreviewCache = new Map<string, Promise<string | null>>()
function IconPreview({ reference, projectPath, className = '' }: { reference: string; projectPath: string; className?: string }) {
  const [source, setSource] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    const key = `${projectPath}\u0000${reference}`
    let pending = iconPreviewCache.get(key)
    if (!pending) { pending = window.cardCms.resolveIcon(reference); iconPreviewCache.set(key, pending) }
    void pending.then((result) => { if (current) setSource(result) }).catch(() => { if (current) setSource(null) })
    return () => { current = false }
  }, [projectPath, reference])
  if (!reference.trim()) return null
  return source ? <img className={className} src={source} alt={`Icona ${reference}`}/>: <span className={`${className} icon-preview-fallback`} title={reference}>{reference}</span>
}

function VariableTextPreview({ value, variables, projectPath }: { value: string; variables: ProjectVariable[]; projectPath: string }) {
  const normalized = value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
  const segments = normalized.split(/(\{[^{}]+\})/g)
  if (!segments.some((segment) => /^\{[^{}]+\}$/.test(segment))) return null
  return <div className="variable-render-preview" aria-label="Anteprima testo con variabili">{segments.map((segment, index) => {
    const match = segment.match(/^\{\s*(.*?)\s*\}$/)
    if (!match) return <span key={index}>{segment}</span>
    const token = match[1]
    const variable = variables.find((item) => item.code.toLocaleLowerCase() === token.toLocaleLowerCase())
    if (variable?.studioType === 'icon') return <IconPreview key={index} reference={variable.replacement} projectPath={projectPath} className="inline-variable-icon"/>
    if (variable) return <span key={index}>{variable.replacement}</span>
    if (token.includes('/') || /\.(png|svg|webp|jpe?g)$/i.test(token)) return <IconPreview key={index} reference={token} projectPath={projectPath} className="inline-variable-icon"/>
    return <span key={index}>{segment}</span>
  })}</div>
}
const blankCard = (): Card => ({ id: `card_${crypto.randomUUID()}`, title: 'Nuova carta', status: 'Idea', tags: [], quantity: 1, values: {}, updatedAt: new Date().toISOString() })

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
  const [sortField, setSortField] = useState('meta_updated')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [importOpen, setImportOpen] = useState(false)
  const [mergePreview, setMergePreview] = useState<WorkbookMergePreview | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [fieldsDirty, setFieldsDirty] = useState(false)

  const refreshProjects = () => window.cardCms.listProjects().then(setProjects)
  useEffect(() => { void refreshProjects() }, [])
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 2800); return () => clearTimeout(timer) } }, [toast])
  useEffect(() => {
    if (!fieldsDirty) return
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [fieldsDirty])

  const cards = snapshot?.cards ?? []
  const columns = snapshot?.columns ?? []
  const activeSet = snapshot?.sets.find((set) => set.id === snapshot.activeSetId)
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    cards.forEach((card) => card.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [cards])
  const listColumns = columns.filter((column, index, all) => column.type !== 'image' && all.findIndex((item) => item.fieldId === column.fieldId) === index)
  const toggleSort = (fieldId: string) => {
    if (sortField === fieldId) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortField(fieldId); setSortDirection('asc') }
  }
  const sortIndicator = (fieldId: string) => sortField === fieldId ? sortDirection === 'asc' ? ' ↑' : ' ↓' : ''
  const propertyFilterOptions = useMemo(() => {
    if (!propertyFilterField) return []
    if (propertyFilterField === 'meta_tags') return tags.map(([tag]) => tag)
    if (propertyFilterField === 'meta_status') return [...new Set(cards.map((card) => card.status))].sort((a, b) => a.localeCompare(b, 'it'))
    if (propertyFilterField === 'meta_quantity') return [...new Set(cards.map((card) => String(card.quantity)))].sort((a, b) => Number(a) - Number(b))
    const column = listColumns.find((item) => item.fieldId === propertyFilterField)
    return [...new Set([...cards.map((card) => card.values[propertyFilterField]?.trim()).filter((value): value is string => Boolean(value)), ...(column?.options ?? [])])].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }))
  }, [propertyFilterField, tags, cards, listColumns])
  const filteredCards = useMemo(() => cards.filter((card) => {
    const text = `${card.title} ${card.tags.join(' ')} ${Object.values(card.values).join(' ')}`.toLocaleLowerCase()
    const propertyMatches = !propertyFilterField || !propertyFilterValue || (propertyFilterField === 'meta_tags' ? card.tags.includes(propertyFilterValue) : propertyFilterField === 'meta_status' ? card.status === propertyFilterValue : propertyFilterField === 'meta_quantity' ? String(card.quantity) === propertyFilterValue : card.values[propertyFilterField]?.trim() === propertyFilterValue)
    return (!search || text.includes(search.toLocaleLowerCase())) && (!activeTag || card.tags.includes(activeTag)) && (filterStatus === 'Tutti gli stati' || card.status === filterStatus) && propertyMatches
  }).sort((a, b) => {
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
    const left = value(a), right = value(b)
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'it', { numeric: true, sensitivity: 'base' })
    return comparison === 0 ? a.title.localeCompare(b.title, 'it') : comparison * (sortDirection === 'asc' ? 1 : -1)
  }), [cards, search, activeTag, filterStatus, propertyFilterField, propertyFilterValue, sortField, sortDirection, listColumns])
  const progress = cards.length ? Math.round(cards.filter((card) => card.status === 'Ready').length / cards.length * 100) : 0
  const confirmDiscardFields = () => {
    if (!fieldsDirty) return true
    const discard = window.confirm('Ci sono modifiche a campi o variabili non salvate. Vuoi scartarle?')
    if (discard) setFieldsDirty(false)
    return discard
  }
  const navigateView = (nextView: View) => { if (nextView === view || confirmDiscardFields()) setView(nextView) }

  const updateCards = (next: Card[]) => {
    if (!snapshot) return
    const resolved = next.map((card) => resolveConditionalValues(columns, card))
    setSnapshot({ ...snapshot, cards: resolved, sets: snapshot.sets.map((set) => set.id === snapshot.activeSetId ? { ...set, cardCount: resolved.length } : set) })
    void window.cardCms.saveCards(resolved)
  }
  const updateColumns = (next: ColumnDefinition[]) => {
    if (!snapshot) return
    const nextCards = snapshot.cards.map((card) => resolveConditionalValues(next, card))
    setSnapshot({ ...snapshot, columns: next, cards: nextCards })
    void window.cardCms.saveColumns(next).then(() => window.cardCms.saveCards(nextCards))
  }
  const updateVariables = async (next: ProjectVariable[]) => {
    const updated = await window.cardCms.saveVariables(next)
    setSnapshot(updated); setFieldsDirty(false); setToast('Variabili salvate in Tabletop Creator')
  }
  const resetListControls = () => { setSearch(''); setActiveTag(''); setFilterStatus('Tutti gli stati'); setPropertyFilterField(''); setPropertyFilterValue(''); setSortField('meta_updated'); setSortDirection('desc') }
  const openPath = async (projectPath: string) => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.openProjectPath(projectPath)
    if (result) { setSnapshot(result); setView('cards'); resetListControls(); setSelected(null); await refreshProjects() }
  }
  const addProject = async () => {
    if (!confirmDiscardFields()) return
    const result = await window.cardCms.openProject()
    if (result) {
      setSnapshot(result); setView('cards'); resetListControls(); setSelected(null); await refreshProjects()
      const pending = result.workbooks.some((book) => !result.sets.some((set) => set.sourceFile === book.file))
      if (pending) setImportOpen(true)
    }
  }
  const switchProject = async () => { if (!confirmDiscardFields()) return; await refreshProjects(); setSnapshot(null); setSelected(null); setView('cards') }
  const addCard = () => { const next = resolveConditionalValues(columns, blankCard()); updateCards([next, ...cards]); setSelected(next) }
  const saveCard = (next: Card) => { next = resolveConditionalValues(columns, next); updateCards(cards.map((card) => card.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : card)); setSelected(null); setToast('Carta aggiornata') }
  const exportCards = async () => { const result = await window.cardCms.exportExcel(); if (result) setToast(`Esportate ${result.count} carte in ${result.path.split(/[\\/]/).pop()}`) }
  const saveSetName = async (name: string) => {
    if (!renameTarget) return
    try { const next = await window.cardCms.renameSet(renameTarget.id, name); setSnapshot(next); setRenameTarget(null); setToast('Nome del set aggiornato') }
    catch (error) { setToast(error instanceof Error ? error.message : 'Impossibile rinominare il set') }
  }
  const createSet = async () => { if (!snapshot || !confirmDiscardFields()) return; const result = await window.cardCms.createSet(`Set ${snapshot.sets.length + 1}`); setSnapshot(result); setView('cards'); setToast('Nuovo set creato') }
  const chooseSet = async (id: string) => { if (!confirmDiscardFields()) return; const result = await window.cardCms.selectSet(id); setSnapshot(result); resetListControls() }
  const refreshWorkbooks = async () => { if (!snapshot || !confirmDiscardFields()) return; const workbooks = await window.cardCms.scanWorkbooks(); setSnapshot({ ...snapshot, workbooks }); setImportOpen(true) }
  const finishImport = async (plans: ImportPlan[]) => { const result = await window.cardCms.importWorkbooks(plans); setSnapshot(result); setImportOpen(false); setView('cards'); setToast(`${plans.length} set importati`); await refreshProjects() }
  const openMergePreview = async (file: string, setId: string, matchFieldId?: string, fieldIds?: string[], restoreFieldIds?: string[]) => {
    setImportOpen(false)
    try { setMergePreview(await window.cardCms.previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds)) }
    catch (error) { setToast(error instanceof Error ? error.message : 'Impossibile confrontare il foglio') }
  }
  const applyMerge = async (token: string, resolutions: Record<string, 'excel' | 'set'>) => {
    try { const result = await window.cardCms.applyWorkbookMerge(token, resolutions); setSnapshot(result); setMergePreview(null); setView('cards'); setToast('Merge applicato al set'); await refreshProjects() }
    catch (error) { setToast(error instanceof Error ? error.message : 'Impossibile applicare il merge') }
  }
  const addAssets = async () => { if (!snapshot) return; const assets = await window.cardCms.importAssets(); setSnapshot({ ...snapshot, assets }); setToast('Libreria asset aggiornata') }
  const refreshGit = async () => { const status = await window.cardCms.gitStatus(); setGitStatus(status); return status }
  const runGitAction = async (action: () => Promise<GitStatus>) => { const status = await action(); setGitStatus(status); setToast(status.error ? 'Operazione Git non completata' : 'Stato Git aggiornato') }

  return <div className="app-shell">
    {snapshot && <aside className="sidebar">
      <div className="brand"><img className="brand-logo" src="/tabletop-card-studio-logo.svg" alt="Tabletop Card Studio" /></div>
      <div className="side-caption project-switch-caption"><span>PROGETTO</span><button onClick={switchProject} title="Cambia progetto"><MoreHorizontal size={15} /></button></div>
      <div className="sidebar-project-name" title={snapshot.projectPath}>{snapshot.projectName}</div>
      <div className="side-caption sets-caption"><span>SET DI CARTE <b>{snapshot.sets.length}</b></span><button onClick={createSet} title="Crea un set"><Plus size={14} /></button></div>
      <div className="set-list">{snapshot.sets.map((set) => <div className="set-nav-row" key={set.id}><button className={`set-nav ${set.id === snapshot.activeSetId ? 'active' : ''}`} onClick={() => void chooseSet(set.id)}><span className="set-nav-icon"><BookOpen size={15} /></span><span className="set-nav-copy"><strong>{set.name}</strong><small>{set.sourceFile || 'Creato qui'}</small></span><span className="set-count">{set.cardCount}</span></button><button className="set-nav-rename" aria-label={`Rinomina il set ${set.name}`} title={`Rinomina ${set.name}`} onClick={() => { if (confirmDiscardFields()) setRenameTarget({ id: set.id, name: set.name }) }}><Pencil size={13}/></button></div>)}{!snapshot.sets.length && <div className="set-empty-note">Importa un foglio per creare il primo set.</div>}</div>
      <nav className="sidebar-navigation" aria-label="Navigazione progetto e set">
        <section className="sidebar-nav-group" aria-label="Set corrente">
          <div className="side-caption nav-group-heading">SET CORRENTE</div>
          <button className={`nav-item ${view === 'cards' ? 'active' : ''}`} onClick={() => navigateView('cards')} disabled={!activeSet}><BookOpen size={17}/><span>Carte</span><span className="nav-count">{activeSet?.cardCount ?? 0}</span></button>
          <button className={`nav-item ${view === 'stats' ? 'active' : ''}`} onClick={() => navigateView('stats')} disabled={!activeSet}><BarChart3 size={17}/><span>Statistiche</span></button>
          <button className={`nav-item ${view === 'columns' ? 'active' : ''}`} onClick={() => navigateView('columns')} disabled={!activeSet}><Columns3 size={17}/><span>Campi e colonne</span></button>
          <div className="side-caption tag-heading"><span>TAG DEL SET</span><Tag size={13}/></div>
          <div className="tag-list">{tags.length ? tags.map(([tag, count]) => <button key={tag} className={`tag-filter ${activeTag === tag ? 'selected' : ''}`} onClick={() => { if (!confirmDiscardFields()) return; setActiveTag(activeTag === tag ? '' : tag); setView('cards') }}><span className="tag-dot"/><span>{tag}</span><span className="tag-count">{count}</span></button>) : <div className="tag-empty">I tag delle carte compariranno qui.</div>}</div>
        </section>
        <div className="sidebar-nav-divider"/>
        <section className="sidebar-nav-group" aria-label="Strumenti del progetto">
          <div className="side-caption nav-group-heading">PROGETTO</div>
          <button className={`nav-item ${view === 'assets' ? 'active' : ''}`} onClick={() => navigateView('assets')}><Images size={17}/><span>Asset di progetto</span><span className="nav-count">{snapshot.assets.length}</span></button>
          <button className={`nav-item ${view === 'variables' ? 'active' : ''}`} onClick={() => navigateView('variables')}><Braces size={17}/><span>Variabili</span><span className="nav-count">{snapshot.variables.length}</span></button>
          <button className={`nav-item ${view === 'github' ? 'active' : ''}`} onClick={() => { if (view !== 'github' && !confirmDiscardFields()) return; setView('github'); void refreshGit() }}><Github size={17}/><span>GitHub</span>{gitStatus?.isRepo && <span className={`github-nav-dot ${gitStatus.changedFiles.length ? 'has-changes' : ''}`}/>}</button>
        </section>
      </nav>
      <div className="sidebar-bottom"><div className="project-mini"><div className="project-icon"><Archive size={16} /></div><div className="project-mini-copy"><strong>{snapshot.sets.length} set · {cards.length} carte</strong><span>{snapshot.workbooks.length} file Excel nel progetto</span></div><button className="icon-button mini-more" aria-label="Cambia progetto" onClick={switchProject}><MoreHorizontal size={18} /></button></div><div className="sidebar-foot"><span>STUDIO EDITION</span><CircleHelp size={15} /></div></div>
    </aside>}

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span className={snapshot ? 'crumb-action' : ''} onClick={() => snapshot && void switchProject()}>Progetti</span>{snapshot && <><span className="crumb-slash">/</span><strong>{snapshot.projectName}</strong>{activeSet && <><span className="crumb-slash">/</span><button className="crumb-current-set" onClick={() => navigateView('cards')}>{activeSet.name}</button></>}</>}</div><div className="top-actions">{snapshot ? <><button className="button button-quiet" onClick={() => void refreshWorkbooks()}><FileSpreadsheet size={16} />Importa Excel <span className="button-count">{snapshot.workbooks.length}</span></button>{activeSet && <button className="button button-primary" onClick={exportCards} disabled={fieldsDirty} title={fieldsDirty ? "Salva i campi prima di esportare" : "Esporta set"}><ArrowDownToLine size={16} />Esporta set</button>}</> : <button className="button button-primary" onClick={addProject}><FolderPlus size={16} />Aggiungi progetto</button>}</div></header>
      {!snapshot ? <ProjectChooser projects={projects} onOpen={(projectPath) => void openPath(projectPath)} onAdd={addProject} /> : view === 'github' ? <GitHubPage status={gitStatus} onRefresh={() => runGitAction(window.cardCms.gitStatus)} onInit={() => runGitAction(window.cardCms.gitInit)} onConnect={(url) => runGitAction(() => window.cardCms.gitConnect(url))} onCommit={(message) => runGitAction(() => window.cardCms.gitCommit(message))} onPull={() => runGitAction(window.cardCms.gitPull)} onPush={() => runGitAction(window.cardCms.gitPush)} onOpenGitHub={() => void window.cardCms.openGitHub()} /> : view === 'assets' ? <AssetsPage assets={snapshot.assets} onAdd={addAssets} /> : view === 'variables' ? <VariablesPage key={snapshot.projectPath} projectPath={snapshot.projectPath} variables={snapshot.variables} onSave={updateVariables} onDirty={setFieldsDirty} /> : !activeSet ? <ImportLanding snapshot={snapshot} onImport={() => void refreshWorkbooks()} onCreate={createSet} /> : view === 'stats' ? <StatisticsPage key={snapshot.activeSetId} cards={cards} columns={columns} /> : view === 'cards' ? <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />SET · {activeSet.name.toLocaleUpperCase()}</div><h1>Le tue carte<span className="heading-period">.</span></h1><p>{activeSet.sourceFile ? `Importate da ${activeSet.sourceFile}.` : 'Un tavolo ordinato per le idee in movimento.'}</p></div><button className="button button-primary add-button" onClick={addCard}><Plus size={17} />Nuova carta</button></div>
        <section className="overview-strip"><div className="overview-cell total-cell"><span className="metric-label">CARTE NEL SET</span><div className="metric-line"><strong>{String(cards.length).padStart(2, '0')}</strong><span>carte</span></div></div><div className="overview-cell"><span className="metric-label">IN PLAYTEST</span><div className="metric-line"><strong>{String(cards.filter((card) => card.status === 'Playtest').length).padStart(2, '0')}</strong><span>carte</span></div></div><div className="overview-cell"><span className="metric-label">PRONTE</span><div className="progress-line"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div><span className="metric-foot">{cards.filter((card) => card.status === 'Ready').length} di {cards.length} carte complete</span></div><div className="overview-note"><Sparkles size={17} /><span>{snapshot.sets.length} set nel progetto<br />{snapshot.workbooks.length} file Excel rilevati</span></div></section>
        <div className="list-toolbar"><div className="list-title"><h2>Archivio</h2><span>{filteredCards.length} di {cards.length} {cards.length === 1 ? 'carta' : 'carte'}</span>{activeTag && <button className="active-filter" onClick={() => setActiveTag('')}><Tag size={12} />{activeTag}<X size={12} /></button>}</div><div className="list-controls"><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca una carta…" /></label><label className="select-wrap" title="Filtra per stato"><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option>Tutti gli stati</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={14} /></label><label className="select-wrap" title="Filtra per campo"><select value={propertyFilterField} onChange={(event) => { setPropertyFilterField(event.target.value); setPropertyFilterValue('') }}><option value="">Filtra campo…</option><option value="meta_tags">Tag</option>{listColumns.map((column) => <option key={column.id} value={column.fieldId}>{column.header}</option>)}</select><ChevronDown size={14} /></label>{propertyFilterField && <label className="select-wrap" title="Valore del filtro"><select value={propertyFilterValue} onChange={(event) => setPropertyFilterValue(event.target.value)}><option value="">Tutti i valori</option>{propertyFilterOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></label>}</div></div>
        <div className="cards-table">
          <div className="table-head">
            <button type="button" className="table-sort col-card" onClick={() => toggleSort('meta_title')} aria-label={`Ordina per carta${sortIndicator('meta_title')}`} title="Ordina per carta">CARTA{sortIndicator('meta_title')}</button>
            <button type="button" className="table-sort col-tags" onClick={() => toggleSort('meta_tags')} aria-label={`Ordina per tag${sortIndicator('meta_tags')}`} title="Ordina per tag">TAG{sortIndicator('meta_tags')}</button>
            <button type="button" className="table-sort col-status" onClick={() => toggleSort('meta_status')} aria-label={`Ordina per stato${sortIndicator('meta_status')}`} title="Ordina per stato">STATO{sortIndicator('meta_status')}</button>
            <button type="button" className="table-sort col-qty" onClick={() => toggleSort('meta_quantity')} aria-label={`Ordina per quantità${sortIndicator('meta_quantity')}`} title="Ordina per quantità">Q.TÀ{sortIndicator('meta_quantity')}</button>
            <button type="button" className="table-sort col-updated" onClick={() => toggleSort('meta_updated')} aria-label={`Ordina per ultima modifica${sortIndicator('meta_updated')}`} title="Ordina per ultima modifica">ULTIMA MODIFICA{sortIndicator('meta_updated')}</button>
            <span className="col-action" />
          </div>
          {filteredCards.length ? filteredCards.map((card, index) => <button key={card.id} className="card-row" onClick={() => setSelected(card)}>
            <span className="card-name col-card"><span className={`card-index tone-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span><span><strong>{card.title || 'Carta senza titolo'}</strong><small>{preview(card, columns, snapshot.assets)}</small></span></span>
            <span className="col-tags row-tags">{card.tags.length ? card.tags.slice(0, 3).map((tag) => <span className="tag-pill" key={tag}>{tag}</span>) : <span className="muted-dash">—</span>}{card.tags.length > 3 && <span className="tag-extra">+{card.tags.length - 3}</span>}</span>
            <span className="col-status"><span className={`status-pill status-${card.status.toLowerCase()}`}><i />{card.status}</span></span>
            <span className="col-qty quantity">{String(card.quantity).padStart(2, '0')}</span>
            <span className="col-updated updated">{formatDate(card.updatedAt)}</span>
            <span className="col-action row-chevron"><ArrowRight size={15} /></span>
          </button>) : <div className="empty-list"><div className="empty-mark"><BookOpen size={21} /></div><strong>{search || activeTag || filterStatus !== 'Tutti gli stati' || propertyFilterValue ? 'Nessuna carta corrisponde.' : 'Il set comincia da qui.'}</strong><span>{cards.length ? 'Prova a cambiare i filtri oppure aggiungi una carta.' : 'Importa un foglio o crea una nuova carta.'}</span>{!cards.length && <div className="empty-actions"><button className="button button-primary" onClick={addCard}><Plus size={15} />Crea carta</button><button className="text-button" onClick={() => void refreshWorkbooks()}><FileSpreadsheet size={15} />Importa Excel</button></div>}</div>}
        </div>
        <footer className="page-foot"><span><span className="live-dot" />SALVATAGGIO AUTOMATICO</span><span>{snapshot.projectPath}</span></footer>
      </div> : <ColumnsPage key={snapshot.activeSetId} columns={columns} assets={snapshot.assets} variables={snapshot.variables} onSave={updateColumns} onDirty={setFieldsDirty} onExport={exportCards} />}
    </main>
    {selected && snapshot && <CardEditor card={selected} columns={columns} assets={snapshot.assets} variables={snapshot.variables} projectPath={snapshot.projectPath} onClose={() => setSelected(null)} onSave={saveCard} onDelete={() => { updateCards(cards.filter((card) => card.id !== selected.id)); setSelected(null); setToast('Carta rimossa dal set') }} />}
      {importOpen && snapshot && <ImportWizard workbooks={snapshot.workbooks} sets={snapshot.sets} onRefresh={async () => { const found = await window.cardCms.scanWorkbooks(); setSnapshot({ ...snapshot, workbooks: found }); return found }} onClose={() => setImportOpen(false)} onImport={finishImport} onMerge={openMergePreview} />}
      {mergePreview && <MergeWizard preview={mergePreview} onPreview={(file, setId, matchFieldId, fieldIds, restoreFieldIds) => window.cardCms.previewWorkbookMerge(file, setId, matchFieldId, fieldIds, restoreFieldIds)} onClose={() => setMergePreview(null)} onApply={applyMerge} />}
      {renameTarget && <RenameSetDialog name={renameTarget.name} onClose={() => setRenameTarget(null)} onSave={saveSetName} />}
    {toast && <div className="toast"><Check size={15} />{toast}</div>}
  </div>
}

function ProjectChooser({ projects, onOpen, onAdd }: { projects: ProjectSummary[]; onOpen: (path: string) => void; onAdd: () => void }) {
  return <div className="chooser-page"><div className="chooser-header"><div><div className="eyebrow"><span className="eyebrow-line" />TABLETOP CARD STUDIO</div><h1>{projects.length ? <>Scegli il tuo<br /><em>tavolo di lavoro.</em></> : <>Le idee migliori<br />meritano <em>ordine.</em></>}</h1><p>{projects.length ? 'Riprendi un progetto salvato o aggiungine un altro dal computer.' : 'Apri una cartella Tabletop Creator per iniziare: potrai gestire più progetti da questa schermata.'}</p><button className="button button-primary welcome-button" onClick={onAdd}><FolderPlus size={17} />Aggiungi progetto</button></div><div className="chooser-art"><div className="chooser-sun"/><div className="chooser-card chooser-card-back"/><div className="chooser-card chooser-card-front"><img src="/tabletop-mark.svg" alt="" /><span>IL PROSSIMO SET<br />COMINCIA QUI</span></div></div></div>{projects.length > 0 && <section className="project-library"><div className="project-library-heading"><h2>Progetti recenti</h2><span>{projects.length} NELLA LIBRERIA</span></div>{projects.map((project, index) => <button className="project-library-row" key={project.path} onClick={() => onOpen(project.path)}><span className={`project-file-icon project-tone-${index % 3}`}><Archive size={18}/></span><span className="project-library-copy"><strong>{project.name}</strong><small>{project.path}</small></span><span className="project-library-stats"><b>{project.setCount}</b> set <i>·</i> <b>{project.cardCount}</b> carte <i>·</i> <b>{project.fileCount}</b> file Excel</span><ArrowRight size={17}/></button>)}</section>}</div>
}

function ImportLanding({ snapshot, onImport, onCreate }: { snapshot: ProjectSnapshot; onImport: () => void; onCreate: () => void }) {
  return <div className="page-content import-landing"><div className="eyebrow"><span className="eyebrow-line"/>PROGETTO · {snapshot.projectName.toLocaleUpperCase()}</div><h1>Organizza i tuoi set<span className="heading-period">.</span></h1><p>Abbiamo trovato <strong>{snapshot.workbooks.length} file Excel</strong> nella cartella. Scegli i fogli e i campi da importare; ogni file diventerà un set indipendente.</p><div className="detected-files"><div className="detected-count"><FileSpreadsheet size={20}/><strong>{snapshot.workbooks.length}</strong><span>file Excel rilevati</span></div>{snapshot.workbooks.slice(0, 6).map((book) => <div className="detected-file" key={book.file}><span>{book.file}</span><small>{book.rowCount} righe · {book.headers.length} colonne</small></div>)}</div><div className="empty-actions"><button className="button button-primary" onClick={onImport}><FileSpreadsheet size={16}/>Scegli campi e importa</button><button className="button button-quiet" onClick={onCreate}><Plus size={16}/>Crea set vuoto</button></div></div>
}

function ImportWizard({ workbooks, sets, onRefresh, onClose, onImport, onMerge }: { workbooks: WorkbookInfo[]; sets: ProjectSnapshot['sets']; onRefresh: () => Promise<WorkbookInfo[]>; onClose: () => void; onImport: (plans: ImportPlan[]) => void; onMerge: (file: string, setId: string) => void }) {
  const [found, setFound] = useState(workbooks)
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(workbooks.filter((book) => !sets.some((set) => set.sourceFile === book.file)).map((book) => book.file)))
  const [expanded, setExpanded] = useState(workbooks.find((book) => !sets.some((set) => set.sourceFile === book.file))?.file ?? '')
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(workbooks.map((book) => [book.file, book.file.replace(/\.xlsx$/i, '')])))
  const [fields, setFields] = useState<Record<string, Array<{ header: string; keep: boolean; type: NonNullable<ColumnDefinition['type']>; options: string }>>>(() => Object.fromEntries(workbooks.map((book) => [book.file, book.headers.map((header) => ({ header, keep: true, type: guessType(header), options: '' }))])))
  const toggleBook = (file: string) => setChosen((current) => { const next = new Set(current); next.has(file) ? next.delete(file) : next.add(file); return next })
  const updateField = (file: string, header: string, patch: Partial<{ keep: boolean; type: NonNullable<ColumnDefinition['type']>; options: string }>) => setFields((current) => ({ ...current, [file]: current[file].map((field) => field.header === header ? { ...field, ...patch } : field) }))
  const refresh = async () => { const next = await onRefresh(); setFound(next); setNames((current) => ({ ...current, ...Object.fromEntries(next.map((book) => [book.file, current[book.file] ?? book.file.replace(/\.xlsx$/i, '')])) })); setFields((current) => ({ ...current, ...Object.fromEntries(next.filter((book) => !current[book.file]).map((book) => [book.file, book.headers.map((header) => ({ header, keep: true, type: guessType(header), options: '' }))])) })) }
  const plans = [...chosen].map((file) => ({ file, name: names[file] || file.replace(/\.xlsx$/i, ''), fields: (fields[file] ?? []).filter((field) => field.keep).map(({ header, type, options }) => ({ header, type, options: type === 'select' ? options.split(',').map((item) => item.trim()).filter(Boolean) : undefined })) })).filter((plan) => plan.fields.length)
  return <><button className="scrim" aria-label="Chiudi importazione" onClick={onClose}/><section className="import-panel"><div className="editor-head"><div><div className="eyebrow"><span className="eyebrow-line"/>IMPORTAZIONE GUIDATA</div><h2>Un file, un set.</h2></div><button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi"><X size={18}/></button></div><div className="import-panel-intro"><p>Importa un nuovo set oppure confronta un foglio già collegato e unisci gli aggiornamenti senza perdere le modifiche al set.</p><div className="import-file-summary"><FileSpreadsheet size={16}/><strong>{found.length}</strong> file Excel rilevati <button className="text-button" onClick={() => void refresh()}>Aggiorna elenco</button></div></div><div className="import-workbook-list">{found.length ? found.map((book) => { const importedSet = sets.find((set) => set.sourceFile === book.file); const already = Boolean(importedSet); const selected = chosen.has(book.file); return <article className={`import-workbook ${selected ? 'is-selected' : ''}`} key={book.file}><div className="workbook-row"><label className="check-wrap"><input type="checkbox" checked={selected} disabled={already} onChange={() => toggleBook(book.file)}/><span className="custom-check"><Check size={12}/></span></label><button className="workbook-summary" onClick={() => setExpanded(expanded === book.file ? '' : book.file)}><span className="workbook-file-icon"><FileSpreadsheet size={17}/></span><span><strong>{book.file}</strong><small>{book.rowCount} righe · {book.headers.length} colonne</small></span><ChevronDown size={15}/></button>{already && <><span className="imported-badge">GIÀ IMPORTATO</span><button type="button" className="button button-quiet reimport-button" onClick={() => onMerge(book.file, importedSet!.id)}><RefreshCw size={13}/>Confronta e unisci</button></>}</div>{selected && expanded === book.file && <div className="workbook-config"><label className="set-name-input"><span>NOME DEL SET</span><input value={names[book.file] ?? ''} onChange={(event) => setNames({ ...names, [book.file]: event.target.value })}/></label><div className="field-choice-heading"><span>CAMPI DA TENERE</span><span>TIPO DI CAMPO</span></div><div className="field-choice-list">{(fields[book.file] ?? []).map((field) => <div className="field-choice" key={field.header}><label><input type="checkbox" checked={field.keep} onChange={(event) => updateField(book.file, field.header, { keep: event.target.checked })}/><span>{field.header}</span></label><select value={field.type} onChange={(event) => updateField(book.file, field.header, { type: event.target.value as NonNullable<ColumnDefinition['type']> })}><option value="text">Testo</option><option value="longtext">Testo lungo</option><option value="number">Numero</option><option value="select">Select</option><option value="image">Immagine</option><option value="variable">Variabile</option><option value="color">Colore</option></select>{field.type === 'select' && <input className="choice-options" value={field.options} onChange={(event) => updateField(book.file, field.header, { options: event.target.value })} placeholder="opzioni separate da virgola"/>}</div>)}</div></div>}</article> }) : <div className="import-no-files"><FileSpreadsheet size={22}/><strong>Nessun file Excel trovato</strong><span>Metti i fogli `.xlsx` nella cartella del progetto e aggiorna l’elenco.</span></div>}</div><div className="import-panel-footer"><span>{plans.length} set · {plans.reduce((sum, plan) => sum + plan.fields.length, 0)} campi selezionati</span><button className="button button-primary" disabled={!plans.length} onClick={() => onImport(plans)}><Check size={15}/>Importa {plans.length ? `${plans.length} set` : ''}</button></div></section></>
}

function MergeWizard({ preview, onPreview, onClose, onApply }: { preview: WorkbookMergePreview; onPreview: (file: string, setId: string, matchFieldId: string, fieldIds: string[], restoreFieldIds: string[]) => Promise<WorkbookMergePreview>; onClose: () => void; onApply: (token: string, resolutions: Record<string, 'excel' | 'set'>) => void }) {
  const [current, setCurrent] = useState(preview)
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => new Set(preview.selectedFieldIds))
  const [restoredFields, setRestoredFields] = useState<Set<string>>(() => new Set(preview.restoredFieldIds))
  const [resolutions, setResolutions] = useState<Record<string, 'excel' | 'set'>>(() => Object.fromEntries(preview.conflicts.map((conflict) => [conflict.conflictId, 'set'])))
  const [loading, setLoading] = useState(false)
  const [expandedChanges, setExpandedChanges] = useState(false)
  useEffect(() => { setCurrent(preview); setSelectedFields(new Set(preview.selectedFieldIds)); setRestoredFields(new Set(preview.restoredFieldIds)); setResolutions(Object.fromEntries(preview.conflicts.map((conflict) => [conflict.conflictId, 'set']))) }, [preview.token])
  const refreshPreview = async (matchFieldId: string, fieldIds: Set<string>, restoreFieldIds: Set<string> = restoredFields) => {
    setLoading(true)
    try {
      const next = await onPreview(current.file, current.setId, matchFieldId, [...fieldIds], [...restoreFieldIds])
      setCurrent(next)
      setSelectedFields(new Set(next.selectedFieldIds))
      setRestoredFields(new Set(next.restoredFieldIds))
      setResolutions(Object.fromEntries(next.conflicts.map((conflict) => [conflict.conflictId, 'set'])))
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Impossibile aggiornare il confronto') }
    finally { setLoading(false) }
  }
  const selectMatchField = (matchFieldId: string) => { void refreshPreview(matchFieldId, new Set(selectedFields)) }
  const toggleImportField = (fieldId: string, checked: boolean) => {
    const next = new Set(selectedFields)
    checked ? next.add(fieldId) : next.delete(fieldId)
    void refreshPreview(current.matchFieldId, next)
  }
  const toggleRestoreField = (fieldId: string, checked: boolean) => {
    const nextRestored = new Set(restoredFields)
    checked ? nextRestored.add(fieldId) : nextRestored.delete(fieldId)
    const nextSelected = new Set(selectedFields)
    checked ? nextSelected.add(fieldId) : nextSelected.delete(fieldId)
    void refreshPreview(current.matchFieldId, nextSelected, nextRestored)
  }
  const selectAllFields = () => void refreshPreview(current.matchFieldId, new Set([...current.importFields.map((field) => field.id), ...restoredFields]))
  const selectOnlyMatchField = () => void refreshPreview(current.matchFieldId, new Set([...restoredFields, current.matchFieldId]))
  const chooseAll = (resolution: 'excel' | 'set') => setResolutions(Object.fromEntries(current.conflicts.map((conflict) => [conflict.conflictId, resolution])))
  const unresolvedCount = current.conflicts.filter((conflict) => !resolutions[conflict.conflictId]).length
  const hasWork = current.newTitles.length + current.automaticChanges.length + current.preservedLocalChanges.length + current.conflicts.length > 0
  const canApplyFields = selectedFields.size > 0
  const valueText = (value: string) => value.trim() || '— vuoto —'
  return <><button className="scrim" aria-label="Chiudi confronto Excel" onClick={onClose}/><section className="merge-panel" role="dialog" aria-modal="true" aria-labelledby="merge-title"><div className="editor-head"><div><div className="eyebrow"><span className="eyebrow-line"/>RICONCILIAZIONE EXCEL</div><h2 id="merge-title">Unisci gli aggiornamenti.</h2></div><button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi"><X size={18}/></button></div><div className="merge-intro"><div><strong>{current.file}</strong><span>→</span><b>{current.setName}</b></div><p>Le carte non presenti nel foglio restano nel set. Scegli cosa fare solo dove entrambi hanno modificato lo stesso campo.</p></div><div className="merge-body">
    <div className="merge-key-row"><label><span>ABBINA LE CARTE TRAMITE</span><select value={current.matchFieldId} disabled={loading} onChange={(event) => selectMatchField(event.target.value)}>{current.matchFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label><small>Scegli un valore stabile e univoco nel foglio, di solito il titolo della carta.</small></div>
    {current.restoreFields.length > 0 && <section className="merge-restore-section"><div className="merge-section-heading"><div><h3>Campi Excel non presenti nel set</h3><span>Puoi ripristinare le colonne rimosse e importarne i valori.</span></div><span className="merge-restore-count">{restoredFields.size} ripristinati</span></div><div className="merge-restore-list">{current.restoreFields.map((field) => <label key={field.id} className={restoredFields.has(field.id) ? 'selected' : ''}><input type="checkbox" checked={restoredFields.has(field.id)} disabled={loading} onChange={(event) => toggleRestoreField(field.id, event.target.checked)}/><span className="merge-field-check"><Check size={11}/></span><strong>{field.header}</strong><small>{field.type}</small></label>)}</div></section>}
    <section className="merge-field-selection"><div className="merge-section-heading"><div><h3>Campi da importare</h3><span>{selectedFields.size} di {current.importFields.length} inclusi nel merge.</span></div><div><button type="button" className="text-button" disabled={loading} onClick={selectOnlyMatchField}>Solo chiave</button><button type="button" className="text-button" disabled={loading} onClick={selectAllFields}>Seleziona tutti</button></div></div><div className="merge-field-list">{current.importFields.map((field) => { const restored = restoredFields.has(field.id); return <label key={field.id} className={field.id === current.matchFieldId ? 'is-match-key' : restored ? 'is-restored' : ''}><input type="checkbox" checked={selectedFields.has(field.id)} disabled={loading || restored} onChange={(event) => toggleImportField(field.id, event.target.checked)}/><span className="merge-field-check"><Check size={11}/></span><strong>{field.label}</strong>{field.id === current.matchFieldId && <small>CHIAVE</small>}{restored && <small>RIPRISTINATO</small>}</label>})}</div><p>La chiave serve per abbinare le carte. Se la escludi, non aggiorna quelle esistenti, ma viene conservata sulle nuove per i prossimi reimport. Gli altri campi esclusi non vengono modificati.</p></section>
    {current.legacyBaseline && <div className="merge-notice"><CircleAlert size={15}/><span>Questo set non ha uno storico di sincronizzazione. Le differenze trovate vengono trattate come conflitti, così puoi scegliere cosa mantenere.</span></div>}
    {current.duplicateKeys.length > 0 && <div className="merge-error"><CircleAlert size={15}/><span>Il campo scelto non è univoco: {current.duplicateKeys.slice(0, 4).map((key) => key || 'valore vuoto').join(', ')}. Scegli un’altra colonna per confrontare le carte.</span></div>}
    <div className="merge-summary"><div><strong>{current.matchedRows}</strong><span>corrispondenze</span></div><div><strong>{current.automaticChanges.length}</strong><span>aggiornamenti Excel</span></div><div><strong>{current.newTitles.length}</strong><span>nuove carte</span></div><div className={current.conflicts.length ? 'has-conflicts' : ''}><strong>{current.conflicts.length}</strong><span>conflitti da scegliere</span></div></div>
    {current.conflicts.length > 0 && <section className="merge-conflicts"><div className="merge-section-heading"><div><h3>Conflitti</h3><span>Per impostazione iniziale mantiene il valore del set.</span></div><div><button className="text-button" onClick={() => chooseAll('set')}>Mantieni tutti</button><button className="text-button" onClick={() => chooseAll('excel')}>Usa tutti da Excel</button></div></div><div className="merge-conflict-list">{current.conflicts.map((conflict) => <article className="merge-conflict" key={conflict.conflictId}><div className="merge-conflict-heading"><strong>{conflict.cardTitle || 'Carta senza titolo'}</strong><span>{conflict.header}</span></div><div className="merge-options"><button type="button" className={`merge-option ${resolutions[conflict.conflictId] === 'set' ? 'selected' : ''}`} aria-pressed={resolutions[conflict.conflictId] === 'set'} onClick={() => setResolutions((existing) => ({ ...existing, [conflict.conflictId]: 'set' }))}><small>VALORE NEL SET</small><span>{valueText(conflict.currentValue)}</span></button><button type="button" className={`merge-option ${resolutions[conflict.conflictId] === 'excel' ? 'selected' : ''}`} aria-pressed={resolutions[conflict.conflictId] === 'excel'} onClick={() => setResolutions((existing) => ({ ...existing, [conflict.conflictId]: 'excel' }))}><small>VALORE NEL FOGLIO</small><span>{valueText(conflict.incomingValue)}</span></button></div></article>)}</div></section>}
    {!current.conflicts.length && current.duplicateKeys.length === 0 && <div className="merge-clear"><Check size={17}/><span>{hasWork ? 'Nessun conflitto: gli aggiornamenti compatibili possono essere uniti.' : 'Il set è già allineato al foglio.'}</span></div>}
    {(current.automaticChanges.length + current.preservedLocalChanges.length > 0) && <details className="merge-detail"><summary onClick={() => setExpandedChanges(!expandedChanges)}>{current.automaticChanges.length} valori aggiornati dal foglio · {current.preservedLocalChanges.length} modifiche locali preservate<span>{expandedChanges ? 'Nascondi dettagli' : 'Mostra dettagli'}</span></summary><div className="merge-change-list">{[...current.automaticChanges, ...current.preservedLocalChanges].slice(0, 80).map((change, index) => <div className="merge-change-row" key={`${change.cardId}-${change.fieldId}-${index}`}><span>{change.cardTitle}</span><b>{change.header}</b><span>{valueText(change.currentValue)}</span><ArrowRight size={12}/><span>{valueText(change.incomingValue)}</span><small>{change.source === 'excel' ? 'Excel' : 'Set'}</small></div>)}{current.automaticChanges.length + current.preservedLocalChanges.length > 80 && <small className="merge-truncated">Mostrate le prime 80 differenze.</small>}</div></details>}
    {(current.newTitles.length > 0 || current.missingTitles.length > 0) && <div className="merge-row-notes">{current.newTitles.length > 0 && <div><strong>{current.newTitles.length} nuove carte</strong><span>{current.newTitles.slice(0, 5).join(' · ')}{current.newTitles.length > 5 ? ' · …' : ''}</span></div>}{current.missingTitles.length > 0 && <div><strong>{current.missingTitles.length} carte non nel foglio</strong><span>Resteranno nel set, senza modifiche.</span></div>}</div>}
    </div><footer className="merge-footer"><span>{unresolvedCount ? `${unresolvedCount} conflitti da risolvere` : current.duplicateKeys.length ? 'Scegli una chiave univoca per continuare' : !canApplyFields ? 'Seleziona almeno un campo da importare' : 'Le carte non presenti in Excel non verranno eliminate'}</span><div><button className="button button-quiet" onClick={onClose}>Annulla</button><button className="button button-primary" disabled={loading || !hasWork || !canApplyFields || current.duplicateKeys.length > 0 || unresolvedCount > 0} onClick={() => onApply(current.token, resolutions)}><Check size={15}/>Applica merge</button></div></footer></section></>
}

function RenameSetDialog({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState('')
  return <><button className="scrim" aria-label="Chiudi rinomina set" onClick={onClose}/><section className="rename-set-panel" role="dialog" aria-modal="true" aria-labelledby="rename-set-title"><div className="editor-head"><div><div className="eyebrow"><span className="eyebrow-line"/>ORGANIZZAZIONE SET</div><h2 id="rename-set-title">Rinomina il set.</h2></div><button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi"><X size={18}/></button></div><form onSubmit={(event) => { event.preventDefault(); const next = value.trim(); if (!next) { setError('Inserisci un nome per il set.'); return } onSave(next) }}><label htmlFor="rename-set-input">NOME DEL SET</label><input id="rename-set-input" autoFocus maxLength={80} value={value} onChange={(event) => { setValue(event.target.value); setError('') }}/>{error && <small className="rename-set-error">{error}</small>}<div><button type="button" className="button button-quiet" onClick={onClose}>Annulla</button><button type="submit" className="button button-primary"><Check size={14}/>Salva nome</button></div></form></section></>
}

function AssetsPage({ assets, onAdd }: { assets: ProjectAsset[]; onAdd: () => void }) {
  return <div className="page-content assets-page"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>LIBRERIA DEL PROGETTO</div><h1>Asset<span className="heading-period">.</span></h1><p>Immagini raccolte nella cartella `assets` e pronte da assegnare alle carte.</p></div><button className="button button-primary add-button" onClick={onAdd}><Plus size={16}/>Aggiungi immagini</button></div><div className="asset-library-meta"><div><Images size={17}/><strong>{assets.length}</strong><span>immagini disponibili</span></div><span>Le nuove immagini vengono copiate in `assets/images/card-studio`</span></div>{assets.length ? <div className="asset-grid">{assets.map((asset) => <article className="asset-card" key={asset.path}><div className="asset-preview">{asset.previewUrl ? <img src={asset.previewUrl} alt={asset.name}/> : <FileImage size={28}/>}</div><div className="asset-card-info"><strong title={asset.name}>{asset.name}</strong><small title={asset.path}>{asset.path}</small></div></article>)}</div> : <div className="asset-empty"><Images size={24}/><strong>La libreria è vuota.</strong><span>Aggiungi illustrazioni, icone o altri file immagine del progetto.</span><button className="button button-quiet" onClick={onAdd}><Plus size={15}/>Aggiungi il primo asset</button></div>}</div>
}

function preview(card: Card, columns: ColumnDefinition[], assets: ProjectAsset[]) {
  const textColumn = columns.find((column) => /text|effetto|description|descrizione/i.test(column.header) && column.type !== 'image')
  const text = textColumn ? card.values[textColumn.fieldId] : Object.values(card.values).find((value) => value.trim() && value !== card.title)
  const image = columns.find((column) => column.type === 'image' && card.values[column.fieldId])
  const asset = image ? assets.find((item) => item.path === card.values[image.fieldId]) : undefined
  return <>{asset && <img className="row-thumb" src={asset.previewUrl} alt=""/>}{text?.replace(/<[^>]*>/g, '').trim().slice(0, 78) || (asset ? asset.name : 'Nessuna descrizione aggiunta')}</>
}
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(date) }
function guessType(header: string): NonNullable<ColumnDefinition['type']> { return /color|colour|colore/i.test(header) ? 'color' : /amount|quantit|costo|cost|speed|potenza|numero|count/i.test(header) ? 'number' : /text|effetto|description|descrizione|regole/i.test(header) ? 'longtext' : /image|immagine|illustrazione|artwork/i.test(header) ? 'image' : 'text' }

function ColorField({ value, onChange, readOnly = false, variables = [] }: { value: string; onChange?: (value: string) => void; readOnly?: boolean; variables?: ProjectVariable[] }) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const hexMatch = value.match(/^#([\da-f]{6})([\da-f]{2})?$/i)
  const pickerValue = hexMatch ? `#${hexMatch[1]}` : '#ffffff'
  const alphaHex = hexMatch?.[2] ?? 'FF'
  const alphaValue = parseInt(alphaHex, 16)
  const hasColor = Boolean(value.trim() && CSS.supports('color', value))
  const showTransparency = !hasColor || alphaValue < 255
  const savedColors = variables.filter((variable) => variable.studioType === 'color' && variable.color)
  return <div className={`color-field-control ${readOnly ? 'is-readonly' : ''}`}>
    <div className={`color-field ${readOnly ? 'is-readonly' : ''}`}>
      <span className="color-preview" style={{ backgroundColor: hasColor ? value : 'transparent', backgroundImage: showTransparency ? undefined : 'none' }} title={value || 'Nessun colore selezionato'}/>
      {readOnly ? <span className="color-field-value">{value || 'Nessuna regola attiva'}</span> : <>
        <input aria-label="Scegli colore" type="color" value={pickerValue} onChange={(event) => onChange?.(`${event.target.value}${hexMatch?.[2] ?? ''}`)}/>
        <input aria-label="Valore colore" type="text" value={value} onChange={(event) => onChange?.(event.target.value)} placeholder="#RRGGBB o #RRGGBBAA"/>
        <div className="saved-color-picker"><button type="button" className={`saved-color-trigger ${libraryOpen ? 'active' : ''}`} onClick={() => setLibraryOpen((open) => !open)} aria-expanded={libraryOpen} title="Scegli un colore salvato"><Palette size={13}/><span>Salvati</span></button>{libraryOpen && <div className="saved-color-popover"><div className="saved-color-heading">PALETTE DEL PROGETTO <button type="button" aria-label="Chiudi palette" onClick={() => setLibraryOpen(false)}><X size={12}/></button></div>{savedColors.length ? savedColors.map((variable) => <button type="button" className="saved-color-option" key={variable.code} onClick={() => { onChange?.(variable.color!); setLibraryOpen(false) }}><span className="saved-color-swatch" style={{ backgroundColor: variable.color }}/><span><strong>{variable.code}</strong><small>{variable.replacement || variable.color}</small></span></button>) : <div className="saved-color-empty"><strong>Palette ancora vuota.</strong>Crea una variabile di tipo “Colore salvato” nella sezione Variabili.</div>}</div>}</div>
      </>}
    </div>
    {!readOnly && <label className="color-alpha-control"><span>OPACITÀ</span><input aria-label="Opacità colore" type="range" min="0" max="255" value={alphaValue} disabled={!hexMatch} onChange={(event) => onChange?.(`${pickerValue}${Number(event.target.value).toString(16).padStart(2, '0').toUpperCase()}`)}/><output>{hexMatch ? `${Math.round(alphaValue / 255 * 100)}%` : '—'}</output></label>}
  </div>
}

function ConditionalRulesEditor({ column, columns, variables, onChange }: { column: ColumnDefinition; columns: ColumnDefinition[]; variables: ProjectVariable[]; onChange: (patch: Partial<ColumnDefinition>) => void }) {
  if (metaFields.some((field) => field.id === column.fieldId)) return null
  const sources = [...metaFields, ...columns.filter((item) => item.fieldId !== column.fieldId && !metaFields.some((meta) => meta.id === item.fieldId)).map((item) => ({ id: item.fieldId, label: item.header }))]
  const availableVariables = column.variableTags?.length ? variables.filter((variable) => (variable.studioTags ?? []).some((tag) => column.variableTags!.some((selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase()))) : variables
  const update = (index: number, rulePatch: Partial<NonNullable<ColumnDefinition['rules']>[number]>) => onChange({ rules: (column.rules ?? []).map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...rulePatch } : rule) })
  const add = () => onChange({ rules: [...(column.rules ?? []), { sourceFieldId: sources[0]?.id ?? '', operator: 'is_set', matchValue: '', value: '' }] })
  return <details className="field-conditions schema-options"><summary>Regole automatiche e visibilità<span>{column.hidden ? 'nascosto' : 'visibile'} · {column.rules?.length ?? 0} regole</span></summary><div className="field-condition-panel"><label className="field-hidden-toggle"><input type="checkbox" checked={Boolean(column.hidden)} onChange={(event) => onChange({ hidden: event.target.checked })} /><span><strong>Nascondi nell’editor carte</strong><small>Il campo resta nel set e viene incluso nel foglio esportato.</small></span></label><div className="rule-explainer">Le regole compilano il campo in automatico. Vale la prima corrispondenza; se nessuna regola corrisponde, {column.defaultValue ? `viene usato il default “${column.defaultValue}”.` : 'il campo resta vuoto.'}</div>{(column.rules ?? []).map((rule, index) => <div className="conditional-rule" key={`${column.id}-rule-${index}`}><select aria-label="Campo da controllare" value={rule.sourceFieldId} onChange={(event) => update(index, { sourceFieldId: event.target.value })}>{sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select><select aria-label="Condizione" value={rule.operator} onChange={(event) => update(index, { operator: event.target.value as NonNullable<ColumnDefinition['rules']>[number]['operator'] })}><option value="is_set">è compilato</option><option value="is_empty">è vuoto</option><option value="equals">è uguale a</option><option value="not_equals">è diverso da</option><option value="contains">contiene</option></select>{['equals', 'not_equals', 'contains'].includes(rule.operator) ? <input aria-label="Valore da confrontare" value={rule.matchValue ?? ''} onChange={(event) => update(index, { matchValue: event.target.value })} placeholder="valore"/> : <span className="rule-any-value">qualsiasi valore</span>}<ArrowRight size={14}/>{column.type === 'color' ? <ColorField value={rule.value} onChange={(value) => update(index, { value })} variables={variables}/> : column.type === 'variable' ? <select className="rule-variable-output" aria-label="Variabile da assegnare" value={rule.value} onChange={(event) => update(index, { value: event.target.value })}><option value="">Scegli variabile…</option>{availableVariables.map((variable) => <option key={variable.code} value={`{${variable.code}}`}>{`{${variable.code}}`} · {variable.replacement}</option>)}</select> : <input className="rule-output" aria-label="Valore automatico" value={rule.value} onChange={(event) => update(index, { value: event.target.value })} placeholder="valore da assegnare"/>}<button type="button" className="icon-button remove-column" onClick={() => onChange({ rules: (column.rules ?? []).filter((_, ruleIndex) => ruleIndex !== index) })} aria-label="Rimuovi regola"><X size={14}/></button></div>)}<button type="button" className="text-button add-condition-rule" onClick={add}><Plus size={13}/>Aggiungi regola</button></div></details>
}

function DefaultValueEditor({ column, assets, variables, onChange }: { column: ColumnDefinition; assets: ProjectAsset[]; variables: ProjectVariable[]; onChange: (patch: Partial<ColumnDefinition>) => void }) {
  const value = column.defaultValue ?? ''
  const update = (next: string) => onChange({ defaultValue: next.trim() ? next : undefined })
  const availableVariables = column.variableTags?.length ? variables.filter((variable) => (variable.studioTags ?? []).some((tag) => column.variableTags!.some((selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase()))) : variables
  return <details className="field-default-editor schema-options"><summary><span>Valore predefinito</span><small>{value || 'non impostato'}</small></summary><div className="field-default-panel"><p>{column.rules?.length ? 'Usato quando nessuna regola condizionale corrisponde.' : 'Usato quando il campo è vuoto. Lascia vuoto per non applicare un valore.'}</p>{column.type === 'color' ? <ColorField value={value} onChange={update} variables={variables}/> : column.type === 'image' ? <ImageField assets={assets} value={value} onChange={update} fieldName={`${column.header} · default`}/> : column.type === 'select' ? <select aria-label={`Valore predefinito per ${column.header}`} value={value} onChange={(event) => update(event.target.value)}><option value="">Nessun default</option>{value && !(column.options ?? []).includes(value) && <option value={value}>{value} · valore attuale</option>}{(column.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : column.type === 'variable' ? <select aria-label={`Valore predefinito per ${column.header}`} value={value} onChange={(event) => update(event.target.value)}><option value="">Nessun default</option>{value && !availableVariables.some((variable) => `{${variable.code}}` === value) && <option value={value}>{value} · valore attuale</option>}{availableVariables.map((variable) => <option key={variable.code} value={`{${variable.code}}`}>{`{${variable.code}}`} · {variable.replacement}</option>)}</select> : column.type === 'longtext' ? <textarea rows={2} aria-label={`Valore predefinito per ${column.header}`} value={value} onChange={(event) => update(event.target.value)} placeholder="Lascia vuoto per non applicare un default"/> : <input type={column.type === 'number' ? 'number' : 'text'} aria-label={`Valore predefinito per ${column.header}`} value={value} onChange={(event) => update(event.target.value)} placeholder="Lascia vuoto per non applicare un default"/>}</div></details>
}

function CardEditor({ card: initial, columns, assets, variables, projectPath, onClose, onSave, onDelete }: { card: Card; columns: ColumnDefinition[]; assets: ProjectAsset[]; variables: ProjectVariable[]; projectPath: string; onClose: () => void; onSave: (card: Card) => void; onDelete: () => void }) {
  const [card, setCard] = useState<Card>(() => resolveConditionalValues(columns, initial))
  const [tagInput, setTagInput] = useState('')
  const fields = columns.filter((column) => !['meta_title', 'meta_quantity', 'meta_status', 'meta_tags'].includes(column.fieldId) && !column.hidden)
  const setValue = (id: string, value: string) => setCard((current) => resolveConditionalValues(columns, { ...current, values: { ...current.values, [id]: value } }))
  const patchCard = (next: Card) => setCard(resolveConditionalValues(columns, next))
  const addTag = () => { const tag = tagInput.trim(); if (tag && !card.tags.includes(tag)) patchCard({ ...card, tags: [...card.tags, tag] }); setTagInput('') }
  return <><button className="scrim" aria-label="Chiudi editor" onClick={onClose}/><aside className="editor-panel"><div className="editor-head"><div><div className="eyebrow"><span className="eyebrow-line"/>EDITOR CARTA</div><h2>Dettagli</h2></div><button className="icon-button close-editor" onClick={onClose} aria-label="Chiudi"><X size={18}/></button></div><div className="editor-body"><div className="field-group"><label>TITOLO DELLA CARTA</label><input className="title-input" autoFocus value={card.title} onChange={(event) => patchCard({ ...card, title: event.target.value })} placeholder="Dai un nome alla carta"/><VariableInsert variables={variables} onInsert={(token) => patchCard({ ...card, title: appendVariable(card.title, token) })}/><VariableTextPreview value={card.title} variables={variables} projectPath={projectPath}/></div><div className="field-pair"><div className="field-group"><label>STATO</label><select value={card.status} onChange={(event) => patchCard({ ...card, status: event.target.value as CardStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><div className="field-group"><label>QUANTITÀ</label><input type="number" min="1" value={card.quantity} onChange={(event) => patchCard({ ...card, quantity: Math.max(1, Number(event.target.value)) })}/></div></div><div className="field-group"><label>TAG <span className="label-hint">· premi Invio per aggiungere</span></label><div className="tag-entry"><Tag size={15}/><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addTag())} placeholder="es. azione, risorsa, raro"/><button onClick={addTag} aria-label="Aggiungi tag"><Plus size={16}/></button></div><div className="editor-tags">{card.tags.map((tag) => <button key={tag} className="tag-pill editable-tag" onClick={() => patchCard({ ...card, tags: card.tags.filter((item) => item !== tag) })}>{tag}<X size={11}/></button>)}</div></div><div className="field-divider"><span>CAMPI DELLA CARTA</span><span>{fields.length} CAMPI</span></div>{fields.map((column) => { const value = card.values[column.fieldId] ?? ''; return <div className="field-group" key={column.id}><label>{column.header}{column.rules?.length ? <span className="label-hint"> · AUTOMATICO</span> : null}</label>{column.rules?.length ? column.type === 'color' ? <ColorField value={value} readOnly/> : column.type === 'variable' ? <VariableField variables={variables} tags={column.variableTags ?? []} value={value} projectPath={projectPath} hasRules/> : <><div className="conditional-value-preview">{value || 'Nessuna regola attiva'}</div><VariableTextPreview value={value} variables={variables} projectPath={projectPath}/></> : column.type === 'select' ? <select value={value} onChange={(event) => setValue(column.fieldId, event.target.value)}><option value="">Seleziona…</option>{(column.options ?? []).map((option) => <option key={option}>{option}</option>)}</select> : column.type === 'image' ? <ImageField assets={assets} value={value} onChange={(next) => setValue(column.fieldId, next)} fieldName={column.header}/> : column.type === 'variable' ? <VariableField variables={variables} tags={column.variableTags ?? []} value={value} projectPath={projectPath} onChange={(next) => setValue(column.fieldId, next)}/> : column.type === 'color' ? <ColorField value={value} variables={variables} onChange={(next) => setValue(column.fieldId, next)}/> : column.type === 'longtext' ? <><textarea rows={3} value={value} onChange={(event) => setValue(column.fieldId, event.target.value)} placeholder="Aggiungi un testo…"/><VariableInsert variables={variables} onInsert={(token) => setValue(column.fieldId, appendVariable(value, token))}/><VariableTextPreview value={value} variables={variables} projectPath={projectPath}/></> : <><input type={column.type === 'number' ? 'number' : 'text'} value={value} onChange={(event) => setValue(column.fieldId, event.target.value)} placeholder="Aggiungi un valore…"/><VariableInsert variables={variables} onInsert={(token) => setValue(column.fieldId, appendVariable(value, token))}/><VariableTextPreview value={value} variables={variables} projectPath={projectPath}/></>}</div> })}{!fields.length && <div className="field-hint-box">Scegli i campi nella configurazione d’importazione oppure aggiungili in Campi e colonne.</div>}</div><div className="editor-footer"><button className="delete-button" onClick={onDelete}>Elimina carta</button><button className="button button-primary" onClick={() => onSave(card)}><Check size={16}/>Salva modifiche</button></div></aside></>
}

function appendVariable(value: string, token: string) { return `${value}${value && !/\s$/.test(value) ? ' ' : ''}${token}` }

function VariableInsert({ variables, onInsert }: { variables: ProjectVariable[]; onInsert: (token: string) => void }) {
  if (!variables.length) return null
  return <label className="variable-insert"><span>Variabile</span><select value="" onChange={(event) => { if (event.target.value) onInsert(`{${event.target.value}}`); event.currentTarget.value = '' }}><option value="">Inserisci nel campo…</option>{variables.map((variable) => <option key={variable.code} value={variable.code}>{`{${variable.code}}`} · {variable.replacement}</option>)}</select><ChevronDown size={12}/></label>
}

function ImageField({ assets, value, onChange, fieldName }: { assets: ProjectAsset[]; value: string; onChange: (value: string) => void; fieldName: string }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = assets.find((asset) => asset.path === normalizeAssetReference(value))
  const filteredAssets = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return assets.filter((asset) => !term || `${asset.name} ${asset.path}`.toLocaleLowerCase().includes(term))
  }, [assets, query])
  const closePicker = () => { setPickerOpen(false); setQuery('') }
  const chooseAsset = (asset: ProjectAsset) => { onChange(asset.path); closePicker() }
  const displayName = selected?.name ?? (value ? value.split(/[\\/]/).filter(Boolean).pop() : '')
  return <div className="image-picker">
    <div className="image-picker-current">
      {selected?.previewUrl ? <img className="image-picker-preview" src={selected.previewUrl} alt={`Anteprima: ${selected.name}`}/> : <div className="image-picker-preview image-picker-placeholder"><FileImage size={22}/><span>{value ? 'Immagine non trovata' : 'Nessuna immagine'}</span></div>}
      <div className="image-picker-current-details"><strong title={selected?.path ?? value}>{displayName || 'Assegna un’immagine'}</strong><small>{selected ? 'Libreria immagini del progetto' : assets.length ? 'Scegli dalla libreria del progetto' : 'La libreria non contiene immagini'}</small><div className="image-picker-actions"><button type="button" className="image-picker-open" onClick={() => setPickerOpen((open) => !open)}><Images size={14}/>{pickerOpen ? 'Chiudi libreria' : selected ? 'Cambia immagine' : 'Scegli immagine'}</button>{value && <button type="button" className="image-picker-clear" onClick={() => { onChange(''); closePicker() }}><X size={13}/>Rimuovi</button>}</div></div>
    </div>
    {pickerOpen && <div className="image-picker-panel"><label className="image-picker-search"><Search size={15}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && closePicker()} placeholder="Cerca per nome o percorso…" aria-label={`Cerca immagini per ${fieldName}`}/><span>{filteredAssets.length} / {assets.length}</span></label>{filteredAssets.length ? <div className="image-picker-grid" aria-label="Risultati nella libreria immagini">{filteredAssets.map((asset) => { const isSelected = normalizeAssetReference(value) === asset.path; return <button type="button" key={asset.path} className={`image-picker-option ${isSelected ? 'selected' : ''}`} onClick={() => chooseAsset(asset)} title={asset.path} aria-pressed={isSelected}>{asset.previewUrl ? <img src={asset.previewUrl} alt=""/> : <span className="image-picker-option-placeholder"><FileImage size={18}/></span>}<span className="image-picker-option-name">{asset.name}</span>{isSelected && <Check size={14}/>}</button>})}</div> : <div className="image-picker-empty">{assets.length ? 'Nessuna immagine corrisponde alla ricerca.' : 'Aggiungi prima le immagini nella sezione Asset di progetto.'}</div>}</div>}
  </div>
}

function variableTagList(variables: ProjectVariable[]) { return [...new Set(variables.flatMap((variable) => variable.studioTags ?? []).map((tag) => tag.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it')) }

function VariableTagPicker({ tags, selected, onChange, className = '' }: { tags: string[]; selected: string[]; onChange: (next: string[]) => void; className?: string }) {
  const toggle = (tag: string) => onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag])
  return <div className={`variable-tag-picker ${className}`}><span className="variable-tag-picker-label">TAG VARIABILI <small>{selected.length ? `${selected.length} selezionati` : 'tutte le variabili'}</small></span>{tags.length ? <div className="variable-tag-chips">{tags.map((tag) => <button type="button" key={tag} className={selected.includes(tag) ? 'selected' : ''} aria-pressed={selected.includes(tag)} onClick={() => toggle(tag)}>{tag}</button>)}</div> : <span className="variable-tag-empty">Assegna tag alle variabili per poterle filtrare qui.</span>}</div>
}

function VariableField({ variables, tags, value, projectPath, hasRules = false, onChange }: { variables: ProjectVariable[]; tags: string[]; value: string; projectPath: string; hasRules?: boolean; onChange?: (value: string) => void }) {
  const available = tags.length ? variables.filter((variable) => (variable.studioTags ?? []).some((tag) => tags.some((chosen) => chosen.toLocaleLowerCase() === tag.toLocaleLowerCase()))) : variables
  const storedCode = value.match(/^\{\s*(.*?)\s*\}$/)?.[1] ?? value
  const current = variables.find((variable) => variable.code.toLocaleLowerCase() === storedCode.toLocaleLowerCase())
  const currentAvailable = current && available.some((variable) => variable.code.toLocaleLowerCase() === current.code.toLocaleLowerCase())
  return <div className="variable-field">{hasRules ? <div className="variable-field-readonly"><span className="variable-field-token">{current ? `{${current.code}}` : value || 'Nessuna regola attiva'}</span>{current?.replacement && <small>{current.replacement}</small>}</div> : <div className="variable-field-select"><select aria-label="Variabile assegnata" value={current?.code ?? (current ? '' : storedCode)} onChange={(event) => onChange?.(event.target.value ? `{${event.target.value}}` : '')}><option value="">Seleziona una variabile…</option>{!current && storedCode && <option value={storedCode}>{storedCode} · non trovata nel progetto</option>}{current && !currentAvailable && <option value={current.code}>{`{${current.code}}`} · fuori dai tag scelti</option>}{available.map((variable) => <option key={variable.code} value={variable.code}>{`{${variable.code}}`} · {variable.replacement}</option>)}</select><ChevronDown size={14}/></div>}{current?.studioType === 'icon' && <div className="variable-field-icon"><IconPreview reference={current.replacement} projectPath={projectPath}/><span>{current.replacement}</span></div>}<small>{hasRules ? `Calcolata automaticamente${tags.length ? ` · tag: ${tags.join(', ')}` : ''}` : tags.length ? `Scegli una variabile con tag: ${tags.join(', ')}` : 'Scegli una variabile dal progetto.'}</small>{current && !currentAvailable && <small className="variable-field-empty">La variabile attuale non rientra nei tag scelti.</small>}</div>
}

function VariablesPage({ variables, projectPath, onSave, onDirty }: { variables: ProjectVariable[]; projectPath: string; onSave: (variables: ProjectVariable[]) => Promise<void>; onDirty: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<ProjectVariable[]>(variables)
  const [saveError, setSaveError] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(variables)
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
  const duplicateCode = draft.find((variable, index) => variable.code.trim() && draft.findIndex((other) => other.code.trim().toLocaleLowerCase() === variable.code.trim().toLocaleLowerCase()) !== index)
  const update = (index: number, patch: Partial<ProjectVariable>) => setDraft((current) => current.map((variable, itemIndex) => itemIndex === index ? { ...variable, ...patch } : variable))
  const add = () => { setDraft((current) => [...current, { code: '', replacement: '', force_tint: 'False', color: '#FFFFFFFF', studioTags: [], studioType: 'text' }]); setSaveError('') }
  const save = async () => {
    if (draft.some((variable) => !variable.code.trim())) { setSaveError('Ogni variabile deve avere un codice.'); return }
    if (duplicateCode) { setSaveError(`Il codice “${duplicateCode.code}” è già presente.`); return }
    setSaveError('')
    try { await onSave(draft.map((variable) => ({ ...variable, code: variable.code.trim(), studioTags: [...new Set((variable.studioTags ?? []).map((tag) => tag.trim()).filter(Boolean))], studioType: variable.studioType ?? 'text' }))) }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Non è stato possibile salvare variables.json.') }
  }
  const cancel = () => { setDraft(variables); setSaveError(''); onDirty(false) }
  const setTags = (index: number, value: string) => update(index, { studioTags: [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))] })
  return <div className="page-content variables-page"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>DATA · VARIABLES.JSON</div><h1>Variabili<span className="heading-period">.</span></h1><p>Crea e organizza le variabili usate nei pannelli di Tabletop Creator.</p></div><button className="button button-primary add-button" onClick={add}><Plus size={16}/>Nuova variabile</button></div>
    <section className="variables-intro"><Braces size={20}/><div><strong>Codice e sostituzione</strong><p>Il codice viene richiamato nelle carte come <code>{'{codice}'}</code>. I tag limitano le opzioni dei campi variabile; “Icona” mostra l’anteprima della sostituzione e “Colore salvato” la aggiunge alla palette.</p></div><span>{draft.length} VARIABILI</span></section>
    {draft.length ? <div className="variable-list">{draft.map((variable, index) => <article className="variable-card" key={`${variable.code}-${index}`}><div className="variable-card-index">{String(index + 1).padStart(2, '0')}</div><div className="variable-card-main"><div className="variable-card-fields"><label><span>CODICE</span><input value={variable.code} onChange={(event) => update(index, { code: event.target.value })} placeholder="es. costo"/></label><label><span>TIPO CARD STUDIO</span><select value={variable.studioType ?? 'text'} onChange={(event) => update(index, { studioType: event.target.value as ProjectVariable['studioType'], color: event.target.value === 'color' ? variable.color || '#FFFFFFFF' : variable.color })}><option value="text">Testo</option><option value="color">Colore salvato</option><option value="icon">Icona</option></select></label><label><span>SOSTITUZIONE</span><textarea rows={2} value={variable.replacement} onChange={(event) => update(index, { replacement: event.target.value })} placeholder={variable.studioType === 'icon' ? 'ID icona o nome file, es. Gui/plain-circle o larva.png' : 'Testo, colore o ID icona Tabletop Creator'}/>{variable.studioType === 'icon' && <div className="variable-icon-preview"><IconPreview reference={variable.replacement} projectPath={projectPath}/><span>Anteprima: {variable.replacement || 'inserisci un ID icona'}</span></div>}</label></div><div className="variable-card-settings"><label className="variable-force-tint"><input type="checkbox" checked={(variable.force_tint ?? 'False').toLocaleLowerCase() === 'true'} onChange={(event) => update(index, { force_tint: event.target.checked ? 'True' : 'False' })}/><span>Forza tinta</span></label><label className="variable-color"><span>COLORE</span><input type="color" value={/^#[0-9a-f]{6}/i.test(variable.color ?? '') ? variable.color!.slice(0, 7) : '#ffffff'} onChange={(event) => { const alpha = /^#[0-9a-f]{8}$/i.test(variable.color ?? '') ? variable.color!.slice(7) : 'FF'; update(index, { color: `${event.target.value}${alpha}` }) }}/><input value={variable.color ?? ''} onChange={(event) => update(index, { color: event.target.value })} placeholder="#FFFFFFFF" aria-label={`Codice colore per ${variable.code || 'nuova variabile'}`}/></label><button className="icon-button variable-delete" onClick={() => { setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index)); setSaveError('') }} aria-label={`Rimuovi variabile ${variable.code || index + 1}`} title="Rimuovi variabile"><X size={15}/></button></div><label className="variable-tags-edit"><span>TAG DELLA VARIABILE <small>separati da virgola</small></span><input value={(variable.studioTags ?? []).join(', ')} onChange={(event) => setTags(index, event.target.value)} placeholder="es. costo, risorsa, rarità"/><div className="variable-tags-preview">{(variable.studioTags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div></label></div></article>)}</div> : <div className="variables-empty"><Braces size={23}/><strong>Nessuna variabile nel progetto.</strong><span>Aggiungi una variabile per creare il primo campo riutilizzabile.</span><button className="button button-quiet" onClick={add}><Plus size={14}/>Crea variabile</button></div>}
    <div className="variables-footer"><span className={saveError ? 'variables-error' : dirty ? 'unsaved-note' : ''}>{saveError || (dirty ? 'Modifiche non salvate' : `Sincronizzate con ${variables.length ? 'data/variables.json' : 'il progetto'}`)}</span><div><button className="text-button" onClick={cancel} disabled={!dirty}>Annulla</button><button className="button button-primary" onClick={() => void save()} disabled={!dirty || Boolean(duplicateCode) || draft.some((variable) => !variable.code.trim())}><Check size={14}/>Salva variabili</button></div></div>
  </div>
}

function ColumnsPage({ columns, assets, variables, onSave, onDirty, onExport }: { columns: ColumnDefinition[]; assets: ProjectAsset[]; variables: ProjectVariable[]; onSave: (columns: ColumnDefinition[]) => void; onDirty: (dirty: boolean) => void; onExport: () => void }) {
  const [draftColumns, setDraftColumns] = useState(columns)
  const dirty = JSON.stringify(draftColumns) !== JSON.stringify(columns)
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<NonNullable<ColumnDefinition['type']>>('text')
  const [fieldOptions, setFieldOptions] = useState('')
  const [fieldVariableTags, setFieldVariableTags] = useState<string[]>([])
  const [dragColumnId, setDragColumnId] = useState<string | null>(null)
  const [dropColumnId, setDropColumnId] = useState<string | null>(null)
  const addField = () => {
    const label = fieldLabel.trim()
    if (!label) return
    const baseId = slug(label)
    const id = draftColumns.some((column) => column.fieldId === baseId) ? `${baseId}_${draftColumns.length + 1}` : baseId
    setDraftColumns([...draftColumns, { id: `column_${id}`, header: label, fieldId: id, type: fieldType, options: fieldType === 'select' ? fieldOptions.split(',').map((item) => item.trim()).filter(Boolean) : undefined, variableTags: fieldType === 'variable' ? fieldVariableTags : undefined }])
    setFieldLabel(''); setFieldOptions(''); setFieldVariableTags([])
  }
  const edit = (id: string, patch: Partial<ColumnDefinition>) => setDraftColumns(draftColumns.map((column) => column.id === id ? { ...column, ...patch } : column))
  const remove = (id: string) => setDraftColumns(draftColumns.filter((column) => column.id !== id))
  const allVariableTags = variableTagList(variables)
  const automaticFields = draftColumns.filter((column) => column.rules?.length)
  const automaticRuleCount = automaticFields.reduce((sum, column) => sum + (column.rules?.length ?? 0), 0)
  const hiddenFieldCount = draftColumns.filter((column) => column.hidden).length
  const fields = [...metaFields, ...draftColumns.filter((column) => !metaFields.some((meta) => meta.id === column.fieldId)).map((column) => ({ id: column.fieldId, label: column.header }))]
  const reorder = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) { setDragColumnId(null); setDropColumnId(null); return }
    const from = draftColumns.findIndex((column) => column.id === dragColumnId)
    const to = draftColumns.findIndex((column) => column.id === targetId)
    if (from < 0 || to < 0) return
    const next = [...draftColumns]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraftColumns(next)
    setDragColumnId(null); setDropColumnId(null)
  }
  const moveByKeyboard = (from: number, to: number) => {
    if (to < 0 || to >= draftColumns.length || from === to) return
    const next = [...draftColumns]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setDraftColumns(next)
  }
  return <div className="page-content columns-content"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>CAMPI DEL SET</div><h1>Campi e colonne<span className="heading-period">.</span></h1><p>Definisci come raccogliere i dati e come esportarli in Excel.</p></div><button className="button button-primary add-button" onClick={onExport} disabled={dirty} title={dirty ? "Salva i campi prima di esportare" : "Esporta set"}><ArrowDownToLine size={16}/>Esporta set</button></div><section className="schema-intro"><div className="schema-icon"><FileSpreadsheet size={20}/></div><div><strong>Ogni set può avere il suo formato.</strong><p>Abbina l’intestazione che Tabletop Creator si aspetta al campo da compilare. Scegli testo, numero, select, immagine o una variabile filtrata per tag.</p></div><div className="schema-badge"><span className="live-dot"/>{draftColumns.length} CAMPI</div></section>{(automaticRuleCount > 0 || hiddenFieldCount > 0) && <section className="automation-summary" aria-label="Riepilogo automazioni e visibilità"><span className="automation-summary-icon"><Sparkles size={16}/></span><span className="automation-summary-copy"><strong>{automaticRuleCount > 0 ? `${automaticRuleCount} ${automaticRuleCount === 1 ? 'regola automatica' : 'regole automatiche'} in ${automaticFields.length} ${automaticFields.length === 1 ? 'campo' : 'campi'}` : `${hiddenFieldCount} ${hiddenFieldCount === 1 ? 'campo nascosto' : 'campi nascosti'}`}</strong><small>{hiddenFieldCount > 0 ? `${hiddenFieldCount} ${hiddenFieldCount === 1 ? 'campo nascosto nell’editor carte' : 'campi nascosti nell’editor carte'}` : 'I campi automatici si aggiornano quando cambiano le sorgenti.'}</small></span>{hiddenFieldCount > 0 && <span className="automation-summary-hidden"><EyeOff size={12}/>{hiddenFieldCount} nascosti</span>}</section>}<div className="schema-title-row"><div><h2>Struttura del foglio</h2><span>Trascina la presa per riordinare · Alt + ↑/↓ da tastiera · {dirty ? "modifiche non salvate" : "struttura salvata"}</span></div><span className="schema-index">{String(draftColumns.length).padStart(2, '0')} CAMPI</span></div><div className="schema-list"><div className="schema-list-head"><span>INTESTAZIONE EXCEL</span><span>CAMPO CARTA / TIPO</span><span/></div>{draftColumns.map((column, index) => <div className={`schema-row ${dragColumnId === column.id ? 'dragging' : ''} ${dropColumnId === column.id && dragColumnId !== column.id ? 'drop-target' : ''} ${column.rules?.length || column.hidden || column.defaultValue ? 'has-conditions' : ''}`} key={column.id} onDragOver={(event) => { event.preventDefault(); setDropColumnId(column.id) }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); reorder(column.id) }}><button type="button" className="schema-drag-handle" draggable aria-label={`Sposta ${column.header}. Usa Alt più freccia su o giù per riordinare.`} title="Trascina per riordinare · Alt + ↑/↓ da tastiera" onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', column.id); setDragColumnId(column.id); setDropColumnId(null) }} onDragEnd={() => { setDragColumnId(null); setDropColumnId(null) }} onKeyDown={(event) => { if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return; event.preventDefault(); moveByKeyboard(index, index + (event.key === 'ArrowUp' ? -1 : 1)) }}><GripVertical size={15}/></button><span className="schema-number">{String(index + 1).padStart(2, '0')}</span><div className="schema-header-cell"><input className="header-input" value={column.header} onChange={(event) => edit(column.id, { header: event.target.value })} aria-label="Intestazione Excel"/>{column.rules?.length ? <span className="schema-condition-badge" title={`${column.rules.length} regole automatiche`}><Sparkles size={11}/>{column.rules.length} {column.rules.length === 1 ? 'regola' : 'regole'}</span> : null}{column.hidden ? <span className="schema-hidden-badge" title="Campo nascosto nell’editor carte"><EyeOff size={11}/>Nascosto</span> : null}{column.defaultValue ? <span className="schema-default-badge" title={`Valore predefinito: ${column.defaultValue}`}>Default</span> : null}</div><span className="mapping-arrow"><ArrowRight size={15}/></span><label className="mapping-select"><select value={column.fieldId} onChange={(event) => edit(column.id, { fieldId: event.target.value })}>{fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select><ChevronDown size={14}/></label><select className="field-type-select" value={column.type ?? 'text'} onChange={(event) => edit(column.id, { type: event.target.value as ColumnDefinition['type'] })}><option value="text">Testo</option><option value="longtext">Testo lungo</option><option value="number">Numero</option><option value="select">Select</option><option value="image">Immagine</option><option value="variable">Variabile</option><option value="color">Colore</option></select><button className="icon-button remove-column" onClick={() => remove(column.id)} aria-label={`Rimuovi ${column.header}`}><X size={15}/></button>{column.type === 'select' && <input className="choice-options schema-options" value={(column.options ?? []).join(', ')} placeholder="opzioni separate da virgola" onChange={(event) => edit(column.id, { options: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}/>}{column.type === 'variable' && <VariableTagPicker className="schema-options" tags={allVariableTags} selected={column.variableTags ?? []} onChange={(next) => edit(column.id, { variableTags: next })}/>}<ConditionalRulesEditor column={column} columns={draftColumns} variables={variables} onChange={(patch) => edit(column.id, patch)}/><DefaultValueEditor column={column} assets={assets} variables={variables} onChange={(patch) => edit(column.id, patch)}/></div>)}{!draftColumns.length && <div className="schema-empty">Aggiungi un campo per definire questo foglio.</div>}</div><div className="add-column add-field-composer"><div className="add-column-icon"><Plus size={17}/></div><div className="add-column-copy"><strong>Nuovo campo per le carte</strong><span>Testo, select, colore, immagine o variabile con regole automatiche.</span></div><div className="add-column-control"><input value={fieldLabel} onChange={(event) => setFieldLabel(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addField()} placeholder="es. Rarità, costo, illustrazione"/><select value={fieldType} onChange={(event) => setFieldType(event.target.value as NonNullable<ColumnDefinition['type']>)}><option value="text">Testo</option><option value="longtext">Testo lungo</option><option value="number">Numero</option><option value="select">Select</option><option value="image">Immagine</option><option value="variable">Variabile</option><option value="color">Colore</option></select><button className="button button-dark" onClick={addField}><Plus size={15}/>Aggiungi</button></div>{fieldType === 'select' && <input className="choice-options composer-options" value={fieldOptions} onChange={(event) => setFieldOptions(event.target.value)} placeholder="opzioni per la select, separate da virgola"/>}{fieldType === 'variable' && <VariableTagPicker className="variable-composer-tags" tags={allVariableTags} selected={fieldVariableTags} onChange={setFieldVariableTags}/>}</div><div className="schema-bottom"><div className={dirty ? "unsaved-note" : ""}><span className="tiny-check"><Check size={11}/></span>{dirty ? "Modifiche non salvate" : "Struttura salvata nel progetto"}</div><div className="column-draft-actions"><button className="text-button" onClick={() => { setDraftColumns(columns); onDirty(false) }} disabled={!dirty}>Annulla</button><button className="button button-primary" onClick={() => { onSave(draftColumns); onDirty(false) }} disabled={!dirty}><Check size={14}/>Salva modifiche</button><button className="text-button" onClick={onExport} disabled={dirty}><FileSpreadsheet size={15}/>Esporta questo set<ArrowRight size={14}/></button></div></div></div>
}

function StatisticsPage({ cards, columns }: { cards: Card[]; columns: ColumnDefinition[] }) {
  const dimensions = [
    { id: 'meta_tags', label: 'Tag delle carte', type: 'tags' },
    { id: 'meta_status', label: 'Stato di lavorazione', type: 'category' },
    { id: 'meta_quantity', label: 'Quantità per carta', type: 'number' },
    ...columns.filter((column) => !['meta_title', 'meta_quantity', 'meta_status', 'meta_tags'].includes(column.fieldId) && column.type !== 'image')
      .filter((column, index, all) => all.findIndex((item) => item.fieldId === column.fieldId) === index)
      .map((column) => ({ id: column.fieldId, label: column.header, type: column.type === 'number' ? 'number' : 'category' })),
  ]
  const [fieldId, setFieldId] = useState('meta_tags')
  const [groupBy, setGroupBy] = useState('')
  const [measure, setMeasure] = useState<'cards' | 'copies'>('cards')
  const dimension = dimensions.find((item) => item.id === fieldId) ?? dimensions[0]
  const groupDimension = dimensions.find((item) => item.id === groupBy && item.id !== fieldId)
  const distribution = useMemo(() => makeDistribution(cards, fieldId, dimension?.type ?? 'tags', groupDimension?.id, groupDimension?.type), [cards, fieldId, dimension?.type, groupDimension?.id, groupDimension?.type])
  const totalCopies = cards.reduce((sum, card) => sum + (Number.isFinite(card.quantity) ? card.quantity : 0), 0)
  const uniqueTags = new Set(cards.flatMap((card) => card.tags)).size
  const maximum = Math.max(...distribution.map((item) => measure === 'cards' ? item.count : item.copies), 1)
  const denominator = measure === 'cards' ? cards.length : totalCopies
  const visible = distribution.slice(0, 12)
  return <div className="page-content stats-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>ANALISI DEL SET</div><h1>Statistiche<span className="heading-period">.</span></h1><p>Esplora tag e proprietà delle {cards.length} carte del set attivo.</p></div><div className="stats-controls"><label className="stats-dimension-select"><span>ANALIZZA PER</span><div><select value={fieldId} onChange={(event) => setFieldId(event.target.value)}>{dimensions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={14}/></div></label><label className="stats-dimension-select"><span>INCROCIA CON</span><div><select value={groupDimension?.id ?? ''} onChange={(event) => setGroupBy(event.target.value)}><option value="">Nessun incrocio</option>{dimensions.filter((item) => item.id !== fieldId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={14}/></div></label></div></div>
    <section className="stats-summary"><div><span className="metric-label">CARTE NEL SET</span><strong>{cards.length}</strong></div><div><span className="metric-label">COPIE TOTALI</span><strong>{totalCopies}</strong></div><div><span className="metric-label">TAG UNICI</span><strong>{uniqueTags}</strong></div><div className="stats-summary-note"><BarChart3 size={17}/><span>Distribuzione basata sui dati<br/>delle carte salvate nel set.</span></div></section>
    <section className="distribution-panel"><div className="distribution-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>DISTRIBUZIONE</div><h2>{dimension?.label ?? 'Valori'}{groupDimension ? ` × ${groupDimension.label}` : ''}</h2><p>{groupDimension ? `Incrocio tra ${dimension?.label.toLowerCase()} e ${groupDimension.label.toLowerCase()}. ` : ''}{fieldId === 'meta_tags' ? 'Una carta con più tag compare in ogni tag assegnato.' : dimension?.type === 'number' && !groupDimension ? 'Le proprietà numeriche sono raggruppate per valore o intervallo.' : 'Conteggio delle carte per ciascun valore.'} La misura selezionata considera {measure === 'cards' ? 'carte uniche' : 'copie (quantità delle carte)'}.</p></div><div className="distribution-tools"><div className="stats-measure-toggle" role="group" aria-label="Misura del grafico"><button className={measure === 'cards' ? 'active' : ''} onClick={() => setMeasure('cards')}>Carte uniche</button><button className={measure === 'copies' ? 'active' : ''} onClick={() => setMeasure('copies')}>Copie</button></div><span className="distribution-total">{distribution.length} {distribution.length === 1 ? 'valore' : 'valori'}</span></div></div>{visible.length ? <div className="distribution-chart">{visible.map((item) => <div className="distribution-row" key={item.label}><span className="distribution-label" title={item.label}>{item.label}</span><div className="distribution-track"><span style={{ width: `${Math.max((measure === 'cards' ? item.count : item.copies) / maximum * 100, (measure === 'cards' ? item.count : item.copies) ? 1.5 : 0)}%` }}/></div><strong>{measure === 'cards' ? item.count : item.copies}</strong><small>{denominator ? `${Math.round((measure === 'cards' ? item.count : item.copies) / denominator * 100)}%` : '0%'}</small></div>)}{distribution.length > visible.length && <div className="chart-overflow">Mostrati i primi 12 di {distribution.length} valori</div>}</div> : <div className="stats-empty"><BarChart3 size={21}/><strong>Nessun dato da rappresentare.</strong><span>Compila questo campo in una o più carte per generare il grafico.</span></div>}</section>
    <div className="stats-foot"><span><span className="live-dot"/>DATI DEL SET ATTIVO</span><span>Le modifiche alle carte aggiornano automaticamente queste statistiche.</span></div>
  </div>
}

function makeDistribution(cards: Card[], fieldId: string, type: string, groupId?: string, groupType?: string) {
  type Row = { label: string; count: number; copies: number }
  const getValues = (card: Card, id: string, valueType?: string): string[] => {
    if (id === 'meta_tags') return card.tags.length ? [...new Set(card.tags)] : ['(Senza tag)']
    if (id === 'meta_status') return [card.status || '(Vuoto)']
    if (id === 'meta_quantity') return [String(card.quantity)]
    const raw = card.values[id]?.trim() ?? ''
    if (!raw) return ['(Vuoto)']
    if (valueType === 'number' && Number.isFinite(Number(raw))) return [String(Number(raw))]
    return [raw]
  }

  // Without an intersection, retain the compact histogram for high-cardinality numeric fields.
  if (type === 'number' && !groupId) {
    const numeric = cards.map((card) => fieldId === 'meta_quantity' ? card.quantity : card.values[fieldId]?.trim() ? Number(card.values[fieldId]) : Number.NaN).filter(Number.isFinite)
    if (!numeric.length) return [] as Row[]
    const distinct = [...new Set(numeric)].sort((a, b) => a - b)
    if (distinct.length <= 8) return distinct.map((value) => {
      const matching = cards.filter((card) => (fieldId === 'meta_quantity' ? card.quantity : Number(card.values[fieldId])) === value)
      return { label: String(value), count: matching.length, copies: matching.reduce((sum, card) => sum + Math.max(0, card.quantity), 0) }
    }).sort((a, b) => b.count - a.count || Number(a.label) - Number(b.label))
    const min = distinct[0], max = distinct[distinct.length - 1]
    const bucketCount = Math.min(8, Math.ceil(Math.sqrt(numeric.length)))
    const size = (max - min) / bucketCount || 1
    return Array.from({ length: bucketCount }, (_, index) => {
      const low = min + index * size
      const high = index === bucketCount - 1 ? max : min + (index + 1) * size
      const matching = cards.filter((card) => {
        const value = fieldId === 'meta_quantity' ? card.quantity : card.values[fieldId]?.trim() ? Number(card.values[fieldId]) : Number.NaN
        return Number.isFinite(value) && (index === bucketCount - 1 ? value >= low && value <= high : value >= low && value < high)
      })
      return { label: `${formatNumber(low)} – ${formatNumber(high)}`, count: matching.length, copies: matching.reduce((sum, card) => sum + Math.max(0, card.quantity), 0) }
    }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count)
  }

  const rows = new Map<string, Row>()
  for (const card of cards) {
    const primary = getValues(card, fieldId, type)
    const secondary = groupId ? getValues(card, groupId, groupType) : ['']
    for (const value of primary) for (const group of secondary) {
      const label = group ? `${value} · ${group}` : value
      const key = JSON.stringify([value, group])
      const row = rows.get(key) ?? { label, count: 0, copies: 0 }
      row.count += 1
      row.copies += Math.max(0, card.quantity)
      rows.set(key, row)
    }
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'it'))
}

function formatNumber(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(1) }

function GitHubPage({ status, onRefresh, onInit, onConnect, onCommit, onPull, onPush, onOpenGitHub }: {
  status: GitStatus | null
  onRefresh: () => Promise<void>
  onInit: () => Promise<void>
  onConnect: (url: string) => Promise<void>
  onCommit: (message: string) => Promise<void>
  onPull: () => Promise<void>
  onPush: () => Promise<void>
  onOpenGitHub: () => void
}) {
  const [remote, setRemote] = useState(status?.remoteUrl ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const perform = async (action: () => Promise<void>) => { setBusy(true); await action(); setBusy(false) }
  const commit = async () => { await perform(() => onCommit(message)); if (!status?.error) setMessage('') }
  const changed = status?.changedFiles.length ?? 0
  return <div className="page-content github-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/>VERSIONE E SINCRONIZZAZIONE</div><h1>GitHub<span className="heading-period">.</span></h1><p>Collega la cartella del progetto al repository e gestisci le modifiche da qui.</p></div><button className="button button-quiet" onClick={() => void perform(onRefresh)} disabled={busy}><RefreshCw size={15} className={busy ? 'spin-icon' : ''}/>Aggiorna stato</button></div>
    {!status ? <div className="github-loading"><RefreshCw size={17} className="spin-icon"/>Controllo il repository Git locale…</div> : !status.isRepo ? <section className="git-connect-card"><div className="git-connect-mark"><Github size={22}/></div><div className="git-connect-copy"><h2>Collega questo progetto a GitHub</h2><p>Il progetto non è ancora un repository Git. Inizia il repository locale, poi aggiungi l’indirizzo del repository GitHub.</p></div><button className="button button-dark" onClick={() => void perform(onInit)} disabled={busy}><GitBranch size={15}/>Inizializza Git</button></section> : <>
      <section className="git-repo-card"><div className="git-repo-mark"><Github size={21}/></div><div className="git-repo-details"><span className="metric-label">REPOSITORY LOCALE</span><strong>{status.branch || 'HEAD scollegato'}</strong><small>{status.remoteUrl || 'Nessun remote configurato'}</small></div><div className="git-repo-indicator"><span className={`live-dot ${changed ? 'git-dirty-dot' : ''}`}/>{changed ? `${changed} modifiche locali` : 'Cartella pulita'}</div>{status.githubUrl && <button className="button button-quiet github-open" onClick={onOpenGitHub}><ExternalLink size={14}/>Apri su GitHub</button>}</section>
      {!status.remoteUrl && <section className="git-remote-form"><div><strong>Aggiungi repository remoto</strong><p>Incolla l’indirizzo HTTPS o SSH del repository GitHub.</p></div><div className="remote-input-row"><input value={remote} onChange={(event) => setRemote(event.target.value)} placeholder="https://github.com/utente/progetto.git"/><button className="button button-dark" onClick={() => void perform(() => onConnect(remote))} disabled={busy || !remote.trim()}><Github size={15}/>Collega GitHub</button></div></section>}
      {status.remoteUrl && <section className="git-sync-strip"><div className="sync-remote"><span className="metric-label">REMOTE · ORIGIN</span><strong>{status.remoteUrl}</strong></div><div className="sync-count"><Upload size={15}/><b>{status.ahead}</b><span>da inviare</span></div><div className="sync-count"><Download size={15}/><b>{status.behind}</b><span>da ricevere</span></div><div className="sync-actions"><button className="button button-quiet" onClick={() => void perform(onPull)} disabled={busy}><Download size={14}/>Pull</button><button className="button button-primary" onClick={() => void perform(onPush)} disabled={busy}><Upload size={14}/>Push</button></div></section>}
      {status.error && <div className="git-error"><CircleAlert size={15}/><span>{status.error}</span></div>}
      <div className="git-workspace-grid"><section className="git-changes"><div className="git-section-heading"><div><h2>Modifiche locali</h2><span>{changed} file nel repository</span></div><span className={`changes-count ${changed ? 'changed' : ''}`}>{String(changed).padStart(2, '0')}</span></div>{changed ? <><div className="git-file-list">{status.changedFiles.map((file) => <div className="git-file-row" key={`${file.status}:${file.path}`}><span className={`git-file-status status-${(file.status === '??' ? 'new' : file.status.replace(/[^A-Z]/g, '').toLowerCase() || 'm')}`}>{file.status}</span><span>{file.path}</span></div>)}</div><div className="git-commit-form"><label htmlFor="commit-message">MESSAGGIO DEL COMMIT</label><div><input id="commit-message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && message.trim() && void commit()} placeholder="es. Aggiorna carte del set base"/><button className="button button-dark" onClick={() => void commit()} disabled={busy || !message.trim()}><Check size={15}/>Commit</button></div><small>Il commit include tutte le modifiche presenti nella cartella del progetto.</small></div></> : <div className="git-clean-state"><Check size={17}/><span>Non ci sono modifiche da registrare.</span></div>}</section><section className="git-history"><div className="git-section-heading"><div><h2>Commit recenti</h2><span>{status.branch || 'Branch corrente'}</span></div><GitBranch size={16}/></div>{status.commits.length ? <div className="commit-list">{status.commits.map((commit) => <div className="commit-row" key={commit.hash}><code>{commit.hash}</code><span>{commit.subject}</span><small>{commit.age}</small></div>)}</div> : <div className="git-clean-state">Nessun commit in questo repository.</div>}</section></div>
      <div className="git-auth-note"><CircleHelp size={14}/><span>L’autenticazione passa da Git e dalle credenziali già configurate sul computer. L’app non salva password o token GitHub.</span></div>
    </>}
  </div>
}

export default App
