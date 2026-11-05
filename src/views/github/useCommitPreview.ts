import { useState } from 'react'
import type { GitCommitFile } from '../../types'
import type { GitHubPageProps } from './types'

/** Read-only snapshot browser state: selected commit, its file list and the file being viewed. */
export function useCommitPreview(
  onCommitFiles: GitHubPageProps['onCommitFiles'],
  onCommitFile: GitHubPageProps['onCommitFile'],
) {
  const [previewCommit, setPreviewCommit] = useState<string | null>(null)
  const [previewFiles, setPreviewFiles] = useState<string[]>([])
  const [previewFile, setPreviewFile] = useState<GitCommitFile | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const openCommit = async (hash: string) => {
    setPreviewCommit(hash)
    setPreviewBusy(true)
    setPreviewFile(null)
    try {
      const files = await onCommitFiles(hash)
      setPreviewFiles(files)
      if (files[0]) setPreviewFile(await onCommitFile(hash, files[0]))
    } finally {
      setPreviewBusy(false)
    }
  }
  const selectSnapshotFile = async (file: string) => {
    if (!previewCommit) return
    setPreviewBusy(true)
    try {
      setPreviewFile(await onCommitFile(previewCommit, file))
    } finally {
      setPreviewBusy(false)
    }
  }
  const closePreview = () => setPreviewCommit(null)
  return { previewCommit, previewFiles, previewFile, previewBusy, openCommit, selectSnapshotFile, closePreview }
}
