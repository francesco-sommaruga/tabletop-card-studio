import type { ProjectSnapshot } from '../src/types'
import { state } from './state'

export function activeSet() {
  return state.sets.find((set) => set.id === state.activeSetId) ?? null
}

export function snapshot(): ProjectSnapshot {
  const current = activeSet()
  return {
    projectPath: state.activeProject,
    projectName: state.projectName,
    cards: current?.cards ?? [],
    columns: current?.columns ?? [],
    sets: state.sets.map(({ id, name, sourceFile, nativeSetFile, nativeSetIndex, blueprintName, cards }) => ({
      id,
      name,
      sourceFile,
      nativeSetFile,
      nativeSetIndex,
      blueprintName,
      cardCount: cards.length,
    })),
    activeSetId: state.activeSetId,
    workbooks: state.workbooks,
    assets: state.assets,
    variables: state.variables,
    blueprints: state.blueprints,
    nativeSets: state.nativeSets,
  }
}
